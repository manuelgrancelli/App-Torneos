-- =============================================================================
-- Panel Superadministrador y Acceso Global de Solo Lectura (D-187).
-- 1. Permite el rol 'superadmin' en public.profiles.
-- 2. Habilita lectura global de solo lectura para superadministradores en todas
--    las tablas deportivas (torneos, parejas, partidos, resultados, canchas, etc.).
-- 3. Provee funciones RPC para consultar y gestionar otros superadministradores.
-- =============================================================================

-- 1. Ampliar el check constraint de account_role
alter table public.profiles drop constraint if exists profiles_account_role_check;
alter table public.profiles add constraint profiles_account_role_check check (account_role in ('player', 'organizer', 'superadmin'));

-- 2. Helper privado: ¿el usuario es superadmin?
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
  );
$$;

revoke execute on function private.is_superadmin(uuid) from public, anon;
grant execute on function private.is_superadmin(uuid) to authenticated;

-- 3. Actualizar helper is_account_organizer para que superadmin también sea considerado organizador
create or replace function private.is_account_organizer(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and account_role in ('organizer', 'superadmin')
  );
$$;

-- 4. Políticas de lectura (SELECT) exclusivas para superadmin
-- Nota de diseño: NO se otorgan políticas de INSERT, UPDATE o DELETE, garantizando
-- que las vistas de auditoría del superadmin operen estrictamente en modo SOLO LECTURA.

drop policy if exists "tournaments: superadmin ve todos" on public.tournaments;
create policy "tournaments: superadmin ve todos"
  on public.tournaments for select to authenticated
  using (private.is_superadmin((select auth.uid())));

drop policy if exists "teams: superadmin ve todos" on public.teams;
create policy "teams: superadmin ve todos"
  on public.teams for select to authenticated
  using (private.is_superadmin((select auth.uid())));

drop policy if exists "team_members: superadmin ve todos" on public.team_members;
create policy "team_members: superadmin ve todos"
  on public.team_members for select to authenticated
  using (private.is_superadmin((select auth.uid())));

drop policy if exists "team_availability: superadmin ve todos" on public.team_availability;
create policy "team_availability: superadmin ve todos"
  on public.team_availability for select to authenticated
  using (private.is_superadmin((select auth.uid())));

drop policy if exists "tournament_groups: superadmin ve todos" on public.tournament_groups;
create policy "tournament_groups: superadmin ve todos"
  on public.tournament_groups for select to authenticated
  using (private.is_superadmin((select auth.uid())));

drop policy if exists "group_teams: superadmin ve todos" on public.group_teams;
create policy "group_teams: superadmin ve todos"
  on public.group_teams for select to authenticated
  using (private.is_superadmin((select auth.uid())));

drop policy if exists "matches: superadmin ve todos" on public.matches;
create policy "matches: superadmin ve todos"
  on public.matches for select to authenticated
  using (private.is_superadmin((select auth.uid())));

drop policy if exists "match_confirmations: superadmin ve todos" on public.match_confirmations;
create policy "match_confirmations: superadmin ve todos"
  on public.match_confirmations for select to authenticated
  using (private.is_superadmin((select auth.uid())));

drop policy if exists "courts: superadmin ve todos" on public.courts;
create policy "courts: superadmin ve todos"
  on public.courts for select to authenticated
  using (private.is_superadmin((select auth.uid())));

drop policy if exists "time_slots: superadmin ve todos" on public.time_slots;
create policy "time_slots: superadmin ve todos"
  on public.time_slots for select to authenticated
  using (private.is_superadmin((select auth.uid())));

drop policy if exists "tournament_categories: superadmin ve todos" on public.tournament_categories;
create policy "tournament_categories: superadmin ve todos"
  on public.tournament_categories for select to authenticated
  using (private.is_superadmin((select auth.uid())));

drop policy if exists "profiles: superadmin ve todos" on public.profiles;
create policy "profiles: superadmin ve todos"
  on public.profiles for select to authenticated
  using (private.is_superadmin((select auth.uid())));

-- 5. Actualizar can_view_profile
create or replace function public.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select
    p_profile_id = (select auth.uid())
    or private.is_superadmin((select auth.uid()))
    or exists (
      select 1
      from public.team_members mine
      join public.team_members other on other.team_id = mine.team_id
      where mine.user_id = (select auth.uid()) and other.user_id = p_profile_id
    )
    or exists (
      select 1
      from public.team_members tm
      join public.tournaments t on t.id = tm.tournament_id
      where tm.user_id = p_profile_id and t.organizer_id = (select auth.uid())
    )
    or exists (
      select 1
      from public.tournaments t
      where t.organizer_id = p_profile_id
        and (
          t.status <> 'draft'
          or private.is_tournament_organizer(t.id)
          or private.is_tournament_participant(t.id)
        )
    )
    or exists (
      select 1
      from public.tournament_admins ta
      where ta.user_id = p_profile_id
        and private.is_tournament_organizer(ta.tournament_id)
    );
$$;

-- 6. RPC para listar superadministradores de la plataforma (lenguaje SQL para evitar conflictos PL/pgSQL)
create or replace function public.get_superadmin_users()
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
  where p.account_role = 'superadmin'
  order by p.created_at;
$$;

revoke execute on function public.get_superadmin_users() from public, anon;
grant execute on function public.get_superadmin_users() to authenticated;

-- 7. RPC para agregar o remover otro superadministrador por email
create or replace function public.set_user_superadmin(p_email text, p_is_superadmin boolean)
returns jsonb
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_target_user_id uuid;
  v_clean_email text := lower(trim(coalesce(p_email, '')));
  v_superadmin_count int;
  v_target_name text;
begin
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

  select full_name into v_target_name
  from public.profiles
  where id = v_target_user_id;

  if not p_is_superadmin then
    select count(*) into v_superadmin_count
    from public.profiles
    where account_role = 'superadmin';

    if v_superadmin_count <= 1 and exists (
      select 1 from public.profiles where id = v_target_user_id and account_role = 'superadmin'
    ) then
      return jsonb_build_object('success', false, 'error', 'No podés remover al único superadministrador activo del sistema.');
    end if;

    update public.profiles
    set account_role = 'organizer', updated_at = now()
    where id = v_target_user_id;

    return jsonb_build_object(
      'success', true,
      'action', 'removed',
      'email', v_clean_email,
      'userId', v_target_user_id,
      'fullName', coalesce(v_target_name, v_clean_email)
    );
  else
    update public.profiles
    set account_role = 'superadmin', updated_at = now()
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

revoke execute on function public.set_user_superadmin(text, boolean) from public, anon;
grant execute on function public.set_user_superadmin(text, boolean) to authenticated;

-- 8. Bootstrap inicial: Asignar superadmin a manuelgrancelli@gmail.com si existe
update public.profiles
set account_role = 'superadmin'
where id in (
  select id from auth.users where lower(email) = 'manuelgrancelli@gmail.com'
);
