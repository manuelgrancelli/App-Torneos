-- -----------------------------------------------------------------------------
-- Invitaciones explícitas a integrantes por email.
-- -----------------------------------------------------------------------------

create table public.team_invitations (
  team_member_id uuid primary key references public.team_members (id) on delete cascade,
  token_hash text not null unique check (token_hash ~ '^[0-9a-f]{64}$'),
  expires_at timestamptz not null,
  sent_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.team_invitations is
  'Invitaciones de un solo uso. Solo guarda el hash del token; el token original se envía por email.';

alter table public.team_invitations enable row level security;
revoke all on table public.team_invitations from anon, authenticated;

-- Deja de vincular integrantes automáticamente al confirmar el email: ahora
-- cada persona tiene que aceptar una invitación dirigida a su cuenta.
drop trigger if exists on_auth_user_verified on auth.users;
drop function if exists public.link_pending_memberships();

create or replace function public.add_team_members(p_team_id uuid, p_tournament_id uuid, p_emails text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
begin
  foreach v_email in array coalesce(p_emails, '{}') loop
    if exists (
      select 1 from public.team_members
      where tournament_id = p_tournament_id and email = v_email and team_id <> p_team_id
    ) then
      raise exception using errcode = 'P0001',
        message = format('%s ya está inscripto en otro equipo de este torneo.', v_email);
    end if;

    insert into public.team_members (team_id, tournament_id, email, user_id, role)
    values (p_team_id, p_tournament_id, v_email, null, 'player')
    on conflict (team_id, email) do nothing;
  end loop;
end;
$$;

create function public.create_team_invitation(
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
  for update of tm;

  if not found or v_captain_id <> v_uid then
    raise exception using errcode = '42501', message = 'Solo el capitán puede invitar a sus compañeros.';
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

create function public.accept_team_invitation(p_token_hash text)
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
  if v_team_status <> 'pending' then
    raise exception using errcode = 'P0001', message = 'La inscripción ya no está pendiente.';
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

  update public.teams set status = 'pending' where id = v_team_id;
  delete from public.team_invitations where team_member_id = v_team_member_id;
  return v_team_id;
end;
$$;

revoke execute on function public.create_team_invitation(uuid, uuid, text) from public, anon;
revoke execute on function public.accept_team_invitation(text) from public, anon;
grant execute on function public.create_team_invitation(uuid, uuid, text) to authenticated;
grant execute on function public.accept_team_invitation(text) to authenticated;

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
    if v_unaccepted > 0 then
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
