-- =============================================================================
-- F4: reglas de edición según el estado del torneo (migración tournament_edit_rules).
-- =============================================================================
begin;
create extension if not exists pgtap with schema extensions;
-- Aislamiento: sin los datos del seed (todo se revierte con el rollback final).
delete from public.tournaments;
select plan(9);

insert into auth.users (id, email, email_confirmed_at, raw_user_meta_data, aud, role) values
  ('aaaaaaaa-0000-4000-8000-000000000001', 'org@test.local', now(), '{"full_name": "Olga Org"}', 'authenticated', 'authenticated');

insert into public.tournaments (id, organizer_id, sport_id, name, slug, starts_on, ends_on, max_teams, scoring_config, standings_config, status)
select v.id, 'aaaaaaaa-0000-4000-8000-000000000001', 'padel', v.name, v.slug, '2026-10-10', '2026-10-11', 8,
  s.default_scoring_config, s.default_standings_config, v.status::public.tournament_status
from public.sports s,
  (values
    ('bbbbbbbb-0000-4000-8000-000000000001'::uuid, 'En preparación', 'prep', 'registration_open'),
    ('bbbbbbbb-0000-4000-8000-000000000002'::uuid, 'En playoffs', 'playoffs', 'playoffs')
  ) as v (id, name, slug, status)
where s.id = 'padel';

insert into public.courts (id, tournament_id, name) values
  ('cccccccc-0000-4000-8000-000000000001', 'bbbbbbbb-0000-4000-8000-000000000001', 'Cancha 1'),
  ('cccccccc-0000-4000-8000-000000000002', 'bbbbbbbb-0000-4000-8000-000000000001', 'Cancha 2'),
  ('cccccccc-0000-4000-8000-000000000003', 'bbbbbbbb-0000-4000-8000-000000000002', 'Cancha 1'),
  ('cccccccc-0000-4000-8000-000000000004', 'bbbbbbbb-0000-4000-8000-000000000002', 'Cancha 2');

set local role authenticated;
set local request.jwt.claims = '{"sub": "aaaaaaaa-0000-4000-8000-000000000001", "role": "authenticated"}';

-- Zona horaria: libre sin franjas, bloqueada con franjas.
select lives_ok($$ update public.tournaments set timezone = 'America/Montevideo' where id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'zona horaria: se cambia si no hay franjas');
insert into public.time_slots (tournament_id, starts_at, ends_at)
values ('bbbbbbbb-0000-4000-8000-000000000001', '2026-10-10 10:00-03', '2026-10-10 11:30-03');
select throws_ok($$ update public.tournaments set timezone = 'America/Argentina/Buenos_Aires' where id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'P0001', 'No se puede cambiar la zona horaria: el torneo ya tiene franjas cargadas.', 'zona horaria: bloqueada con franjas');

-- Tabla de posiciones: editable en preparación, bloqueada en playoffs.
select lives_ok($$ update public.tournaments set standings_config = jsonb_set(standings_config, '{points,loss}', '1') where id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'tabla: editable antes de playoffs');
select throws_ok($$ update public.tournaments set standings_config = jsonb_set(standings_config, '{points,loss}', '1') where id = 'bbbbbbbb-0000-4000-8000-000000000002' $$,
  'P0001', 'No se puede cambiar la tabla de posiciones después de terminar la fase de grupos.', 'tabla: bloqueada en playoffs');

-- Canchas: se borran en preparación, nunca la última, nunca con el torneo en curso.
select lives_ok($$ delete from public.courts where id = 'cccccccc-0000-4000-8000-000000000002' $$,
  'canchas: se borra una en preparación');
select throws_ok($$ delete from public.courts where id = 'cccccccc-0000-4000-8000-000000000001' $$,
  'P0001', 'El torneo tiene que tener al menos una cancha.', 'canchas: no se borra la última');
delete from public.courts where id = 'cccccccc-0000-4000-8000-000000000004';

reset role;
select is((select count(*)::int from public.courts where tournament_id = 'bbbbbbbb-0000-4000-8000-000000000002'), 2,
  'canchas: con el torneo en curso el borrado no afecta filas');

-- Borrar el torneo borra sus canchas (la regla de la última cancha no aplica en cascada).
select lives_ok($$ delete from public.tournaments where id = 'bbbbbbbb-0000-4000-8000-000000000001' $$,
  'cascada: borrar el torneo borra su última cancha');
select is((select count(*)::int from public.courts where tournament_id = 'bbbbbbbb-0000-4000-8000-000000000001'), 0,
  'cascada: no quedan canchas huérfanas');

select * from finish();
rollback;
