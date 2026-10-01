-- =============================================================================
-- Catálogo de deportes. Cada deporte define su sistema de puntuación, el
-- tamaño de los equipos y la configuración por defecto de sus torneos.
-- Es un catálogo de solo lectura para la app: se amplía con migraciones.
-- =============================================================================

create table public.sports (
  id text primary key check (id ~ '^[a-z0-9]+(-[a-z0-9]+)*$'),
  name text not null unique,
  scoring_type public.scoring_type not null,
  min_team_size smallint not null check (min_team_size between 1 and 50),
  max_team_size smallint not null check (max_team_size between 1 and 50),
  -- Formato validado en la app (lib/domain/scoring). Acá solo la forma mínima.
  default_scoring_config jsonb not null check (jsonb_typeof(default_scoring_config) = 'object'),
  default_standings_config jsonb not null check (jsonb_typeof(default_standings_config) = 'object'),
  sort_order smallint not null default 0,
  created_at timestamptz not null default now(),
  check (max_team_size >= min_team_size),
  check (default_scoring_config ->> 'type' = scoring_type::text)
);

comment on table public.sports is 'Catálogo de deportes (solo lectura desde la app).';

alter table public.sports enable row level security;

revoke all on table public.sports from anon, authenticated;
grant select on table public.sports to anon, authenticated;

create policy "sports: catálogo público"
  on public.sports for select to anon, authenticated
  using (true);

-- Datos del catálogo: van en la migración (no en seed.sql) porque la app los
-- necesita también en producción.
insert into public.sports (
  id, name, scoring_type, min_team_size, max_team_size,
  default_scoring_config, default_standings_config, sort_order
) values
  (
    'padel', 'Pádel', 'sets', 2, 2,
    -- Al mejor de 3 sets de 6 games, tie-break en 6-6 y super tie-break a 10 como tercer set.
    '{"type": "sets", "bestOf": 3, "gamesPerSet": 6, "tiebreak": true, "decidingSet": "super_tiebreak", "superTiebreakPoints": 10}',
    '{"points": {"win": 3, "draw": 1, "loss": 0}, "tiebreakers": ["points", "head_to_head", "set_diff", "game_diff", "games_won"]}',
    1
  ),
  (
    'tenis', 'Tenis', 'sets', 2, 2,
    '{"type": "sets", "bestOf": 3, "gamesPerSet": 6, "tiebreak": true, "decidingSet": "full", "superTiebreakPoints": 10}',
    '{"points": {"win": 3, "draw": 1, "loss": 0}, "tiebreakers": ["points", "head_to_head", "set_diff", "game_diff", "games_won"]}',
    2
  ),
  (
    'futbol-11', 'Fútbol 11', 'goals', 11, 11,
    -- En playoffs un empate se define por penales.
    '{"type": "goals", "playoffTiebreak": "penalties"}',
    '{"points": {"win": 3, "draw": 1, "loss": 0}, "tiebreakers": ["points", "goal_diff", "goals_for", "head_to_head"]}',
    3
  );
