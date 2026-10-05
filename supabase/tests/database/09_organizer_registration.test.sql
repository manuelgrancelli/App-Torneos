-- Inscripción por el organizador con nombres, disponibilidad y sin emails.
begin;
create extension if not exists pgtap with schema extensions;
select plan(11);

delete from public.tournaments;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('cccccccc-0000-4000-8000-000000000001', 'org@organizer-registration.local', now(),
   '{"full_name": "Organizador"}', 'authenticated', 'authenticated'),
  ('cccccccc-0000-4000-8000-000000000002', 'other@organizer-registration.local', now(),
   '{"full_name": "Ajeno"}', 'authenticated', 'authenticated');

set local role authenticated;
set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000001", "role": "authenticated"}';

select lives_ok(
  $$ select public.create_test_tournament('padel', 'Prueba organizador', 'prueba-organizador', null,
     '2026-10-10', '2026-10-11', null, 4, array['Cancha 1']) $$,
  'crea un torneo privado para probar inscripciones manuales'
);

reset role;
create temp table organizer_test_tournament as
select id as tournament_id from public.tournaments where slug = 'prueba-organizador';
grant select on organizer_test_tournament to anon, authenticated;

insert into public.time_slots (tournament_id, starts_at, ends_at)
select tournament_id, '2026-10-10 10:00-03'::timestamptz, '2026-10-10 11:30-03'::timestamptz
from organizer_test_tournament;

set local role authenticated;
set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$ select public.set_tournament_status((select tournament_id from organizer_test_tournament), 'registration_open') $$,
  'abre la inscripción del torneo'
);
select lives_ok(
  $$ select public.create_organizer_team(
    (select tournament_id from organizer_test_tournament),
    'Las del sábado',
    array['Ana Pérez', 'Belén Gómez'],
    array(select id from public.time_slots where tournament_id = (select tournament_id from organizer_test_tournament))
  ) $$,
  'el organizador inscribe una pareja con disponibilidad, sin emails, también en un torneo privado'
);
select is(
  (select count(*)::integer from public.teams
   where tournament_id = (select tournament_id from organizer_test_tournament)
     and status = 'approved' and organizer_registered and not test_generated),
  1,
  'la pareja manual queda aprobada y diferenciada de las ficticias'
);
select is(
  (select array_agg(display_name order by display_name)
   from public.team_members
   where team_id = (select id from public.teams where name = 'Las del sábado')),
  array['Ana Pérez', 'Belén Gómez']::text[],
  'guarda el nombre de cada integrante'
);
select is(
  (select count(*)::integer from public.team_members
   where team_id = (select id from public.teams where name = 'Las del sábado')
     and email is null and user_id is null),
  2,
  'no crea emails ni cuentas ficticias para los integrantes'
);
select is(
  (select count(*)::integer from public.team_availability
   where team_id = (select id from public.teams where name = 'Las del sábado')),
  1,
  'persiste las franjas seleccionadas'
);

select throws_ok(
  $$ select public.update_team_roster(
    (select id from public.teams where name = 'Las del sábado'),
    'Otro nombre',
    array[]::text[]
  ) $$,
  '42501', 'Solo el capitán puede editar el equipo.',
  'el organizador no cambia estos equipos mediante el flujo de integrantes por email'
);
select throws_ok(
  $$ select public.withdraw_team((select id from public.teams where name = 'Las del sábado')) $$,
  '42501', 'Solo el capitán puede dar de baja la inscripción.',
  'la baja manual no pasa por el flujo del capitán participante'
);
select throws_ok(
  $$ select * from public.create_team_invitation(
    (select id from public.teams where name = 'Las del sábado'),
    (select id from public.team_members where display_name = 'Belén Gómez'),
    repeat('a', 64)
  ) $$,
  '42501', 'Solo el capitán puede invitar a sus compañeros.',
  'no se pueden enviar invitaciones por email a integrantes sin email'
);

reset role;
set local role authenticated;
set local request.jwt.claims = '{"sub": "cccccccc-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.create_organizer_team(
    (select tournament_id from organizer_test_tournament),
    'Equipo ajeno',
    array['Persona 1', 'Persona 2'],
    array(select id from public.time_slots where tournament_id = (select tournament_id from organizer_test_tournament))
  ) $$,
  '42501', 'No tenés permiso para inscribir equipos en este torneo.',
  'solo el organizador puede usar la inscripción manual'
);

select * from finish();
rollback;
