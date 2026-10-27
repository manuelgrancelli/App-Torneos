-- =============================================================================
-- Unificación del deporte Fútbol a una única opción y carga flexible de jugadores
-- con nombre y/o email según el reglamento del flyer del organizador.
-- =============================================================================

-- 1. Unificar torneos existentes hacia el deporte 'futbol'
update public.tournaments
set sport_id = 'futbol'
where sport_id in ('futbol-11', 'futbol-5', 'futbol-7', 'futbol-8');

-- 2. Eliminar variantes fragmentadas de fútbol del catálogo
delete from public.sports
where id in ('futbol-11', 'futbol-5', 'futbol-7', 'futbol-8');

-- 3. Consolidar el deporte 'futbol' como opción única en public.sports
insert into public.sports (
  id, name, scoring_type, min_team_size, max_team_size,
  default_scoring_config, default_standings_config, sort_order
) values (
  'futbol', 'Fútbol', 'goals', 1, 30,
  '{"type": "goals", "playoffTiebreak": "penalties"}',
  '{"points": {"win": 3, "draw": 1, "loss": 0}, "tiebreakers": ["points", "goal_diff", "goals_for", "head_to_head"]}',
  3
)
on conflict (id) do update set
  name = excluded.name,
  scoring_type = excluded.scoring_type,
  min_team_size = excluded.min_team_size,
  max_team_size = excluded.max_team_size,
  default_scoring_config = excluded.default_scoring_config,
  default_standings_config = excluded.default_standings_config,
  sort_order = excluded.sort_order;

-- 4. Actualizar register_team para aceptar nombres de jugadores (p_member_names)
-- Eliminar firmas previas para prevenir ambigüedades PGRST203 en PostgREST
drop function if exists public.register_team(text, text, text[], uuid);
drop function if exists public.register_team(text, text, text[], uuid, text);
drop function if exists public.register_team(text, text, text[], uuid, text, text[]);

create or replace function public.register_team(
  p_code text,
  p_team_name text,
  p_member_emails text[] default '{}'::text[],
  p_category_id uuid default null,
  p_logo_url text default null,
  p_member_names text[] default '{}'::text[]
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
  v_names text[];
  v_name text := btrim(coalesce(p_team_name, ''));
  v_team_id uuid;
  v_curr_email text;
  v_curr_name text;
  v_existing_user uuid;
  v_is_organizer boolean;
  v_status public.team_status;
  v_max_items integer;
  i integer;
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
  v_emails := coalesce(p_member_emails, '{}'::text[]);
  v_names := coalesce(p_member_names, '{}'::text[]);

  -- Si NO es el organizador haciendo pruebas, no puede inscribirse 2 veces en el torneo
  if not v_is_organizer then
    if exists (
      select 1 from public.team_members
      where tournament_id = v_tournament.id and (user_id = v_uid or email = v_email)
    ) then
      raise exception using errcode = 'P0001', message = 'Ya estás inscripto en este torneo.';
    end if;
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

  insert into public.teams (tournament_id, category_id, name, captain_id, status, organizer_registered, logo_url)
  values (v_tournament.id, p_category_id, v_name, v_uid, v_status, false, p_logo_url)
  returning id into v_team_id;

  -- Insertar capitán
  insert into public.team_members (team_id, tournament_id, email, user_id, role)
  values (v_team_id, v_tournament.id, v_email, v_uid, 'captain');

  -- Insertar integrantes agregados por nombre y/o email
  v_max_items := greatest(cardinality(v_emails), cardinality(v_names));
  if v_max_items is not null and v_max_items > 0 then
    for i in 1..v_max_items loop
      v_curr_email := null;
      v_curr_name := null;
      if i <= cardinality(v_emails) then
        v_curr_email := lower(btrim(coalesce(v_emails[i], '')));
        if v_curr_email = '' or v_curr_email = v_email then
          v_curr_email := null;
        end if;
      end if;

      if i <= cardinality(v_names) then
        v_curr_name := btrim(coalesce(v_names[i], ''));
        if v_curr_name = '' then
          v_curr_name := null;
        end if;
      end if;

      if v_curr_email is not null or v_curr_name is not null then
        v_existing_user := null;
        if v_curr_email is not null then
          select id into v_existing_user
          from auth.users
          where lower(email) = v_curr_email and email_confirmed_at is not null;
        end if;

        insert into public.team_members (team_id, tournament_id, email, display_name, user_id, role)
        values (v_team_id, v_tournament.id, v_curr_email, v_curr_name, v_existing_user, 'player')
        on conflict do nothing;
      end if;
    end loop;
  end if;

  -- Activar todas las franjas horarias existentes del torneo para el nuevo equipo
  insert into public.team_availability (team_id, slot_id, tournament_id)
  select v_team_id, ts.id, v_tournament.id
  from public.time_slots ts
  where ts.tournament_id = v_tournament.id
  on conflict (team_id, slot_id) do nothing;

  return v_team_id;
end;
$$;

revoke execute on function public.register_team(text, text, text[], uuid, text, text[]) from public, anon;
grant execute on function public.register_team(text, text, text[], uuid, text, text[]) to authenticated;

-- 5. Actualizar review_registration para contemplar planteles flexibles de fútbol
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
  if v_tournament.organizer_id <> v_uid and not private.is_tournament_organizer(v_tournament.id) then
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

    if v_sport.scoring_type = 'sets' and v_members not between v_sport.min_team_size and v_sport.max_team_size then
      raise exception using errcode = 'P0001', message = 'La pareja no tiene el plantel completo.';
    end if;

    if v_sport.scoring_type = 'goals' and (v_members < 1 or v_members > v_sport.max_team_size) then
      raise exception using errcode = 'P0001', message = 'El equipo tiene que tener al menos 1 integrante.';
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

-- 6. Actualizar add_team_member para admitir p_name opcional
drop function if exists public.add_team_member(uuid, text);
drop function if exists public.add_team_member(uuid, text, text);

create or replace function public.add_team_member(
  p_team_id uuid,
  p_email text default null,
  p_name text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_team public.teams%rowtype;
  v_tournament public.tournaments%rowtype;
  v_sport public.sports%rowtype;
  v_norm_email text := lower(btrim(coalesce(p_email, '')));
  v_norm_name text := btrim(coalesce(p_name, ''));
  v_captain_email text;
  v_current_count integer;
  v_existing_user uuid := null;
  v_member_id uuid;
begin
  if v_norm_email = '' then
    v_norm_email := null;
  end if;
  if v_norm_name = '' then
    v_norm_name := null;
  end if;

  if v_norm_email is null and v_norm_name is null then
    raise exception using errcode = 'P0001', message = 'Ingresá el nombre o el email del jugador.';
  end if;

  if v_norm_email is not null and v_norm_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
    raise exception using errcode = 'P0001', message = 'Ingresá un email válido.';
  end if;

  select * into v_team from public.teams where id = p_team_id;
  if not found then
    raise exception using errcode = '42501', message = 'Equipo inexistente.';
  end if;

  select * into v_tournament from public.tournaments where id = v_team.tournament_id;
  if v_team.captain_id <> v_uid and v_tournament.organizer_id <> v_uid and not private.is_tournament_organizer(v_tournament.id) then
    raise exception using errcode = '42501', message = 'Solo el capitán o el organizador pueden agregar integrantes.';
  end if;

  if v_tournament.status <> 'registration_open' then
    raise exception using errcode = 'P0001', message = 'La inscripción ya cerró: no se pueden sumar integrantes.';
  end if;

  select * into v_sport from public.sports where id = v_tournament.sport_id;

  select count(*)::integer into v_current_count
  from public.team_members
  where team_id = p_team_id;

  if v_current_count >= v_sport.max_team_size then
    raise exception using errcode = 'P0001',
      message = format('El equipo ya alcanzó el límite máximo de %s integrantes.', v_sport.max_team_size);
  end if;

  if v_norm_email is not null then
    select email into v_captain_email from public.team_members where team_id = p_team_id and role = 'captain';
    if v_captain_email = v_norm_email then
      raise exception using errcode = 'P0001', message = 'No podés agregar tu propio email: ya sos el capitán.';
    end if;

    if exists (
      select 1 from public.team_members
      where tournament_id = v_tournament.id and email = v_norm_email
    ) then
      raise exception using errcode = 'P0001', message = 'Esta persona ya está inscripta en este torneo.';
    end if;

    select id into v_existing_user
    from auth.users
    where lower(email) = v_norm_email and email_confirmed_at is not null;
  end if;

  insert into public.team_members (team_id, tournament_id, email, display_name, user_id, role)
  values (p_team_id, v_tournament.id, v_norm_email, v_norm_name, v_existing_user, 'player')
  returning id into v_member_id;

  return v_member_id;
end;
$$;

revoke execute on function public.add_team_member(uuid, text, text) from public, anon;
grant execute on function public.add_team_member(uuid, text, text) to authenticated;
