-- =============================================================================
-- Corrección de get_admin_invite_info y join_tournament_as_admin
-- 1. Elimina la ambigüedad de nombre "tournament_id" convirtiendo get_admin_invite_info
--    a función pura en lenguaje SQL (evita conflicto entre variables PL/pgSQL y columnas).
-- 2. Utiliza profiles.full_name en vez de display_name inexistente.
-- 3. Usa #variable_conflict use_column y variables con prefijo en join_tournament_as_admin.
-- =============================================================================

create or replace function public.get_admin_invite_info(p_code text)
returns table (
  tournament_id uuid,
  tournament_name text,
  tournament_slug text,
  sport_name text,
  organizer_name text,
  status public.tournament_status,
  starts_on date,
  ends_on date,
  is_already_admin boolean
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    t.id as tournament_id,
    t.name as tournament_name,
    t.slug as tournament_slug,
    s.name as sport_name,
    coalesce(p.full_name, 'Organizador') as organizer_name,
    t.status,
    t.starts_on,
    t.ends_on,
    case
      when (select auth.uid()) is null then false
      when t.organizer_id = (select auth.uid()) then true
      when exists (select 1 from public.tournament_admins ta where ta.tournament_id = t.id and ta.user_id = (select auth.uid())) then true
      else false
    end as is_already_admin
  from public.tournament_admin_invites ai
  join public.tournaments t on t.id = ai.tournament_id
  join public.sports s on s.id = t.sport_id
  left join public.profiles p on p.id = t.organizer_id
  where ai.code = upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
$$;

create or replace function public.join_tournament_as_admin(p_code text)
returns table (
  tournament_id uuid,
  tournament_slug text,
  tournament_name text
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_uid uuid := public.require_user();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  v_tourney_id uuid;
  v_tourney_slug text;
  v_tourney_name text;
  v_organizer_id uuid;
begin
  select t.id, t.slug, t.name, t.organizer_id
  into v_tourney_id, v_tourney_slug, v_tourney_name, v_organizer_id
  from public.tournaments t
  join public.tournament_admin_invites ai on ai.tournament_id = t.id
  where ai.code = v_code;

  if not found then
    raise exception using errcode = 'P0001', message = 'El código de invitación de administrador no es válido.';
  end if;

  -- Si es el dueño del torneo
  if v_organizer_id = v_uid then
    return query select v_tourney_id, v_tourney_slug, v_tourney_name;
    return;
  end if;

  -- Insertar como co-administrador
  insert into public.tournament_admins (tournament_id, user_id, role)
  values (v_tourney_id, v_uid, 'admin')
  on conflict (tournament_id, user_id) do nothing;

  return query select v_tourney_id, v_tourney_slug, v_tourney_name;
end;
$$;

create or replace function private.can_view_profile(p_profile_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select p_profile_id = (select auth.uid())
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

create or replace function public.get_tournament_admins(p_tournament_id uuid)
returns table (
  user_id uuid,
  display_name text,
  avatar_url text,
  role text,
  created_at timestamptz
)
language plpgsql
security definer
set search_path = ''
as $$
#variable_conflict use_column
declare
  v_tourney public.tournaments%rowtype;
begin
  select * into v_tourney
  from public.tournaments
  where id = p_tournament_id;

  if not found then
    return;
  end if;

  if not private.is_tournament_organizer(p_tournament_id) then
    raise exception using errcode = '42501', message = 'No tenés permiso para ver los administradores de este torneo.';
  end if;

  -- 1. Dueño / Organizador principal
  return query
  select
    p.id as user_id,
    coalesce(p.full_name, 'Organizador') as display_name,
    p.avatar_url,
    'owner'::text as role,
    v_tourney.created_at
  from public.profiles p
  where p.id = v_tourney.organizer_id;

  -- 2. Co-administradores
  return query
  select
    p.id as user_id,
    coalesce(p.full_name, 'Administrador') as display_name,
    p.avatar_url,
    ta.role,
    ta.created_at
  from public.tournament_admins ta
  join public.profiles p on p.id = ta.user_id
  where ta.tournament_id = p_tournament_id
  order by ta.created_at asc;
end;
$$;

grant execute on function public.get_admin_invite_info(text) to anon, authenticated;
grant execute on function public.join_tournament_as_admin(text) to authenticated;
grant execute on function public.get_tournament_admins(uuid) to authenticated;
