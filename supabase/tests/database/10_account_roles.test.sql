-- Rol de cuenta (D-122): los jugadores no crean torneos ni circuitos.
begin;
select plan(7);

delete from public.tournaments;

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('dddddddd-0000-4000-8000-000000000001', 'org@roles.local', now(), '{"full_name": "Olga Org"}', 'authenticated', 'authenticated'),
  ('dddddddd-0000-4000-8000-000000000002', 'jugador@roles.local', now(), '{"full_name": "Juan Jugador"}', 'authenticated', 'authenticated');

select is(
  (select account_role from public.profiles where id = 'dddddddd-0000-4000-8000-000000000002'),
  'player',
  'las cuentas nuevas son de jugador'
);

update public.profiles set account_role = 'organizer' where id = 'dddddddd-0000-4000-8000-000000000001';

set local role authenticated;

-- Jugador: no crea torneos (ni de prueba) ni circuitos, ni puede cambiarse el rol.
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000002", "role": "authenticated"}';
select throws_ok(
  $$ select public.create_tournament('padel', 'Torneo', 'torneo-jugador', null, '2026-10-10', '2026-10-11', null, 8, array['C1']) $$,
  'P0001', 'Tu cuenta es de jugador: no podés crear torneos ni circuitos.',
  'jugador: create_tournament rechazado'
);
select throws_ok(
  $$ select public.create_test_tournament('padel', 'Prueba', 'prueba-jugador', null, '2026-10-10', '2026-10-11', null, 4, array['C1']) $$,
  'P0001', 'Tu cuenta es de jugador: no podés crear torneos ni circuitos.',
  'jugador: create_test_tournament rechazado'
);
select throws_ok(
  $$ insert into public.circuits (organizer_id, sport_id, name, slug, points_config)
     values ('dddddddd-0000-4000-8000-000000000002', 'padel', 'Circuito', 'circuito-jugador', '{}') $$,
  'P0001', 'Tu cuenta es de jugador: no podés crear torneos ni circuitos.',
  'jugador: alta de circuito rechazada'
);
select throws_ok(
  $$ update public.profiles set account_role = 'organizer' where id = 'dddddddd-0000-4000-8000-000000000002' $$,
  '42501', null,
  'jugador: no puede cambiarse el rol'
);

-- Organizador: crea torneos y circuitos.
set local request.jwt.claims = '{"sub": "dddddddd-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok(
  $$ select public.create_tournament('padel', 'Copa Org', 'copa-org-roles', null, '2026-10-10', '2026-10-11', null, 8, array['C1']) $$,
  'organizador: crea torneos'
);
select lives_ok(
  $$ insert into public.circuits (organizer_id, sport_id, name, slug, points_config)
     values ('dddddddd-0000-4000-8000-000000000001', 'padel', 'Circuito', 'circuito-org-roles', '{}') $$,
  'organizador: crea circuitos'
);

select * from finish();
rollback;
