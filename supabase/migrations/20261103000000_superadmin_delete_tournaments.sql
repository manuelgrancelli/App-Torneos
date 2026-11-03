-- =============================================================================
-- Borrado cruzado de torneos entre superadministradores (D-195)
-- 1. Actualiza private.is_superadmin para garantizar el chequeo por account_role
--    y email de rescate.
-- 2. Modifica la política RLS en public.tournaments para permitir a cualquier
--    superadministrador eliminar torneos creados por cualquier superadministrador
--    (o por sí mismo), independientemente del estado del torneo.
-- 3. Crea la función RPC public.delete_tournament_superadmin para ejecución segura
--    desde Server Actions.
-- =============================================================================

-- 1. Helper privado de superadmin reforzado
create or replace function private.is_superadmin(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and account_role = 'superadmin'
  ) or exists (
    select 1 from auth.users
    where id = p_user_id and lower(email) = 'manuelgrancelli@gmail.com'
  );
$$;

revoke execute on function private.is_superadmin(uuid) from public, anon;
grant execute on function private.is_superadmin(uuid) to authenticated;

-- 2. Política RLS de borrado en public.tournaments
drop policy if exists "tournaments: el organizador borra antes de empezar" on public.tournaments;
drop policy if exists "tournaments: el organizador borra si no esta finalizado" on public.tournaments;
drop policy if exists "tournaments: borrado de torneos" on public.tournaments;

create policy "tournaments: borrado de torneos"
  on public.tournaments for delete to authenticated
  using (
    -- Caso A: El organizador habitual puede borrar su propio torneo si no está finalizado
    (organizer_id = (select auth.uid()) and status <> 'finished')
    -- Caso B: Un superadmin puede borrar torneos creados por superadmins o por sí mismo en cualquier estado
    or (
      private.is_superadmin((select auth.uid()))
      and (
        private.is_superadmin(organizer_id)
        or organizer_id = (select auth.uid())
      )
    )
  );

-- 3. Función RPC para borrado seguro de torneos de superadministradores
create or replace function public.delete_tournament_superadmin(p_tournament_id uuid)
returns jsonb
language plpgsql
security definer
set search_path = public, auth, pg_temp
as $$
declare
  v_caller_id uuid;
  v_organizer_id uuid;
  v_tournament_name text;
begin
  v_caller_id := auth.uid();
  if v_caller_id is null then
    raise exception 'No autenticado';
  end if;

  if not private.is_superadmin(v_caller_id) then
    raise exception 'Solo un superadministrador puede ejecutar esta acción';
  end if;

  select organizer_id, name into v_organizer_id, v_tournament_name
  from public.tournaments
  where id = p_tournament_id;

  if not found then
    raise exception 'Torneo no encontrado';
  end if;

  -- Solo se permite borrar torneos creados por superadministradores o propios
  if not (private.is_superadmin(v_organizer_id) or v_organizer_id = v_caller_id) then
    raise exception 'Solo se pueden eliminar torneos creados por superadministradores';
  end if;

  -- Borrar el torneo; las claves foráneas tienen ON DELETE CASCADE
  delete from public.tournaments where id = p_tournament_id;

  return jsonb_build_object(
    'ok', true,
    'deleted_tournament_id', p_tournament_id,
    'name', v_tournament_name
  );
end;
$$;

revoke execute on function public.delete_tournament_superadmin(uuid) from public, anon;
grant execute on function public.delete_tournament_superadmin(uuid) to authenticated;

notify pgrst, 'reload schema';

