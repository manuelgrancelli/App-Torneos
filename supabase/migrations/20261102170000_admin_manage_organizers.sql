-- =============================================================================
-- Gestión de Organizadores desde el Panel de Superadministrador (D-193).
-- Permite a los superadministradores promover a usuarios registrados (rol predeterminado
-- 'player') al rol 'organizer' por correo electrónico, y revertirlos si es necesario.
-- =============================================================================

-- 1. RPC para listar usuarios con rol organizador
create or replace function public.get_organizer_users()
returns table (
  id uuid,
  full_name text,
  email text,
  created_at timestamptz
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    p.id,
    coalesce(p.full_name, 'Sin nombre')::text as full_name,
    coalesce(u.email, 'Sin email')::text as email,
    p.created_at
  from public.profiles p
  left join auth.users u on u.id = p.id
  where p.account_role = 'organizer'
  order by p.created_at;
$$;

revoke execute on function public.get_organizer_users() from public, anon;
grant execute on function public.get_organizer_users() to authenticated;

-- 2. RPC para asignar o quitar rol organizador por email
create or replace function public.set_user_organizer(p_email text, p_is_organizer boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_user_id uuid;
  v_clean_email text := lower(trim(coalesce(p_email, '')));
  v_target_name text;
  v_current_role text;
begin
  -- Solo superadministradores pueden gestionar el rol de organizador
  if not private.is_superadmin(auth.uid()) and not exists (
    select 1 from auth.users where id = auth.uid() and lower(email) in ('manuelgrancelli@gmail.com')
  ) then
    return jsonb_build_object('success', false, 'error', 'Acceso denegado: solo superadministradores pueden gestionar roles.');
  end if;

  if v_clean_email = '' then
    return jsonb_build_object('success', false, 'error', 'Debes ingresar un correo electrónico válido.');
  end if;

  select id into v_target_user_id
  from auth.users
  where lower(email) = v_clean_email
  limit 1;

  if v_target_user_id is null then
    return jsonb_build_object('success', false, 'error', 'No se encontró ningún usuario registrado con el correo: ' || v_clean_email);
  end if;

  select full_name, account_role into v_target_name, v_current_role
  from public.profiles
  where id = v_target_user_id;

  if not p_is_organizer then
    -- Si es superadmin, advertir que no se debe degradar desde este diálogo
    if v_current_role = 'superadmin' then
      return jsonb_build_object('success', false, 'error', 'El usuario es Superadministrador. Gestioná su rol desde la sección de Superadmins.');
    end if;

    update public.profiles
    set account_role = 'player', updated_at = now()
    where id = v_target_user_id;

    return jsonb_build_object(
      'success', true,
      'action', 'removed',
      'email', v_clean_email,
      'userId', v_target_user_id,
      'fullName', coalesce(v_target_name, v_clean_email)
    );
  else
    -- Si ya es superadmin, ya tiene todos los permisos
    if v_current_role = 'superadmin' then
      return jsonb_build_object(
        'success', true,
        'action', 'already_superadmin',
        'email', v_clean_email,
        'userId', v_target_user_id,
        'fullName', coalesce(v_target_name, v_clean_email)
      );
    end if;

    update public.profiles
    set account_role = 'organizer', updated_at = now()
    where id = v_target_user_id;

    return jsonb_build_object(
      'success', true,
      'action', 'added',
      'email', v_clean_email,
      'userId', v_target_user_id,
      'fullName', coalesce(v_target_name, v_clean_email)
    );
  end if;
end;
$$;

revoke execute on function public.set_user_organizer(text, boolean) from public, anon;
grant execute on function public.set_user_organizer(text, boolean) to authenticated;

-- Notificar a PostgREST para recargar la caché del esquema de inmediato
notify pgrst, 'reload schema';


