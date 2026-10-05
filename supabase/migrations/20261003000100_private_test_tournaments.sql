-- Torneos aislados de prueba con parejas ficticias para validar grupos, fixture
-- y playoffs sin mezclar datos de torneos reales.

alter table public.tournaments
  add column is_test boolean not null default false;

alter table public.teams
  add column test_generated boolean not null default false;

comment on column public.tournaments.is_test is
  'Torneo privado del organizador para pruebas; no aparece en vistas públicas ni acepta inscripciones reales.';
comment on column public.teams.test_generated is
  'Equipo ficticio generado para completar los cupos de un torneo de prueba.';

-- La visibilidad pública siempre excluye los torneos de prueba, incluso si
-- pasan a inscripción abierta, grupos, playoffs o finalizado.
create or replace function private.is_tournament_published(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tournaments
    where id = p_tournament_id and status <> 'draft' and not is_test
  );
$$;

create or replace function private.can_read_tournament(p_tournament_id uuid)
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
        (t.status <> 'draft' and not t.is_test)
        or t.organizer_id = (select auth.uid())
        or exists (
          select 1 from public.team_members tm
          where tm.tournament_id = t.id and tm.user_id = (select auth.uid())
        )
      )
  );
$$;

alter policy "tournaments: lectura de publicados y propios"
  on public.tournaments
  using (
    (status <> 'draft' and not is_test)
    or organizer_id = (select auth.uid())
    or private.is_tournament_participant(id)
  );

-- Reemplaza resolve_invite_code para que ni siquiera un código compartido
-- permita encontrar un torneo privado de pruebas.
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
    and t.status <> 'draft'
    and not t.is_test;
$$;

-- La marca de prueba se asigna de forma atómica al crear el torneo, y no se
-- puede activar sobre un torneo real que ya pudiera tener inscripciones.
create function public.create_test_tournament(
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
  v_tournament_id uuid;
  v_uid uuid := public.require_user();
begin
  v_tournament_id := public.create_tournament(
    p_sport_id => p_sport_id,
    p_name => p_name,
    p_slug => p_slug,
    p_description => p_description,
    p_starts_on => p_starts_on,
    p_ends_on => p_ends_on,
    p_timezone => p_timezone,
    p_max_teams => p_max_teams,
    p_court_names => p_court_names,
    p_scoring_config => p_scoring_config,
    p_standings_config => p_standings_config,
    p_playoff_config => p_playoff_config,
    p_results_require_confirmation => p_results_require_confirmation
  );

  update public.tournaments
  set is_test = true
  where id = v_tournament_id
    and organizer_id = v_uid
    and status = 'draft';

  if not found then
    raise exception using errcode = 'P0001', message = 'No pudimos marcar el torneo como prueba.';
  end if;

  return v_tournament_id;
end;
$$;

-- Impide el alta de inscripciones reales por RPC directo o con un código
-- filtrado. Solo la RPC de generación puede insertar equipos de prueba.
create function private.prevent_real_registration_in_test_tournaments()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if exists (
    select 1 from public.tournaments
    where id = new.tournament_id and is_test
  ) and not new.test_generated then
    raise exception using errcode = 'P0001',
      message = 'Este es un torneo de prueba privado y no recibe inscripciones reales.';
  end if;
  return new;
end;
$$;

revoke execute on function private.prevent_real_registration_in_test_tournaments() from public;

create trigger teams_prevent_real_test_registration
  before insert on public.teams
  for each row execute function private.prevent_real_registration_in_test_tournaments();

create function public.fill_test_team_slots(p_tournament_id uuid)
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament public.tournaments%rowtype;
  v_sport public.sports%rowtype;
  v_approved integer;
  v_slots integer;
  v_created integer := 0;
  v_team_id uuid;
  v_team_name text;
  v_team_number integer;
  v_member_number integer;
  v_member_email text;
begin
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found or v_tournament.organizer_id <> v_uid then
    raise exception using errcode = '42501', message = 'No tenés permiso para completar los cupos.';
  end if;
  if not v_tournament.is_test then
    raise exception using errcode = 'P0001',
      message = 'Los equipos ficticios solo se agregan a torneos creados en modo de prueba.';
  end if;
  if v_tournament.status <> 'registration_open' then
    raise exception using errcode = 'P0001',
      message = 'Los equipos ficticios se agregan con la inscripción abierta.';
  end if;
  if exists (
    select 1 from public.teams
    where tournament_id = p_tournament_id
      and status = 'pending'
      and not test_generated
  ) then
    raise exception using errcode = 'P0001',
      message = 'Primero revisá las inscripciones pendientes antes de completar los cupos.';
  end if;

  select * into v_sport from public.sports where id = v_tournament.sport_id;
  select count(*)::integer into v_approved
  from public.teams
  where tournament_id = p_tournament_id and status = 'approved';

  v_slots := v_tournament.max_teams - v_approved;
  if v_slots <= 0 then
    raise exception using errcode = 'P0001', message = 'El torneo ya completó el cupo.';
  end if;

  for v_team_number in 1..v_slots loop
    v_team_id := gen_random_uuid();
    v_team_name := case
      when v_sport.min_team_size = 2 then 'Pareja de prueba '
      else 'Equipo de prueba '
    end || lpad(v_team_number::text, 2, '0') || ' (' || left(v_team_id::text, 4) || ')';

    insert into public.teams (id, tournament_id, name, captain_id, status, test_generated)
    values (v_team_id, p_tournament_id, v_team_name, v_uid, 'approved', true);

    for v_member_number in 1..v_sport.min_team_size loop
      v_member_email := format(
        'prueba-%s-%s@demo.test',
        left(v_team_id::text, 8),
        v_member_number
      );
      insert into public.team_members (team_id, tournament_id, email, role)
      values (
        v_team_id,
        p_tournament_id,
        v_member_email,
        case when v_member_number = 1
          then 'captain'::public.team_member_role
          else 'player'::public.team_member_role
        end
      );
    end loop;

    insert into public.team_availability (team_id, slot_id, tournament_id)
    select v_team_id, ts.id, p_tournament_id
    from public.time_slots ts
    where ts.tournament_id = p_tournament_id;

    v_created := v_created + 1;
  end loop;

  return v_created;
end;
$$;

revoke execute on function public.create_test_tournament(
  text, text, text, text, date, date, text, integer, text[], jsonb, jsonb, jsonb, boolean
) from public, anon;
revoke execute on function public.fill_test_team_slots(uuid) from public, anon;
grant execute on function public.create_test_tournament(
  text, text, text, text, date, date, text, integer, text[], jsonb, jsonb, jsonb, boolean
) to authenticated;
grant execute on function public.fill_test_team_slots(uuid) to authenticated;
