-- Torneos privados de prueba y generación protegida de equipos ficticios.
begin;
create extension if not exists pgtap with schema extensions;
select plan(13);

delete from public.tournaments;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('bbbbbbbb-0000-4000-8000-000000000001', 'org@test-tournament.local', now(), '{"full_name": "Olga Org"}', 'authenticated', 'authenticated'),
  ('bbbbbbbb-0000-4000-8000-000000000003', 'ana@test-tournament.local', now(), '{"full_name": "Ana"}', 'authenticated', 'authenticated');

set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_test_tournament('padel', 'Torneo privado', 'torneo-privado', null,
     '2026-10-10', '2026-10-11', null, 4, array['Cancha 1']) $$,
  'crea un torneo marcado como prueba desde el alta'
);

reset role;
create temp table test_tournament as
select id as tournament_id from public.tournaments where slug = 'torneo-privado';
grant select on test_tournament to anon, authenticated;

insert into public.time_slots (tournament_id, starts_at, ends_at)
select tournament_id, '2026-10-10 10:00-03'::timestamptz, '2026-10-10 11:30-03'::timestamptz
from test_tournament;
update public.tournament_invites set code = 'TESTONLYAA'
where tournament_id = (select tournament_id from test_tournament);

set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000001", "role": "authenticated"}';
select is(
  (select is_test from public.tournaments where id = (select tournament_id from test_tournament)),
  true,
  'el modo de prueba queda fijado desde su creación'
);
select lives_ok(
  $$ select public.set_tournament_status((select tournament_id from test_tournament), 'registration_open') $$,
  'abre el torneo privado de prueba'
);
select throws_ok(
  $$ select public.register_team('TESTONLYAA', 'Ana / Bruno', array['bruno@test-tournament.local']) $$,
  'P0001', 'Este es un torneo de prueba privado y no recibe inscripciones reales.',
  'bloquea inscripciones reales aunque se invoque la RPC directamente'
);
select is(
  public.fill_test_team_slots((select tournament_id from test_tournament)),
  4,
  'completa el cupo con parejas ficticias en el proyecto alojado'
);
select is(
  (select count(*)::integer from public.teams
   where tournament_id = (select tournament_id from test_tournament)
     and status = 'approved' and test_generated),
  4,
  'las parejas generadas quedan aprobadas y marcadas como ficticias'
);
select is(
  (select count(*)::integer from public.team_members tm
   join public.teams t on t.id = tm.team_id
   where t.tournament_id = (select tournament_id from test_tournament)
     and t.test_generated and tm.role = 'captain'),
  4,
  'cada pareja ficticia tiene un integrante capitán'
);
select is(
  (select count(*)::integer from public.team_availability
   where tournament_id = (select tournament_id from test_tournament)),
  4,
  'cada pareja ficticia tiene disponibilidad en todas las franjas'
);
select lives_ok(
  $$ select public.set_tournament_status((select tournament_id from test_tournament), 'group_stage') $$,
  'los equipos ficticios permiten continuar a la fase de grupos'
);

set local role anon;
set local request.jwt.claims = '{"role": "anon"}';
select is(
  (select count(*)::integer from public.tournaments
   where id = (select tournament_id from test_tournament)),
  0,
  'el torneo de prueba no se ve con una consulta pública'
);
select is(
  (select count(*)::integer from public.teams
   where tournament_id = (select tournament_id from test_tournament)),
  0,
  'las parejas ficticias no se ven con una consulta pública'
);
select is(
  (select count(*)::integer from public.resolve_invite_code('TESTONLYAA')),
  0,
  'el código de inscripción no revela un torneo de prueba'
);

set local role authenticated;
set local request.jwt.claims = '{"sub": "bbbbbbbb-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok(
  $$ select public.fill_test_team_slots((select tournament_id from test_tournament)) $$,
  '42501', 'No tenés permiso para completar los cupos.',
  'solo el organizador puede generar equipos ficticios'
);

select * from finish();
rollback;
