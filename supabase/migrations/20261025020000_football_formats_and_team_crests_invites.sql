-- =============================================================================
-- Formatos de fútbol (F5, F7, F8, F11), escudos de equipo e invitación abierta
-- con enlace directo para unirse automáticamente al equipo.
-- =============================================================================

-- 1. Actualizar catálogo de deportes en public.sports
-- Ampliar fútbol 11 para permitir planteles con suplentes (11 a 25)
update public.sports
set min_team_size = 11, max_team_size = 25
where id = 'futbol-11';

-- Incorporar Fútbol 5, Fútbol 7, Fútbol 8 y Fútbol (general/libre)
insert into public.sports (
  id, name, scoring_type, min_team_size, max_team_size,
  default_scoring_config, default_standings_config, sort_order
) values
  (
    'futbol-5', 'Fútbol 5', 'goals', 5, 15,
    '{"type": "goals", "playoffTiebreak": "penalties"}',
    '{"points": {"win": 3, "draw": 1, "loss": 0}, "tiebreakers": ["points", "goal_diff", "goals_for", "head_to_head"]}',
    3
  ),
  (
    'futbol-7', 'Fútbol 7', 'goals', 7, 18,
    '{"type": "goals", "playoffTiebreak": "penalties"}',
    '{"points": {"win": 3, "draw": 1, "loss": 0}, "tiebreakers": ["points", "goal_diff", "goals_for", "head_to_head"]}',
    4
  ),
  (
    'futbol-8', 'Fútbol 8', 'goals', 8, 20,
    '{"type": "goals", "playoffTiebreak": "penalties"}',
    '{"points": {"win": 3, "draw": 1, "loss": 0}, "tiebreakers": ["points", "goal_diff", "goals_for", "head_to_head"]}',
    5
  ),
  (
    'futbol', 'Fútbol', 'goals', 5, 25,
    '{"type": "goals", "playoffTiebreak": "penalties"}',
    '{"points": {"win": 3, "draw": 1, "loss": 0}, "tiebreakers": ["points", "goal_diff", "goals_for", "head_to_head"]}',
    7
  )
on conflict (id) do update set
  name = excluded.name,
  scoring_type = excluded.scoring_type,
  min_team_size = excluded.min_team_size,
  max_team_size = excluded.max_team_size,
  default_scoring_config = excluded.default_scoring_config,
  default_standings_config = excluded.default_standings_config,
  sort_order = excluded.sort_order;

-- 2. Modificaciones a la tabla public.teams: escudo (logo_url) y código de enlace (invite_code)
alter table public.teams
  add column if not exists logo_url text check (
    logo_url is null or char_length(logo_url) <= 2048
  );

alter table public.teams
  add column if not exists invite_code text unique check (
    invite_code is null or (char_length(invite_code) between 6 and 20 and invite_code ~ '^[A-Za-z0-9_-]+$')
  );

grant select on table public.teams to anon, authenticated;
grant update (name, logo_url) on table public.teams to authenticated;

comment on column public.teams.logo_url is 'Escudo o logo del equipo (URL a imagen o preset).';
comment on column public.teams.invite_code is 'Código para enlace de invitación abierta al equipo.';

-- Generador automático de invite_code para cada equipo nuevo
create or replace function public.teams_assign_invite_code()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.invite_code is null then
    loop
      new.invite_code := public.generate_code(10);
      exit when not exists (select 1 from public.teams where invite_code = new.invite_code);
    end loop;
  end if;
  return new;
end;
$$;

drop trigger if exists teams_before_insert_invite_code on public.teams;
create trigger teams_before_insert_invite_code
  before insert on public.teams
  for each row execute function public.teams_assign_invite_code();

-- Backfill para equipos existentes que no tengan invite_code
do $$
declare
  r record;
  v_new_code text;
begin
  for r in select id from public.teams where invite_code is null loop
    loop
      v_new_code := public.generate_code(10);
      exit when not exists (select 1 from public.teams where invite_code = v_new_code);
    end loop;
    update public.teams set invite_code = v_new_code where id = r.id;
  end loop;
end;
$$;

-- 3. Actualizar register_team para aceptar logo_url y permitir inscripción flexible en fútbol
-- Eliminar firmas previas para prevenir ambigüedades PGRST203 en PostgREST
drop function if exists public.register_team(text, text, text[], uuid);

create or replace function public.register_team(
  p_code text,
  p_team_name text,
  p_member_emails text[],
  p_category_id uuid default null,
  p_logo_url text default null
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

  -- Validación de tamaño de plantel:
  -- En deportes de marcador por goles (fútbol) se permite inscribir con el capitán e ir agregando integrantes luego
  if cardinality(v_emails) + 1 > v_sport.max_team_size then
    raise exception using errcode = 'P0001',
      message = format('El equipo no puede tener más de %s integrantes, contándote a vos.', v_sport.max_team_size);
  end if;

  if v_sport.scoring_type = 'sets' and (cardinality(v_emails) + 1) not between v_sport.min_team_size and v_sport.max_team_size then
    raise exception using errcode = 'P0001',
      message = case
        when v_sport.min_team_size = v_sport.max_team_size
          then format('La pareja tiene que tener %s integrantes, contándote a vos.', v_sport.min_team_size)
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

  insert into public.teams (tournament_id, category_id, name, captain_id, status, organizer_registered, logo_url)
  values (v_tournament.id, p_category_id, v_name, v_uid, v_status, false, p_logo_url)
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

  -- Activar todas las franjas horarias existentes del torneo para el nuevo equipo
  insert into public.team_availability (team_id, slot_id, tournament_id)
  select v_team_id, ts.id, v_tournament.id
  from public.time_slots ts
  where ts.tournament_id = v_tournament.id
  on conflict (team_id, slot_id) do nothing;

  return v_team_id;
end;
$$;

revoke execute on function public.register_team(text, text, text[], uuid, text) from public, anon;
grant execute on function public.register_team(text, text, text[], uuid, text) to authenticated;

-- 4. Actualizar update_team_roster para aceptar p_logo_url y permitir edición ágil
drop function if exists public.update_team_roster(uuid, text, text[]);

create or replace function public.update_team_roster(
  p_team_id uuid,
  p_team_name text,
  p_member_emails text[],
  p_logo_url text default null
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

  if cardinality(v_emails) + 1 > v_sport.max_team_size then
    raise exception using errcode = 'P0001',
      message = format('El equipo no puede superar los %s integrantes, contándote a vos.', v_sport.max_team_size);
  end if;

  if v_sport.scoring_type = 'sets' and (cardinality(v_emails) + 1) not between v_sport.min_team_size and v_sport.max_team_size then
    raise exception using errcode = 'P0001',
      message = format('La pareja tiene que tener %s integrantes, contándote a vos.', v_sport.min_team_size);
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
      logo_url = coalesce(p_logo_url, logo_url),
      status = case when v_roster_changed then 'pending'::public.team_status else status end
  where id = p_team_id;
end;
$$;

revoke execute on function public.update_team_roster(uuid, text, text[], text) from public, anon;
grant execute on function public.update_team_roster(uuid, text, text[], text) to authenticated;

-- 5. RPC para agregar un integrante individualmente de a uno
create or replace function public.add_team_member(p_team_id uuid, p_email text)
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
  v_captain_email text;
  v_current_count integer;
  v_existing_user uuid;
  v_member_id uuid;
begin
  if v_norm_email !~ '^[^@\s]+@[^@\s]+\.[^@\s]+$' then
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

  insert into public.team_members (team_id, tournament_id, email, user_id, role)
  values (p_team_id, v_tournament.id, v_norm_email, v_existing_user, 'player')
  returning id into v_member_id;

  return v_member_id;
end;
$$;

revoke execute on function public.add_team_member(uuid, text) from public, anon;
grant execute on function public.add_team_member(uuid, text) to authenticated;

-- 6. RPC para remover un integrante del equipo
create or replace function public.remove_team_member(p_team_id uuid, p_member_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_team public.teams%rowtype;
  v_tournament public.tournaments%rowtype;
  v_target_role public.team_member_role;
begin
  select * into v_team from public.teams where id = p_team_id;
  if not found then
    raise exception using errcode = '42501', message = 'Equipo inexistente.';
  end if;

  select * into v_tournament from public.tournaments where id = v_team.tournament_id;
  if v_team.captain_id <> v_uid and v_tournament.organizer_id <> v_uid and not private.is_tournament_organizer(v_tournament.id) then
    raise exception using errcode = '42501', message = 'Solo el capitán o el organizador pueden remover integrantes.';
  end if;

  if v_tournament.status <> 'registration_open' then
    raise exception using errcode = 'P0001', message = 'La inscripción ya cerró: no se pueden modificar integrantes.';
  end if;

  select role into v_target_role from public.team_members where id = p_member_id and team_id = p_team_id;
  if not found then
    raise exception using errcode = 'P0002', message = 'Integrante no encontrado.';
  end if;

  if v_target_role = 'captain' then
    raise exception using errcode = 'P0001', message = 'No se puede remover al capitán del equipo.';
  end if;

  delete from public.team_members where id = p_member_id and team_id = p_team_id;
end;
$$;

revoke execute on function public.remove_team_member(uuid, uuid) from public, anon;
grant execute on function public.remove_team_member(uuid, uuid) to authenticated;

-- 7. RPC pública para resolver los datos de un equipo por su código de invitación abierta
create or replace function public.resolve_team_invite(p_invite_code text)
returns table (
  team_id uuid,
  team_name text,
  team_logo_url text,
  team_status public.team_status,
  captain_name text,
  captain_email text,
  tournament_id uuid,
  tournament_name text,
  tournament_slug text,
  tournament_status public.tournament_status,
  sport_id text,
  sport_name text,
  min_team_size smallint,
  max_team_size smallint,
  members_count integer,
  category_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id as team_id,
    t.name as team_name,
    t.logo_url as team_logo_url,
    t.status as team_status,
    coalesce(cap_p.full_name, 'Capitán') as captain_name,
    cap_m.email as captain_email,
    tour.id as tournament_id,
    tour.name as tournament_name,
    tour.slug as tournament_slug,
    tour.status as tournament_status,
    s.id as sport_id,
    s.name as sport_name,
    s.min_team_size,
    s.max_team_size,
    (select count(*)::integer from public.team_members tm where tm.team_id = t.id) as members_count,
    tc.name as category_name
  from public.teams t
  join public.tournaments tour on tour.id = t.tournament_id
  join public.sports s on s.id = tour.sport_id
  left join public.team_members cap_m on cap_m.team_id = t.id and cap_m.role = 'captain'
  left join public.profiles cap_p on cap_p.id = t.captain_id
  left join public.tournament_categories tc on tc.id = t.category_id
  where t.invite_code = upper(btrim(p_invite_code))
    and tour.status <> 'draft';
$$;

revoke execute on function public.resolve_team_invite(text) from public;
grant execute on function public.resolve_team_invite(text) to anon, authenticated;

-- 8. RPC para que un usuario se una directamente a un equipo mediante el enlace de invitación
create or replace function public.join_team_by_invite_code(p_invite_code text)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_email text;
  v_team public.teams%rowtype;
  v_tournament public.tournaments%rowtype;
  v_sport public.sports%rowtype;
  v_current_count integer;
begin
  select lower(email) into v_email
  from auth.users
  where id = v_uid and email_confirmed_at is not null;

  if v_email is null then
    raise exception using errcode = 'P0001', message = 'Confirmá tu email antes de unirte a un equipo.';
  end if;

  select * into v_team
  from public.teams
  where invite_code = upper(btrim(p_invite_code))
  for update;

  if not found then
    raise exception using errcode = 'P0001', message = 'El enlace de invitación al equipo no es válido.';
  end if;

  select * into v_tournament
  from public.tournaments
  where id = v_team.tournament_id;

  if v_tournament.status <> 'registration_open' then
    raise exception using errcode = 'P0001', message = 'La inscripción del torneo ya no está abierta.';
  end if;

  select * into v_sport
  from public.sports
  where id = v_tournament.sport_id;

  -- Verificar si el usuario ya está en este equipo
  if exists (
    select 1 from public.team_members
    where team_id = v_team.id and (user_id = v_uid or email = v_email)
  ) then
    return v_team.id; -- Ya es miembro, devolver con éxito
  end if;

  -- Verificar si ya está en otro equipo del mismo torneo
  if exists (
    select 1 from public.team_members
    where tournament_id = v_tournament.id and (user_id = v_uid or email = v_email)
  ) then
    raise exception using errcode = 'P0001', message = 'Ya formás parte de otro equipo en este torneo.';
  end if;

  -- Verificar que el equipo no haya alcanzado el cupo máximo
  select count(*)::integer into v_current_count
  from public.team_members
  where team_id = v_team.id;

  if v_current_count >= v_sport.max_team_size then
    raise exception using errcode = 'P0001',
      message = format('El equipo ya completó el cupo máximo de %s integrantes.', v_sport.max_team_size);
  end if;

  -- Insertar como jugador con su usuario y email verificado
  insert into public.team_members (team_id, tournament_id, email, user_id, role)
  values (v_team.id, v_tournament.id, v_email, v_uid, 'player');

  return v_team.id;
end;
$$;

revoke execute on function public.join_team_by_invite_code(text) from public, anon;
grant execute on function public.join_team_by_invite_code(text) to authenticated;
