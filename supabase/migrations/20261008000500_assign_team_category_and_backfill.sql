-- =============================================================================
-- Asignación de categorías para parejas y migración de parejas huérfanas
-- Permite al organizador asignar o reasignar parejas a categorías, y asegura
-- que los torneos con categorías vinculen correctamente las parejas aprobadas.
-- =============================================================================

-- 1. Función para que el organizador asigne o cambie la categoría de una pareja
create or replace function public.assign_team_category(
  p_team_id uuid,
  p_category_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_team public.teams%rowtype;
  v_tournament public.tournaments%rowtype;
  v_cat public.tournament_categories%rowtype;
begin
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'No se encontró la inscripción.';
  end if;

  select * into v_tournament from public.tournaments where id = v_team.tournament_id;
  if v_tournament.organizer_id <> v_uid then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar esta inscripción.';
  end if;

  if p_category_id is not null then
    select * into v_cat from public.tournament_categories
    where id = p_category_id and tournament_id = v_tournament.id;
    if not found then
      raise exception using errcode = 'P0001', message = 'La categoría no pertenece a este torneo.';
    end if;
  end if;

  update public.teams
  set category_id = p_category_id
  where id = p_team_id;
end;
$$;

revoke execute on function public.assign_team_category(uuid, uuid) from public, anon;
grant execute on function public.assign_team_category(uuid, uuid) to authenticated;

-- 2. Función para asignar todas las parejas sin categoría de un torneo a una categoría
create or replace function public.assign_tournament_teams_category(
  p_tournament_id uuid,
  p_category_id uuid
)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament public.tournaments%rowtype;
  v_cat public.tournament_categories%rowtype;
  v_updated integer;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id;
  if not found or v_tournament.organizer_id <> v_uid then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este torneo.';
  end if;

  select * into v_cat from public.tournament_categories
  where id = p_category_id and tournament_id = p_tournament_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'La categoría no pertenece a este torneo.';
  end if;

  update public.teams
  set category_id = p_category_id
  where tournament_id = p_tournament_id and category_id is null;

  get diagnostics v_updated = row_count;
  return v_updated;
end;
$$;

revoke execute on function public.assign_tournament_teams_category(uuid, uuid) from public, anon;
grant execute on function public.assign_tournament_teams_category(uuid, uuid) to authenticated;

-- 3. Actualizar apply_groups para auto-asignar parejas huérfanas al guardar grupos de una categoría
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
  if not found or v_tournament.organizer_id <> v_uid then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este torneo.';
  end if;

  if p_category_id is not null then
    select * into v_cat from public.tournament_categories where id = p_category_id and tournament_id = p_tournament_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'La categoría no pertenece a este torneo.';
    end if;
    if v_cat.status <> 'group_stage' and v_tournament.status <> 'group_stage' then
      raise exception using errcode = 'P0001', message = 'Los grupos se arman con la categoría en fase de grupos.';
    end if;
    if exists (
      select 1 from public.matches
      where tournament_id = p_tournament_id and category_id = p_category_id and result_status is not null
    ) then
      raise exception using errcode = 'P0001', message = 'Ya hay resultados cargados: no se pueden rearmar los grupos.';
    end if;
  else
    if v_tournament.status <> 'group_stage' then
      raise exception using errcode = 'P0001', message = 'Los grupos se arman con el torneo en fase de grupos.';
    end if;
    if exists (
      select 1 from public.matches where tournament_id = p_tournament_id and result_status is not null
    ) then
      raise exception using errcode = 'P0001', message = 'Ya hay resultados cargados: no se pueden rearmar los grupos.';
    end if;
  end if;

  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) not between 1 and 26 then
    raise exception using errcode = 'P0001', message = 'Tiene que haber entre 1 y 26 grupos.';
  end if;

  -- Auto-asignar parejas sin categoría a p_category_id si el torneo solo tiene 1 categoría
  -- o si esas parejas fueron expresamente incluidas en los grupos enviados.
  if p_category_id is not null then
    update public.teams
    set category_id = p_category_id
    where tournament_id = p_tournament_id
      and category_id is null
      and (
        (select count(*) from public.tournament_categories where tournament_id = p_tournament_id) = 1
        or id in (
          select distinct (jsonb_array_elements_text(g -> 'teamIds'))::uuid
          from jsonb_array_elements(p_groups) g
        )
      );

    select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_approved
    from public.teams where tournament_id = p_tournament_id and category_id = p_category_id and status = 'approved';
  else
    select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_approved
    from public.teams where tournament_id = p_tournament_id and status = 'approved';
  end if;

  for v_group in select value from jsonb_array_elements(p_groups) loop
    select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_team_ids
    from jsonb_array_elements_text(v_group -> 'teamIds');
    if cardinality(v_team_ids) < 2 then
      raise exception using errcode = 'P0001', message = 'Cada grupo tiene que tener al menos 2 equipos.';
    end if;
    v_all_teams := v_all_teams || v_team_ids;
  end loop;

  if (select array_agg(t order by t) from unnest(v_all_teams) as t) is distinct from v_approved
     or cardinality(v_all_teams) <> (select count(distinct t) from unnest(v_all_teams) as t) then
    raise exception using errcode = 'P0001',
      message = 'Los grupos tienen que incluir a todas las inscripciones aprobadas, una sola vez cada una.';
  end if;

  -- Reemplazo de la fase de grupos (por categoría o global)
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

  -- Si el torneo general aún estaba en 'registration_open', pasarlo a 'group_stage'
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

-- 4. Backfill: Vincular parejas huérfanas en torneos existentes con categorías
update public.teams t
set category_id = (
  select c.id from public.tournament_categories c
  where c.tournament_id = t.tournament_id
  order by c.position asc limit 1
)
where t.category_id is null
  and exists (select 1 from public.tournament_categories c where c.tournament_id = t.tournament_id);
