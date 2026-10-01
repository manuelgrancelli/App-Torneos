-- =============================================================================
-- Competencia: grupos, partidos (grupos y playoffs) y confirmación de resultados.
-- =============================================================================

create table public.tournament_groups (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 30),
  position smallint not null check (position >= 0),
  -- Semilla del sorteo final cuando los criterios de desempate no alcanzan.
  tiebreak_seed integer not null default (floor(random() * 2147483647))::integer,
  created_at timestamptz not null default now(),
  unique (id, tournament_id),
  unique (tournament_id, position),
  unique (tournament_id, name)
);

alter table public.tournament_groups enable row level security;

create table public.group_teams (
  group_id uuid not null,
  team_id uuid not null,
  tournament_id uuid not null,
  -- Orden en que quedó en el sorteo (o armado manual).
  position smallint not null default 0,
  primary key (group_id, team_id),
  -- Un equipo está en un solo grupo por torneo.
  unique (tournament_id, team_id),
  foreign key (group_id, tournament_id) references public.tournament_groups (id, tournament_id) on delete cascade,
  foreign key (team_id, tournament_id) references public.teams (id, tournament_id) on delete cascade
);

create index group_teams_group_idx on public.group_teams (group_id, tournament_id);
create index group_teams_team_idx on public.group_teams (team_id, tournament_id);

alter table public.group_teams enable row level security;

-- -----------------------------------------------------------------------------
-- Partidos
-- -----------------------------------------------------------------------------

create table public.matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  stage public.match_stage not null,
  group_id uuid,
  -- Grupos: número de fecha. Playoffs: ronda (1 = primera ronda; la mayor es la final).
  round smallint not null check (round >= 1),
  -- Orden dentro de la fecha/ronda (en playoffs, posición en el cuadro).
  position smallint not null default 0 check (position >= 0),
  -- En playoffs pueden ser null hasta que se definen los cruces.
  home_team_id uuid,
  away_team_id uuid,
  is_bye boolean not null default false,
  is_third_place boolean not null default false,
  -- A qué partido (y de qué lado) avanza el ganador; el perdedor solo en semis con 3er puesto.
  next_match_id uuid,
  next_match_side public.match_side,
  loser_next_match_id uuid,
  loser_next_match_side public.match_side,
  -- Programación. starts_at/ends_at se copian de la franja por trigger.
  slot_id uuid,
  court_id uuid,
  starts_at timestamptz,
  ends_at timestamptz,
  -- Asignación fijada a mano: el scheduler automático no la mueve.
  schedule_locked boolean not null default false,
  -- Resultado: sets [{home, away}] o goles {home, away, penalties?}. Validado en la app.
  result jsonb check (result is null or jsonb_typeof(result) = 'object'),
  winner_team_id uuid,
  is_draw boolean not null default false,
  is_walkover boolean not null default false,
  result_status public.result_status,
  result_recorded_at timestamptz,
  result_recorded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  unique (id, tournament_id),
  foreign key (group_id, tournament_id)
    references public.tournament_groups (id, tournament_id) on delete cascade,
  foreign key (home_team_id, tournament_id) references public.teams (id, tournament_id),
  foreign key (away_team_id, tournament_id) references public.teams (id, tournament_id),
  foreign key (winner_team_id, tournament_id) references public.teams (id, tournament_id),
  foreign key (next_match_id, tournament_id)
    references public.matches (id, tournament_id) on delete set null (next_match_id),
  foreign key (loser_next_match_id, tournament_id)
    references public.matches (id, tournament_id) on delete set null (loser_next_match_id),
  foreign key (slot_id, tournament_id)
    references public.time_slots (id, tournament_id) on delete set null (slot_id),
  foreign key (court_id, tournament_id)
    references public.courts (id, tournament_id) on delete set null (court_id),

  -- Coherencia estructural.
  check (home_team_id is null or away_team_id is null or home_team_id <> away_team_id),
  check ((stage = 'group') = (group_id is not null)),
  check (
    stage = 'playoff'
    or (not is_bye and not is_third_place and next_match_id is null and loser_next_match_id is null)
  ),
  check ((next_match_id is null) = (next_match_side is null)),
  check ((loser_next_match_id is null) = (loser_next_match_side is null)),
  check ((starts_at is null) = (ends_at is null)),
  check (starts_at is null or ends_at > starts_at),
  -- Coherencia del resultado.
  check (winner_team_id is null or winner_team_id = home_team_id or winner_team_id = away_team_id),
  check (not (is_draw and winner_team_id is not null)),
  check (not is_draw or stage = 'group'),
  check (not is_walkover or winner_team_id is not null),
  check ((result_status is null) = (winner_team_id is null and not is_draw))
);

comment on table public.matches is 'Partidos de grupos y playoffs, con programación y resultado.';

create index matches_tournament_stage_idx on public.matches (tournament_id, stage);
create index matches_group_idx on public.matches (group_id, tournament_id);
create index matches_home_team_idx on public.matches (home_team_id, tournament_id);
create index matches_away_team_idx on public.matches (away_team_id, tournament_id);
create index matches_winner_team_idx on public.matches (winner_team_id, tournament_id);
create index matches_next_match_idx on public.matches (next_match_id, tournament_id);
create index matches_loser_next_match_idx on public.matches (loser_next_match_id, tournament_id);
create index matches_slot_idx on public.matches (slot_id, tournament_id);
create index matches_court_idx on public.matches (court_id, tournament_id);
create index matches_result_recorded_by_idx on public.matches (result_recorded_by);
create index matches_starts_at_idx on public.matches (tournament_id, starts_at);

-- Una cancha no puede tener dos partidos superpuestos. Diferido hasta el commit
-- para permitir intercambiar horarios dentro de una misma transacción.
alter table public.matches
  add constraint matches_court_no_overlap
  exclude using gist (court_id with =, tstzrange(starts_at, ends_at, '[)') with &&)
  where (court_id is not null and starts_at is not null)
  deferrable initially deferred;

alter table public.matches enable row level security;

create trigger matches_set_updated_at
  before update on public.matches
  for each row execute function public.set_updated_at();

-- Copia horario y cancha de la franja asignada. Sin franja no hay horario ni cancha.
create function public.matches_sync_schedule()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_slot record;
begin
  if new.slot_id is null then
    new.starts_at := null;
    new.ends_at := null;
    new.court_id := null;
  else
    select starts_at, ends_at, court_id into v_slot
    from public.time_slots
    where id = new.slot_id;

    new.starts_at := v_slot.starts_at;
    new.ends_at := v_slot.ends_at;
    -- Franja de una cancha específica: esa es la cancha del partido.
    if v_slot.court_id is not null then
      new.court_id := v_slot.court_id;
    end if;
  end if;
  return new;
end;
$$;

create trigger matches_sync_schedule
  before insert or update of slot_id, court_id on public.matches
  for each row execute function public.matches_sync_schedule();

-- Si cambia el horario o la cancha de una franja, se actualizan sus partidos.
create function public.time_slots_propagate_schedule()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  -- Reasignar la misma franja dispara matches_sync_schedule.
  update public.matches set slot_id = new.id where slot_id = new.id;
  return new;
end;
$$;

create trigger time_slots_propagate_schedule
  after update of starts_at, ends_at, court_id on public.time_slots
  for each row execute function public.time_slots_propagate_schedule();

-- Un equipo no puede tener dos partidos superpuestos. Trigger de constraint
-- diferido: se valida al commit, con todos los cambios de la transacción.
create function public.matches_check_team_overlap()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.starts_at is null then
    return null;
  end if;

  if exists (
    select 1
    from public.matches m
    where m.tournament_id = new.tournament_id
      and m.id <> new.id
      and m.starts_at is not null
      and tstzrange(m.starts_at, m.ends_at, '[)') && tstzrange(new.starts_at, new.ends_at, '[)')
      and (
        m.home_team_id in (new.home_team_id, new.away_team_id)
        or m.away_team_id in (new.home_team_id, new.away_team_id)
      )
  ) then
    raise exception using errcode = 'P0001',
      message = 'Un equipo no puede jugar dos partidos en horarios superpuestos.';
  end if;

  return null;
end;
$$;

create constraint trigger matches_team_no_overlap
  after insert or update of slot_id, starts_at, ends_at, home_team_id, away_team_id on public.matches
  deferrable initially deferred
  for each row execute function public.matches_check_team_overlap();

revoke execute on function public.matches_sync_schedule() from public, anon, authenticated;
revoke execute on function public.time_slots_propagate_schedule() from public, anon, authenticated;
revoke execute on function public.matches_check_team_overlap() from public, anon, authenticated;

-- -----------------------------------------------------------------------------
-- Confirmación de resultados por los equipos (si el torneo la exige).
-- -----------------------------------------------------------------------------

create table public.match_confirmations (
  match_id uuid not null,
  team_id uuid not null,
  tournament_id uuid not null,
  response public.confirmation_response not null,
  comment text check (char_length(comment) <= 500),
  responded_by uuid references public.profiles (id) on delete set null,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  primary key (match_id, team_id),
  foreign key (match_id, tournament_id) references public.matches (id, tournament_id) on delete cascade,
  foreign key (team_id, tournament_id) references public.teams (id, tournament_id) on delete cascade
);

create index match_confirmations_team_idx on public.match_confirmations (team_id, tournament_id);
create index match_confirmations_match_idx on public.match_confirmations (match_id, tournament_id);
create index match_confirmations_tournament_idx on public.match_confirmations (tournament_id);
create index match_confirmations_responded_by_idx on public.match_confirmations (responded_by);

alter table public.match_confirmations enable row level security;

create trigger match_confirmations_set_updated_at
  before update on public.match_confirmations
  for each row execute function public.set_updated_at();

-- -----------------------------------------------------------------------------
-- Privilegios y políticas
-- -----------------------------------------------------------------------------

revoke all on table public.tournament_groups from anon, authenticated;
grant select on table public.tournament_groups to anon, authenticated;
grant insert, update, delete on table public.tournament_groups to authenticated;

create policy "tournament_groups: lectura si el torneo es visible"
  on public.tournament_groups for select to anon, authenticated
  using (private.can_read_tournament(tournament_id));

create policy "tournament_groups: el organizador crea"
  on public.tournament_groups for insert to authenticated
  with check (private.is_tournament_organizer(tournament_id));

create policy "tournament_groups: el organizador edita"
  on public.tournament_groups for update to authenticated
  using (private.is_tournament_organizer(tournament_id))
  with check (private.is_tournament_organizer(tournament_id));

create policy "tournament_groups: el organizador borra"
  on public.tournament_groups for delete to authenticated
  using (private.is_tournament_organizer(tournament_id));

revoke all on table public.group_teams from anon, authenticated;
grant select on table public.group_teams to anon, authenticated;
grant insert, update, delete on table public.group_teams to authenticated;

create policy "group_teams: lectura si el torneo es visible"
  on public.group_teams for select to anon, authenticated
  using (private.can_read_tournament(tournament_id));

create policy "group_teams: el organizador crea"
  on public.group_teams for insert to authenticated
  with check (private.is_tournament_organizer(tournament_id));

create policy "group_teams: el organizador edita"
  on public.group_teams for update to authenticated
  using (private.is_tournament_organizer(tournament_id))
  with check (private.is_tournament_organizer(tournament_id));

create policy "group_teams: el organizador borra"
  on public.group_teams for delete to authenticated
  using (private.is_tournament_organizer(tournament_id));

revoke all on table public.matches from anon, authenticated;
grant select on table public.matches to anon, authenticated;
grant insert, update, delete on table public.matches to authenticated;

create policy "matches: lectura si el torneo es visible"
  on public.matches for select to anon, authenticated
  using (private.can_read_tournament(tournament_id));

create policy "matches: el organizador crea"
  on public.matches for insert to authenticated
  with check (private.is_tournament_organizer(tournament_id));

create policy "matches: el organizador edita"
  on public.matches for update to authenticated
  using (private.is_tournament_organizer(tournament_id))
  with check (private.is_tournament_organizer(tournament_id));

create policy "matches: el organizador borra"
  on public.matches for delete to authenticated
  using (private.is_tournament_organizer(tournament_id));

-- Las respuestas se escriben por RPC (respond_result, fase 6).
revoke all on table public.match_confirmations from anon, authenticated;
grant select on table public.match_confirmations to authenticated;

create policy "match_confirmations: el equipo y el organizador"
  on public.match_confirmations for select to authenticated
  using (private.is_team_member(team_id) or private.is_tournament_organizer(tournament_id));

-- -----------------------------------------------------------------------------
-- Historial y próximos partidos del usuario. security_invoker: aplica el RLS
-- de las tablas con los permisos de quien consulta.
-- -----------------------------------------------------------------------------

create view public.v_my_matches
with (security_invoker = true)
as
select
  m.id as match_id,
  m.tournament_id,
  t.name as tournament_name,
  t.slug as tournament_slug,
  t.status as tournament_status,
  t.timezone,
  t.sport_id,
  s.name as sport_name,
  s.scoring_type,
  m.stage,
  m.round,
  m.is_third_place,
  m.starts_at,
  m.ends_at,
  m.court_id,
  c.name as court_name,
  c.venue as court_venue,
  mine.team_id as my_team_id,
  my_team.name as my_team_name,
  (m.home_team_id = mine.team_id) as is_home,
  rival.id as rival_team_id,
  rival.name as rival_team_name,
  m.result,
  m.winner_team_id,
  m.is_draw,
  m.is_walkover,
  m.result_status,
  case
    when m.is_draw then 'draw'
    when m.winner_team_id is null then null
    when m.winner_team_id = mine.team_id then 'win'
    else 'loss'
  end as outcome
from public.team_members as mine
join public.matches as m
  on m.tournament_id = mine.tournament_id
  and mine.team_id in (m.home_team_id, m.away_team_id)
join public.tournaments as t on t.id = m.tournament_id
join public.sports as s on s.id = t.sport_id
join public.teams as my_team on my_team.id = mine.team_id
left join public.teams as rival
  on rival.id = case when m.home_team_id = mine.team_id then m.away_team_id else m.home_team_id end
left join public.courts as c on c.id = m.court_id
where mine.user_id = (select auth.uid())
  and not m.is_bye;

comment on view public.v_my_matches is 'Partidos del usuario actual (historial y próximos).';

revoke all on table public.v_my_matches from anon, authenticated;
grant select on table public.v_my_matches to authenticated;
