-- =============================================================================
-- Equipos/parejas inscriptos, sus integrantes y su disponibilidad horaria.
-- Un equipo pertenece a un único torneo (la inscripción ES el equipo).
-- =============================================================================

create table public.teams (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 2 and 60),
  captain_id uuid not null references public.profiles (id) on delete restrict,
  status public.team_status not null default 'pending',
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tournament_id)
);

comment on table public.teams is 'Inscripción de un equipo/pareja en un torneo. Solo los aprobados son públicos.';

create unique index teams_tournament_name_key on public.teams (tournament_id, lower(name));
create index teams_captain_id_idx on public.teams (captain_id);

alter table public.teams enable row level security;

create trigger teams_set_updated_at
  before update on public.teams
  for each row execute function public.set_updated_at();

-- Campeón del torneo (se completa al finalizar).
alter table public.tournaments
  add constraint tournaments_champion_team_fk
  foreign key (champion_team_id, id) references public.teams (id, tournament_id)
  on delete set null (champion_team_id);

create index tournaments_champion_team_idx on public.tournaments (champion_team_id, id);

-- -----------------------------------------------------------------------------
-- Integrantes. Se vinculan por email sin aceptación: si hay una cuenta con ese
-- email verificado se completa user_id; si no, queda pendiente hasta que la
-- persona se registre y verifique ese email.
-- -----------------------------------------------------------------------------

create table public.team_members (
  id uuid primary key default gen_random_uuid(),
  team_id uuid not null,
  tournament_id uuid not null,
  email text not null check (
    email = lower(btrim(email))
    and char_length(email) <= 254
    and email ~ '^[^@\s]+@[^@\s]+\.[^@\s]+$'
  ),
  user_id uuid references public.profiles (id) on delete set null,
  role public.team_member_role not null default 'player',
  created_at timestamptz not null default now(),
  foreign key (team_id, tournament_id) references public.teams (id, tournament_id) on delete cascade,
  unique (team_id, email),
  -- Una persona juega en un solo equipo por torneo.
  unique (tournament_id, email)
);

comment on table public.team_members is 'Integrantes. email visible solo para el equipo y el organizador.';

create unique index team_members_tournament_user_key
  on public.team_members (tournament_id, user_id) where user_id is not null;
create unique index team_members_one_captain_key
  on public.team_members (team_id) where role = 'captain';
create index team_members_team_idx on public.team_members (team_id, tournament_id);
create index team_members_user_id_idx on public.team_members (user_id);

alter table public.team_members enable row level security;

-- -----------------------------------------------------------------------------
-- Disponibilidad: en qué franjas puede jugar cada equipo.
-- -----------------------------------------------------------------------------

create table public.team_availability (
  team_id uuid not null,
  slot_id uuid not null,
  tournament_id uuid not null,
  created_at timestamptz not null default now(),
  primary key (team_id, slot_id),
  foreign key (team_id, tournament_id) references public.teams (id, tournament_id) on delete cascade,
  foreign key (slot_id, tournament_id) references public.time_slots (id, tournament_id) on delete cascade
);

create index team_availability_slot_idx on public.team_availability (slot_id, tournament_id);
create index team_availability_tournament_idx on public.team_availability (tournament_id);
create index team_availability_team_idx on public.team_availability (team_id, tournament_id);

alter table public.team_availability enable row level security;

-- -----------------------------------------------------------------------------
-- Helpers de autorización
-- -----------------------------------------------------------------------------

create function private.is_tournament_participant(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where tournament_id = p_tournament_id and user_id = (select auth.uid())
  );
$$;

create function private.is_team_member(p_team_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where team_id = p_team_id and user_id = (select auth.uid())
  );
$$;

-- Torneo visible para quien consulta: publicado, propio o donde participa.
create function private.can_read_tournament(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tournaments t
    where t.id = p_tournament_id
      and (
        t.status <> 'draft'
        or t.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.team_members tm
          where tm.tournament_id = t.id and tm.user_id = (select auth.uid())
        )
      )
  );
$$;

-- Perfil visible: el propio, el de compañeros de equipo y, para el organizador,
-- el de los integrantes de sus torneos.
create function private.can_view_profile(p_profile_id uuid)
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
    );
$$;

revoke execute on function private.is_tournament_participant(uuid) from public;
revoke execute on function private.is_team_member(uuid) from public;
revoke execute on function private.can_read_tournament(uuid) from public;
revoke execute on function private.can_view_profile(uuid) from public;
grant execute on function private.is_tournament_participant(uuid) to anon, authenticated;
grant execute on function private.is_team_member(uuid) to anon, authenticated;
grant execute on function private.can_read_tournament(uuid) to anon, authenticated;
grant execute on function private.can_view_profile(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Vinculación automática de integrantes pendientes cuando una cuenta verifica
-- su email (alta con Google, confirmación de registro o cambio de email).
-- -----------------------------------------------------------------------------

create function public.link_pending_memberships()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.email is null or new.email_confirmed_at is null then
    return new;
  end if;

  begin
    update public.team_members as tm
    set user_id = new.id
    where tm.user_id is null
      and tm.email = lower(new.email)
      and exists (select 1 from public.profiles p where p.id = new.id)
      -- Si ya juega en otro equipo del mismo torneo, no se vincula (quedaría duplicado).
      and not exists (
        select 1 from public.team_members other
        where other.tournament_id = tm.tournament_id and other.user_id = new.id
      );
  exception when others then
    -- Nunca bloquear el alta o la confirmación de una cuenta por esto.
    raise warning 'link_pending_memberships: %', sqlerrm;
  end;

  return new;
end;
$$;

-- Corre después de on_auth_user_created (orden alfabético), así el perfil ya existe.
create trigger on_auth_user_verified
  after insert or update of email_confirmed_at, email on auth.users
  for each row execute function public.link_pending_memberships();

revoke execute on function public.link_pending_memberships() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- El cupo no puede quedar por debajo de los equipos ya aprobados.
-- -----------------------------------------------------------------------------

create function public.tournaments_check_max_teams()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_approved integer;
begin
  select count(*) into v_approved
  from public.teams
  where tournament_id = new.id and status = 'approved';

  if new.max_teams < v_approved then
    raise exception using errcode = 'P0001',
      message = format('El cupo no puede ser menor a los %s equipos ya aprobados.', v_approved);
  end if;
  return new;
end;
$$;

create trigger tournaments_check_max_teams
  before update of max_teams on public.tournaments
  for each row execute function public.tournaments_check_max_teams();

revoke execute on function public.tournaments_check_max_teams() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Privilegios y políticas
-- -----------------------------------------------------------------------------

-- Participantes: también ven los torneos (aunque vuelvan a borrador) y sus datos.
alter policy "tournaments: lectura de publicados y propios"
  on public.tournaments
  using (
    status <> 'draft'
    or organizer_id = (select auth.uid())
    or private.is_tournament_participant(id)
  );

alter policy "courts: lectura si el torneo es visible"
  on public.courts
  using (private.can_read_tournament(tournament_id));

alter policy "time_slots: lectura si el torneo es visible"
  on public.time_slots
  using (private.can_read_tournament(tournament_id));

alter policy "profiles: ver el propio"
  on public.profiles
  using (private.can_view_profile(id));
alter policy "profiles: ver el propio"
  on public.profiles
  rename to "profiles: propio, compañeros y organizador";

-- Equipos: todas las escrituras pasan por RPC (register_team, review_registration...).
revoke all on table public.teams from anon, authenticated;
grant select on table public.teams to anon, authenticated;

create policy "teams: aprobados de torneos publicados, propios y del organizador"
  on public.teams for select to anon, authenticated
  using (
    (status = 'approved' and private.is_tournament_published(tournament_id))
    or private.is_tournament_organizer(tournament_id)
    or private.is_team_member(id)
  );

-- Integrantes (con email): solo el propio equipo y el organizador. Nunca público.
revoke all on table public.team_members from anon, authenticated;
grant select on table public.team_members to authenticated;

create policy "team_members: el equipo y el organizador"
  on public.team_members for select to authenticated
  using (private.is_team_member(team_id) or private.is_tournament_organizer(tournament_id));

-- Disponibilidad: la edita el equipo vía RPC; la lee el equipo y el organizador.
revoke all on table public.team_availability from anon, authenticated;
grant select on table public.team_availability to authenticated;

create policy "team_availability: el equipo y el organizador"
  on public.team_availability for select to authenticated
  using (private.is_team_member(team_id) or private.is_tournament_organizer(tournament_id));
