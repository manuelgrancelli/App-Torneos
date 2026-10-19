-- =============================================================================
-- Corrección de get_admin_invite_info, join_tournament_as_admin y can_view_profile
-- Corrige el error de columna inexistente "p.display_name" (la columna real es profiles.full_name)
-- y añade left join para evitar bloqueos si el perfil no estuviera presente.
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
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  v_uid uuid := (select auth.uid());
  v_tourney_id uuid;
begin
  select tournament_id into v_tourney_id
  from public.tournament_admin_invites
  where code = v_code;

  if not found then
    return;
  end if;

  return query
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
      when v_uid is null then false
      when t.organizer_id = v_uid then true
      when exists (select 1 from public.tournament_admins ta where ta.tournament_id = t.id and ta.user_id = v_uid) then true
      else false
    end as is_already_admin
  from public.tournaments t
  join public.sports s on s.id = t.sport_id
  left join public.profiles p on p.id = t.organizer_id
  where t.id = v_tourney_id;
end;
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
declare
  v_uid uuid := public.require_user();
  v_code text := upper(regexp_replace(coalesce(p_code, ''), '[^a-zA-Z0-9]', '', 'g'));
  v_tournament public.tournaments%rowtype;
begin
  select t.* into v_tournament
  from public.tournaments t
  join public.tournament_admin_invites ai on ai.tournament_id = t.id
  where ai.code = v_code;

  if not found then
    raise exception using errcode = 'P0001', message = 'El código de invitación de administrador no es válido.';
  end if;

  -- Si es el dueño del torneo
  if v_tournament.organizer_id = v_uid then
    return query select v_tournament.id, v_tournament.slug, v_tournament.name;
    return;
  end if;

  -- Insertar como co-administrador
  insert into public.tournament_admins (tournament_id, user_id, role)
  values (v_tournament.id, v_uid, 'admin')
  on conflict (tournament_id, user_id) do nothing;

  return query select v_tournament.id, v_tournament.slug, v_tournament.name;
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

grant execute on function public.get_admin_invite_info(text) to anon, authenticated;
grant execute on function public.join_tournament_as_admin(text) to authenticated;
