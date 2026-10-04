-- =============================================================================
-- F6: grupos, programación, resultados (con propagación) y confirmaciones.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
-- Aislamiento: sin los datos del seed (todo se revierte con el rollback final).
delete from public.tournaments;
select plan(27);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'org@test.local', now(), '{"full_name": "Olga Org"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'a@test.local', now(), '{"full_name": "Jugador A"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'b@test.local', now(), '{"full_name": "Jugador B"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000009', 'x@test.local', now(), '{"full_name": "Ajeno"}', 'authenticated', 'authenticated');

insert into public.tournaments (id, organizer_id, sport_id, name, slug, starts_on, ends_on, max_teams, scoring_config, standings_config, status, results_require_confirmation)
select 'bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'padel', 'Torneo', 'torneo',
  '2026-10-10', '2026-10-11', 8, default_scoring_config, default_standings_config, 'group_stage', true
from public.sports where id = 'padel';

insert into public.courts (id, tournament_id, name) values
  ('cccccccc-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Cancha 1'),
  ('cccccccc-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 'Cancha 2');
insert into public.time_slots (id, tournament_id, starts_at, ends_at) values
  ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', '2026-10-10 10:00-03', '2026-10-10 11:30-03'),
  ('dddddddd-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', '2026-10-10 12:00-03', '2026-10-10 13:30-03');

insert into public.teams (id, tournament_id, name, captain_id, status) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Equipo A', 'aaaaaaaa-0000-4000-8000-000000000002', 'approved'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 'Equipo B', 'aaaaaaaa-0000-4000-8000-000000000003', 'approved'),
  ('eeeeeeee-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001', 'Equipo C', 'aaaaaaaa-0000-4000-8000-000000000001', 'approved'),
  ('eeeeeeee-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000001', 'Equipo D', 'aaaaaaaa-0000-4000-8000-000000000001', 'approved'),
  ('eeeeeeee-0000-4000-8000-000000000005', 'bbbbbbbb-0000-4000-8000-000000000001', 'Equipo E (rechazado)', 'aaaaaaaa-0000-4000-8000-000000000001', 'rejected');
insert into public.team_members (team_id, tournament_id, email, user_id, role) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'a@test.local', 'aaaaaaaa-0000-4000-8000-000000000002', 'captain'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 'b@test.local', 'aaaaaaaa-0000-4000-8000-000000000003', 'captain');

create temp table g as select $json$[
  {"name": "Grupo A", "teamIds": ["eeeeeeee-0000-4000-8000-000000000001", "eeeeeeee-0000-4000-8000-000000000002"],
   "matches": [{"round": 1, "position": 0, "home": "eeeeeeee-0000-4000-8000-000000000001", "away": "eeeeeeee-0000-4000-8000-000000000002"}]},
  {"name": "Grupo B", "teamIds": ["eeeeeeee-0000-4000-8000-000000000003", "eeeeeeee-0000-4000-8000-000000000004"],
   "matches": [{"round": 1, "position": 0, "home": "eeeeeeee-0000-4000-8000-000000000003", "away": "eeeeeeee-0000-4000-8000-000000000004"}]}
]$json$::jsonb as groups;
grant select on g to authenticated;

-- -----------------------------------------------------------------------------
-- apply_groups
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000009", "role": "authenticated"}';
select throws_ok($$ select public.apply_groups('bbbbbbbb-0000-4000-8000-000000000001', (select groups from g)) $$,
  '42501', null, 'grupos: solo el organizador');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok($$ select public.apply_groups('bbbbbbbb-0000-4000-8000-000000000001',
  '[{"name": "Grupo A", "teamIds": ["eeeeeeee-0000-4000-8000-000000000001", "eeeeeeee-0000-4000-8000-000000000002", "eeeeeeee-0000-4000-8000-000000000003"], "matches": []}]') $$,
  'P0001', 'Los grupos tienen que incluir a todas las inscripciones aprobadas, una sola vez cada una.', 'grupos: faltan aprobados');
select throws_ok($$ select public.apply_groups('bbbbbbbb-0000-4000-8000-000000000001',
  '[{"name": "Grupo A", "teamIds": ["eeeeeeee-0000-4000-8000-000000000001", "eeeeeeee-0000-4000-8000-000000000002", "eeeeeeee-0000-4000-8000-000000000003", "eeeeeeee-0000-4000-8000-000000000005"], "matches": []}]') $$,
  'P0001', 'Los grupos tienen que incluir a todas las inscripciones aprobadas, una sola vez cada una.', 'grupos: no se cuelan rechazados');
select throws_ok($$ select public.apply_groups('bbbbbbbb-0000-4000-8000-000000000001',
  '[{"name": "Grupo A", "teamIds": ["eeeeeeee-0000-4000-8000-000000000001", "eeeeeeee-0000-4000-8000-000000000002", "eeeeeeee-0000-4000-8000-000000000003", "eeeeeeee-0000-4000-8000-000000000004"],
     "matches": [{"home": "eeeeeeee-0000-4000-8000-000000000001", "away": "eeeeeeee-0000-4000-8000-000000000002"},
                 {"home": "eeeeeeee-0000-4000-8000-000000000002", "away": "eeeeeeee-0000-4000-8000-000000000001"}]}]') $$,
  'P0001', 'Hay partidos repetidos en un grupo.', 'grupos: sin partidos repetidos');
select lives_ok($$ select public.apply_groups('bbbbbbbb-0000-4000-8000-000000000001', (select groups from g)) $$,
  'grupos: el organizador los arma');

reset role;
select is((select count(*)::int from public.tournament_groups where tournament_id = 'bbbbbbbb-0000-4000-8000-000000000001'), 2, 'grupos: 2 grupos');
select is((select count(*)::int from public.matches where tournament_id = 'bbbbbbbb-0000-4000-8000-000000000001' and stage = 'group'), 2, 'grupos: 2 partidos');
create temp table m as select id, home_team_id from public.matches where tournament_id = 'bbbbbbbb-0000-4000-8000-000000000001' order by home_team_id;
grant select on m to authenticated;

-- -----------------------------------------------------------------------------
-- Programación
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
select is(public.apply_schedule('bbbbbbbb-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('matchId', (select id from m limit 1), 'slotId', 'dddddddd-0000-4000-8000-000000000001', 'courtId', 'cccccccc-0000-4000-8000-000000000001'),
    jsonb_build_object('matchId', (select id from m offset 1 limit 1), 'slotId', 'dddddddd-0000-4000-8000-000000000001', 'courtId', 'cccccccc-0000-4000-8000-000000000002')
  )), 2, 'programación: asigna en lote');
select throws_ok($$
  select public.apply_schedule('bbbbbbbb-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('matchId', (select id from m offset 1 limit 1), 'slotId', 'dddddddd-0000-4000-8000-000000000001', 'courtId', 'cccccccc-0000-4000-8000-000000000001')));
  set constraints all immediate;
$$, '23P01', null, 'programación: el lote no puede pisar una cancha ocupada');
set constraints all deferred;

select throws_ok($$ select public.assign_match_slot((select id from m limit 1), 'dddddddd-0000-4000-8000-000000000002', null) $$,
  'P0001', 'Elegí en qué cancha se juega.', 'manual: franja general exige cancha');
select lives_ok($$ select public.assign_match_slot((select id from m limit 1), 'dddddddd-0000-4000-8000-000000000002', 'cccccccc-0000-4000-8000-000000000001') $$,
  'manual: asigna y fija');
reset role;
select ok((select schedule_locked from public.matches where id = (select id from m limit 1)), 'manual: queda fijado');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok($$ select public.apply_schedule('bbbbbbbb-0000-4000-8000-000000000001', jsonb_build_array(
    jsonb_build_object('matchId', (select id from m limit 1), 'slotId', 'dddddddd-0000-4000-8000-000000000001', 'courtId', 'cccccccc-0000-4000-8000-000000000001'))) $$,
  'P0001', 'Un partido ya no se puede programar (se jugó o tiene horario fijado).', 'programación: el automático no mueve lo fijado');

-- -----------------------------------------------------------------------------
-- Resultados y confirmación (el torneo exige confirmación)
-- -----------------------------------------------------------------------------
select throws_ok($$ select public.record_match_result((select id from m limit 1), '{"type": "sets", "sets": []}', 'eeeeeeee-0000-4000-8000-000000000003') $$,
  'P0001', 'El ganador tiene que ser uno de los equipos del partido.', 'resultado: ganador válido');
select lives_ok($$ select public.record_match_result((select id from m limit 1), '{"type": "sets", "sets": [{"home": 6, "away": 3}, {"home": 6, "away": 4}]}', 'eeeeeeee-0000-4000-8000-000000000001') $$,
  'resultado: el organizador lo carga');
reset role;
select is((select result_status::text from public.matches where id = (select id from m limit 1)), 'provisional',
  'resultado: queda provisional si se exige confirmación');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok($$ select public.record_match_result((select id from m limit 1), '{"type": "sets", "sets": []}', 'eeeeeeee-0000-4000-8000-000000000001') $$,
  '42501', null, 'resultado: un jugador no lo puede cargar');
select is(public.respond_result((select id from m limit 1), 'confirmed'), 'provisional'::public.result_status,
  'confirmación: con un solo equipo sigue provisional');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok($$ select public.respond_result((select id from m limit 1), 'disputed', '  ') $$,
  'P0001', 'Contale al organizador qué está mal en el resultado.', 'objeción: exige comentario');
select is(public.respond_result((select id from m limit 1), 'disputed', 'Fue 6-4 el segundo'), 'disputed'::public.result_status,
  'objeción: queda objetado');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000009", "role": "authenticated"}';
select throws_ok($$ select public.respond_result((select id from m limit 1), 'confirmed') $$,
  '42501', 'No jugás este partido.', 'confirmación: un ajeno no responde');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok($$ select public.confirm_match_result((select id from m limit 1)) $$, 'organizador: confirma igual');
reset role;
select is((select result_status::text from public.matches where id = (select id from m limit 1)), 'confirmed', 'organizador: queda confirmado');

-- Con resultados cargados no se rearman los grupos; se puede borrar el resultado.
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok($$ select public.apply_groups('bbbbbbbb-0000-4000-8000-000000000001', (select groups from g)) $$,
  'P0001', 'Ya hay resultados cargados: no se pueden rearmar los grupos.', 'grupos: bloqueados con resultados');
select throws_ok($$ select public.assign_match_slot((select id from m limit 1), null, null) $$,
  'P0001', 'El partido ya tiene resultado: no se puede reprogramar.', 'manual: no se reprograma un partido jugado');
select lives_ok($$ select public.clear_match_result((select id from m limit 1)) $$, 'resultado: se puede borrar');
reset role;
select is((select count(*)::int from public.match_confirmations), 0, 'resultado borrado: sin confirmaciones');

select * from finish();
rollback;
