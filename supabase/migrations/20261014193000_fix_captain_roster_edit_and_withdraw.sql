-- Corrección de autorización para editar y dar de baja equipos (capitán y organizador),
-- invitaciones en parejas auto-aprobadas y prevención de auto-inscripción duplicada.

-- 1. update_team_roster: permite editar al capitán O al organizador del torneo,
-- sin bloquear por organizer_registered.
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
  if not found then
    raise exception using errcode = '42501', message = 'Solo el capitán puede editar el equipo.';
  end if;

  select * into v_tournament from public.tournaments where id = v_team.tournament_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'El torneo no existe.';
  end if;

  if v_team.captain_id <> v_uid and v_tournament.organizer_id <> v_uid then
    raise exception using errcode = '42501', message = 'Solo el capitán puede editar el equipo.';
  end if;

  if v_tournament.status <> 'registration_open' then
    raise exception using errcode = 'P0001', message = 'La inscripción ya cerró: no se puede modificar el equipo.';
  end if;

  select * into v_sport from public.sports where id = v_tournament.sport_id;
  select email into v_captain_email from public.team_members where team_id = p_team_id and role = 'captain';
  v_emails := public.normalize_emails(p_member_emails);

  if v_captain_email is not null and v_captain_email = any(v_emails) then
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
  where team_id = p_team_id and role = 'player' and email is not null;

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

-- 2. withdraw_team: permite dar de baja al capitán O al organizador del torneo,
-- sin bloquear por organizer_registered.
create or replace function public.withdraw_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_team public.teams%rowtype;
  v_tournament public.tournaments%rowtype;
begin
  select * into v_team from public.teams where id = p_team_id;
  if not found then
    raise exception using errcode = '42501', message = 'Solo el capitán puede dar de baja la inscripción.';
  end if;

  select * into v_tournament from public.tournaments where id = v_team.tournament_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'El torneo no existe.';
  end if;

  if v_team.captain_id <> v_uid and v_tournament.organizer_id <> v_uid then
    raise exception using errcode = '42501', message = 'Solo el capitán puede dar de baja la inscripción.';
  end if;

  if v_tournament.status <> 'registration_open' then
    raise exception using errcode = 'P0001',
      message = 'La inscripción ya cerró: pedile al organizador que te dé de baja.';
  end if;

  delete from public.teams where id = p_team_id;
end;
$$;

-- 3. create_team_invitation: permite enviar invitaciones si el usuario es capitán u organizador,
-- sin bloquear equipos auto-aprobados ni organizer_registered si tienen email.
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
  v_organizer_id uuid;
  v_email text;
  v_team_name text;
  v_tournament_name text;
  v_tournament_status public.tournament_status;
  v_team_status public.team_status;
  v_last_sent_at timestamptz;
begin
  select tm.email, t.name, tr.name, t.captain_id, tr.organizer_id, tr.status, t.status
  into v_email, v_team_name, v_tournament_name, v_captain_id, v_organizer_id, v_tournament_status, v_team_status
  from public.team_members tm
  join public.teams t on t.id = tm.team_id
  join public.tournaments tr on tr.id = tm.tournament_id
  where tm.id = p_team_member_id and tm.team_id = p_team_id and tm.role = 'player'
  for update of tm;

  if not found or (v_captain_id <> v_uid and v_organizer_id <> v_uid) then
    raise exception using errcode = '42501', message = 'Solo el capitán puede invitar a sus compañeros.';
  end if;
  if v_email is null then
    raise exception using errcode = 'P0001', message = 'Este integrante no tiene un email para invitar.';
  end if;
  if v_tournament_status <> 'registration_open' then
    raise exception using errcode = 'P0001', message = 'La inscripción ya cerró: no se pueden enviar invitaciones.';
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

-- 4. accept_team_invitation: permite aceptar en equipos 'pending' o 'approved'
create or replace function public.accept_team_invitation(p_token_hash text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_team_member_id uuid;
  v_team_id uuid;
  v_tournament_id uuid;
  v_invited_email text;
  v_user_email text;
  v_email_confirmed_at timestamptz;
  v_team_status public.team_status;
  v_tournament_status public.tournament_status;
begin
  if p_token_hash is null or p_token_hash !~ '^[0-9a-f]{64}$' then
    raise exception using errcode = 'P0001', message = 'La invitación no es válida o venció.';
  end if;

  select i.team_member_id, tm.team_id, tm.tournament_id, tm.email, t.status
  into v_team_member_id, v_team_id, v_tournament_id, v_invited_email, v_team_status
  from public.team_invitations i
  join public.team_members tm on tm.id = i.team_member_id
  join public.teams t on t.id = tm.team_id
  where i.token_hash = p_token_hash and i.expires_at > now()
  for update of i, tm;

  if not found then
    raise exception using errcode = 'P0001', message = 'La invitación no es válida o venció.';
  end if;
  if v_team_status not in ('pending', 'approved') then
    raise exception using errcode = 'P0001', message = 'La inscripción no está disponible.';
  end if;

  select u.email, u.email_confirmed_at
  into v_user_email, v_email_confirmed_at
  from auth.users u
  where u.id = v_uid;

  if v_email_confirmed_at is null then
    raise exception using errcode = 'P0001', message = 'Confirmá tu email antes de aceptar la invitación.';
  end if;
  if v_user_email is null or lower(v_user_email) <> v_invited_email then
    raise exception using errcode = 'P0001',
      message = 'Iniciá sesión con el mismo email al que enviaron la invitación.';
  end if;

  select status into v_tournament_status
  from public.tournaments
  where id = v_tournament_id
  for update;
  if v_tournament_status <> 'registration_open' then
    raise exception using errcode = 'P0001', message = 'La inscripción ya cerró: no se puede aceptar la invitación.';
  end if;
  if exists (
    select 1 from public.team_members
    where tournament_id = v_tournament_id
      and team_id <> v_team_id
      and (user_id = v_uid or email = v_invited_email)
  ) then
    raise exception using errcode = 'P0001', message = 'Ya estás inscripto en otro equipo de este torneo.';
  end if;

  update public.team_members
  set user_id = v_uid
  where id = v_team_member_id and user_id is null;
  if not found then
    raise exception using errcode = 'P0001', message = 'La invitación ya fue aceptada.';
  end if;

  update public.teams
  set status = case when v_team_status = 'approved' then 'approved'::public.team_status else 'pending'::public.team_status end
  where id = v_team_id;

  delete from public.team_invitations where team_member_id = v_team_member_id;
  return v_team_id;
end;
$$;

-- 5. register_team: siempre establece organizer_registered = false,
-- valida que el capitán no se auto-inscriba en v_emails y valida que ningún
-- compañero esté ya inscripto en el torneo.
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
  v_email text := public.require_user_email();
  v_tournament public.tournaments%rowtype;
  v_sport public.sports%rowtype;
  v_team_id uuid;
  v_name text := btrim(coalesce(p_team_name, ''));
  v_emails text[];
  v_member_email text;
  v_existing_user uuid;
  v_is_organizer boolean;
  v_status public.team_status;
  v_cat public.tournament_categories%rowtype;
begin
  select * into v_tournament
  from public.tournaments
  where invite_code = upper(btrim(coalesce(p_code, '')))
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'El código no es válido.';
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
    if (select count(*) from public.teams where tournament_id = v_tournament.id and category_id = p_category_id and status = 'approved')
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

-- 6. Backfill para corregir equipos existentes donde organizer_registered quedó en true
-- a pesar de haberse inscripto con cuentas o emails reales
update public.teams
set organizer_registered = false
where organizer_registered = true
  and exists (
    select 1 from public.team_members
    where team_id = teams.id and email is not null
  );

revoke execute on function public.update_team_roster(uuid, text, text[]) from public, anon;
grant execute on function public.update_team_roster(uuid, text, text[]) to authenticated;

revoke execute on function public.withdraw_team(uuid) from public, anon;
grant execute on function public.withdraw_team(uuid) to authenticated;

revoke execute on function public.create_team_invitation(uuid, uuid, text) from public, anon;
grant execute on function public.create_team_invitation(uuid, uuid, text) to authenticated;

revoke execute on function public.accept_team_invitation(text) from public, anon;
grant execute on function public.accept_team_invitation(text) to authenticated;

revoke execute on function public.register_team(text, text, text[], uuid) from public, anon;
grant execute on function public.register_team(text, text, text[], uuid) to authenticated;
