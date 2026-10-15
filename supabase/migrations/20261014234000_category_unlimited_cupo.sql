-- =============================================================================
-- Migración: Cupos ilimitados / hasta cerrar inscripción por categoría
-- Permite que tournament_categories.max_teams sea NULL (sin límite hasta que el
-- organizador cierre la inscripción o inicie la siguiente fase).
-- =============================================================================

alter table public.tournament_categories
  alter column max_teams drop not null;

alter table public.tournament_categories
  drop constraint if exists tournament_categories_max_teams_check;

alter table public.tournament_categories
  add constraint tournament_categories_max_teams_check
  check (max_teams is null or (max_teams between 2 and 128));

-- 1. Actualizar register_team para respetar cupo null (sin límite) en categorías
create or replace function public.register_team(
  p_code text,
  p_team_name text,
  p_member_emails text[],
  p_category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_email text;
  v_tournament public.tournaments%rowtype;
  v_cat public.tournament_categories%rowtype;
  v_sport public.sports%rowtype;
  v_emails text[];
  v_name text := btrim(coalesce(p_team_name, ''));
  v_team_id uuid;
  v_member_email text;
  v_existing_user uuid;
  v_is_organizer boolean;
  v_status public.team_status;
begin
  select lower(email) into v_email
  from auth.users
  where id = v_uid and email_confirmed_at is not null;
  if v_email is null then
    raise exception using errcode = 'P0001', message = 'Confirmá tu email antes de inscribirte.';
  end if;

  select t.* into v_tournament
  from public.tournament_invites i
  join public.tournaments t on t.id = i.tournament_id
  where i.code = public.normalize_code(p_code)
  for update of t;

  if not found then
    raise exception using errcode = 'P0001', message = 'El código de inscripción no es válido.';
  end if;

  v_is_organizer := (v_tournament.organizer_id = v_uid);
  if v_is_organizer then
    v_status := 'approved';
  else
    v_status := 'pending';
  end if;

  if p_category_id is not null then
    select * into v_cat from public.tournament_categories where id = p_category_id and tournament_id = v_tournament.id;
    if not found then
      raise exception using errcode = 'P0001', message = 'La categoría seleccionada no existe.';
    end if;
    if v_cat.status <> 'registration_open' then
      raise exception using errcode = 'P0001', message = 'La inscripción en esta categoría ya está cerrada.';
    end if;
    if v_cat.max_teams is not null and (select count(*) from public.teams where tournament_id = v_tournament.id and category_id = p_category_id and status = 'approved')
       >= v_cat.max_teams then
      raise exception using errcode = 'P0001', message = 'Esta categoría ya completó el cupo.';
    end if;
  else
    if v_tournament.status <> 'registration_open' then
      raise exception using errcode = 'P0001', message = 'La inscripción de este torneo no está abierta.';
    end if;
    if (select count(*) from public.teams where tournament_id = v_tournament.id and status = 'approved')
       >= v_tournament.max_teams then
      raise exception using errcode = 'P0001', message = 'El torneo ya completó el cupo.';
    end if;
  end if;

  select * into v_sport from public.sports where id = v_tournament.sport_id;
  v_emails := public.normalize_emails(p_member_emails);

  -- Regla universal: quien inscribe queda como capitán, no puede ser su propio compañero
  if v_email = any(v_emails) then
    raise exception using errcode = 'P0001', message = 'No incluyas tu propio email: ya quedás como capitán.';
  end if;

  -- Si NO es el organizador haciendo pruebas, no puede inscribirse 2 veces en el torneo
  if not v_is_organizer then
    if exists (
      select 1 from public.team_members
      where tournament_id = v_tournament.id and (user_id = v_uid or email = v_email)
    ) then
      raise exception using errcode = 'P0001', message = 'Ya estás inscripto en este torneo.';
    end if;
  end if;

  -- Ningún compañero puede estar ya inscripto en el torneo
  if exists (
    select 1 from public.team_members
    where tournament_id = v_tournament.id and email = any(v_emails)
  ) then
    raise exception using errcode = 'P0001', message = 'Uno de los integrantes ya está inscripto en este torneo.';
  end if;

  if cardinality(v_emails) + 1 not between v_sport.min_team_size and v_sport.max_team_size then
    raise exception using errcode = 'P0001',
      message = case
        when v_sport.min_team_size = v_sport.max_team_size
          then format('El equipo tiene que tener %s integrantes, contándote a vos.', v_sport.min_team_size)
        else format('El equipo tiene que tener entre %s y %s integrantes, contándote a vos.',
          v_sport.min_team_size, v_sport.max_team_size)
      end;
  end if;

  if char_length(v_name) not between 2 and 60 then
    raise exception using errcode = 'P0001', message = 'El nombre del equipo tiene que tener entre 2 y 60 caracteres.';
  end if;
  if exists (
    select 1 from public.teams
    where tournament_id = v_tournament.id and lower(name) = lower(v_name)
  ) then
    raise exception using errcode = 'P0001', message = 'Ya hay un equipo con ese nombre en este torneo.';
  end if;

  insert into public.teams (tournament_id, category_id, name, captain_id, status, organizer_registered)
  values (v_tournament.id, p_category_id, v_name, v_uid, v_status, false)
  returning id into v_team_id;

  insert into public.team_members (team_id, tournament_id, email, user_id, role)
  values (v_team_id, v_tournament.id, v_email, v_uid, 'captain');

  foreach v_member_email in array v_emails loop
    select id into v_existing_user
    from auth.users
    where lower(email) = v_member_email and email_confirmed_at is not null;

    insert into public.team_members (team_id, tournament_id, email, user_id, role)
    values (v_team_id, v_tournament.id, v_member_email, v_existing_user, 'player')
    on conflict do nothing;
  end loop;

  return v_team_id;
end;
$$;

revoke execute on function public.register_team(text, text, text[], uuid) from public, anon;
grant execute on function public.register_team(text, text, text[], uuid) to authenticated;

-- 2. Actualizar create_organizer_team para respetar cupo null en categorías
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
    raise exception using errcode = 'P0001', message = 'Seleccioná al menos una franja horaria.';
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

-- 3. Actualizar review_registration para respetar cupo null en categorías
create or replace function public.review_registration(
  p_team_id uuid,
  p_decision public.team_status
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
  v_sport public.sports%rowtype;
  v_members integer;
  v_approved integer;
begin
  if p_decision not in ('approved', 'rejected') then
    raise exception using errcode = 'P0001', message = 'La decisión tiene que ser aprobar o rechazar.';
  end if;

  select * into v_team from public.teams where id = p_team_id;
  if not found then
    raise exception using errcode = '42501', message = 'No tenés permiso para revisar esta inscripción.';
  end if;

  select * into v_tournament from public.tournaments where id = v_team.tournament_id for update;
  if v_tournament.organizer_id <> v_uid then
    raise exception using errcode = '42501', message = 'No tenés permiso para revisar esta inscripción.';
  end if;
  if v_tournament.status <> 'registration_open' then
    raise exception using errcode = 'P0001', message = 'Solo se revisan inscripciones con la inscripción abierta.';
  end if;

  if p_decision = 'approved' and v_team.status <> 'approved' then
    select * into v_sport from public.sports where id = v_tournament.sport_id;
    select count(*)::integer
    into v_members
    from public.team_members
    where team_id = p_team_id;
    if v_members not between v_sport.min_team_size and v_sport.max_team_size then
      raise exception using errcode = 'P0001', message = 'El equipo no tiene el plantel completo.';
    end if;

    -- Validar cupo según categoría o torneo general
    if v_team.category_id is not null then
      select * into v_cat from public.tournament_categories where id = v_team.category_id;
      select count(*) into v_approved
      from public.teams
      where tournament_id = v_tournament.id and category_id = v_team.category_id and status = 'approved';
      if v_cat.max_teams is not null and v_approved >= v_cat.max_teams then
        raise exception using errcode = 'P0001', message = 'Esta categoría ya completó el cupo.';
      end if;
    else
      select count(*) into v_approved
      from public.teams
      where tournament_id = v_tournament.id and status = 'approved';
      if v_approved >= v_tournament.max_teams then
        raise exception using errcode = 'P0001', message = 'El torneo ya completó el cupo.';
      end if;
    end if;
  end if;

  update public.teams set status = p_decision where id = p_team_id;
end;
$$;

revoke execute on function public.review_registration(uuid, public.team_status) from public, anon;
grant execute on function public.review_registration(uuid, public.team_status) to authenticated;
