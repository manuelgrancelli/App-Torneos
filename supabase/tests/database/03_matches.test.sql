-- =============================================================================
-- Partidos: integridad de programación (canchas y equipos sin superposición),
-- sincronización con las franjas y vista v_my_matches.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
-- Aislamiento: sin los datos del seed (todo se revierte con el rollback final).
delete from public.tournaments;
select plan(12);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'org@test.local', now(), '{"full_name": "Olga Org"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'ana@test.local', now(), '{"full_name": "Ana"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'carla@test.local', now(), '{"full_name": "Carla"}', 'authenticated', 'authenticated');

insert into public.tournaments (id, organizer_id, sport_id, name, slug, starts_on, ends_on, max_teams, scoring_config, standings_config, status)
select 'bbbbbbbb-0000-4000-8000-000000000001', 'aaaaaaaa-0000-4000-8000-000000000001', 'padel', 'Torneo', 'torneo',
  '2026-10-10', '2026-10-11', 8, default_scoring_config, default_standings_config, 'group_stage'
from public.sports where id = 'padel';

insert into public.courts (id, tournament_id, name) values
  ('cccccccc-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Cancha 1'),
  ('cccccccc-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 'Cancha 2'),
  ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001', 'Cancha 3');

insert into public.time_slots (id, tournament_id, starts_at, ends_at, court_id) values
  -- Franja general 10:00-11:30 y otra de la cancha 1 que se superpone (11:00-12:30).
  ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', '2026-10-10 10:00-03', '2026-10-10 11:30-03', null),
  ('dddddddd-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', '2026-10-10 11:00-03', '2026-10-10 12:30-03', 'cccccccc-0000-4000-8000-000000000001'),
  ('dddddddd-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001', '2026-10-10 14:00-03', '2026-10-10 15:30-03', null),
  -- General 11:00-12:30: se superpone en horario con la primera pero no fuerza cancha.
  ('dddddddd-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000001', '2026-10-10 11:00-03', '2026-10-10 12:30-03', null);

insert into public.teams (id, tournament_id, name, captain_id, status) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Equipo A', 'aaaaaaaa-0000-4000-8000-000000000003', 'approved'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 'Equipo B', 'aaaaaaaa-0000-4000-8000-000000000005', 'approved'),
  ('eeeeeeee-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001', 'Equipo C', 'aaaaaaaa-0000-4000-8000-000000000001', 'approved'),
  ('eeeeeeee-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000001', 'Equipo D', 'aaaaaaaa-0000-4000-8000-000000000001', 'approved');
insert into public.team_members (team_id, tournament_id, email, user_id, role) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'ana@test.local', 'aaaaaaaa-0000-4000-8000-000000000003', 'captain'),
  ('eeeeeeee-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 'carla@test.local', 'aaaaaaaa-0000-4000-8000-000000000005', 'captain');

insert into public.tournament_groups (id, tournament_id, name, position) values
  ('ffffffff-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Grupo A', 0);

insert into public.matches (id, tournament_id, stage, group_id, round, home_team_id, away_team_id) values
  ('99999999-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'group', 'ffffffff-0000-4000-8000-000000000001', 1, 'eeeeeeee-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000002'),
  ('99999999-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 'group', 'ffffffff-0000-4000-8000-000000000001', 1, 'eeeeeeee-0000-4000-8000-000000000003', 'eeeeeeee-0000-4000-8000-000000000004'),
  ('99999999-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000001', 'group', 'ffffffff-0000-4000-8000-000000000001', 2, 'eeeeeeee-0000-4000-8000-000000000001', 'eeeeeeee-0000-4000-8000-000000000003');

-- -----------------------------------------------------------------------------
-- Programación (como organizador)
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';

update public.matches
set slot_id = 'dddddddd-0000-4000-8000-000000000001', court_id = 'cccccccc-0000-4000-8000-000000000001'
where id = '99999999-0000-4000-8000-000000000001';

select is((select starts_at from public.matches where id = '99999999-0000-4000-8000-000000000001'),
  '2026-10-10 10:00-03'::timestamptz, 'programación: copia el horario de la franja');

-- Las validaciones son diferidas: se fuerzan con SET CONSTRAINTS para testear.
select throws_ok($$
  update public.matches set slot_id = 'dddddddd-0000-4000-8000-000000000002' where id = '99999999-0000-4000-8000-000000000002';
  set constraints all immediate;
$$, '23P01', null, 'programación: una cancha no puede tener partidos superpuestos (franjas distintas que se pisan)');
set constraints all deferred;

select lives_ok($$
  update public.matches set slot_id = 'dddddddd-0000-4000-8000-000000000001', court_id = 'cccccccc-0000-4000-8000-000000000002'
  where id = '99999999-0000-4000-8000-000000000002';
  set constraints all immediate;
$$, 'programación: otra cancha en la misma franja está permitido');
set constraints all deferred;

select throws_ok($$
  update public.matches set slot_id = 'dddddddd-0000-4000-8000-000000000004', court_id = 'cccccccc-0000-4000-8000-000000000003'
  where id = '99999999-0000-4000-8000-000000000003';
  set constraints all immediate;
$$, 'P0001', 'Un equipo no puede jugar dos partidos en horarios superpuestos.', 'programación: un equipo no juega dos partidos a la vez');
set constraints all deferred;

select lives_ok($$
  update public.matches set slot_id = 'dddddddd-0000-4000-8000-000000000003', court_id = 'cccccccc-0000-4000-8000-000000000001'
  where id = '99999999-0000-4000-8000-000000000003';
  set constraints all immediate;
$$, 'programación: franja libre para ambos equipos');
set constraints all deferred;

-- Si se mueve la franja, se mueven sus partidos.
update public.time_slots set starts_at = '2026-10-10 14:30-03', ends_at = '2026-10-10 16:00-03'
where id = 'dddddddd-0000-4000-8000-000000000003';
select is((select starts_at from public.matches where id = '99999999-0000-4000-8000-000000000003'),
  '2026-10-10 14:30-03'::timestamptz, 'programación: cambiar la franja actualiza el partido');

-- Si se borra la franja, el partido queda "sin horario".
delete from public.time_slots where id = 'dddddddd-0000-4000-8000-000000000003';
select ok((select slot_id is null and starts_at is null and court_id is null from public.matches where id = '99999999-0000-4000-8000-000000000003'),
  'programación: borrar la franja deja el partido sin horario');

-- Resultado incoherente: el ganador tiene que ser uno de los dos equipos.
select throws_ok($$
  update public.matches set winner_team_id = 'eeeeeeee-0000-4000-8000-000000000004', result_status = 'confirmed', result = '{}'
  where id = '99999999-0000-4000-8000-000000000001'
$$, '23514', null, 'resultado: el ganador tiene que jugar el partido');

update public.matches
set winner_team_id = 'eeeeeeee-0000-4000-8000-000000000001', result_status = 'confirmed',
    result = '{"sets": [{"home": 6, "away": 3}, {"home": 6, "away": 4}]}'
where id = '99999999-0000-4000-8000-000000000001';

-- -----------------------------------------------------------------------------
-- Participantes
-- -----------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000005", "role": "authenticated"}';

update public.matches set winner_team_id = 'eeeeeeee-0000-4000-8000-000000000002' where id = '99999999-0000-4000-8000-000000000001';
select is((select winner_team_id from public.matches where id = '99999999-0000-4000-8000-000000000001'),
  'eeeeeeee-0000-4000-8000-000000000001'::uuid, 'participante: no puede cambiar resultados');

select is((select count(*)::int from public.v_my_matches), 1, 'v_my_matches: solo los partidos propios');
select is((select outcome from public.v_my_matches), 'loss', 'v_my_matches: calcula el resultado desde mi lado');
select is((select rival_team_name from public.v_my_matches), 'Equipo A', 'v_my_matches: identifica al rival');

select * from finish();
rollback;
