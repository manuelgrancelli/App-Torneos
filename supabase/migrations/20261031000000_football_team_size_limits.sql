-- =============================================================================
-- Migración: Límites reglamentarios obligatorios de jugadores por equipo en fútbol
-- (min_team_size y max_team_size en torneos y RPCs)
-- =============================================================================

-- 1. Agregar columnas min_team_size y max_team_size a public.tournaments
alter table public.tournaments
  add column if not exists min_team_size smallint check (min_team_size >= 1),
  add column if not exists max_team_size smallint check (max_team_size >= min_team_size);

comment on column public.tournaments.min_team_size is 'Cantidad mínima de jugadores requerida para inscribir un equipo.';
comment on column public.tournaments.max_team_size is 'Cantidad máxima de jugadores permitida por equipo (incluyendo suplentes).';

-- 2. Función y trigger para mantener sincronizados min_team_size y max_team_size
create or replace function private.sync_tournament_team_sizes()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_sport public.sports%rowtype;
  v_min integer;
  v_max integer;
begin
  select * into v_sport from public.sports where id = new.sport_id;

  if (new.scoring_config->>'type') = 'goals' then
    v_min := coalesce((new.scoring_config->>'minTeamSize')::integer, 5);
    v_max := coalesce((new.scoring_config->>'maxTeamSize')::integer, 15);
  else
    v_min := coalesce(v_sport.min_team_size, 2);
    v_max := coalesce(v_sport.max_team_size, 2);
  end if;

  new.min_team_size := v_min;
  new.max_team_size := greatest(v_min, v_max);
  return new;
end;
$$;

drop trigger if exists trg_sync_tournament_team_sizes on public.tournaments;
create trigger trg_sync_tournament_team_sizes
  before insert or update of sport_id, scoring_config
  on public.tournaments
  for each row
  execute function private.sync_tournament_team_sizes();

-- Backfill en filas existentes
update public.tournaments t
set
  min_team_size = case
    when (t.scoring_config->>'type') = 'goals' then coalesce((t.scoring_config->>'minTeamSize')::smallint, 5)
    else s.min_team_size
  end,
  max_team_size = case
    when (t.scoring_config->>'type') = 'goals' then coalesce((t.scoring_config->>'maxTeamSize')::smallint, 15)
    else s.max_team_size
  end
from public.sports s
where s.id = t.sport_id;

-- 3. Actualizar resolve_invite_code para devolver los límites específicos del torneo
create or replace function public.resolve_invite_code(p_code text)
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
    coalesce(t.min_team_size, (t.scoring_config->>'minTeamSize')::smallint, s.min_team_size) as min_team_size,
    coalesce(t.max_team_size, (t.scoring_config->>'maxTeamSize')::smallint, s.max_team_size) as max_team_size,
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
    and t.status <> 'draft'
    and not t.is_test;
$$;

revoke execute on function public.resolve_invite_code(text) from public;
grant execute on function public.resolve_invite_code(text) to anon, authenticated;

-- 4. Actualizar create_organizer_team para validar límites dinámicos de torneo
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
  v_min_team_size integer;
  v_max_team_size integer;
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
  v_min_team_size := coalesce(v_tournament.min_team_size, (v_tournament.scoring_config->>'minTeamSize')::integer, v_sport.min_team_size);
  v_max_team_size := coalesce(v_tournament.max_team_size, (v_tournament.scoring_config->>'maxTeamSize')::integer, v_sport.max_team_size);

  if coalesce(cardinality(p_player_names), 0) not between v_min_team_size and v_max_team_size then
    raise exception using errcode = 'P0001',
      message = format('La cantidad de jugadores (%s) no cumple con los límites reglamentarios del equipo (%s a %s).', coalesce(cardinality(p_player_names), 0), v_min_team_size, v_max_team_size);
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

-- 5. Actualizar register_team para validar límites dinámicos de equipo
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
  v_min_team_size integer;
  v_max_team_size integer;
  v_companion_count integer := 0;
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
  v_min_team_size := coalesce(v_tournament.min_team_size, (v_tournament.scoring_config->>'minTeamSize')::integer, v_sport.min_team_size);
  v_max_team_size := coalesce(v_tournament.max_team_size, (v_tournament.scoring_config->>'maxTeamSize')::integer, v_sport.max_team_size);

  -- Contar compañeros válidos cargados
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
        v_companion_count := v_companion_count + 1;
      end if;
    end loop;
  end if;

  -- Validar límites reglamentarios del equipo (1 capitán + compañeros)
  if (1 + v_companion_count) not between v_min_team_size and v_max_team_size then
    raise exception using errcode = 'P0001',
      message = format('El equipo debe tener entre %s y %s integrantes reglamentarios (actualmente tiene %s contando al capitán).', v_min_team_size, v_max_team_size, 1 + v_companion_count);
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

-- 6. Actualizar review_registration para exigir cumplimiento del mínimo y máximo configurados
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
  v_min_team_size integer;
  v_max_team_size integer;
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
    v_min_team_size := coalesce(v_tournament.min_team_size, (v_tournament.scoring_config->>'minTeamSize')::integer, v_sport.min_team_size);
    v_max_team_size := coalesce(v_tournament.max_team_size, (v_tournament.scoring_config->>'maxTeamSize')::integer, v_sport.max_team_size);

    select count(*)::integer
    into v_members
    from public.team_members
    where team_id = p_team_id;

    if v_sport.scoring_type = 'sets' and v_members not between v_min_team_size and v_max_team_size then
      raise exception using errcode = 'P0001', message = 'La pareja no tiene el plantel completo.';
    end if;

    if v_sport.scoring_type = 'goals' and (v_members < v_min_team_size or v_members > v_max_team_size) then
      raise exception using errcode = 'P0001',
        message = format('El equipo debe tener entre %s y %s integrantes para ser aprobado (actualmente tiene %s).', v_min_team_size, v_max_team_size, v_members);
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

-- 7. Actualizar add_team_member para respetar max_team_size del torneo
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
  v_max_team_size integer;
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
  v_max_team_size := coalesce(v_tournament.max_team_size, (v_tournament.scoring_config->>'maxTeamSize')::integer, v_sport.max_team_size);

  select count(*)::integer into v_current_count
  from public.team_members
  where team_id = p_team_id;

  if v_current_count >= v_max_team_size then
    raise exception using errcode = 'P0001',
      message = format('El equipo ya alcanzó el límite máximo de %s integrantes.', v_max_team_size);
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

