-- =============================================================================
-- Datos de DEMO para desarrollo local (solo corre con `supabase db reset`).
-- NO ejecutar en producción. Todos los usuarios tienen la contraseña: demo1234
-- =============================================================================

-- Usuarios con email confirmado (los triggers crean perfiles y vinculan pendientes).
insert into auth.users (
  instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
  raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
  confirmation_token, recovery_token, email_change_token_new, email_change,
  email_change_token_current, phone_change, phone_change_token, reauthentication_token
)
select
  '00000000-0000-0000-0000-000000000000', u.id, 'authenticated', 'authenticated', u.email,
  extensions.crypt('demo1234', extensions.gen_salt('bf')), now(),
  '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', u.full_name),
  now(), now(), '', '', '', '', '', '', '', ''
from (values
  ('00000000-0000-4000-8000-000000000001'::uuid, 'organizador@demo.test', 'Olga Organizadora'),
  ('00000000-0000-4000-8000-000000000002'::uuid, 'ana@demo.test', 'Ana López'),
  ('00000000-0000-4000-8000-000000000003'::uuid, 'bruno@demo.test', 'Bruno García'),
  ('00000000-0000-4000-8000-000000000004'::uuid, 'carla@demo.test', 'Carla Méndez'),
  ('00000000-0000-4000-8000-000000000005'::uuid, 'diego@demo.test', 'Diego Suárez'),
  ('00000000-0000-4000-8000-000000000006'::uuid, 'eva@demo.test', 'Eva Romero'),
  ('00000000-0000-4000-8000-000000000007'::uuid, 'fede@demo.test', 'Fede Álvarez'),
  ('00000000-0000-4000-8000-000000000008'::uuid, 'gabi@demo.test', 'Gabi Torres')
) as u (id, email, full_name);

-- Identidades de email (GoTrue las necesita para el login con contraseña).
insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
select gen_random_uuid(), u.id, u.id::text, 'email',
  jsonb_build_object('sub', u.id::text, 'email', u.email, 'email_verified', true),
  now(), now(), now()
from auth.users u
where u.email like '%@demo.test';

-- Torneo demo de pádel armado con las mismas RPC que usa la app.
do $$
declare
  v_org constant uuid := '00000000-0000-4000-8000-000000000001';
  v_tournament uuid;
  v_team uuid;
  v_slots uuid[];
begin
  -- Actuar como el organizador (auth.uid() lee estos claims).
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);

  v_tournament := public.create_tournament(
    p_sport_id => 'padel',
    p_name => 'Torneo Demo de Pádel',
    p_slug => 'torneo-demo-padel',
    p_description => 'Torneo de ejemplo para desarrollo local.',
    p_starts_on => '2026-10-10',
    p_ends_on => '2026-10-11',
    p_timezone => 'America/Argentina/Buenos_Aires',
    p_max_teams => 8,
    p_court_names => array['Cancha 1', 'Cancha 2']
  );

  -- Código fijo para probar el link de inscripción: /unirse/DEMQ2PADEL (sin O ni I, igual que los generados).
  update public.tournament_invites set code = 'DEMQ2PADEL' where tournament_id = v_tournament;

  -- Franjas de 90 minutos sábado y domingo (sin cancha = cualquiera de las dos).
  insert into public.time_slots (tournament_id, starts_at, ends_at)
  select v_tournament, d + t, d + t + interval '90 minutes'
  from unnest(array['2026-10-10 00:00-03'::timestamptz, '2026-10-11 00:00-03'::timestamptz]) as d,
       unnest(array[interval '9 hours', interval '10 hours 30 minutes', interval '12 hours', interval '17 hours', interval '18 hours 30 minutes']) as t;

  perform public.set_tournament_status(v_tournament, 'registration_open');

  select array_agg(id order by starts_at) into v_slots from public.time_slots where tournament_id = v_tournament;

  -- Parejas: Ana+Bruno, Carla+Diego, Eva+Fede y Gabi con una compañera sin cuenta (queda pendiente).
  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000002", "role": "authenticated"}', true);
  v_team := public.register_team('DEMQ2PADEL', 'López / García', array['bruno@demo.test']);
  perform public.set_team_availability(v_team, v_slots[1:6]);

  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000004", "role": "authenticated"}', true);
  v_team := public.register_team('DEMQ2PADEL', 'Méndez / Suárez', array['diego@demo.test']);
  perform public.set_team_availability(v_team, v_slots[3:10]);

  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000006", "role": "authenticated"}', true);
  v_team := public.register_team('DEMQ2PADEL', 'Romero / Álvarez', array['fede@demo.test']);
  perform public.set_team_availability(v_team, array[v_slots[1], v_slots[4], v_slots[6], v_slots[9]]);

  perform set_config('request.jwt.claims', '{"sub": "00000000-0000-4000-8000-000000000008", "role": "authenticated"}', true);
  v_team := public.register_team('DEMQ2PADEL', 'Torres / Paz', array['hana.paz@demo.test']);

  -- El organizador aprueba dos inscripciones; las otras quedan pendientes.
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);
  perform public.review_registration(id, 'approved')
  from public.teams
  where tournament_id = v_tournament and name in ('López / García', 'Méndez / Suárez');

  perform set_config('request.jwt.claims', '', true);
end;
$$;
