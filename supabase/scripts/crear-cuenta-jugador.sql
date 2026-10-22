-- =============================================================================
-- Crea una cuenta de JUGADOR para probar la vista de jugador (D-122).
-- Se corre a mano en Supabase → SQL Editor, DESPUÉS de la migración
-- 20261021180000_account_roles.sql. No es una migración: no va en db push.
--
-- Antes de ejecutar, cambiá v_password por una clave propia (mínimo 8
-- caracteres). Si la dejás como está, el script se detiene sin crear nada.
-- Se puede correr más de una vez: si el email ya existe, no hace nada.
-- =============================================================================

do $$
declare
  v_email    constant text := 'jugador@demo.test';
  v_name     constant text := 'Jugador Demo';
  v_password constant text := 'CAMBIAR_ESTA_CLAVE';
  v_id uuid := gen_random_uuid();
begin
  if v_password = 'CAMBIAR_ESTA_CLAVE' or char_length(v_password) < 8 then
    raise exception 'Cambiá v_password por una clave de al menos 8 caracteres antes de ejecutar.';
  end if;

  if exists (select 1 from auth.users where lower(email) = lower(v_email)) then
    raise notice 'Ya existe una cuenta con %: no se creó nada.', v_email;
    return;
  end if;

  -- Usuario con email confirmado (el trigger on_auth_user_created crea su perfil como jugador).
  insert into auth.users (
    instance_id, id, aud, role, email, encrypted_password, email_confirmed_at,
    raw_app_meta_data, raw_user_meta_data, created_at, updated_at,
    confirmation_token, recovery_token, email_change_token_new, email_change,
    email_change_token_current, phone_change, phone_change_token, reauthentication_token
  ) values (
    '00000000-0000-0000-0000-000000000000', v_id, 'authenticated', 'authenticated', v_email,
    extensions.crypt(v_password, extensions.gen_salt('bf')), now(),
    '{"provider": "email", "providers": ["email"]}', jsonb_build_object('full_name', v_name),
    now(), now(), '', '', '', '', '', '', '', ''
  );

  -- Identidad de email (GoTrue la necesita para el login con contraseña).
  insert into auth.identities (id, user_id, provider_id, provider, identity_data, last_sign_in_at, created_at, updated_at)
  values (
    gen_random_uuid(), v_id, v_id::text, 'email',
    jsonb_build_object('sub', v_id::text, 'email', v_email, 'email_verified', true),
    now(), now(), now()
  );

  -- Por si el perfil ya existía con otro rol: esta cuenta es de jugador.
  update public.profiles set account_role = 'player' where id = v_id;

  raise notice 'Cuenta de jugador creada: %', v_email;
end;
$$;

-- Verificación: debería devolver una fila con account_role = 'player'.
select u.email, p.full_name, p.account_role
from auth.users u
join public.profiles p on p.id = u.id
where u.email = 'jugador@demo.test';
