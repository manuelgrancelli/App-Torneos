-- =============================================================================
-- F7: cuadro eliminatorio, avance automático, 3er puesto y campeón.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
-- Aislamiento: sin los datos del seed (todo se revierte con el rollback final).
delete from public.tournaments;
select plan(16);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'org@test.local', now(), '{"full_name": "Olga Org"}', 'authenticated', 'authenticated');

insert into public.tournaments (id, organizer_id, sport_id, name, slug, starts_on, ends_on, max_teams, scoring_config, standings_config, status)
select 'bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'padel', 'Torneo', 'torneo',
  '2026-10-10', '2026-10-11', 8, default_scoring_config, default_standings_config, 'playoffs'
from public.sports where id = 'padel';

insert into public.teams (id, tournament_id, name, captain_id, status)
select ('eeeeeeee-0000-4000-8000-00000000000' || n)::uuid, 'bbbbbbbb-0000-4000-8000-000000000001', 'Equipo ' || n,
  'aaaaaaaa-0000-4000-8000-000000000001', 'approved'
from generate_series(1, 5) as n;

-- Cuadro de 4 con 3er puesto (semis r1, final y 3er puesto en r2).
create temp table b as select $json$[
  {"key": "r1-m0", "round": 1, "position": 0, "home": "eeeeeeee-0000-4000-8000-000000000001", "away": "eeeeeeee-0000-4000-8000-000000000004",
   "isBye": false, "isThirdPlace": false, "winner": null, "next": {"key": "r2-m0", "side": "home"}, "loserNext": {"key": "third-place", "side": "home"}},
  {"key": "r1-m1", "round": 1, "position": 1, "home": "eeeeeeee-0000-4000-8000-000000000002", "away": "eeeeeeee-0000-4000-8000-000000000003",
   "isBye": false, "isThirdPlace": false, "winner": null, "next": {"key": "r2-m0", "side": "away"}, "loserNext": {"key": "third-place", "side": "away"}},
  {"key": "r2-m0", "round": 2, "position": 0, "home": null, "away": null, "isBye": false, "isThirdPlace": false, "winner": null, "next": null, "loserNext": null},
  {"key": "third-place", "round": 2, "position": 1, "home": null, "away": null, "isBye": false, "isThirdPlace": true, "winner": null, "next": null, "loserNext": null}
]$json$::jsonb as matches;
grant select on b to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok($$ select public.apply_bracket('bbbbbbbb-0000-4000-8000-000000000001',
  '[{"key": "r1-m0", "round": 1, "home": "eeeeeeee-0000-4000-8000-000000000001", "away": "eeeeeeee-0000-4000-8000-000000000001"}]') $$,
  'P0001', 'Un equipo aparece dos veces en el cuadro.', 'cuadro: sin equipos repetidos');
select throws_ok($$ select public.apply_bracket('bbbbbbbb-0000-4000-8000-000000000001',
  '[{"key": "r1-m0", "round": 1, "home": "eeeeeeee-0000-4000-8000-000000000001", "away": "eeeeeeee-0000-4000-8000-000000000002", "next": {"key": "nada", "side": "home"}}]') $$,
  'P0001', 'El cuadro está incompleto.', 'cuadro: enlaces válidos');
select lives_ok($$ select public.apply_bracket('bbbbbbbb-0000-4000-8000-000000000001', (select matches from b)) $$,
  'cuadro: el organizador lo genera');

reset role;
select is((select count(*)::int from public.matches where stage = 'playoff'), 4, 'cuadro: 4 partidos');
create temp table pm as
  select id, round, is_third_place, home_team_id from public.matches where stage = 'playoff';
grant select on pm to authenticated;
select ok((select next_match_id is not null and loser_next_match_id is not null from public.matches
  where id = (select id from pm where round = 1 and home_team_id = 'eeeeeeee-0000-4000-8000-000000000001')),
  'cuadro: la semi apunta a la final y al 3er puesto');

-- Semis: ganan 1 y 3 → final 1 vs 3, 3er puesto 4 vs 2.
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok($$ select public.record_match_result((select id from pm where round = 1 and home_team_id = 'eeeeeeee-0000-4000-8000-000000000001'),
  '{"type": "sets", "sets": [{"home": 6, "away": 2}, {"home": 6, "away": 2}]}', 'eeeeeeee-0000-4000-8000-000000000001') $$, 'semi 1 cargada');
select lives_ok($$ select public.record_match_result((select id from pm where round = 1 and home_team_id = 'eeeeeeee-0000-4000-8000-000000000002'),
  '{"type": "sets", "sets": [{"home": 2, "away": 6}, {"home": 2, "away": 6}]}', 'eeeeeeee-0000-4000-8000-000000000003') $$, 'semi 2 cargada');
reset role;
select results_eq(
  $$ select home_team_id, away_team_id from public.matches where id = (select id from pm where round = 2 and not is_third_place) $$,
  $$ values ('eeeeeeee-0000-4000-8000-000000000001'::uuid, 'eeeeeeee-0000-4000-8000-000000000003'::uuid) $$,
  'avance: los ganadores pasan a la final');
select results_eq(
  $$ select home_team_id, away_team_id from public.matches where id = (select id from pm where is_third_place) $$,
  $$ values ('eeeeeeee-0000-4000-8000-000000000004'::uuid, 'eeeeeeee-0000-4000-8000-000000000002'::uuid) $$,
  'avance: los perdedores van al 3er puesto');

-- Corregir una semi con la final sin jugar: el finalista cambia.
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok($$ select public.record_match_result((select id from pm where round = 1 and home_team_id = 'eeeeeeee-0000-4000-8000-000000000002'),
  '{"type": "sets", "sets": [{"home": 6, "away": 2}, {"home": 6, "away": 2}]}', 'eeeeeeee-0000-4000-8000-000000000002') $$, 'corrección de semi');
reset role;
select is((select away_team_id from public.matches where id = (select id from pm where round = 2 and not is_third_place)),
  'eeeeeeee-0000-4000-8000-000000000002'::uuid, 'corrección: cambia el finalista');

-- Con la final jugada no se corrige la semi.
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok($$ select public.record_match_result((select id from pm where round = 2 and not is_third_place),
  '{"type": "sets", "sets": [{"home": 6, "away": 4}, {"home": 6, "away": 4}]}', 'eeeeeeee-0000-4000-8000-000000000001') $$, 'final cargada');
select throws_ok($$ select public.clear_match_result((select id from pm where round = 1 and home_team_id = 'eeeeeeee-0000-4000-8000-000000000001')) $$,
  'P0001', 'El partido siguiente ya tiene resultado: borralo antes de corregir este.', 'avance: no se corrige con la final jugada');
select throws_ok($$ select public.apply_bracket('bbbbbbbb-0000-4000-8000-000000000001', (select matches from b)) $$,
  'P0001', 'Ya hay resultados de playoffs: no se puede rearmar el cuadro.', 'cuadro: no se rearma con resultados');

-- Finalizar: el campeón es el ganador de la final.
select lives_ok($$ select public.set_tournament_status('bbbbbbbb-0000-4000-8000-000000000001', 'finished') $$, 'torneo finalizado');
reset role;
select is((select champion_team_id from public.tournaments where id = 'bbbbbbbb-0000-4000-8000-000000000001'),
  'eeeeeeee-0000-4000-8000-000000000001'::uuid, 'campeón: el ganador de la final');

select * from finish();
rollback;
