-- =============================================================================
-- Matriz de acceso (RLS + privilegios): qué ve y qué puede tocar cada rol.
-- Se corre con `supabase test db`. Todo ocurre en una transacción que se descarta.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
-- Aislamiento: sin los datos del seed (todo se revierte con el rollback final).
delete from public.tournaments;
select plan(32);

-- -----------------------------------------------------------------------------
-- Datos (como postgres)
-- -----------------------------------------------------------------------------
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'org@test.local', now(), '{"full_name": "Olga Org"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000002', 'org2@test.local', now(), '{"full_name": "Otro Org"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'ana@test.local', now(), '{"full_name": "Ana"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'bruno@test.local', now(), '{"full_name": "Bruno"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'extra@test.local', now(), '{"full_name": "Extraño"}', 'authenticated', 'authenticated');

insert into public.tournaments (id, organizer_id, sport_id, name, slug, starts_on, ends_on, max_teams, scoring_config, standings_config, status)
select v.id, 'aaaaaaaa-0000-4000-8000-000000000001', 'padel', v.name, v.slug, '2026-10-10', '2026-10-11', 8,
  s.default_scoring_config, s.default_standings_config, v.status::public.tournament_status
from public.sports s,
  (values
    ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'Torneo borrador', 'borrador', 'draft'),
    ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'Torneo abierto', 'abierto', 'registration_open')
  ) as v (id, name, slug, status)
where s.id = 'padel';

insert into public.courts (id, tournament_id, name) values
  ('cccccccc-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'Cancha 1');
insert into public.time_slots (id, tournament_id, starts_at, ends_at) values
  ('dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', '2026-10-10 10:00-03', '2026-10-10 11:30-03');

-- Equipo pendiente de Ana + Bruno en el torneo abierto.
insert into public.teams (id, tournament_id, name, captain_id) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'Ana / Bruno', 'aaaaaaaa-0000-4000-8000-000000000003');
insert into public.team_members (team_id, tournament_id, email, user_id, role) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'ana@test.local', 'aaaaaaaa-0000-4000-8000-000000000003', 'captain'),
  ('eeeeeeee-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002', 'bruno@test.local', 'aaaaaaaa-0000-4000-8000-000000000004', 'player');
insert into public.team_availability (team_id, slot_id, tournament_id) values
  ('eeeeeeee-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002');

-- -----------------------------------------------------------------------------
-- Anónimo
-- -----------------------------------------------------------------------------
set local role anon;
set local request.jwt.claims = '{"role": "anon"}';

select is((select count(*)::int from public.tournaments), 1, 'anon: solo ve torneos publicados');
select is((select count(*)::int from public.sports), 3, 'anon: ve el catálogo de deportes');
select is((select count(*)::int from public.courts), 1, 'anon: ve canchas de torneos publicados');
select is((select count(*)::int from public.teams), 0, 'anon: no ve inscripciones pendientes');
select throws_ok('select * from public.tournament_invites', '42501', null, 'anon: sin acceso a códigos de inscripción');
select throws_ok('select * from public.team_members', '42501', null, 'anon: sin acceso a integrantes (emails)');
select throws_ok('select * from public.team_availability', '42501', null, 'anon: sin acceso a disponibilidad');
select throws_ok('select * from public.profiles', '42501', null, 'anon: sin acceso a perfiles');
select throws_ok($$ insert into public.courts (tournament_id, name) values ('bbbbbbbb-0000-4000-8000-000000000002', 'X') $$,
  '42501', null, 'anon: no puede escribir');
select throws_ok($$ select public.register_team('ABCDEFGHJK', 'Equipo', array['x@test.local']) $$,
  '42501', null, 'anon: no puede ejecutar RPCs de escritura');

reset role;

-- -----------------------------------------------------------------------------
-- Participante (Bruno, integrante no capitán)
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000004", "role": "authenticated"}';

select is((select count(*)::int from public.teams), 1, 'participante: ve su equipo aunque esté pendiente');
select is((select count(*)::int from public.team_members), 2, 'participante: ve a su compañero');
select is((select count(*)::int from public.profiles), 2, 'participante: ve su perfil y el del compañero');
select is((select count(*)::int from public.team_availability), 1, 'participante: ve su disponibilidad');
select is((select count(*)::int from public.tournament_invites), 0, 'participante: no ve el código de inscripción');
select throws_ok($$ insert into public.teams (tournament_id, name, captain_id) values ('bbbbbbbb-0000-4000-8000-000000000002', 'Trucho', 'aaaaaaaa-0000-4000-8000-000000000004') $$,
  '42501', null, 'participante: no puede crear equipos salteando la RPC');
select throws_ok($$ update public.teams set status = 'approved' $$,
  '42501', null, 'participante: no puede auto-aprobarse');
select throws_ok($$ insert into public.team_availability (team_id, slot_id, tournament_id) values ('eeeeeeee-0000-4000-8000-000000000001', 'dddddddd-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000002') $$,
  '42501', null, 'participante: la disponibilidad solo se escribe por RPC');

-- Un UPDATE sobre filas no autorizadas no falla: simplemente no afecta nada.
update public.time_slots set ends_at = ends_at + interval '1 hour';
update public.courts set name = 'Hackeada';

reset role;
select is((select name from public.courts where id = 'cccccccc-0000-4000-8000-000000000001'), 'Cancha 1',
  'participante: no puede editar canchas');
select is((select ends_at from public.time_slots where id = 'dddddddd-0000-4000-8000-000000000001'), '2026-10-10 11:30-03'::timestamptz,
  'participante: no puede editar franjas');

-- -----------------------------------------------------------------------------
-- Usuario ajeno (autenticado, sin relación con el torneo)
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000005", "role": "authenticated"}';

select is((select count(*)::int from public.tournaments), 1, 'ajeno: solo ve torneos publicados');
select is((select count(*)::int from public.teams), 0, 'ajeno: no ve inscripciones pendientes');
select is((select count(*)::int from public.team_members), 0, 'ajeno: no ve integrantes');
select is((select count(*)::int from public.profiles), 1, 'ajeno: solo ve su propio perfil');

update public.tournaments set name = 'Hackeado';
reset role;
select is((select count(*)::int from public.tournaments where name = 'Hackeado'), 0, 'ajeno: no puede editar torneos');

-- -----------------------------------------------------------------------------
-- Organizador
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';

select is((select count(*)::int from public.tournaments), 2, 'organizador: ve sus borradores');
select is((select count(*)::int from public.tournament_invites), 2, 'organizador: ve sus códigos');
select is((select count(*)::int from public.team_members), 2, 'organizador: ve los integrantes de sus torneos');
select is((select count(*)::int from public.profiles), 3, 'organizador: ve perfiles de sus inscriptos');
select lives_ok($$ update public.tournaments set name = 'Torneo abierto 2026' where id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  'organizador: edita su torneo');
select throws_ok($$ update public.tournaments set status = 'finished' where id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  '42501', null, 'organizador: el estado solo cambia por RPC');
select throws_ok($$ update public.tournaments set organizer_id = 'aaaaaaaa-0000-4000-8000-000000000002' $$,
  '42501', null, 'organizador: no puede transferir el torneo por la API');

select * from finish();
rollback;
