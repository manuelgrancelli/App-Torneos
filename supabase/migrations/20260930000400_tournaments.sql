-- =============================================================================
-- Torneos, código de inscripción, canchas/sedes y franjas horarias.
-- =============================================================================

create table public.tournaments (
  id uuid primary key default gen_random_uuid(),
  -- restrict: borrar la cuenta del organizador no puede borrar el historial de los participantes.
  organizer_id uuid not null references public.profiles (id) on delete restrict,
  sport_id text not null references public.sports (id),
  name text not null check (char_length(btrim(name)) between 3 and 100),
  slug text not null unique check (slug ~ '^[a-z0-9]+(-[a-z0-9]+)*$' and char_length(slug) <= 120),
  description text check (char_length(description) <= 2000),
  starts_on date not null,
  ends_on date not null,
  -- Las franjas se guardan en UTC (timestamptz) y se muestran en esta zona.
  timezone text not null default 'America/Argentina/Buenos_Aires',
  max_teams smallint not null check (max_teams between 2 and 128),
  status public.tournament_status not null default 'draft',
  -- Configuración validada en la app (Zod) y en create_tournament.
  scoring_config jsonb not null check (jsonb_typeof(scoring_config) = 'object'),
  standings_config jsonb not null check (jsonb_typeof(standings_config) = 'object'),
  playoff_config jsonb not null default '{"qualifiersPerGroup": 2, "thirdPlace": false}'
    check (jsonb_typeof(playoff_config) = 'object'),
  results_require_confirmation boolean not null default false,
  -- FK a teams (compuesta) en la migración de equipos.
  champion_team_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  check (ends_on >= starts_on)
);

comment on table public.tournaments is 'Torneos. Publicado = status distinto de draft.';

create index tournaments_organizer_id_idx on public.tournaments (organizer_id);
create index tournaments_sport_id_idx on public.tournaments (sport_id);

alter table public.tournaments enable row level security;

create trigger tournaments_set_updated_at
  before update on public.tournaments
  for each row execute function public.set_updated_at();

-- Reglas de integridad que no entran en un CHECK.
create function public.tournaments_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_scoring_type public.scoring_type;
begin
  if tg_op = 'INSERT' or new.timezone is distinct from old.timezone then
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
      raise exception using errcode = 'P0001', message = 'La zona horaria no es válida.';
    end if;
  end if;

  if tg_op = 'INSERT' or new.scoring_config is distinct from old.scoring_config then
    select scoring_type into v_scoring_type from public.sports where id = new.sport_id;
    if new.scoring_config ->> 'type' is distinct from v_scoring_type::text then
      raise exception using errcode = 'P0001',
        message = 'La configuración de puntuación no corresponde al deporte del torneo.';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.sport_id is distinct from old.sport_id then
      raise exception using errcode = 'P0001', message = 'No se puede cambiar el deporte de un torneo.';
    end if;
    -- Con partidos en juego, cambiar la puntuación invalidaría resultados cargados.
    if old.status not in ('draft', 'registration_open')
       and new.scoring_config is distinct from old.scoring_config then
      raise exception using errcode = 'P0001',
        message = 'No se puede cambiar la puntuación con el torneo en curso.';
    end if;
    if old.status in ('playoffs', 'finished')
       and new.playoff_config is distinct from old.playoff_config then
      raise exception using errcode = 'P0001',
        message = 'No se puede cambiar la configuración de playoffs después de generar el cuadro.';
    end if;
  end if;

  return new;
end;
$$;

create trigger tournaments_guard
  before insert or update on public.tournaments
  for each row execute function public.tournaments_guard();

-- -----------------------------------------------------------------------------
-- Código de inscripción: tabla aparte para que nunca sea legible públicamente
-- (la tabla tournaments sí lo es cuando el torneo está publicado).
-- -----------------------------------------------------------------------------

create table public.tournament_invites (
  tournament_id uuid primary key references public.tournaments (id) on delete cascade,
  code text not null unique check (code ~ '^[A-HJ-NP-Z2-9]{10}$'),
  rotated_at timestamptz not null default now()
);

comment on table public.tournament_invites is 'Código/link de inscripción. Solo lo ve el organizador.';

alter table public.tournament_invites enable row level security;

-- Genera el código al crear el torneo (reintenta ante la improbable colisión).
create function public.tournaments_create_invite()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  loop
    begin
      insert into public.tournament_invites (tournament_id, code)
      values (new.id, public.generate_code(10));
      exit;
    exception when unique_violation then
      -- colisión de código: se prueba con otro
    end;
  end loop;
  return new;
end;
$$;

create trigger tournaments_create_invite
  after insert on public.tournaments
  for each row execute function public.tournaments_create_invite();

-- -----------------------------------------------------------------------------
-- Canchas / sedes
-- -----------------------------------------------------------------------------

create table public.courts (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  venue text check (char_length(venue) <= 100),
  position smallint not null default 0,
  created_at timestamptz not null default now(),
  -- Destino de las FKs compuestas: garantiza que una referencia sea del mismo torneo.
  unique (id, tournament_id),
  unique (tournament_id, name)
);

alter table public.courts enable row level security;

-- -----------------------------------------------------------------------------
-- Franjas horarias posibles del torneo. Sin cancha = cualquiera de las canchas.
-- -----------------------------------------------------------------------------

create table public.time_slots (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  starts_at timestamptz not null,
  ends_at timestamptz not null,
  court_id uuid,
  created_at timestamptz not null default now(),
  unique (id, tournament_id),
  -- Si se borra la cancha, sus franjas específicas dejan de tener sentido.
  foreign key (court_id, tournament_id) references public.courts (id, tournament_id) on delete cascade,
  check (ends_at > starts_at),
  check (ends_at - starts_at <= interval '24 hours'),
  unique nulls not distinct (tournament_id, starts_at, ends_at, court_id)
);

create index time_slots_tournament_starts_idx on public.time_slots (tournament_id, starts_at);
create index time_slots_court_idx on public.time_slots (court_id, tournament_id);

alter table public.time_slots enable row level security;

-- -----------------------------------------------------------------------------
-- Helpers de autorización para RLS. SECURITY DEFINER para no depender de las
-- políticas de las tablas que consultan (evita recursión) y search_path vacío.
-- -----------------------------------------------------------------------------

create function private.is_tournament_organizer(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tournaments
    where id = p_tournament_id and organizer_id = (select auth.uid())
  );
$$;

create function private.is_tournament_published(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tournaments
    where id = p_tournament_id and status <> 'draft'
  );
$$;

revoke execute on function private.is_tournament_organizer(uuid) from public;
revoke execute on function private.is_tournament_published(uuid) from public;
grant execute on function private.is_tournament_organizer(uuid) to anon, authenticated;
grant execute on function private.is_tournament_published(uuid) to anon, authenticated;
revoke execute on function public.tournaments_guard() from public, anon, authenticated;
revoke execute on function public.tournaments_create_invite() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Privilegios y políticas. La visibilidad para participantes se agrega en la
-- migración de equipos (necesita team_members).
-- -----------------------------------------------------------------------------

revoke all on table public.tournaments from anon, authenticated;
grant select on table public.tournaments to anon, authenticated;
-- El alta es por RPC (create_tournament). status, campeón, organizador, deporte
-- y slug no se pueden tocar directamente.
grant update (
  name, description, starts_on, ends_on, timezone, max_teams,
  scoring_config, standings_config, playoff_config, results_require_confirmation
) on table public.tournaments to authenticated;
grant delete on table public.tournaments to authenticated;

create policy "tournaments: lectura de publicados y propios"
  on public.tournaments for select to anon, authenticated
  using (status <> 'draft' or organizer_id = (select auth.uid()));

create policy "tournaments: el organizador edita"
  on public.tournaments for update to authenticated
  using (organizer_id = (select auth.uid()))
  with check (organizer_id = (select auth.uid()));

-- Una vez que hay partidos, el torneo es historial de los participantes.
create policy "tournaments: el organizador borra antes de empezar"
  on public.tournaments for delete to authenticated
  using (organizer_id = (select auth.uid()) and status in ('draft', 'registration_open'));

revoke all on table public.tournament_invites from anon, authenticated;
grant select on table public.tournament_invites to authenticated;

create policy "tournament_invites: solo el organizador"
  on public.tournament_invites for select to authenticated
  using (private.is_tournament_organizer(tournament_id));

revoke all on table public.courts from anon, authenticated;
grant select on table public.courts to anon, authenticated;
grant insert, update, delete on table public.courts to authenticated;

create policy "courts: lectura si el torneo es visible"
  on public.courts for select to anon, authenticated
  using (private.is_tournament_published(tournament_id) or private.is_tournament_organizer(tournament_id));

create policy "courts: el organizador crea"
  on public.courts for insert to authenticated
  with check (private.is_tournament_organizer(tournament_id));

create policy "courts: el organizador edita"
  on public.courts for update to authenticated
  using (private.is_tournament_organizer(tournament_id))
  with check (private.is_tournament_organizer(tournament_id));

create policy "courts: el organizador borra"
  on public.courts for delete to authenticated
  using (private.is_tournament_organizer(tournament_id));

revoke all on table public.time_slots from anon, authenticated;
grant select on table public.time_slots to anon, authenticated;
grant insert, update, delete on table public.time_slots to authenticated;

create policy "time_slots: lectura si el torneo es visible"
  on public.time_slots for select to anon, authenticated
  using (private.is_tournament_published(tournament_id) or private.is_tournament_organizer(tournament_id));

create policy "time_slots: el organizador crea"
  on public.time_slots for insert to authenticated
  with check (private.is_tournament_organizer(tournament_id));

create policy "time_slots: el organizador edita"
  on public.time_slots for update to authenticated
  using (private.is_tournament_organizer(tournament_id))
  with check (private.is_tournament_organizer(tournament_id));

create policy "time_slots: el organizador borra"
  on public.time_slots for delete to authenticated
  using (private.is_tournament_organizer(tournament_id));
