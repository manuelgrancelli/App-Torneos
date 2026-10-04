-- =============================================================================
-- F6: fase de grupos, programación y resultados.
-- Las RPC validan permisos y estado; el armado (sorteo, fixture, scheduler,
-- validación de marcadores) lo calcula la app con lib/domain (D-036).
-- =============================================================================

-- Organizador del torneo de un partido (o error de permisos).
create function public.require_match_organizer(p_match_id uuid)
returns public.matches
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
begin
  select m.* into v_match
  from public.matches m
  join public.tournaments t on t.id = m.tournament_id
  where m.id = p_match_id and t.organizer_id = (select auth.uid());
  if not found then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este partido.';
  end if;
  return v_match;
end;
$$;

revoke execute on function public.require_match_organizer(uuid) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Grupos y fixture
-- -----------------------------------------------------------------------------

-- p_groups: [{ "name": "Grupo A", "teamIds": [uuid…],
--              "matches": [{ "round": 1, "position": 0, "home": uuid, "away": uuid }…] }…]
create function public.apply_groups(p_tournament_id uuid, p_groups jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament public.tournaments%rowtype;
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
  if v_tournament.status <> 'group_stage' then
    raise exception using errcode = 'P0001', message = 'Los grupos se arman con el torneo en fase de grupos.';
  end if;
  if exists (
    select 1 from public.matches where tournament_id = p_tournament_id and result_status is not null
  ) then
    raise exception using errcode = 'P0001', message = 'Ya hay resultados cargados: no se pueden rearmar los grupos.';
  end if;
  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) not between 1 and 26 then
    raise exception using errcode = 'P0001', message = 'Tiene que haber entre 1 y 26 grupos.';
  end if;

  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_approved
  from public.teams where tournament_id = p_tournament_id and status = 'approved';

  -- Validación de la composición: cada aprobado exactamente una vez, grupos de 2+.
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

  -- Reemplazo completo de la fase de grupos.
  delete from public.matches where tournament_id = p_tournament_id and stage = 'group';
  delete from public.tournament_groups where tournament_id = p_tournament_id;

  for v_group in select value from jsonb_array_elements(p_groups) loop
    insert into public.tournament_groups (tournament_id, name, position)
    values (p_tournament_id, btrim(v_group ->> 'name'), v_position)
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

      insert into public.matches (tournament_id, stage, group_id, round, position, home_team_id, away_team_id)
      values (
        p_tournament_id, 'group', v_group_id,
        greatest(coalesce((v_match ->> 'round')::integer, 1), 1),
        greatest(coalesce((v_match ->> 'position')::integer, 0), 0),
        v_home, v_away
      );
    end loop;

    v_position := v_position + 1;
  end loop;
end;
$$;

-- -----------------------------------------------------------------------------
-- Programación
-- -----------------------------------------------------------------------------

-- p_assignments: [{ "matchId": uuid, "slotId": uuid, "courtId": uuid }…]
-- Con p_clear_unlocked, antes se desprograma todo lo no fijado y no jugado.
-- Los choques de cancha/equipo los frenan los constraints diferidos al commit.
create function public.apply_schedule(p_tournament_id uuid, p_assignments jsonb, p_clear_unlocked boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_status public.tournament_status;
  v_item jsonb;
  v_count integer := 0;
begin
  select status into v_status from public.tournaments where id = p_tournament_id and organizer_id = v_uid;
  if not found then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este torneo.';
  end if;
  if v_status not in ('group_stage', 'playoffs') then
    raise exception using errcode = 'P0001', message = 'Los partidos se programan durante la fase de grupos o los playoffs.';
  end if;

  if p_clear_unlocked then
    update public.matches
    set slot_id = null
    where tournament_id = p_tournament_id and not schedule_locked and result_status is null and slot_id is not null;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) loop
    update public.matches
    set slot_id = (v_item ->> 'slotId')::uuid,
        court_id = (v_item ->> 'courtId')::uuid
    where id = (v_item ->> 'matchId')::uuid
      and tournament_id = p_tournament_id
      and result_status is null
      and not schedule_locked;
    if not found then
      raise exception using errcode = 'P0001', message = 'Un partido ya no se puede programar (se jugó o tiene horario fijado).';
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- Asignación manual (queda fijada para el scheduler). Sin franja = desasignar.
create function public.assign_match_slot(p_match_id uuid, p_slot_id uuid, p_court_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype := public.require_match_organizer(p_match_id);
  v_slot_court uuid;
begin
  if v_match.result_status is not null then
    raise exception using errcode = 'P0001', message = 'El partido ya tiene resultado: no se puede reprogramar.';
  end if;

  if p_slot_id is null then
    update public.matches set slot_id = null, schedule_locked = false where id = p_match_id;
    return;
  end if;

  select court_id into v_slot_court
  from public.time_slots where id = p_slot_id and tournament_id = v_match.tournament_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'La franja no es de este torneo.';
  end if;
  if v_slot_court is null and p_court_id is null then
    raise exception using errcode = 'P0001', message = 'Elegí en qué cancha se juega.';
  end if;

  update public.matches
  set slot_id = p_slot_id, court_id = coalesce(v_slot_court, p_court_id), schedule_locked = true
  where id = p_match_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Resultados (con avance automático en playoffs)
-- -----------------------------------------------------------------------------

-- Ubica (o quita, con p_team_id null) a un equipo en un lado de un partido,
-- salvo que ese partido ya tenga resultado con otro equipo en ese lado.
create function public.place_team_in_match(p_match_id uuid, p_side public.match_side, p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target public.matches%rowtype;
  v_current uuid;
begin
  if p_match_id is null or p_side is null then
    return;
  end if;
  select * into v_target from public.matches where id = p_match_id for update;
  v_current := case p_side when 'home' then v_target.home_team_id else v_target.away_team_id end;
  if v_current is not distinct from p_team_id then
    return;
  end if;
  if v_target.result_status is not null then
    raise exception using errcode = 'P0001',
      message = 'El partido siguiente ya tiene resultado: borralo antes de corregir este.';
  end if;
  if p_side = 'home' then
    update public.matches set home_team_id = p_team_id where id = p_match_id;
  else
    update public.matches set away_team_id = p_team_id where id = p_match_id;
  end if;
end;
$$;

-- Carga (o corrige) un resultado. El marcador lo valida la app con la config
-- del torneo (evaluateResult); acá se valida la coherencia y se propaga.
create function public.record_match_result(
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
  if (v_match.stage = 'group' and v_tournament.status <> 'group_stage')
     or (v_match.stage = 'playoff' and v_tournament.status <> 'playoffs') then
    raise exception using errcode = 'P0001', message = 'En esta etapa del torneo no se cargan resultados de este partido.';
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
end;
$$;

-- Borra un resultado (para corregirlo) y deshace el avance en playoffs.
create function public.clear_match_result(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype := public.require_match_organizer(p_match_id);
  v_status public.tournament_status;
begin
  if v_match.result_status is null then
    return;
  end if;
  select status into v_status from public.tournaments where id = v_match.tournament_id;
  if v_status = 'finished' or (v_match.stage = 'group' and v_status <> 'group_stage') then
    raise exception using errcode = 'P0001', message = 'En esta etapa del torneo ya no se corrigen resultados de este partido.';
  end if;
  if v_match.is_bye then
    raise exception using errcode = 'P0001', message = 'Un pase directo (bye) no tiene resultado para borrar.';
  end if;

  perform public.place_team_in_match(v_match.next_match_id, v_match.next_match_side, null);
  perform public.place_team_in_match(v_match.loser_next_match_id, v_match.loser_next_match_side, null);

  update public.matches
  set result = null, winner_team_id = null, is_draw = false, is_walkover = false,
      result_status = null, result_recorded_at = null, result_recorded_by = null
  where id = p_match_id;
  delete from public.match_confirmations where match_id = p_match_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- Confirmación de resultados por los equipos
-- -----------------------------------------------------------------------------

create function public.respond_result(p_match_id uuid, p_response public.confirmation_response, p_comment text default null)
returns public.result_status
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_match public.matches%rowtype;
  v_team_id uuid;
  v_requires boolean;
  v_status public.result_status;
begin
  select * into v_match from public.matches where id = p_match_id for update;
  if not found then
    raise exception using errcode = '42501', message = 'No jugás este partido.';
  end if;
  select tm.team_id into v_team_id
  from public.team_members tm
  where tm.user_id = v_uid and tm.team_id in (v_match.home_team_id, v_match.away_team_id)
  limit 1;
  if v_team_id is null then
    raise exception using errcode = '42501', message = 'No jugás este partido.';
  end if;

  select results_require_confirmation into v_requires from public.tournaments where id = v_match.tournament_id;
  if not v_requires then
    raise exception using errcode = 'P0001', message = 'Este torneo no pide confirmar los resultados.';
  end if;
  if v_match.result_status is null then
    raise exception using errcode = 'P0001', message = 'El partido todavía no tiene resultado.';
  end if;
  if p_response = 'disputed' and nullif(btrim(coalesce(p_comment, '')), '') is null then
    raise exception using errcode = 'P0001', message = 'Contale al organizador qué está mal en el resultado.';
  end if;

  insert into public.match_confirmations (match_id, team_id, tournament_id, response, comment, responded_by)
  values (p_match_id, v_team_id, v_match.tournament_id, p_response, left(nullif(btrim(p_comment), ''), 500), v_uid)
  on conflict (match_id, team_id) do update
  set response = excluded.response, comment = excluded.comment, responded_by = excluded.responded_by;

  select case
    when bool_or(response = 'disputed') then 'disputed'::public.result_status
    when count(*) filter (where response = 'confirmed') >= 2 then 'confirmed'::public.result_status
    else 'provisional'::public.result_status
  end into v_status
  from public.match_confirmations where match_id = p_match_id;

  update public.matches set result_status = v_status where id = p_match_id;
  return v_status;
end;
$$;

-- El organizador da por bueno un resultado (provisional u objetado).
create function public.confirm_match_result(p_match_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype := public.require_match_organizer(p_match_id);
begin
  if v_match.result_status is null then
    raise exception using errcode = 'P0001', message = 'El partido todavía no tiene resultado.';
  end if;
  update public.matches set result_status = 'confirmed' where id = p_match_id;
end;
$$;

revoke execute on function public.apply_groups(uuid, jsonb) from public, anon;
revoke execute on function public.apply_schedule(uuid, jsonb, boolean) from public, anon;
revoke execute on function public.assign_match_slot(uuid, uuid, uuid) from public, anon;
revoke execute on function public.place_team_in_match(uuid, public.match_side, uuid) from public, anon, authenticated;
revoke execute on function public.record_match_result(uuid, jsonb, uuid, boolean, boolean) from public, anon;
revoke execute on function public.clear_match_result(uuid) from public, anon;
revoke execute on function public.respond_result(uuid, public.confirmation_response, text) from public, anon;
revoke execute on function public.confirm_match_result(uuid) from public, anon;

grant execute on function public.apply_groups(uuid, jsonb) to authenticated;
grant execute on function public.apply_schedule(uuid, jsonb, boolean) to authenticated;
grant execute on function public.assign_match_slot(uuid, uuid, uuid) to authenticated;
grant execute on function public.record_match_result(uuid, jsonb, uuid, boolean, boolean) to authenticated;
grant execute on function public.clear_match_result(uuid) to authenticated;
grant execute on function public.respond_result(uuid, public.confirmation_response, text) to authenticated;
grant execute on function public.confirm_match_result(uuid) to authenticated;
