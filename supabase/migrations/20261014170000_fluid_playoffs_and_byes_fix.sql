-- =============================================================================
-- D-078: Transición fluida a playoffs, fijación de byes y carga directa de resultados
-- =============================================================================

-- 1. Actualizar apply_bracket para fijar result_status='confirmed' en partidos con Bye
-- y actualizar automáticamente el estado del torneo / categoría a 'playoffs'
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
  if not found or v_tournament.organizer_id <> v_uid then
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


-- 2. Actualizar record_match_result para permitir cargar playoffs sin exigir cambio manual de estado
create or replace function public.record_match_result(
  p_match_id uuid,
  p_result jsonb,
  p_winner_team_id uuid,
  p_is_draw boolean default false,
  p_is_walkover boolean default false
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype := public.require_match_organizer(p_match_id);
  v_tournament public.tournaments%rowtype;
  v_loser uuid;
begin
  select * into v_tournament from public.tournaments where id = v_match.tournament_id;

  if v_match.stage = 'group' and v_tournament.status <> 'group_stage' then
    raise exception using errcode = 'P0001', message = 'En esta etapa del torneo no se cargan resultados de este partido.';
  end if;

  if v_match.stage = 'playoff' then
    if v_tournament.status not in ('group_stage', 'playoffs') then
      raise exception using errcode = 'P0001', message = 'En esta etapa del torneo no se cargan resultados de este partido.';
    end if;

    -- Si el torneo todavía está marcado como group_stage, validar que los partidos de grupo de su categoría/torneo concluyeron
    if v_tournament.status = 'group_stage' then
      if v_match.category_id is not null then
        if exists (
          select 1 from public.matches
          where tournament_id = v_match.tournament_id
            and category_id = v_match.category_id
            and stage = 'group'
            and result_status is null
        ) then
          raise exception using errcode = 'P0001', message = 'Faltan cargar resultados de la fase de grupos antes de cargar playoffs.';
        end if;
      else
        if exists (
          select 1 from public.matches
          where tournament_id = v_match.tournament_id
            and stage = 'group'
            and result_status is null
        ) then
          raise exception using errcode = 'P0001', message = 'Faltan cargar resultados de la fase de grupos antes de cargar playoffs.';
        end if;
      end if;
    end if;
  end if;

  if v_match.home_team_id is null or v_match.away_team_id is null or v_match.is_bye then
    raise exception using errcode = 'P0001', message = 'El partido todavía no tiene sus dos equipos.';
  end if;
  if p_result is null or jsonb_typeof(p_result) <> 'object' then
    raise exception using errcode = 'P0001', message = 'Falta el resultado.';
  end if;
  if coalesce(p_is_draw, false) then
    if v_match.stage <> 'group' or p_winner_team_id is not null or coalesce(p_is_walkover, false) then
      raise exception using errcode = 'P0001', message = 'Solo puede haber empate en la fase de grupos.';
    end if;
  elsif p_winner_team_id is null or p_winner_team_id not in (v_match.home_team_id, v_match.away_team_id) then
    raise exception using errcode = 'P0001', message = 'El ganador tiene que ser uno de los equipos del partido.';
  end if;

  update public.matches
  set result = p_result,
      winner_team_id = case when coalesce(p_is_draw, false) then null else p_winner_team_id end,
      is_draw = coalesce(p_is_draw, false),
      is_walkover = coalesce(p_is_walkover, false),
      result_status = case when v_tournament.results_require_confirmation then 'provisional'::public.result_status
                           else 'confirmed'::public.result_status end,
      result_recorded_at = now(),
      result_recorded_by = (select auth.uid())
  where id = p_match_id;

  delete from public.match_confirmations where match_id = p_match_id;

  -- Playoffs: el ganador avanza y el perdedor va al 3er puesto (si corresponde).
  if v_match.next_match_id is not null or v_match.loser_next_match_id is not null then
    v_loser := case when p_winner_team_id = v_match.home_team_id then v_match.away_team_id else v_match.home_team_id end;
    perform public.place_team_in_match(v_match.next_match_id, v_match.next_match_side, p_winner_team_id);
    perform public.place_team_in_match(v_match.loser_next_match_id, v_match.loser_next_match_side, v_loser);
  end if;

  -- Si era un partido de playoff y el torneo o categoría seguía en group_stage, actualizar el estado
  if v_match.stage = 'playoff' then
    if v_match.category_id is not null then
      update public.tournament_categories set status = 'playoffs', updated_at = now() where id = v_match.category_id and status = 'group_stage';
    end if;
    if v_tournament.status = 'group_stage' then
      update public.tournaments set status = 'playoffs', updated_at = now() where id = v_match.tournament_id;
    end if;
  end if;
end;
$$;

revoke execute on function public.record_match_result(uuid, jsonb, uuid, boolean, boolean) from public, anon;
grant execute on function public.record_match_result(uuid, jsonb, uuid, boolean, boolean) to authenticated;
