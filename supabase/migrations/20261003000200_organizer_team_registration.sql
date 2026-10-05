-- Inscripción presencial/manual por parte del organizador, sin emails.

alter table public.teams
  add column organizer_registered boolean not null default false;

alter table public.team_members
  alter column email drop not null,
  add column display_name text check (
    display_name is null
    or char_length(btrim(display_name)) between 1 and 80
  );

create or replace function private.prevent_real_registration_in_test_tournaments()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.tournaments
    where id = new.tournament_id and is_test
  ) and not new.test_generated and not new.organizer_registered then
    raise exception using errcode = 'P0001',
      message = 'Este es un torneo de prueba privado y no recibe inscripciones reales.';
  end if;
  return new;
end;
$$;

create or replace function public.review_registration(p_team_id uuid, p_decision public.team_status)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_team public.teams%rowtype;
  v_tournament public.tournaments%rowtype;
  v_sport public.sports%rowtype;
  v_members integer;
  v_unaccepted integer;
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
    select count(*)::integer, count(*) filter (where user_id is null)::integer
    into v_members, v_unaccepted
    from public.team_members
    where team_id = p_team_id;
    if v_members not between v_sport.min_team_size and v_sport.max_team_size then
      raise exception using errcode = 'P0001', message = 'El equipo no tiene el plantel completo.';
    end if;
    if v_unaccepted > 0 and not v_team.organizer_registered then
      raise exception using errcode = 'P0001',
        message = 'Todos los integrantes tienen que aceptar la invitación antes de aprobar.';
    end if;

    select count(*) into v_approved
    from public.teams
    where tournament_id = v_tournament.id and status = 'approved';
    if v_approved >= v_tournament.max_teams then
      raise exception using errcode = 'P0001', message = 'El torneo ya completó el cupo.';
    end if;
  end if;

  update public.teams set status = p_decision where id = p_team_id;
end;
$$;

create or replace function public.create_team_invitation(
  p_team_id uuid,
  p_team_member_id uuid,
  p_token_hash text
)
returns table (recipient_email text, team_name text, tournament_name text)
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_captain_id uuid;
  v_team_name text;
  v_team_status public.team_status;
  v_tournament_name text;
  v_tournament_status public.tournament_status;
  v_email text;
  v_last_sent_at timestamptz;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'No pudimos preparar la invitación.';
  end if;

  select tm.email, t.captain_id, t.name, t.status, tr.name, tr.status
  into v_email, v_captain_id, v_team_name, v_team_status, v_tournament_name, v_tournament_status
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  join public.tournaments tr on tr.id = tm.tournament_id
  where tm.id = p_team_member_id and tm.team_id = p_team_id and tm.role = 'player'
    and not t.organizer_registered
  for update of tm;

  if not found or v_captain_id <> v_uid then
    raise exception using errcode = '42501', message = 'Solo el capitán puede invitar a sus compañeros.';
  end if;
  if v_email is null then
    raise exception using errcode = 'P0001', message = 'Este integrante no tiene un email para invitar.';
  end if;
  if v_tournament_status <> 'registration_open' then
    raise exception using errcode = 'P0001', message = 'La inscripción ya cerró: no se pueden enviar invitaciones.';
  end if;
  if v_team_status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'La inscripción ya no está pendiente.';
  end if;
  if exists (
    select 1 from public.team_members
    where id = p_team_member_id and user_id is not null
  ) then
    raise exception using errcode = 'P0001', message = 'Este integrante ya aceptó la invitación.';
  end if;

  select sent_at into v_last_sent_at
  from public.team_invitations
  where team_member_id = p_team_member_id
  for update;
  if found and v_last_sent_at > now() - interval '1 minute' then
    raise exception using errcode = 'P0001', message = 'Esperá un minuto antes de reenviar esta invitación.';
  end if;

  insert into public.team_invitations (team_member_id, token_hash, expires_at, sent_at)
  values (p_team_member_id, p_token_hash, now() + interval '7 days', now())
  on conflict (team_member_id) do update
  set token_hash = excluded.token_hash,
      expires_at = excluded.expires_at,
      sent_at = excluded.sent_at;

  return query select v_email, v_team_name, v_tournament_name;
end;
$$;

create or replace function public.update_team_roster(p_team_id uuid, p_team_name text, p_member_emails text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_team public.teams%rowtype;
  v_tournament public.tournaments%rowtype;
  v_sport public.sports%rowtype;
  v_captain_email text;
  v_emails text[];
  v_current text[];
  v_name text := btrim(coalesce(p_team_name, ''));
  v_roster_changed boolean;
begin
  select * into v_team from public.teams where id = p_team_id;
  if not found or v_team.captain_id <> v_uid or v_team.organizer_registered then
    raise exception using errcode = '42501', message = 'Solo el capitán puede editar el equipo.';
  end if;

  select * into v_tournament from public.tournaments where id = v_team.tournament_id for update;
  if v_tournament.status <> 'registration_open' then
    raise exception using errcode = 'P0001', message = 'La inscripción ya cerró: no se puede modificar el equipo.';
  end if;

  select * into v_sport from public.sports where id = v_tournament.sport_id;
  select email into v_captain_email from public.team_members where team_id = p_team_id and role = 'captain';
  v_emails := public.normalize_emails(p_member_emails);

  if v_captain_email = any(v_emails) then
    raise exception using errcode = 'P0001', message = 'No incluyas tu propio email: ya quedás como capitán.';
  end if;
  if cardinality(v_emails) + 1 not between v_sport.min_team_size and v_sport.max_team_size then
    raise exception using errcode = 'P0001',
      message = format('El equipo tiene que tener entre %s y %s integrantes, contándote a vos.',
        v_sport.min_team_size, v_sport.max_team_size);
  end if;
  if char_length(v_name) not between 2 and 60 then
    raise exception using errcode = 'P0001', message = 'El nombre del equipo tiene que tener entre 2 y 60 caracteres.';
  end if;
  if exists (
    select 1 from public.teams
    where tournament_id = v_team.tournament_id and lower(name) = lower(v_name) and id <> p_team_id
  ) then
    raise exception using errcode = 'P0001', message = 'Ya hay un equipo con ese nombre en el torneo.';
  end if;

  select coalesce(array_agg(email order by email), '{}') into v_current
  from public.team_members
  where team_id = p_team_id and role = 'player';

  v_roster_changed := not (v_current @> v_emails and v_emails @> v_current);

  if v_roster_changed then
    delete from public.team_members
    where team_id = p_team_id and role = 'player' and not (email = any(v_emails));
    perform public.add_team_members(p_team_id, v_team.tournament_id, v_emails);
  end if;

  update public.teams
  set name = v_name,
      status = case when v_roster_changed then 'pending'::public.team_status else status end
  where id = p_team_id;
end;
$$;

create or replace function public.withdraw_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_team public.teams%rowtype;
begin
  select * into v_team from public.teams where id = p_team_id;
  if not found or v_team.captain_id <> v_uid or v_team.organizer_registered then
    raise exception using errcode = '42501', message = 'Solo el capitán puede dar de baja la inscripción.';
  end if;

  perform 1 from public.tournaments where id = v_team.tournament_id and status = 'registration_open' for update;
  if not found then
    raise exception using errcode = 'P0001',
      message = 'La inscripción ya cerró: pedile al organizador que te dé de baja.';
  end if;

  delete from public.teams where id = p_team_id;
end;
$$;

create function public.create_organizer_team(
  p_tournament_id uuid,
  p_team_name text,
  p_player_names text[],
  p_slot_ids uuid[]
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament public.tournaments%rowtype;
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

  select count(*)::integer into v_approved
  from public.teams
  where tournament_id = p_tournament_id and status = 'approved';
  if v_approved >= v_tournament.max_teams then
    raise exception using errcode = 'P0001', message = 'El torneo ya completó el cupo.';
  end if;
  v_names := array(
    select btrim(player_name)
    from unnest(p_player_names) with ordinality as player_rows(player_name, position)
    order by position
  );

  insert into public.teams (
    tournament_id, name, captain_id, status, organizer_registered
  )
  values (p_tournament_id, v_name, v_uid, 'approved', true)
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

revoke execute on function public.create_organizer_team(uuid, text, text[], uuid[]) from public, anon;
grant execute on function public.create_organizer_team(uuid, text, text[], uuid[]) to authenticated;
