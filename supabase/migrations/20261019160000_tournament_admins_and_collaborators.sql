-- =============================================================================
-- Co-administradores de torneo y enlaces de invitación de administradores
-- Permite al organizador principal invitar colaboradores vía enlace/código de WhatsApp
-- con permisos operativos completos (resultados, horarios, zonas, partidos).
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabla de administradores / colaboradores de torneo
-- -----------------------------------------------------------------------------

create table if not exists public.tournament_admins (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  user_id uuid not null references public.profiles (id) on delete cascade,
  role text not null default 'admin' check (role in ('admin')),
  created_at timestamptz not null default now(),
  primary key (tournament_id, user_id)
);

comment on table public.tournament_admins is
  'Co-administradores del torneo con permisos operativos (resultados, horarios, grupos, etc.).';

create index if not exists tournament_admins_user_id_idx on public.tournament_admins (user_id);
create index if not exists tournament_admins_tournament_id_idx on public.tournament_admins (tournament_id);

alter table public.tournament_admins enable row level security;

-- -----------------------------------------------------------------------------
-- 2. Tabla de enlaces/códigos de invitación para administradores
-- -----------------------------------------------------------------------------

create table if not exists public.tournament_admin_invites (
  tournament_id uuid primary key references public.tournaments (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  rotated_at timestamptz not null default now(),
  created_at timestamptz not null default now()
);

comment on table public.tournament_admin_invites is
  'Código/link de invitación para sumar administradores al torneo. Solo lo gestiona el dueño del torneo.';

alter table public.tournament_admin_invites enable row level security;

-- Poblar códigos para los torneos existentes
insert into public.tournament_admin_invites (tournament_id, code)
select id, public.generate_code(10)
from public.tournaments
on conflict (tournament_id) do nothing;

-- -----------------------------------------------------------------------------
-- 3. Trigger al crear torneos: genera código de inscripción y de administrador
-- -----------------------------------------------------------------------------

create or replace function public.tournaments_create_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- Código para participantes
  loop
    begin
      insert into public.tournament_invites (tournament_id, code)
      values (new.id, public.generate_code(10));
      exit;
    exception when unique_violation then
      -- colisión de código: se prueba con otro
    end;
  end loop;

  -- Código para co-administradores
  loop
    begin
      insert into public.tournament_admin_invites (tournament_id, code)
      values (new.id, public.generate_code(10));
      exit;
    exception when unique_violation then
      -- colisión de código: se prueba con otro
    end;
  end loop;

  return new;
end;
$$;

-- -----------------------------------------------------------------------------
-- 4. Actualizar helper privado is_tournament_organizer
-- Retorna true si el usuario es el creador del torneo O un co-administrador registrado.
-- -----------------------------------------------------------------------------

create or replace function private.is_tournament_organizer(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tournaments
    where id = p_tournament_id and organizer_id = (select auth.uid())
  ) or exists (
    select 1 from public.tournament_admins
    where tournament_id = p_tournament_id and user_id = (select auth.uid())
  );
$$;

-- 4b. Actualizar can_view_profile para que organizador y administradores puedan ver los perfiles mutuos
create or replace function private.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id = (select auth.uid())
    or exists (
      select 1
      from public.team_members mine
      join public.team_members other on other.team_id = mine.team_id
      where mine.user_id = (select auth.uid()) and other.user_id = p_profile_id
    )
    or exists (
      select 1
      from public.team_members tm
      join public.tournaments t on t.id = tm.tournament_id
      where tm.user_id = p_profile_id and t.organizer_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.tournaments t
      where t.organizer_id = p_profile_id
        and (
          t.status <> 'draft'
          or private.is_tournament_organizer(t.id)
          or private.is_tournament_participant(t.id)
        )
    )
    or exists (
      select 1
      from public.tournament_admins ta
      where ta.user_id = p_profile_id
        and private.is_tournament_organizer(ta.tournament_id)
    );
$$;

-- -----------------------------------------------------------------------------
-- 5. Actualizar require_match_organizer para autorizar co-administradores
-- -----------------------------------------------------------------------------

create or replace function public.require_match_organizer(p_match_id uuid)
returns public.matches
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_match public.matches%rowtype;
  v_uid uuid := (select auth.uid());
begin
  select m.* into v_match
  from public.matches m
  where m.id = p_match_id and private.is_tournament_organizer(m.tournament_id);

  if not found then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este partido.';
  end if;
  return v_match;
end;
$$;

-- -----------------------------------------------------------------------------
-- 6. Actualizar RPCs operativas para permitir co-administradores
-- -----------------------------------------------------------------------------

-- apply_groups
create or replace function public.apply_groups(p_tournament_id uuid, p_groups jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament public.tournaments%rowtype;
  v_group jsonb;
  v_match jsonb;
  v_group_id uuid;
  v_position integer := 0;
  v_team_ids uuid[];
  v_all_teams uuid[] := '{}'::uuid[];
  v_approved uuid[];
  v_pairs text[] := '{}'::text[];
  v_home uuid;
  v_away uuid;
  v_pair text;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  if not found or not private.is_tournament_organizer(p_tournament_id) then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este torneo.';
  end if;
  if v_tournament.status <> 'group_stage' then
    raise exception using errcode = 'P0001', message = 'Los grupos se arman con el torneo en fase de grupos.';
  end if;
  if exists (
    select 1 from public.matches where tournament_id = p_tournament_id and result_status is not null
  ) then
    raise exception using errcode = 'P0001', message = 'Ya hay resultados cargados: no se pueden rearmar los grupos.';
  end if;
  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) not between 1 and 26 then
    raise exception using errcode = 'P0001', message = 'Tiene que haber entre 1 y 26 grupos.';
  end if;

  select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_approved
  from public.teams where tournament_id = p_tournament_id and status = 'approved';

  delete from public.matches where tournament_id = p_tournament_id and stage = 'group';
  delete from public.tournament_groups where tournament_id = p_tournament_id;

  for v_group in select value from jsonb_array_elements(p_groups) loop
    select array_agg(value::text::uuid) into v_team_ids
    from jsonb_array_elements_text(v_group -> 'teamIds');
    v_team_ids := coalesce(v_team_ids, '{}'::uuid[]);

    if array_length(v_team_ids, 1) < 2 then
      raise exception using errcode = 'P0001', message = 'Cada grupo tiene que tener al menos 2 equipos.';
    end if;

    v_all_teams := v_all_teams || v_team_ids;

    insert into public.tournament_groups (tournament_id, name, position)
    values (p_tournament_id, btrim(v_group ->> 'name'), v_position)
    returning id into v_group_id;
    v_position := v_position + 1;

    insert into public.group_teams (group_id, team_id, tournament_id)
    select v_group_id, tid, p_tournament_id from unnest(v_team_ids) as tid;

    for v_match in select value from jsonb_array_elements(v_group -> 'matches') loop
      v_home := (v_match ->> 'home')::uuid;
      v_away := (v_match ->> 'away')::uuid;

      if v_home = v_away or v_home != all(v_team_ids) or v_away != all(v_team_ids) then
        raise exception using errcode = 'P0001', message = 'Un partido incluye equipos que no están en el grupo.';
      end if;

      v_pair := least(v_home::text, v_away::text) || ':' || greatest(v_home::text, v_away::text);
      if v_pair = any(v_pairs) then
        raise exception using errcode = 'P0001', message = 'Hay partidos duplicados en el fixture.';
      end if;
      v_pairs := array_append(v_pairs, v_pair);

      insert into public.matches (
        tournament_id, stage, group_id, round, position, home_team_id, away_team_id
      ) values (
        p_tournament_id, 'group', v_group_id,
        (v_match ->> 'round')::integer,
        (v_match ->> 'position')::integer,
        v_home, v_away
      );
    end loop;
  end loop;

  select array_agg(t order by t) into v_all_teams from (select distinct unnest(v_all_teams) as t) s;
  if v_all_teams is distinct from v_approved then
    raise exception using errcode = 'P0001', message = 'Los grupos tienen que incluir a todos los equipos aprobados sin repetir.';
  end if;
end;
$$;

-- apply_schedule
create or replace function public.apply_schedule(p_tournament_id uuid, p_assignments jsonb, p_clear_unlocked boolean default false)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_status public.tournament_status;
  v_item jsonb;
  v_count integer := 0;
begin
  select status into v_status from public.tournaments where id = p_tournament_id and private.is_tournament_organizer(p_tournament_id);
  if not found then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este torneo.';
  end if;
  if v_status not in ('group_stage', 'playoffs') then
    raise exception using errcode = 'P0001', message = 'Los partidos se programan durante la fase de grupos o los playoffs.';
  end if;

  if p_clear_unlocked then
    update public.matches
    set slot_id = null
    where tournament_id = p_tournament_id and not schedule_locked and result_status is null and slot_id is not null;
  end if;

  for v_item in select value from jsonb_array_elements(coalesce(p_assignments, '[]'::jsonb)) loop
    update public.matches
    set slot_id = (v_item ->> 'slotId')::uuid,
        court_id = (v_item ->> 'courtId')::uuid
    where id = (v_item ->> 'matchId')::uuid
      and tournament_id = p_tournament_id
      and result_status is null
      and not schedule_locked;
    if not found then
      raise exception using errcode = 'P0001', message = 'Un partido ya no se puede programar (se jugó o tiene horario fijado).';
    end if;
    v_count := v_count + 1;
  end loop;

  return v_count;
end;
$$;

-- apply_bracket
create or replace function public.apply_bracket(p_tournament_id uuid, p_cards jsonb)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament public.tournaments%rowtype;
  v_card jsonb;
  v_match_id uuid;
  v_home uuid;
  v_away uuid;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  if not found or not private.is_tournament_organizer(p_tournament_id) then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este torneo.';
  end if;
  if v_tournament.status <> 'playoffs' then
    raise exception using errcode = 'P0001', message = 'El cuadro solo se actualiza con el torneo en playoffs.';
  end if;

  for v_card in select value from jsonb_array_elements(p_cards) loop
    v_match_id := (v_card ->> 'matchId')::uuid;
    v_home := (v_card ->> 'homeTeamId')::uuid;
    v_away := (v_card ->> 'awayTeamId')::uuid;

    if v_match_id is null then
      insert into public.matches (
        tournament_id, stage, round, position, is_third_place, home_team_id, away_team_id
      ) values (
        p_tournament_id, 'playoff',
        (v_card ->> 'round')::integer,
        (v_card ->> 'position')::integer,
        coalesce((v_card ->> 'isThirdPlace')::boolean, false),
        v_home, v_away
      );
    else
      update public.matches
      set home_team_id = v_home,
          away_team_id = v_away
      where id = v_match_id
        and tournament_id = p_tournament_id
        and stage = 'playoff'
        and result_status is null;
    end if;
  end loop;
end;
$$;

-- set_tournament_status
create or replace function public.set_tournament_status(p_tournament_id uuid, p_status public.tournament_status, p_champion_team_id uuid default null)
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

  if not found or not private.is_tournament_organizer(p_tournament_id) then
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
        message = 'Aprobá al menos 2 parejas para pasar a la fase de grupos.';
    end if;

  elsif v_tournament.status = 'group_stage' and p_status = 'playoffs' then
    if exists (
      select 1 from public.matches
      where tournament_id = p_tournament_id and stage = 'group' and result_status is null
    ) then
      raise exception using errcode = 'P0001',
        message = 'Hay partidos de grupos pendientes de resultado.';
    end if;

  elsif v_tournament.status = 'playoffs' and p_status = 'finished' then
    select home_team_id into v_champion
    from public.matches
    where tournament_id = p_tournament_id and stage = 'playoff' and not is_third_place
    order by round desc
    limit 1;

    p_champion_team_id := coalesce(p_champion_team_id, v_champion);
    if p_champion_team_id is null then
      raise exception using errcode = 'P0001',
        message = 'La final no tiene ganador registrado.';
    end if;

  elsif v_tournament.status = 'group_stage' and p_status = 'finished' then
    if p_champion_team_id is null then
      raise exception using errcode = 'P0001',
        message = 'Indicá el equipo campeón para finalizar el torneo.';
    end if;
  end if;

  update public.tournaments
  set status = p_status,
      champion_team_id = p_champion_team_id
  where id = p_tournament_id;
end;
$$;

-- replace_team_player
create or replace function public.replace_team_player(
  p_team_id uuid,
  p_member_id uuid,
  p_new_player_name text,
  p_new_team_name text default null
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
  v_new_name text := btrim(coalesce(p_new_player_name, ''));
  v_team_name text := btrim(coalesce(p_new_team_name, ''));
begin
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'El equipo no existe.';
  end if;

  select * into v_tournament from public.tournaments where id = v_team.tournament_id for update;
  if not found or not private.is_tournament_organizer(v_team.tournament_id) then
    raise exception using errcode = '42501', message = 'Solo el organizador o un administrador puede reemplazar jugadores.';
  end if;

  if char_length(v_new_name) not between 1 and 80 then
    raise exception using errcode = 'P0001', message = 'El nombre del jugador tiene que tener entre 1 y 80 caracteres.';
  end if;

  if not exists (select 1 from public.team_members where id = p_member_id and team_id = p_team_id) then
    raise exception using errcode = 'P0001', message = 'El integrante a reemplazar no pertenece a este equipo.';
  end if;

  update public.team_members
  set display_name = v_new_name,
      email = null,
      user_id = null
  where id = p_member_id and team_id = p_team_id;

  if v_team_name is not null and char_length(v_team_name) > 0 then
    if char_length(v_team_name) not between 2 and 60 then
      raise exception using errcode = 'P0001', message = 'El nombre del equipo tiene que tener entre 2 y 60 caracteres.';
    end if;

    if exists (
      select 1 from public.teams
      where tournament_id = v_team.tournament_id and lower(name) = lower(v_team_name) and id <> p_team_id
    ) then
      raise exception using errcode = 'P0001', message = format('Ya existe un equipo llamado "%s" en este torneo.', v_team_name);
    end if;

    update public.teams
    set name = v_team_name
    where id = p_team_id;
  end if;
end;
$$;

-- -----------------------------------------------------------------------------
-- 7. Funciones para gestión y unión de co-administradores
-- -----------------------------------------------------------------------------

-- Obtener información básica de la invitación por código (pública / autenticada)
create or replace function public.get_admin_invite_info(p_code text)
returns table (
  tournament_id uuid,
  tournament_name text,
  tournament_slug text,
  sport_name text,
  organizer_name text,
  status public.tournament_status,
  starts_on date,
  ends_on date,
  is_already_admin boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id as tournament_id,
    t.name as tournament_name,
    t.slug as tournament_slug,
    s.name as sport_name,
    coalesce(p.full_name, 'Organizador') as organizer_name,
    t.status,
    t.starts_on,
    t.ends_on,
    case
      when (select auth.uid()) is null then false
      when t.organizer_id = (select auth.uid()) then true
      when exists (select 1 from public.tournament_admins ta where ta.tournament_id = t.id and ta.user_id = (select auth.uid())) then true
      else false
    end as is_already_admin
  from public.tournament_admin_invites ai
  join public.tournaments t on t.id = ai.tournament_id
  join public.sports s on s.id = t.sport_id
  left join public.profiles p on p.id = t.organizer_id
  where ai.code = upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

-- Unirse al torneo como co-administrador usando el código de invitación
create or replace function public.join_tournament_as_admin(p_code text)
returns table (
  tournament_id uuid,
  tournament_slug text,
  tournament_name text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := public.require_user();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  v_tourney_id uuid;
  v_tourney_slug text;
  v_tourney_name text;
  v_organizer_id uuid;
begin
  select t.id, t.slug, t.name, t.organizer_id
  into v_tourney_id, v_tourney_slug, v_tourney_name, v_organizer_id
  from public.tournaments t
  join public.tournament_admin_invites ai on ai.tournament_id = t.id
  where ai.code = v_code;

  if not found then
    raise exception using errcode = 'P0001', message = 'El código de invitación de administrador no es válido.';
  end if;

  -- Si es el dueño del torneo
  if v_organizer_id = v_uid then
    return query select v_tourney_id, v_tourney_slug, v_tourney_name;
    return;
  end if;

  -- Insertar como co-administrador
  insert into public.tournament_admins (tournament_id, user_id, role)
  values (v_tourney_id, v_uid, 'admin')
  on conflict (tournament_id, user_id) do nothing;

  return query select v_tourney_id, v_tourney_slug, v_tourney_name;
end;
$$;

-- Rotar el código de invitación de administradores (solo el dueño)
create or replace function public.rotate_tournament_admin_invite(p_tournament_id uuid)
returns text
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_new_code text;
begin
  if not exists (select 1 from public.tournaments where id = p_tournament_id and organizer_id = v_uid) then
    raise exception using errcode = '42501', message = 'Solo el organizador principal puede rotar el enlace de invitación de administradores.';
  end if;

  loop
    v_new_code := public.generate_code(10);
    begin
      update public.tournament_admin_invites
      set code = v_new_code,
          rotated_at = now()
      where tournament_id = p_tournament_id;
      exit;
    exception when unique_violation then
    end;
  end loop;

  return v_new_code;
end;
$$;

-- Eliminar un co-administrador (dueño o el propio usuario saliendo)
create or replace function public.remove_tournament_admin(p_tournament_id uuid, p_user_id uuid)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
begin
  if not (
    exists (select 1 from public.tournaments where id = p_tournament_id and organizer_id = v_uid)
    or v_uid = p_user_id
  ) then
    raise exception using errcode = '42501', message = 'No tenés permiso para eliminar este administrador.';
  end if;

  delete from public.tournament_admins
  where tournament_id = p_tournament_id and user_id = p_user_id;
end;
$$;

-- -----------------------------------------------------------------------------
-- 8. Políticas de RLS
-- -----------------------------------------------------------------------------

-- tournament_admins: lectura para organizador y admins del torneo
create policy tournament_admins_select on public.tournament_admins
  for select
  using (private.is_tournament_organizer(tournament_id));

-- tournament_admins: eliminación solo para el dueño o el propio admin
create policy tournament_admins_delete on public.tournament_admins
  for delete
  using (
    exists (select 1 from public.tournaments t where t.id = tournament_id and t.organizer_id = (select auth.uid()))
    or user_id = (select auth.uid())
  );

-- tournament_admin_invites: lectura y actualización solo para el dueño
create policy tournament_admin_invites_select on public.tournament_admin_invites
  for select
  using (
    exists (select 1 from public.tournaments t where t.id = tournament_id and t.organizer_id = (select auth.uid()))
  );

create policy tournament_admin_invites_update on public.tournament_admin_invites
  for update
  using (
    exists (select 1 from public.tournaments t where t.id = tournament_id and t.organizer_id = (select auth.uid()))
  )
  with check (
    exists (select 1 from public.tournaments t where t.id = tournament_id and t.organizer_id = (select auth.uid()))
  );

-- -----------------------------------------------------------------------------
-- 9. Permisos y grants
-- -----------------------------------------------------------------------------

revoke all on table public.tournament_admins from public, anon;
grant select, delete on table public.tournament_admins to authenticated;

revoke all on table public.tournament_admin_invites from public, anon;
grant select on table public.tournament_admin_invites to authenticated;

create or replace function public.get_tournament_admins(p_tournament_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_tourney public.tournaments%rowtype;
begin
  select * into v_tourney
  from public.tournaments
  where id = p_tournament_id;

  if not found then
    return;
  end if;

  if not private.is_tournament_organizer(p_tournament_id) then
    raise exception using errcode = '42501', message = 'No tenés permiso para ver los administradores de este torneo.';
  end if;

  -- 1. Dueño / Organizador principal
  return query
  select
    p.id as user_id,
    coalesce(p.full_name, 'Organizador') as display_name,
    p.avatar_url,
    'owner'::text as role,
    v_tourney.created_at
  from public.profiles p
  where p.id = v_tourney.organizer_id;

  -- 2. Co-administradores
  return query
  select
    p.id as user_id,
    coalesce(p.full_name, 'Administrador') as display_name,
    p.avatar_url,
    ta.role,
    ta.created_at
  from public.tournament_admins ta
  join public.profiles p on p.id = ta.user_id
  where ta.tournament_id = p_tournament_id
  order by ta.created_at asc;
end;
$$;

grant execute on function public.get_admin_invite_info(text) to anon, authenticated;
grant execute on function public.join_tournament_as_admin(text) to authenticated;
grant execute on function public.rotate_tournament_admin_invite(uuid) to authenticated;
grant execute on function public.remove_tournament_admin(uuid, uuid) to authenticated;
grant execute on function public.get_tournament_admins(uuid) to authenticated;
