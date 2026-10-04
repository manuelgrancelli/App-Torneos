-- =============================================================================
-- F7: cuadro eliminatorio. La app arma el cuadro (lib/domain/bracket) y esta
-- RPC lo valida y lo persiste: inserta los partidos y después los enlaza
-- (ganador → partido siguiente, perdedores de semis → 3er puesto).
-- El avance al cargar resultados lo hace record_match_result (migración F6).
-- =============================================================================

-- p_matches: [{ "key": "r1-m0", "round": 1, "position": 0, "home": uuid|null, "away": uuid|null,
--              "isBye": bool, "isThirdPlace": bool, "winner": uuid|null,
--              "next": { "key": "r2-m0", "side": "home" }|null, "loserNext": {…}|null }…]
create function public.apply_bracket(p_tournament_id uuid, p_matches jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament public.tournaments%rowtype;
  v_item jsonb;
  v_ids jsonb := '{}'::jsonb;
  v_keys text[] := '{}'::text[];
  v_teams uuid[] := '{}'::uuid[];
  v_team uuid;
  v_key text;
  v_link jsonb;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  if not found or v_tournament.organizer_id <> v_uid then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este torneo.';
  end if;
  if v_tournament.status <> 'playoffs' then
    raise exception using errcode = 'P0001', message = 'El cuadro se arma con el torneo en playoffs.';
  end if;
  if exists (
    select 1 from public.matches
    where tournament_id = p_tournament_id and stage = 'playoff' and result_status is not null and not is_bye
  ) then
    raise exception using errcode = 'P0001', message = 'Ya hay resultados de playoffs: no se puede rearmar el cuadro.';
  end if;
  if jsonb_typeof(p_matches) <> 'array' or jsonb_array_length(p_matches) not between 1 and 64 then
    raise exception using errcode = 'P0001', message = 'El cuadro no es válido.';
  end if;

  -- Claves únicas y equipos de la 1ª ronda: aprobados del torneo, sin repetir.
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

  if exists (
    select 1 from unnest(v_teams) as t(id)
    where not exists (
      select 1 from public.teams x where x.id = t.id and x.tournament_id = p_tournament_id and x.status = 'approved'
    )
  ) then
    raise exception using errcode = 'P0001', message = 'El cuadro solo puede incluir inscripciones aprobadas.';
  end if;

  delete from public.matches where tournament_id = p_tournament_id and stage = 'playoff';

  -- 1) Partidos (sin enlaces, porque los destinos todavía no existen).
  for v_item in select value from jsonb_array_elements(p_matches) loop
    insert into public.matches (
      id, tournament_id, stage, round, position, home_team_id, away_team_id,
      is_bye, is_third_place, winner_team_id, result_status
    ) values (
      (v_ids ->> (v_item ->> 'key'))::uuid,
      p_tournament_id,
      'playoff',
      greatest(coalesce((v_item ->> 'round')::integer, 1), 1),
      greatest(coalesce((v_item ->> 'position')::integer, 0), 0),
      (v_item ->> 'home')::uuid,
      (v_item ->> 'away')::uuid,
      coalesce((v_item ->> 'isBye')::boolean, false),
      coalesce((v_item ->> 'isThirdPlace')::boolean, false),
      case when coalesce((v_item ->> 'isBye')::boolean, false) then (v_item ->> 'winner')::uuid end,
      case when coalesce((v_item ->> 'isBye')::boolean, false) then 'confirmed'::public.result_status end
    );
  end loop;

  -- 2) Enlaces al partido siguiente y al del 3er puesto.
  for v_item in select value from jsonb_array_elements(p_matches) loop
    v_link := v_item -> 'next';
    if jsonb_typeof(v_link) = 'object' then
      if not (v_ids ? (v_link ->> 'key')) then
        raise exception using errcode = 'P0001', message = 'El cuadro está incompleto.';
      end if;
      update public.matches
      set next_match_id = (v_ids ->> (v_link ->> 'key'))::uuid,
          next_match_side = (v_link ->> 'side')::public.match_side
      where id = (v_ids ->> (v_item ->> 'key'))::uuid;
    end if;

    v_link := v_item -> 'loserNext';
    if jsonb_typeof(v_link) = 'object' then
      if not (v_ids ? (v_link ->> 'key')) then
        raise exception using errcode = 'P0001', message = 'El cuadro está incompleto.';
      end if;
      update public.matches
      set loser_next_match_id = (v_ids ->> (v_link ->> 'key'))::uuid,
          loser_next_match_side = (v_link ->> 'side')::public.match_side
      where id = (v_ids ->> (v_item ->> 'key'))::uuid;
    end if;
  end loop;
end;
$$;

revoke execute on function public.apply_bracket(uuid, jsonb) from public, anon;
grant execute on function public.apply_bracket(uuid, jsonb) to authenticated;
