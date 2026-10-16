-- =============================================================================
-- Permitir al organizador gestionar disponibilidad de equipos y registrar sin franjas
-- =============================================================================

-- 1. Actualizar create_organizer_team para permitir p_slot_ids vacío o nulo
--    (para que el organizador pueda importar listas sin disponibilidad y asignarlas luego)
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
  v_slots uuid[] := coalesce(p_slot_ids, '{}');
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

  if coalesce(cardinality(v_slots), 0) > 1000 then
    raise exception using errcode = 'P0001', message = 'Demasiadas franjas seleccionadas.';
  end if;

  if coalesce(cardinality(v_slots), 0) > 0 then
    if (
      select count(distinct selected_slot_id)
      from unnest(v_slots) as selected_slots(selected_slot_id)
    ) <> cardinality(v_slots) then
      raise exception using errcode = 'P0001', message = 'Hay franjas repetidas en la selección.';
    end if;
    if exists (
      select 1
      from unnest(v_slots) as selected_slots(selected_slot_id)
      where selected_slot_id is null
        or not exists (
          select 1 from public.time_slots
          where id = selected_slot_id and tournament_id = p_tournament_id
        )
    ) then
      raise exception using errcode = 'P0001', message = 'Una o más franjas no pertenecen a este torneo.';
    end if;
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

  if coalesce(cardinality(v_slots), 0) > 0 then
    insert into public.team_availability (team_id, slot_id, tournament_id)
    select v_team_id, selected_slot_id, p_tournament_id
    from unnest(v_slots) as selected_slots(selected_slot_id);
  end if;

  return v_team_id;
end;
$$;

revoke execute on function public.create_organizer_team(uuid, text, text[], uuid[], uuid) from public, anon;
grant execute on function public.create_organizer_team(uuid, text, text[], uuid[], uuid) to authenticated;

-- 2. Actualizar set_team_availability para permitir que el organizador del torneo
--    o los miembros del equipo puedan actualizar la disponibilidad horaria del equipo
create or replace function public.set_team_availability(p_team_id uuid, p_slot_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament_id uuid;
  v_is_organizer boolean;
  v_is_member boolean;
  v_tournament_status public.tournament_status;
  v_slot_ids uuid[] := coalesce(p_slot_ids, '{}');
begin
  if cardinality(v_slot_ids) > 1000 then
    raise exception using errcode = 'P0001', message = 'Demasiadas franjas.';
  end if;

  select t.tournament_id into v_tournament_id
  from public.teams t
  where t.id = p_team_id;

  if v_tournament_id is null then
    raise exception using errcode = 'P0002', message = 'Equipo inexistente.';
  end if;

  select (tour.organizer_id = v_uid), tour.status
  into v_is_organizer, v_tournament_status
  from public.tournaments tour
  where tour.id = v_tournament_id;

  select exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id and tm.user_id = v_uid
  ) into v_is_member;

  if not (coalesce(v_is_organizer, false) or v_is_member) then
    raise exception using errcode = '42501', message = 'No tenés permisos para modificar la disponibilidad de este equipo.';
  end if;

  if not coalesce(v_is_organizer, false) and v_tournament_status <> 'registration_open' then
    raise exception using errcode = 'P0001',
      message = 'La disponibilidad solo se puede cambiar con la inscripción abierta.';
  end if;

  if coalesce(v_is_organizer, false) and v_tournament_status in ('completed', 'cancelled') then
    raise exception using errcode = 'P0001',
      message = 'El torneo ya está finalizado o cancelado.';
  end if;

  if cardinality(v_slot_ids) > 0 and exists (
    select 1 from unnest(v_slot_ids) as s(id)
    where not exists (
      select 1 from public.time_slots ts where ts.id = s.id and ts.tournament_id = v_tournament_id
    )
  ) then
    raise exception using errcode = 'P0001', message = 'Alguna de las franjas no pertenece a este torneo.';
  end if;

  delete from public.team_availability
  where team_id = p_team_id and not (slot_id = any(v_slot_ids));

  if cardinality(v_slot_ids) > 0 then
    insert into public.team_availability (team_id, slot_id, tournament_id)
    select p_team_id, s.id, v_tournament_id
    from (select distinct unnest(v_slot_ids) as id) as s
    on conflict (team_id, slot_id) do nothing;
  end if;

  return (select count(*)::integer from public.team_availability where team_id = p_team_id);
end;
$$;

revoke execute on function public.set_team_availability(uuid, uuid[]) from public, anon;
grant execute on function public.set_team_availability(uuid, uuid[]) to authenticated;
