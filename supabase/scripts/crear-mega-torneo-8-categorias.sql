-- =============================================================================
-- Script para crear un MEGA TORNEO DE PRUEBA con 8 categorías y 108 parejas
-- Requisitos:
-- 1. 8 categorías:
--    - 4 categorías con 12 parejas (48 parejas)
--    - 4 categorías con 15 parejas (60 parejas)
--    - Total: 108 parejas
-- 2. 4 canchas (Cancha 1, Cancha 2, Cancha 3, Cancha 4)
-- 3. Fechas: Miércoles 04/11 a Domingo 08/11 de 2026
--    - Franjas de 60m predeterminadas de Mié, Jue, Vie: 09:00 a 22:00 hs (fase de grupos)
--    - Franjas de 60m predeterminadas de Sáb, Dom: 08:00 a 22:00 hs (playoffs)
-- =============================================================================

do $$
declare
  v_org uuid;
  v_tournament uuid;
  v_cat_id uuid;
  v_cat_name text;
  v_cat_count integer;
  v_team_id uuid;
  v_team_name text;
  v_p1_name text;
  v_p2_name text;
  v_group_slots uuid[];
  v_i integer;
  v_cat_idx integer;
  v_slug text := 'mega-torneo-8-cat-' || substr(gen_random_uuid()::text, 1, 6);
  
  -- Apellidos de ejemplo para parejas realistas
  v_lastnames text[] := array[
    'González', 'Rodríguez', 'Gómez', 'Fernández', 'López', 'Díaz', 'Martínez', 'Pérez',
    'Romero', 'Sánchez', 'Álvarez', 'Torres', 'Ruiz', 'Ramírez', 'Flores', 'Acosta',
    'Benítez', 'Medina', 'Suárez', 'Herrera', 'Aguirre', 'Giménez', 'Gutiérrez', 'Pereyra',
    'Molina', 'Castro', 'Rojas', 'Ortiz', 'Silva', 'Núñez', 'Luna', 'Juárez', 'Cabrera',
    'Ríos', 'Morales', 'Godoy', 'Moreno', 'Ferreyra', 'Domínguez', 'Carrizo', 'Vega',
    'Castillo', 'Ojeda', 'Mendoza', 'Peralta', 'Bustos', 'Mansilla', 'Correa', 'Vargas'
  ];
  v_ln_count integer := array_length(v_lastnames, 1);
begin
  -- 1. Identificar al organizador (prioriza manuelgrancelli@gmail.com o el primer organizador)
  select id into v_org
  from auth.users
  where lower(email) = 'manuelgrancelli@gmail.com'
  limit 1;

  if v_org is null then
    select id into v_org from public.profiles where account_role in ('organizer', 'superadmin') limit 1;
  end if;

  if v_org is null then
    raise exception 'No se encontró un usuario organizador en la base de datos.';
  end if;

  -- Simular identidad del organizador para que las funciones RLS respondan correctamente
  perform set_config('request.jwt.claims', json_build_object('sub', v_org, 'role', 'authenticated')::text, true);

  -- 2. Crear el torneo como torneo de prueba (is_test = true)
  -- Nota: el trigger "tournaments_create_invite" genera automáticamente el código de 10 caracteres
  insert into public.tournaments (
    organizer_id,
    sport_id,
    name,
    slug,
    description,
    starts_on,
    ends_on,
    timezone,
    max_teams,
    status,
    is_test,
    scoring_config,
    standings_config,
    playoff_config
  ) values (
    v_org,
    'padel',
    'Torneo Oficial 8 Categorías (Prueba)',
    v_slug,
    'Torneo de prueba a gran escala con 8 categorías, 108 parejas, 4 canchas, turnos de 60 minutos y simulación completa.',
    '2026-11-04',
    '2026-11-08',
    'America/Argentina/Buenos_Aires',
    108,
    'registration_open',
    true,
    '{"type": "sets", "bestOf": 3, "gamesPerSet": 6, "tiebreak": true, "decidingSet": "super_tiebreak", "superTiebreakPoints": 10, "superTiebreakUntil": "all"}'::jsonb,
    '{"points": {"win": 2, "draw": 0, "loss": 1}, "tiebreakers": ["points", "wins", "head_to_head", "set_diff", "game_diff"]}'::jsonb,
    '{"thirdPlace": false, "qualifiersPerGroup": 2}'::jsonb
  ) returning id into v_tournament;

  -- 3. Crear las 4 canchas
  insert into public.courts (tournament_id, name, position) values
    (v_tournament, 'Cancha 1', 0),
    (v_tournament, 'Cancha 2', 1),
    (v_tournament, 'Cancha 3', 2),
    (v_tournament, 'Cancha 4', 3);

  -- 4. Crear las franjas horarias de 60 minutos (predeterminado de partido)
  -- Miércoles 04/11, Jueves 05/11, Viernes 06/11: 09:00 a 22:00 (13 turnos de 60m por día = 39 turnos)
  insert into public.time_slots (tournament_id, starts_at, ends_at, stage)
  select
    v_tournament,
    d + (h || ' hours')::interval,
    d + ((h + 1) || ' hours')::interval,
    'group'
  from unnest(array[
    '2026-11-04 00:00-03'::timestamptz,
    '2026-11-05 00:00-03'::timestamptz,
    '2026-11-06 00:00-03'::timestamptz
  ]) as d,
  generate_series(9, 21) as h;

  -- Sábado 07/11, Domingo 08/11: 08:00 a 22:00 (14 turnos de 60m por día = 28 turnos)
  insert into public.time_slots (tournament_id, starts_at, ends_at, stage)
  select
    v_tournament,
    d + (h || ' hours')::interval,
    d + ((h + 1) || ' hours')::interval,
    'playoff'
  from unnest(array[
    '2026-11-07 00:00-03'::timestamptz,
    '2026-11-08 00:00-03'::timestamptz
  ]) as d,
  generate_series(8, 21) as h;

  -- Guardar array de franjas de grupo para asignar disponibilidad
  select array_agg(id) into v_group_slots
  from public.time_slots
  where tournament_id = v_tournament and stage = 'group';

  -- 5. Crear las 8 categorías e insertar sus parejas
  for v_cat_idx in 1..8 loop
    case v_cat_idx
      when 1 then v_cat_name := '4ta Caballeros'; v_cat_count := 12;
      when 2 then v_cat_name := '5ta Caballeros'; v_cat_count := 12;
      when 3 then v_cat_name := '6ta Caballeros'; v_cat_count := 12;
      when 4 then v_cat_name := '7ma Caballeros'; v_cat_count := 12;
      when 5 then v_cat_name := '3ra Damas';      v_cat_count := 15;
      when 6 then v_cat_name := '4ta Damas';      v_cat_count := 15;
      when 7 then v_cat_name := '5ta Damas';      v_cat_count := 15;
      when 8 then v_cat_name := '6ta Damas';      v_cat_count := 15;
    end case;

    insert into public.tournament_categories (
      tournament_id,
      name,
      position,
      max_teams,
      status
    ) values (
      v_tournament,
      v_cat_name,
      v_cat_idx - 1,
      v_cat_count,
      'registration_open'
    ) returning id into v_cat_id;

    -- Insertar parejas en esta categoría
    for v_i in 1..v_cat_count loop
      v_team_id := gen_random_uuid();
      v_p1_name := v_lastnames[1 + ((v_cat_idx * 13 + v_i * 7) % v_ln_count)];
      v_p2_name := v_lastnames[1 + ((v_cat_idx * 17 + v_i * 11) % v_ln_count)];
      v_team_name := v_p1_name || ' / ' || v_p2_name || ' (' || v_cat_name || ' ' || lpad(v_i::text, 2, '0') || ')';

      insert into public.teams (
        id,
        tournament_id,
        category_id,
        name,
        captain_id,
        status,
        test_generated
      ) values (
        v_team_id,
        v_tournament,
        v_cat_id,
        v_team_name,
        v_org,
        'approved',
        true
      );

      -- Crear los 2 integrantes ficticios de la pareja con emails únicos requeridos por el esquema
      insert into public.team_members (team_id, tournament_id, email, role, display_name)
      values
        (v_team_id, v_tournament, format('prueba-%s-1@demo.test', left(v_team_id::text, 8)), 'captain', v_p1_name),
        (v_team_id, v_tournament, format('prueba-%s-2@demo.test', left(v_team_id::text, 8)), 'player', v_p2_name);

      -- Asignar disponibilidad horaria completa a la pareja en la fase de grupos
      insert into public.team_availability (team_id, slot_id, tournament_id)
      select v_team_id, unnest(v_group_slots), v_tournament;
    end loop;
  end loop;

  raise notice '=====================================================';
  raise notice 'MEGA TORNEO CREADO CON ÉXITO:';
  raise notice 'ID: %', v_tournament;
  raise notice 'SLUG: %', v_slug;
  raise notice '8 Categorías creadas (4 de 12 y 4 de 15)';
  raise notice '108 Parejas aprobadas con disponibilidad asignada';
  raise notice '4 Canchas y 67 Franjas horarias de 60m configuradas';
  raise notice 'URL panel: /torneos/%', v_tournament;
  raise notice '=====================================================';
end $$;
