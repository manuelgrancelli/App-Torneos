-- =============================================================================
-- Reglas de las RPC de torneos, inscripción, disponibilidad y aprobación.
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
-- Aislamiento: sin los datos del seed (todo se revierte con el rollback final).
delete from public.tournaments;
select plan(50);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'org@test.local', now(), '{"full_name": "Olga Org"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000003', 'ana@test.local', now(), '{"full_name": "Ana"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000004', 'bruno@test.local', now(), '{"full_name": "Bruno"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000005', 'carla@test.local', now(), '{"full_name": "Carla"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000006', 'diego@test.local', now(), '{"full_name": "Diego"}', 'authenticated', 'authenticated'),
  ('aaaaaaaa-0000-4000-8000-000000000007', 'eva@test.local', now(), '{"full_name": "Eva"}', 'authenticated', 'authenticated'),
  -- Registrado pero sin confirmar el email.
  ('aaaaaaaa-0000-4000-8000-000000000008', 'sinconfirmar@test.local', null, '{"full_name": "Sin Confirmar"}', 'authenticated', 'authenticated');

-- -----------------------------------------------------------------------------
-- Alta del torneo y estados
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok($$ select public.create_tournament('golf', 'Torneo', 'torneo-golf', null, '2026-10-10', '2026-10-11', null, 8, array['C1']) $$,
  'P0001', 'El deporte elegido no existe.', 'create_tournament: valida el deporte');
select throws_ok($$ select public.create_tournament('padel', 'Torneo', 'torneo-x', null, '2026-10-10', '2026-10-11', null, 8, array[]::text[]) $$,
  'P0001', 'Definí entre 1 y 50 canchas.', 'create_tournament: exige canchas');
select throws_ok($$ select public.create_tournament('padel', 'Torneo', 'torneo-x', null, '2026-10-10', '2026-10-11', 'Marte/Olympus', 8, array['C1']) $$,
  'P0001', 'La zona horaria no es válida.', 'create_tournament: valida la zona horaria');
select throws_ok($$ select public.create_tournament('padel', 'Torneo', 'torneo-x', null, '2026-10-10', '2026-10-11', null, 8, array['C1'], '{"type": "goals"}') $$,
  'P0001', 'La configuración de puntuación no corresponde al deporte del torneo.', 'create_tournament: puntuación acorde al deporte');
select lives_ok($$ select public.create_tournament('padel', 'Copa Test', 'copa-test', 'Desc', '2026-10-10', '2026-10-11', null, 3, array['Cancha 1', 'Cancha 2']) $$,
  'create_tournament: crea el torneo');

reset role;
create temp table ids as select id as tournament_id from public.tournaments where slug = 'copa-test';
grant select on ids to authenticated;
select is((select count(*)::int from public.courts c join ids using (tournament_id)), 2, 'create_tournament: crea las canchas');
select matches((select code from public.tournament_invites join ids using (tournament_id)), '^[A-HJ-NP-Z2-9]{10}$',
  'create_tournament: genera un código de inscripción válido');
update public.tournament_invites set code = 'CUPATESTAA' where tournament_id = (select tournament_id from ids);

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';

select throws_ok($$ select public.set_tournament_status((select tournament_id from ids), 'registration_open') $$,
  'P0001', 'Cargá al menos una franja horaria antes de abrir la inscripción.', 'estado: abrir inscripción exige franjas');
insert into public.time_slots (tournament_id, starts_at, ends_at)
select tournament_id, '2026-10-10 10:00-03'::timestamptz, '2026-10-10 11:30-03'::timestamptz from ids
union all
select tournament_id, '2026-10-10 11:30-03'::timestamptz, '2026-10-10 13:00-03'::timestamptz from ids;
select throws_ok($$ select public.set_tournament_status((select tournament_id from ids), 'group_stage') $$,
  'P0001', 'No se puede pasar de "borrador" a "fase de grupos".', 'estado: no se puede saltear la inscripción');
select lives_ok($$ select public.set_tournament_status((select tournament_id from ids), 'registration_open') $$,
  'estado: abre la inscripción');

-- Otro usuario no puede tocar el torneo.
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000005", "role": "authenticated"}';
select throws_ok($$ select public.set_tournament_status((select tournament_id from ids), 'draft') $$,
  '42501', null, 'estado: solo el organizador');
select throws_ok($$ select public.rotate_invite_code((select tournament_id from ids)) $$,
  '42501', null, 'código: solo el organizador lo regenera');

-- -----------------------------------------------------------------------------
-- Inscripción
-- -----------------------------------------------------------------------------
select is((select name from public.resolve_invite_code('ZZZZZZZZZZ')), null, 'resolve_invite_code: código inexistente no devuelve nada');
select is((select name from public.resolve_invite_code(' cupatest-aa ')), 'Copa Test', 'resolve_invite_code: tolera espacios, guiones y minúsculas');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok($$ select public.register_team('NOEXISTE22', 'Ana / Bruno', array['bruno@test.local']) $$,
  'P0001', 'El código de inscripción no es válido.', 'inscripción: código inválido');
select throws_ok($$ select public.register_team('CUPATESTAA', 'Ana / Bruno', array[]::text[]) $$,
  'P0001', 'El equipo tiene que tener 2 integrantes, contándote a vos.', 'inscripción: pareja incompleta');
select throws_ok($$ select public.register_team('CUPATESTAA', 'Ana / Bruno', array['bruno@test.local', 'carla@test.local']) $$,
  'P0001', 'El equipo tiene que tener 2 integrantes, contándote a vos.', 'inscripción: pareja con de más');
select throws_ok($$ select public.register_team('CUPATESTAA', 'Ana / Ana', array['ANA@test.local ']) $$,
  'P0001', 'No incluyas tu propio email: ya quedás como capitán.', 'inscripción: no se puede agregar a sí mismo');
select throws_ok($$ select public.register_team('CUPATESTAA', 'Ana / X', array['no-es-email']) $$,
  'P0001', '"no-es-email" no es un email válido.', 'inscripción: valida emails');
select lives_ok($$ select public.register_team('cupatestaa', 'Ana / Bruno', array[' Bruno@Test.local ']) $$,
  'inscripción: Ana inscribe a Bruno por email');
select throws_ok($$ select public.register_team('CUPATESTAA', 'Otra', array['diego@test.local']) $$,
  'P0001', 'Ya estás inscripto en este torneo.', 'inscripción: una persona, un equipo');

reset role;
select is((select user_id from public.team_members where email = 'bruno@test.local'), null::uuid,
  'inscripción: cuenta verificada sin aceptación no queda vinculada');
create temp table bruno_invitation as
  select tm.team_id, tm.id as member_id from public.team_members tm where tm.email = 'bruno@test.local';
grant select on bruno_invitation to authenticated;

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000003", "role": "authenticated"}';
select lives_ok($$ select * from public.create_team_invitation(
  (select team_id from bruno_invitation),
  (select member_id from bruno_invitation),
  encode(extensions.digest('bruno-token', 'sha256'), 'hex')
) $$, 'invitación: el capitán crea una invitación para Bruno');
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000004", "role": "authenticated"}';
select is(
  public.accept_team_invitation(encode(extensions.digest('bruno-token', 'sha256'), 'hex')),
  (select team_id from bruno_invitation),
  'invitación: Bruno acepta su invitación'
);
select throws_ok($$ select public.accept_team_invitation(encode(extensions.digest('bruno-token', 'sha256'), 'hex')) $$,
  'P0001', 'La invitación no es válida o venció.', 'invitación: el token se invalida después de usarlo');
reset role;
select is((select user_id from public.team_members where email = 'bruno@test.local'), 'aaaaaaaa-0000-4000-8000-000000000004'::uuid,
  'invitación: vincula al usuario que aceptó');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000005", "role": "authenticated"}';
select throws_ok($$ select public.register_team('CUPATESTAA', 'Carla / Bruno', array['bruno@test.local']) $$,
  'P0001', 'bruno@test.local ya está inscripto en otro equipo de este torneo.', 'inscripción: el compañero ya está en otro equipo');
select throws_ok($$ select public.register_team('CUPATESTAA', 'ana / bruno', array['diego@test.local']) $$,
  'P0001', 'Ya hay un equipo con ese nombre en el torneo.', 'inscripción: nombre único (sin distinguir mayúsculas)');
-- Compañera sin cuenta: queda pendiente.
select lives_ok($$ select public.register_team('CUPATESTAA', 'Carla / Hana', array['hana@test.local']) $$,
  'inscripción: se puede vincular un email sin cuenta');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000008", "role": "authenticated"}';
select throws_ok($$ select public.register_team('CUPATESTAA', 'Sin / Confirmar', array['zz@test.local']) $$,
  'P0001', 'Confirmá tu email antes de inscribirte.', 'inscripción: exige email confirmado');

-- Hana se registra y confirma el email, pero debe aceptar su invitación.
reset role;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
values ('aaaaaaaa-0000-4000-8000-000000000009', 'hana@test.local', null, '{"full_name": "Hana"}', 'authenticated', 'authenticated');
select is((select user_id from public.team_members where email = 'hana@test.local'), null, 'vinculación: no vincula sin email confirmado');
update auth.users set email_confirmed_at = now() where id = 'aaaaaaaa-0000-4000-8000-000000000009';
select is((select user_id from public.team_members where email = 'hana@test.local'), null::uuid,
  'invitación: confirmar el email no acepta la invitación');
create temp table hana_invitation as
  select tm.team_id, tm.id as member_id from public.team_members tm where tm.email = 'hana@test.local';
grant select on hana_invitation to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000005", "role": "authenticated"}';
select lives_ok($$ select * from public.create_team_invitation(
  (select team_id from hana_invitation),
  (select member_id from hana_invitation),
  encode(extensions.digest('hana-token', 'sha256'), 'hex')
) $$, 'invitación: la capitana crea una invitación para Hana');
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000006", "role": "authenticated"}';
select throws_ok($$ select public.accept_team_invitation(encode(extensions.digest('hana-token', 'sha256'), 'hex')) $$,
  'P0001', 'Iniciá sesión con el mismo email al que enviaron la invitación.', 'invitación: rechaza otra cuenta');
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000009", "role": "authenticated"}';
select is(
  public.accept_team_invitation(encode(extensions.digest('hana-token', 'sha256'), 'hex')),
  (select team_id from hana_invitation),
  'invitación: Hana acepta con el email verificado'
);
reset role;
select is((select user_id from public.team_members where email = 'hana@test.local'), 'aaaaaaaa-0000-4000-8000-000000000009'::uuid,
  'invitación: vincula a Hana después de aceptar');

-- -----------------------------------------------------------------------------
-- Disponibilidad
-- -----------------------------------------------------------------------------
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000004", "role": "authenticated"}';
create temp table my_team as
  select team_id from public.team_members where user_id = 'aaaaaaaa-0000-4000-8000-000000000004';

select is(
  public.set_team_availability((select team_id from my_team), (select array_agg(id) from public.time_slots where tournament_id = (select tournament_id from ids))),
  2, 'disponibilidad: un integrante marca sus franjas');
select throws_ok($$ select public.set_team_availability((select team_id from my_team), array['dddddddd-0000-4000-8000-00000000ffff'::uuid]) $$,
  'P0001', 'Alguna de las franjas no pertenece a este torneo.', 'disponibilidad: solo franjas del torneo');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000006", "role": "authenticated"}';
select throws_ok($$ select public.set_team_availability((select team_id from my_team), array[]::uuid[]) $$,
  '42501', 'No sos integrante de este equipo.', 'disponibilidad: un ajeno no puede tocarla');

-- -----------------------------------------------------------------------------
-- Aprobación y cupo (max_teams = 3)
-- -----------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000006", "role": "authenticated"}';
select lives_ok($$ select public.register_team('CUPATESTAA', 'Diego / Eva', array['eva@test.local']) $$, 'inscripción: tercera pareja');
reset role;
create temp table eva_invitation as
  select tm.team_id, tm.id as member_id from public.team_members tm where tm.email = 'eva@test.local';
grant select on eva_invitation to authenticated;
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000006", "role": "authenticated"}';
select lives_ok($$ select * from public.create_team_invitation(
  (select team_id from eva_invitation),
  (select member_id from eva_invitation),
  encode(extensions.digest('eva-token', 'sha256'), 'hex')
) $$, 'invitación: el capitán crea una invitación para Eva');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok($$ select public.review_registration((select team_id from my_team), 'approved') $$,
  '42501', null, 'aprobación: solo el organizador');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
select throws_ok($$ select public.review_registration((select team_id from eva_invitation), 'approved') $$,
  'P0001', 'Todos los integrantes tienen que aceptar la invitación antes de aprobar.',
  'aprobación: bloquea parejas con invitaciones pendientes');
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000007", "role": "authenticated"}';
select is(
  public.accept_team_invitation(encode(extensions.digest('eva-token', 'sha256'), 'hex')),
  (select team_id from eva_invitation),
  'invitación: Eva acepta su invitación'
);
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok($$ select public.review_registration(id, 'approved') from public.teams where tournament_id = (select tournament_id from ids) $$,
  'aprobación: el organizador aprueba las tres');
select throws_ok($$ update public.tournaments set max_teams = 2 where id = (select tournament_id from ids) $$,
  'P0001', 'El cupo no puede ser menor a los 3 equipos ya aprobados.', 'cupo: no puede quedar debajo de los aprobados');

-- Cupo lleno: nadie más se puede inscribir.
reset role;
insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role)
values ('aaaaaaaa-0000-4000-8000-000000000010', 'fede@test.local', now(), '{"full_name": "Fede"}', 'authenticated', 'authenticated');
set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000010", "role": "authenticated"}';
select throws_ok($$ select public.register_team('CUPATESTAA', 'Fede / Gabi', array['gabi@test.local']) $$,
  'P0001', 'El torneo ya completó el cupo.', 'cupo: bloquea nuevas inscripciones');

-- -----------------------------------------------------------------------------
-- Salir del equipo y congelamiento al empezar
-- -----------------------------------------------------------------------------
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000003", "role": "authenticated"}';
select throws_ok($$ select public.leave_team((select team_id from my_team)) $$,
  'P0001', 'Sos el capitán: para bajarte, dá de baja la inscripción.', 'salir: el capitán no se "sale"');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';
select lives_ok($$ select public.set_tournament_status((select tournament_id from ids), 'group_stage') $$,
  'estado: empieza la fase de grupos con 3 aprobados');

set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000004", "role": "authenticated"}';
select throws_ok($$ select public.leave_team((select team_id from my_team)) $$,
  'P0001', 'La inscripción ya cerró: pedile al organizador que te dé de baja.', 'salir: bloqueado con el torneo en curso');

select * from finish();
rollback;
