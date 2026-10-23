-- =============================================================================
-- Migración: Corrección de sobrecargas de RPCs de grupos/cuadros y aislamiento estricto de categorías
-- Elimina las sobrecargas obsoletas de 2 parámetros que causaban PGRST203 o pérdida de category_id,
-- garantiza que apply_bracket y apply_groups manejen co-administradores y category_id,
-- y asigna category_id a cualquier equipo que haya quedado huérfano.
-- =============================================================================

-- 1. Eliminar sobrecargas ambiguas de 2 parámetros
drop function if exists public.apply_groups(uuid, jsonb);
drop function if exists public.apply_bracket(uuid, jsonb);

-- 2. Asegurar la RPC canónica apply_bracket(uuid, jsonb, uuid)
create or replace function public.apply_bracket(
  p_tournament_id uuid,
  p_matches jsonb,
  p_category_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament public.tournaments%rowtype;
  v_cat public.tournament_categories%rowtype;
  v_item jsonb;
  v_ids jsonb := '{}'::jsonb;
  v_keys text[] := '{}'::text[];
  v_teams uuid[] := '{}'::uuid[];
  v_team uuid;
  v_key text;
  v_link jsonb;
  v_pending_cats integer;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  if not found or not private.is_tournament_organizer(p_tournament_id) then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este torneo.';
  end if;

  if p_category_id is not null then
    select * into v_cat from public.tournament_categories where id = p_category_id and tournament_id = p_tournament_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'La categoría no pertenece a este torneo.';
    end if;
    if exists (
      select 1 from public.matches
      where tournament_id = p_tournament_id and category_id = p_category_id and stage = 'playoff' and result_status is not null and not is_bye
    ) then
      raise exception using errcode = 'P0001', message = 'Ya hay resultados de playoffs: no se puede rearmar el cuadro.';
    end if;
  else
    if exists (
      select 1 from public.matches
      where tournament_id = p_tournament_id and stage = 'playoff' and result_status is not null and not is_bye
    ) then
      raise exception using errcode = 'P0001', message = 'Ya hay resultados de playoffs: no se puede rearmar el cuadro.';
    end if;
  end if;

  if jsonb_typeof(p_matches) <> 'array' or jsonb_array_length(p_matches) not between 1 and 64 then
    raise exception using errcode = 'P0001', message = 'El cuadro no es válido.';
  end if;

  for v_item in select value from jsonb_array_elements(p_matches) loop
    v_key := v_item ->> 'key';
    if v_key is null or v_key = any(v_keys) then
      raise exception using errcode = 'P0001', message = 'El cuadro tiene partidos repetidos.';
    end if;
    v_keys := v_keys || v_key;
    v_ids := v_ids || jsonb_build_object(v_key, gen_random_uuid());

    if coalesce((v_item ->> 'round')::integer, 0) = 1 then
      foreach v_team in array array_remove(array[(v_item ->> 'home')::uuid, (v_item ->> 'away')::uuid], null) loop
        if v_team = any(v_teams) then
          raise exception using errcode = 'P0001', message = 'Un equipo aparece dos veces en el cuadro.';
        end if;
        v_teams := v_teams || v_team;
      end loop;
    end if;
  end loop;

  -- Reemplazar solo los playoffs de esta categoría o globales
  if p_category_id is not null then
    delete from public.matches where tournament_id = p_tournament_id and category_id = p_category_id and stage = 'playoff';
  else
    delete from public.matches where tournament_id = p_tournament_id and stage = 'playoff';
  end if;

  for v_item in select value from jsonb_array_elements(p_matches) loop
    v_key := v_item ->> 'key';
    insert into public.matches (
      id, tournament_id, category_id, stage, round, position,
      home_team_id, away_team_id, is_bye, is_third_place, winner_team_id,
      result_status
    ) values (
      (v_ids ->> v_key)::uuid, p_tournament_id, p_category_id, 'playoff',
      (v_item ->> 'round')::smallint, (v_item ->> 'position')::smallint,
      (v_item ->> 'home')::uuid, (v_item ->> 'away')::uuid,
      coalesce((v_item ->> 'isBye')::boolean, false),
      coalesce((v_item ->> 'isThirdPlace')::boolean, false),
      case when coalesce((v_item ->> 'isBye')::boolean, false) then (v_item ->> 'winner')::uuid else null end,
      case when coalesce((v_item ->> 'isBye')::boolean, false) then 'confirmed'::public.result_status else null end
    );
  end loop;

  for v_item in select value from jsonb_array_elements(p_matches) loop
    v_key := v_item ->> 'key';
    v_link := v_item -> 'next';
    if v_link is not null and v_link <> 'null'::jsonb then
      update public.matches
      set next_match_id = (v_ids ->> (v_link ->> 'key'))::uuid,
          next_match_side = (v_link ->> 'side')::public.match_side
      where id = (v_ids ->> v_key)::uuid;
    end if;

    v_link := v_item -> 'loserNext';
    if v_link is not null and v_link <> 'null'::jsonb then
      update public.matches
      set loser_next_match_id = (v_ids ->> (v_link ->> 'key'))::uuid,
          loser_next_match_side = (v_link ->> 'side')::public.match_side
      where id = (v_ids ->> v_key)::uuid;
    end if;
  end loop;

  -- Actualizar categoría a playoffs
  if p_category_id is not null and v_cat.status = 'group_stage' then
    update public.tournament_categories set status = 'playoffs', updated_at = now() where id = p_category_id;
  end if;

  -- Actualizar torneo a playoffs si no tiene categorías o si todas las categorías pasaron de grupos
  if v_tournament.status = 'group_stage' then
    if p_category_id is null then
      update public.tournaments set status = 'playoffs', updated_at = now() where id = p_tournament_id;
    else
      select count(*) into v_pending_cats
      from public.tournament_categories
      where tournament_id = p_tournament_id and status in ('draft', 'registration_open', 'group_stage');

      if v_pending_cats = 0 then
        update public.tournaments set status = 'playoffs', updated_at = now() where id = p_tournament_id;
      end if;
    end if;
  end if;
end;
$$;

revoke execute on function public.apply_bracket(uuid, jsonb, uuid) from public, anon;
grant execute on function public.apply_bracket(uuid, jsonb, uuid) to authenticated;

-- 3. Asegurar la RPC canónica apply_groups(uuid, jsonb, uuid)
create or replace function public.apply_groups(
  p_tournament_id uuid,
  p_groups jsonb,
  p_category_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament public.tournaments%rowtype;
  v_cat public.tournament_categories%rowtype;
  v_group jsonb;
  v_match jsonb;
  v_group_id uuid;
  v_position integer := 0;
  v_team_ids uuid[];
  v_all_teams uuid[] := '{}'::uuid[];
  v_approved uuid[];
  v_pairs text[] := '{}'::text[];
  v_home uuid;
  v_away uuid;
  v_pair text;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  if not found or not private.is_tournament_organizer(p_tournament_id) then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este torneo.';
  end if;

  if p_category_id is not null then
    select * into v_cat from public.tournament_categories
    where id = p_category_id and tournament_id = p_tournament_id for update;
    if not found then
      raise exception using errcode = 'P0001', message = 'La categoría no existe en este torneo.';
    end if;
    if v_cat.status not in ('registration_open', 'group_stage') then
      raise exception using errcode = 'P0001', message = 'Los grupos se arman antes o durante la fase de grupos.';
    end if;
    if exists (
      select 1 from public.matches
      where tournament_id = p_tournament_id and category_id = p_category_id and result_status is not null
    ) then
      raise exception using errcode = 'P0001', message = 'Ya hay resultados cargados en esta categoría: no se pueden rearmar los grupos.';
    end if;
  else
    if v_tournament.status not in ('registration_open', 'group_stage') then
      raise exception using errcode = 'P0001', message = 'Los grupos se arman antes o durante la fase de grupos.';
    end if;
    if exists (
      select 1 from public.matches
      where tournament_id = p_tournament_id and result_status is not null
    ) then
      raise exception using errcode = 'P0001', message = 'Ya hay resultados cargados: no se pueden rearmar los grupos.';
    end if;
  end if;

  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) not between 1 and 26 then
    raise exception using errcode = 'P0001', message = 'Tiene que haber entre 1 y 26 grupos.';
  end if;

  if p_category_id is not null then
    select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_approved
    from public.teams
    where tournament_id = p_tournament_id
      and category_id = p_category_id
      and status = 'approved';
  else
    select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_approved
    from public.teams
    where tournament_id = p_tournament_id
      and status = 'approved';
  end if;

  for v_group in select value from jsonb_array_elements(p_groups) loop
    select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_team_ids
    from jsonb_array_elements_text(v_group -> 'teamIds');
    if cardinality(v_team_ids) not between 2 and 5 then
      raise exception using errcode = 'P0001', message = 'Cada grupo tiene que tener entre 2 y 5 parejas.';
    end if;
    v_all_teams := v_all_teams || v_team_ids;
  end loop;

  if (select array_agg(t order by t) from unnest(v_all_teams) as t) is distinct from v_approved
     or cardinality(v_all_teams) <> (select count(distinct t) from unnest(v_all_teams) as t) then
    raise exception using errcode = 'P0001',
      message = 'Los grupos tienen que incluir a todas las inscripciones aprobadas de la categoría, una sola vez cada una.';
  end if;

  -- Reemplazo de la fase de grupos (solo para esta categoría o global)
  if p_category_id is not null then
    delete from public.matches where tournament_id = p_tournament_id and category_id = p_category_id and stage = 'group';
    delete from public.tournament_groups where tournament_id = p_tournament_id and category_id = p_category_id;
  else
    delete from public.matches where tournament_id = p_tournament_id and stage = 'group';
    delete from public.tournament_groups where tournament_id = p_tournament_id;
  end if;

  for v_group in select value from jsonb_array_elements(p_groups) loop
    insert into public.tournament_groups (tournament_id, category_id, name, position)
    values (p_tournament_id, p_category_id, btrim(v_group ->> 'name'), v_position)
    returning id into v_group_id;

    select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_team_ids
    from jsonb_array_elements_text(v_group -> 'teamIds');

    insert into public.group_teams (group_id, team_id, tournament_id, position)
    select v_group_id, t.team_id, p_tournament_id, (t.ord - 1)::smallint
    from unnest(v_team_ids) with ordinality as t (team_id, ord);

    v_pairs := '{}'::text[];
    for v_match in select value from jsonb_array_elements(coalesce(v_group -> 'matches', '[]'::jsonb)) loop
      v_home := (v_match ->> 'home')::uuid;
      v_away := (v_match ->> 'away')::uuid;
      if not (v_home = any(v_team_ids)) or not (v_away = any(v_team_ids)) or v_home = v_away then
        raise exception using errcode = 'P0001', message = 'Hay un partido entre equipos que no son del mismo grupo.';
      end if;
      v_pair := least(v_home::text, v_away::text) || '|' || greatest(v_home::text, v_away::text);
      if v_pair = any(v_pairs) then
        raise exception using errcode = 'P0001', message = 'Hay partidos repetidos en un grupo.';
      end if;
      v_pairs := v_pairs || v_pair;

      insert into public.matches (tournament_id, category_id, stage, group_id, round, position, home_team_id, away_team_id)
      values (
        p_tournament_id, p_category_id, 'group', v_group_id,
        greatest(coalesce((v_match ->> 'round')::integer, 1), 1),
        greatest(coalesce((v_match ->> 'position')::integer, 0), 0),
        v_home, v_away
      );
    end loop;

    v_position := v_position + 1;
  end loop;

  -- Actualizar estado
  if v_tournament.status = 'registration_open' then
    update public.tournaments set status = 'group_stage', updated_at = now() where id = p_tournament_id;
  end if;
  if p_category_id is not null and v_cat.status = 'registration_open' then
    update public.tournament_categories set status = 'group_stage', updated_at = now() where id = p_category_id;
  end if;
end;
$$;

revoke execute on function public.apply_groups(uuid, jsonb, uuid) from public, anon;
grant execute on function public.apply_groups(uuid, jsonb, uuid) to authenticated;

-- 4. Backfill de category_id en equipos que hayan quedado con null
update public.teams t
set category_id = tg.category_id
from public.group_teams gt
join public.tournament_groups tg on tg.id = gt.group_id
where gt.team_id = t.id
  and t.category_id is null
  and tg.category_id is not null;

-- Asignar categoría a gran / grancelli en el torneo t 6ta cfeefefe si aún no tenía
update public.teams
set category_id = (
  select id from public.tournament_categories
  where tournament_id = '29a8f7f0-1630-49ac-a5cc-45d1fee9720a'
    and lower(name) like '%6ta%'
  limit 1
)
where id = 'bedd90aa-47a3-40f0-b3b0-4c934d3d5925'
  and category_id is null;
