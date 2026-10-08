-- =============================================================================
-- Resolución de invitaciones de equipo para la vista de aceptación (/invitacion/aceptar).
-- Permite que integrantes (autenticados o anónimos desde el link del email)
-- consulten los datos del torneo, afiche/banner oficial y el capitán que los invitó.
-- =============================================================================

create or replace function public.resolve_team_invitation(p_token_hash text)
returns table (
  recipient_email text,
  team_id uuid,
  team_name text,
  captain_name text,
  tournament_id uuid,
  tournament_name text,
  tournament_slug text,
  sport_name text,
  starts_on date,
  ends_on date,
  description text,
  banner_url text,
  tournament_status public.tournament_status,
  team_status public.team_status,
  is_expired boolean
)
language plpgsql
stable
security definer
set search_path = ''
as $$
declare
  v_hash text := lower(btrim(p_token_hash));
begin
  if v_hash is null or v_hash !~ '^[0-9a-f]{64}$' then
    return;
  end if;

  return query
  select
    tm.email as recipient_email,
    t.id as team_id,
    t.name as team_name,
    coalesce(nullif(btrim(p.full_name), ''), nullif(btrim(cap.email), ''), 'Tu compañero') as captain_name,
    tr.id as tournament_id,
    tr.name as tournament_name,
    tr.slug as tournament_slug,
    s.name as sport_name,
    tr.starts_on,
    tr.ends_on,
    tr.description,
    tr.banner_url,
    tr.status as tournament_status,
    t.status as team_status,
    (i.expires_at <= now()) as is_expired
  from public.team_invitations i
  join public.team_members tm on tm.id = i.team_member_id
  join public.teams t on t.id = tm.team_id
  join public.tournaments tr on tr.id = tm.tournament_id
  join public.sports s on s.id = tr.sport_id
  left join public.profiles p on p.id = t.captain_id
  left join public.team_members cap on cap.team_id = t.id and cap.role = 'captain'
  where i.token_hash = v_hash;
end;
$$;

comment on function public.resolve_team_invitation(text) is
  'Devuelve los datos del torneo, afiche, equipo y capitán para un token_hash de invitación válido.';

revoke all on function public.resolve_team_invitation(text) from public;
grant execute on function public.resolve_team_invitation(text) to anon, authenticated;
