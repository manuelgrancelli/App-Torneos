-- =============================================================================
-- Función segura para consulta de rankings de circuitos deportivos.
-- Permite que los jugadores participantes y visitantes consulten los equipos
-- y nombres de los integrantes sin exponer direcciones de email (D-138).
-- =============================================================================

create or replace function public.get_circuit_teams_and_members(p_tournament_ids uuid[])
returns table (
  team_id uuid,
  tournament_id uuid,
  category_id uuid,
  team_name text,
  team_status public.team_status,
  user_id uuid,
  display_name text,
  full_name text
)
language sql
stable
security definer
set search_path = ''
as $$
  select
    tm.id as team_id,
    tm.tournament_id,
    tm.category_id,
    tm.name as team_name,
    tm.status as team_status,
    m.user_id,
    m.display_name,
    p.full_name
  from public.teams tm
  left join public.team_members m on m.team_id = tm.id
  left join public.profiles p on p.id = m.user_id
  where tm.tournament_id = any(p_tournament_ids)
    and tm.status <> 'rejected';
$$;

comment on function public.get_circuit_teams_and_members(uuid[]) is 'Retorna equipos y nombres de integrantes para rankings de circuitos sin exponer emails.';

revoke all on function public.get_circuit_teams_and_members(uuid[]) from public;
grant execute on function public.get_circuit_teams_and_members(uuid[]) to anon, authenticated;
