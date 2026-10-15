-- =============================================================================
-- Corrección de create_organizer_team RPC
-- Corrige el tipo de rol y el insert en team_availability con tournament_id
-- =============================================================================

create or replace function public.create_organizer_team(
  p_tournament_id uuid,
  p_team_name text,
  p_player_names text[],
  p_slot_ids uuid[],
  p_category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament public.tournaments%rowtype;
  v_cat public.tournament_categories%rowtype;
  v_sport public.sports%rowtype;
  v_team_id uuid;
  v_name text := btrim(coalesce(p_team_name, ''));
  v_names text[];
  v_approved integer;
begin
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found or v_tournament.organizer_id <> v_uid then
    raise exception using errcode = '42501', message = 'No tenés permiso para inscribir equipos en este torneo.';
  end if;
  if v_tournament.status <> 'registration_open' then
    raise exception using errcode = 'P0001', message = 'La inscripción de este torneo no está abierta.';
  end if;
  if char_length(v_name) not between 2 and 60 then
    raise exception using errcode = 'P0001', message = 'El nombre tiene que tener entre 2 y 60 caracteres.';
  end if;

  if p_category_id is not null then
    select * into v_cat
    from public.tournament_categories
    where id = p_category_id and tournament_id = p_tournament_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'La categoría seleccionada no existe.';
    end if;
    if v_cat.status <> 'registration_open' then
      raise exception using errcode = 'P0001', message = 'La inscripción en esta categoría ya está cerrada.';
    end if;
    select count(*)::integer into v_approved
    from public.teams
    where tournament_id = p_tournament_id and category_id = p_category_id and status = 'approved';
    if v_cat.max_teams is not null and v_approved >= v_cat.max_teams then
      raise exception using errcode = 'P0001', message = 'Esta categoría ya completó el cupo.';
    end if;
  else
    select count(*)::integer into v_approved
    from public.teams
    where tournament_id = p_tournament_id and status = 'approved';
    if v_approved >= v_tournament.max_teams then
      raise exception using errcode = 'P0001', message = 'El torneo ya completó el cupo.';
    end if;
  end if;

  select * into v_sport from public.sports where id = v_tournament.sport_id;
  if coalesce(cardinality(p_player_names), 0) not between v_sport.min_team_size and v_sport.max_team_size then
    raise exception using errcode = 'P0001', message = 'La cantidad de nombres no coincide con el tamaño del equipo.';
  end if;
  if exists (
    select 1 from unnest(p_player_names) as player_rows(player_name)
    where player_name is null or char_length(btrim(player_name)) not between 1 and 80
  ) then
    raise exception using errcode = 'P0001', message = 'Cada integrante necesita un nombre de entre 1 y 80 caracteres.';
  end if;
  if exists (
    select 1 from public.teams
    where tournament_id = p_tournament_id and lower(name) = lower(v_name)
  ) then
    raise exception using errcode = 'P0001', message = 'Ya hay un equipo con ese nombre en el torneo.';
  end if;

  if coalesce(cardinality(p_slot_ids), 0) not between 1 and 1000 then
    raise exception using errcode = 'P0001', message = 'Elegí al menos una franja disponible.';
  end if;
  if (
    select count(distinct selected_slot_id)
    from unnest(p_slot_ids) as selected_slots(selected_slot_id)
  ) <> cardinality(p_slot_ids) then
    raise exception using errcode = 'P0001', message = 'Hay franjas repetidas en la selección.';
  end if;
  if exists (
    select 1
    from unnest(p_slot_ids) as selected_slots(selected_slot_id)
    where selected_slot_id is null
      or not exists (
        select 1 from public.time_slots
        where id = selected_slot_id and tournament_id = p_tournament_id
      )
  ) then
    raise exception using errcode = 'P0001', message = 'Una o más franjas no pertenecen a este torneo.';
  end if;

  v_names := array(
    select btrim(player_name)
    from unnest(p_player_names) with ordinality as player_rows(player_name, position)
    order by position
  );

  insert into public.teams (
    tournament_id, category_id, name, captain_id, status, organizer_registered
  )
  values (p_tournament_id, p_category_id, v_name, v_uid, 'approved', true)
  returning id into v_team_id;

  insert into public.team_members (team_id, tournament_id, email, display_name, role)
  select v_team_id, p_tournament_id, null, player_name, 'player'
  from unnest(v_names) as player_rows(player_name);

  insert into public.team_availability (team_id, slot_id, tournament_id)
  select v_team_id, selected_slot_id, p_tournament_id
  from unnest(p_slot_ids) as selected_slots(selected_slot_id);

  return v_team_id;
end;
$$;

revoke execute on function public.create_organizer_team(uuid, text, text[], uuid[], uuid) from public, anon;
grant execute on function public.create_organizer_team(uuid, text, text[], uuid[], uuid) to authenticated;
