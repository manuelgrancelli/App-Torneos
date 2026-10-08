-- Matriz de permisos de funciones (F9, D-042): qué puede ejecutar cada rol
-- por /rpc. Cualquier función nueva expuesta sin querer rompe este test.
begin;
select plan(5);

-- anon: resolver códigos de torneo e invitaciones de equipo (/unirse e /invitacion/aceptar).
select is(
  (
    select array_agg(p.proname::text collate "C" order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('anon', p.oid, 'execute')
  ),
  array['resolve_invite_code', 'resolve_team_invitation']::text[] collate "C",
  'anon solo puede ejecutar resolve_invite_code y resolve_team_invitation'
);

-- authenticated: exactamente las RPC de la app.
select is(
  (
    select array_agg(p.proname::text collate "C" order by p.proname)
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public' and has_function_privilege('authenticated', p.oid, 'execute')
  ),
  array[
    'accept_team_invitation', 'apply_bracket', 'apply_groups', 'apply_schedule', 'assign_match_slot',
    'clear_match_result', 'confirm_match_result', 'create_organizer_team', 'create_team_invitation',
    'create_test_tournament', 'create_tournament', 'fill_test_team_slots', 'leave_team', 'record_match_result', 'register_team',
    'resolve_invite_code', 'resolve_team_invitation', 'respond_result', 'review_registration', 'rotate_invite_code',
    'set_team_availability', 'set_tournament_status', 'update_team_roster', 'withdraw_team'
  ]::text[] collate "C",
  'authenticated solo puede ejecutar las RPC de la app'
);

-- Las utilitarias internas que quedan en public no se pueden llamar desde la API.
select is_empty(
  $$
    select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'public'
      and p.proname in (
        'add_team_members', 'generate_code', 'normalize_code', 'normalize_emails', 'place_team_in_match',
        'profile_values_from_user', 'require_match_organizer', 'require_user', 'tournament_status_label'
      )
      and (has_function_privilege('anon', p.oid, 'execute') or has_function_privilege('authenticated', p.oid, 'execute'))
  $$,
  'las utilitarias internas no son ejecutables por anon ni authenticated'
);

-- Toda función SECURITY DEFINER fija search_path (evita secuestro por objetos homónimos).
select is_empty(
  $$
    select n.nspname || '.' || p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname in ('public', 'private')
      and p.prosecdef
      and not exists (select 1 from unnest(coalesce(p.proconfig, '{}')) c where c like 'search_path=%')
  $$,
  'toda función SECURITY DEFINER tiene search_path fijo'
);

-- El schema private no se expone: anon y authenticated no lo pueden usar salvo los helpers de RLS.
select is_empty(
  $$
    select p.proname
    from pg_proc p join pg_namespace n on n.oid = p.pronamespace
    where n.nspname = 'private'
      and not p.prosecdef
      and has_function_privilege('authenticated', p.oid, 'execute')
  $$,
  'los helpers de private ejecutables por la API son SECURITY DEFINER'
);

select * from finish();
rollback;
