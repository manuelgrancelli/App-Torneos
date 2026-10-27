-- =============================================================================
-- Tenis Individual (Singles, 1 vs 1) en el catálogo de deportes.
-- =============================================================================

insert into public.sports (
  id, name, scoring_type, min_team_size, max_team_size,
  default_scoring_config, default_standings_config, sort_order
) values (
  'tenis-single', 'Tenis Individual', 'sets', 1, 1,
  '{"type": "sets", "bestOf": 3, "gamesPerSet": 6, "tiebreak": true, "decidingSet": "full", "superTiebreakPoints": 10}',
  '{"points": {"win": 3, "draw": 1, "loss": 0}, "tiebreakers": ["points", "head_to_head", "set_diff", "game_diff", "games_won"]}',
  2
)
on conflict (id) do update set
  name = excluded.name,
  scoring_type = excluded.scoring_type,
  min_team_size = excluded.min_team_size,
  max_team_size = excluded.max_team_size,
  default_scoring_config = excluded.default_scoring_config,
  default_standings_config = excluded.default_standings_config,
  sort_order = excluded.sort_order;
