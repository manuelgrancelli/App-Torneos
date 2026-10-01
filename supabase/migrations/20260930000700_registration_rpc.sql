-- =============================================================================
-- RPCs de la fase 2: alta y ciclo de vida del torneo, inscripciones y
-- disponibilidad. Todas validan permisos y estado explícitamente: la API de
-- PostgREST es pública, así que estas funciones son la barrera real.
-- Los errores de negocio usan errcode P0001 con mensajes en español aptos para
-- mostrar al usuario; los de permisos usan 42501.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- Utilitarias internas (no expuestas)
-- -----------------------------------------------------------------------------

create function public.require_user()
returns uuid
language plpgsql
stable
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Tenés que iniciar sesión.';
  end if;
  return v_uid;
end;
$$;

-- "abc-12 3" → "ABC123": el usuario puede tipear el código con espacios o guiones.
create function public.normalize_code(p_code text)
returns text
language sql
immutable
set search_path = ''
as $$
  select upper(regexp_replace(coalesce(p_code, ''), '[^A-Za-z0-9]', '', 'g'));
$$;

-- Normaliza (minúsculas, sin espacios), valida y deduplica una lista de emails.
create function public.normalize_emails(p_emails text[])
returns text[]
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_email text;
  v_result text[] := '{}'::text[];
begin
  if coalesce(cardinality(p_emails), 0) > 60 then
    raise exception using errcode = 'P0001', message = 'Demasiados emails.';
  end if;

  foreach v_email in array coalesce(p_emails, '{}') loop
    v_email := lower(btrim(v_email));
    continue when v_email = '';
    if char_length(v_email) > 254 or v_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
      raise exception using errcode = 'P0001', message = format('"%s" no es un email válido.', left(v_email, 60));
    end if;
    if not v_email = any(v_result) then
      v_result := v_result || v_email;
    end if;
  end loop;

  return v_result;
end;
$$;

create function public.tournament_status_label(p_status public.tournament_status)
returns text
language sql
immutable
set search_path = ''
as $$
  select case p_status
    when 'draft' then 'borrador'
    when 'registration_open' then 'inscripción abierta'
    when 'group_stage' then 'fase de grupos'
    when 'playoffs' then 'playoffs'
    when 'finished' then 'finalizado'
  end;
$$;

-- Agrega integrantes por email a un equipo. Si el email tiene cuenta verificada
-- se vincula al usuario; si no, queda pendiente (lo vincula on_auth_user_verified).
create function public.add_team_members(p_team_id uuid, p_tournament_id uuid, p_emails text[])
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_email text;
  v_user_id uuid;
begin
  foreach v_email in array coalesce(p_emails, '{}') loop
    if exists (
      select 1 from public.team_members
      where tournament_id = p_tournament_id and email = v_email and team_id <> p_team_id
    ) then
      raise exception using errcode = 'P0001',
        message = format('%s ya está inscripto en otro equipo de este torneo.', v_email);
    end if;

    select u.id into v_user_id
    from auth.users u
    join public.profiles p on p.id = u.id
    where lower(u.email) = v_email and u.email_confirmed_at is not null
    limit 1;

    if v_user_id is not null and exists (
      select 1 from public.team_members
      where tournament_id = p_tournament_id and user_id = v_user_id and team_id <> p_team_id
    ) then
      raise exception using errcode = 'P0001',
        message = format('%s ya está inscripto en otro equipo de este torneo.', v_email);
    end if;

    insert into public.team_members (team_id, tournament_id, email, user_id, role)
    values (p_team_id, p_tournament_id, v_email, v_user_id, 'player')
    on conflict (team_id, email) do nothing;
  end loop;
end;
$$;

revoke execute on function public.require_user() from public, anon, authenticated;
revoke execute on function public.normalize_code(text) from public, anon, authenticated;
revoke execute on function public.normalize_emails(text[]) from public, anon, authenticated;
revoke execute on function public.tournament_status_label(public.tournament_status) from public, anon, authenticated;
revoke execute on function public.add_team_members(uuid, uuid, text[]) from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Torneos
-- -----------------------------------------------------------------------------

-- Crea el torneo con sus canchas en una sola transacción. El código de
-- inscripción lo genera el trigger tournaments_create_invite.
create function public.create_tournament(
  p_sport_id text,
  p_name text,
  p_slug text,
  p_description text,
  p_starts_on date,
  p_ends_on date,
  p_timezone text,
  p_max_teams integer,
  p_court_names text[],
  p_scoring_config jsonb default null,
  p_standings_config jsonb default null,
  p_playoff_config jsonb default null,
  p_results_require_confirmation boolean default false
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_sport public.sports%rowtype;
  v_tournament_id uuid;
  v_court text;
  v_courts text[] := '{}'::text[];
  v_position integer := 0;
begin
  select * into v_sport from public.sports where id = p_sport_id;
  if not found then
    raise exception using errcode = 'P0001', message = 'El deporte elegido no existe.';
  end if;

  foreach v_court in array coalesce(p_court_names, '{}') loop
    v_court := btrim(v_court);
    continue when v_court = '';
    if lower(v_court) = any(select lower(c) from unnest(v_courts) as c) then
      raise exception using errcode = 'P0001', message = 'Las canchas no pueden tener nombres repetidos.';
    end if;
    v_courts := v_courts || v_court;
  end loop;

  if cardinality(v_courts) not between 1 and 50 then
    raise exception using errcode = 'P0001', message = 'Definí entre 1 y 50 canchas.';
  end if;

  insert into public.tournaments (
    organizer_id, sport_id, name, slug, description, starts_on, ends_on, timezone,
    max_teams, scoring_config, standings_config, playoff_config, results_require_confirmation
  ) values (
    v_uid, p_sport_id, btrim(p_name), p_slug, nullif(btrim(p_description), ''), p_starts_on, p_ends_on,
    coalesce(nullif(btrim(p_timezone), ''), 'America/Argentina/Buenos_Aires'),
    p_max_teams,
    coalesce(p_scoring_config, v_sport.default_scoring_config),
    coalesce(p_standings_config, v_sport.default_standings_config),
    coalesce(p_playoff_config, '{"qualifiersPerGroup": 2, "thirdPlace": false}'::jsonb),
    coalesce(p_results_require_confirmation, false)
  )
  returning id into v_tournament_id;

  foreach v_court in array v_courts loop
    v_position := v_position + 1;
    insert into public.courts (tournament_id, name, position)
    values (v_tournament_id, v_court, v_position);
  end loop;

  return v_tournament_id;
end;
$$;

-- Cambia el estado validando la transición y sus precondiciones.
-- p_champion_team_id solo aplica al finalizar un torneo sin playoffs: el
-- campeón lo calcula la app con la tabla de posiciones y sus desempates.
create function public.set_tournament_status(
  p_tournament_id uuid,
  p_status public.tournament_status,
  p_champion_team_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament public.tournaments%rowtype;
  v_count integer;
  v_champion uuid;
begin
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found or v_tournament.organizer_id <> v_uid then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este torneo.';
  end if;

  if v_tournament.status = p_status then
    return;
  end if;

  if v_tournament.status = 'draft' and p_status = 'registration_open' then
    if not exists (select 1 from public.time_slots where tournament_id = p_tournament_id) then
      raise exception using errcode = 'P0001',
        message = 'Cargá al menos una franja horaria antes de abrir la inscripción.';
    end if;

  elsif v_tournament.status = 'registration_open' and p_status = 'draft' then
    if exists (select 1 from public.teams where tournament_id = p_tournament_id) then
      raise exception using errcode = 'P0001',
        message = 'No se puede volver a borrador: ya hay inscripciones.';
    end if;

  elsif v_tournament.status = 'registration_open' and p_status = 'group_stage' then
    select count(*) into v_count
    from public.teams
    where tournament_id = p_tournament_id and status = 'approved';
    if v_count < 2 then
      raise exception using errcode = 'P0001',
        message = 'Necesitás al menos 2 inscripciones aprobadas para empezar la fase de grupos.';
    end if;

  elsif v_tournament.status = 'group_stage' and p_status in ('playoffs', 'finished') then
    if not exists (select 1 from public.matches where tournament_id = p_tournament_id and stage = 'group') then
      raise exception using errcode = 'P0001',
        message = 'Todavía no se generaron los partidos de la fase de grupos.';
    end if;
    if exists (
      select 1 from public.matches
      where tournament_id = p_tournament_id and stage = 'group' and result_status is null
    ) then
      raise exception using errcode = 'P0001', message = 'Faltan cargar resultados de la fase de grupos.';
    end if;
    if p_status = 'finished' and p_champion_team_id is not null then
      if not exists (
        select 1 from public.teams
        where id = p_champion_team_id and tournament_id = p_tournament_id and status = 'approved'
      ) then
        raise exception using errcode = 'P0001', message = 'El campeón indicado no es un equipo del torneo.';
      end if;
      v_champion := p_champion_team_id;
    end if;

  elsif v_tournament.status = 'playoffs' and p_status = 'finished' then
    -- La final es el partido de playoff sin partido siguiente que no es por el 3er puesto.
    select winner_team_id into v_champion
    from public.matches
    where tournament_id = p_tournament_id
      and stage = 'playoff'
      and not is_third_place
      and next_match_id is null
    order by round desc
    limit 1;
    if v_champion is null then
      raise exception using errcode = 'P0001', message = 'Falta cargar el resultado de la final.';
    end if;

  else
    raise exception using errcode = 'P0001',
      message = format('No se puede pasar de "%s" a "%s".',
        public.tournament_status_label(v_tournament.status),
        public.tournament_status_label(p_status));
  end if;

  update public.tournaments
  set status = p_status,
      champion_team_id = coalesce(v_champion, champion_team_id)
  where id = p_tournament_id;
end;
$$;

-- Regenera el código de inscripción (invalida el link anterior).
create function public.rotate_invite_code(p_tournament_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_code text;
begin
  if not exists (
    select 1 from public.tournaments where id = p_tournament_id and organizer_id = v_uid
  ) then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este torneo.';
  end if;

  loop
    v_code := public.generate_code(10);
    begin
      update public.tournament_invites
      set code = v_code, rotated_at = now()
      where tournament_id = p_tournament_id;
      exit;
    exception when unique_violation then
      -- colisión: se prueba con otro código
    end;
  end loop;

  return v_code;
end;
$$;

-- Datos mínimos del torneo al que lleva un código (para la pantalla de
-- inscripción). No devuelve nada para torneos en borrador.
create function public.resolve_invite_code(p_code text)
returns table (
  tournament_id uuid,
  name text,
  slug text,
  sport_id text,
  sport_name text,
  scoring_type public.scoring_type,
  min_team_size smallint,
  max_team_size smallint,
  status public.tournament_status,
  starts_on date,
  ends_on date,
  max_teams smallint,
  approved_teams integer,
  my_team_id uuid
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id,
    t.name,
    t.slug,
    s.id,
    s.name,
    s.scoring_type,
    s.min_team_size,
    s.max_team_size,
    t.status,
    t.starts_on,
    t.ends_on,
    t.max_teams,
    (select count(*)::integer from public.teams x where x.tournament_id = t.id and x.status = 'approved'),
    (select tm.team_id from public.team_members tm
      where tm.tournament_id = t.id and tm.user_id = (select auth.uid()) limit 1)
  from public.tournament_invites i
  join public.tournaments t on t.id = i.tournament_id
  join public.sports s on s.id = t.sport_id
  where i.code = public.normalize_code(p_code)
    and t.status <> 'draft';
$$;

-- -----------------------------------------------------------------------------
-- Inscripciones
-- -----------------------------------------------------------------------------

-- Inscribe un equipo con el código del torneo. Quien llama queda como capitán
-- y los emails se vinculan como compañeros (sin aceptación).
create function public.register_team(p_code text, p_team_name text, p_member_emails text[])
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_email text;
  v_tournament public.tournaments%rowtype;
  v_sport public.sports%rowtype;
  v_emails text[];
  v_name text := btrim(coalesce(p_team_name, ''));
  v_team_id uuid;
begin
  select lower(email) into v_email
  from auth.users
  where id = v_uid and email_confirmed_at is not null;
  if v_email is null then
    raise exception using errcode = 'P0001', message = 'Confirmá tu email antes de inscribirte.';
  end if;

  -- Lock del torneo: serializa inscripciones concurrentes (cupo y duplicados).
  select t.* into v_tournament
  from public.tournament_invites i
  join public.tournaments t on t.id = i.tournament_id
  where i.code = public.normalize_code(p_code)
  for update of t;

  if not found then
    raise exception using errcode = 'P0001', message = 'El código de inscripción no es válido.';
  end if;
  if v_tournament.status <> 'registration_open' then
    raise exception using errcode = 'P0001', message = 'La inscripción de este torneo no está abierta.';
  end if;

  select * into v_sport from public.sports where id = v_tournament.sport_id;
  v_emails := public.normalize_emails(p_member_emails);

  if v_email = any(v_emails) then
    raise exception using errcode = 'P0001', message = 'No incluyas tu propio email: ya quedás como capitán.';
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
  if exists (
    select 1 from public.team_members
    where tournament_id = v_tournament.id and (user_id = v_uid or email = v_email)
  ) then
    raise exception using errcode = 'P0001', message = 'Ya estás inscripto en este torneo.';
  end if;
  if (select count(*) from public.teams where tournament_id = v_tournament.id and status = 'approved')
     >= v_tournament.max_teams then
    raise exception using errcode = 'P0001', message = 'El torneo ya completó el cupo.';
  end if;
  if char_length(v_name) not between 2 and 60 then
    raise exception using errcode = 'P0001', message = 'El nombre del equipo tiene que tener entre 2 y 60 caracteres.';
  end if;
  if exists (
    select 1 from public.teams where tournament_id = v_tournament.id and lower(name) = lower(v_name)
  ) then
    raise exception using errcode = 'P0001', message = 'Ya hay un equipo con ese nombre en el torneo.';
  end if;

  insert into public.teams (tournament_id, name, captain_id)
  values (v_tournament.id, v_name, v_uid)
  returning id into v_team_id;

  insert into public.team_members (team_id, tournament_id, email, user_id, role)
  values (v_team_id, v_tournament.id, v_email, v_uid, 'captain');

  perform public.add_team_members(v_team_id, v_tournament.id, v_emails);

  return v_team_id;
end;
$$;

-- El capitán cambia el nombre o los integrantes mientras la inscripción está
-- abierta. Si cambian los integrantes, vuelve a quedar pendiente de aprobación.
create function public.update_team_roster(p_team_id uuid, p_team_name text, p_member_emails text[])
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
  if not found or v_team.captain_id <> v_uid then
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

-- El capitán da de baja la inscripción (solo con la inscripción abierta).
-- Se borra el equipo: así sus integrantes pueden anotarse en otro.
create function public.withdraw_team(p_team_id uuid)
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
  if not found or v_team.captain_id <> v_uid then
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

-- Un integrante (no capitán) se sale del equipo. Protege a quien fue vinculado
-- sin su consentimiento. El equipo vuelve a quedar pendiente.
create function public.leave_team(p_team_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_member public.team_members%rowtype;
begin
  select * into v_member from public.team_members where team_id = p_team_id and user_id = v_uid;
  if not found then
    raise exception using errcode = '42501', message = 'No sos integrante de este equipo.';
  end if;
  if v_member.role = 'captain' then
    raise exception using errcode = 'P0001',
      message = 'Sos el capitán: para bajarte, dá de baja la inscripción.';
  end if;

  perform 1 from public.tournaments where id = v_member.tournament_id and status = 'registration_open' for update;
  if not found then
    raise exception using errcode = 'P0001',
      message = 'La inscripción ya cerró: pedile al organizador que te dé de baja.';
  end if;

  delete from public.team_members where id = v_member.id;
  update public.teams set status = 'pending' where id = p_team_id;
end;
$$;

-- Reemplaza la disponibilidad del equipo por la lista recibida (atómico).
-- Devuelve cuántas franjas quedaron marcadas.
create function public.set_team_availability(p_team_id uuid, p_slot_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament_id uuid;
  v_slot_ids uuid[] := coalesce(p_slot_ids, '{}');
begin
  if cardinality(v_slot_ids) > 1000 then
    raise exception using errcode = 'P0001', message = 'Demasiadas franjas.';
  end if;

  select tournament_id into v_tournament_id
  from public.team_members
  where team_id = p_team_id and user_id = v_uid;
  if v_tournament_id is null then
    raise exception using errcode = '42501', message = 'No sos integrante de este equipo.';
  end if;

  perform 1 from public.tournaments where id = v_tournament_id and status = 'registration_open';
  if not found then
    raise exception using errcode = 'P0001',
      message = 'La disponibilidad solo se puede cambiar con la inscripción abierta.';
  end if;

  if exists (
    select 1 from unnest(v_slot_ids) as s(id)
    where not exists (
      select 1 from public.time_slots ts where ts.id = s.id and ts.tournament_id = v_tournament_id
    )
  ) then
    raise exception using errcode = 'P0001', message = 'Alguna de las franjas no pertenece a este torneo.';
  end if;

  delete from public.team_availability
  where team_id = p_team_id and not (slot_id = any(v_slot_ids));

  insert into public.team_availability (team_id, slot_id, tournament_id)
  select p_team_id, s.id, v_tournament_id
  from (select distinct unnest(v_slot_ids) as id) as s
  on conflict (team_id, slot_id) do nothing;

  return (select count(*)::integer from public.team_availability where team_id = p_team_id);
end;
$$;

-- El organizador aprueba o rechaza una inscripción (con la inscripción abierta).
create function public.review_registration(p_team_id uuid, p_decision public.team_status)
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
    select count(*) into v_members from public.team_members where team_id = p_team_id;
    if v_members not between v_sport.min_team_size and v_sport.max_team_size then
      raise exception using errcode = 'P0001', message = 'El equipo no tiene el plantel completo.';
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

-- -----------------------------------------------------------------------------
-- Permisos de ejecución
-- -----------------------------------------------------------------------------

revoke execute on function public.create_tournament(text, text, text, text, date, date, text, integer, text[], jsonb, jsonb, jsonb, boolean) from public, anon;
revoke execute on function public.set_tournament_status(uuid, public.tournament_status, uuid) from public, anon;
revoke execute on function public.rotate_invite_code(uuid) from public, anon;
revoke execute on function public.resolve_invite_code(text) from public;
revoke execute on function public.register_team(text, text, text[]) from public, anon;
revoke execute on function public.update_team_roster(uuid, text, text[]) from public, anon;
revoke execute on function public.withdraw_team(uuid) from public, anon;
revoke execute on function public.leave_team(uuid) from public, anon;
revoke execute on function public.set_team_availability(uuid, uuid[]) from public, anon;
revoke execute on function public.review_registration(uuid, public.team_status) from public, anon;

grant execute on function public.create_tournament(text, text, text, text, date, date, text, integer, text[], jsonb, jsonb, jsonb, boolean) to authenticated;
grant execute on function public.set_tournament_status(uuid, public.tournament_status, uuid) to authenticated;
grant execute on function public.rotate_invite_code(uuid) to authenticated;
grant execute on function public.resolve_invite_code(text) to anon, authenticated;
grant execute on function public.register_team(text, text, text[]) to authenticated;
grant execute on function public.update_team_roster(uuid, text, text[]) to authenticated;
grant execute on function public.withdraw_team(uuid) to authenticated;
grant execute on function public.leave_team(uuid) to authenticated;
grant execute on function public.set_team_availability(uuid, uuid[]) to authenticated;
grant execute on function public.review_registration(uuid, public.team_status) to authenticated;
