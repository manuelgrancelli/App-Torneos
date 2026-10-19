-- =============================================================================
-- Reemplazo / edición rápida de jugadores por lesión o cambio de integrante
-- Permite al organizador del torneo cambiar el nombre de un jugador y opcionalmente
-- el nombre visible de la pareja sin alterar los IDs, partidos ni grupos existentes.
-- =============================================================================

create or replace function public.replace_team_player(
  p_team_id uuid,
  p_member_id uuid,
  p_new_player_name text,
  p_new_team_name text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_team public.teams%rowtype;
  v_tournament public.tournaments%rowtype;
  v_new_name text := btrim(coalesce(p_new_player_name, ''));
  v_team_name text := btrim(coalesce(p_new_team_name, ''));
begin
  select * into v_team from public.teams where id = p_team_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'El equipo no existe.';
  end if;

  select * into v_tournament from public.tournaments where id = v_team.tournament_id for update;
  if not found or v_tournament.organizer_id <> v_uid then
    raise exception using errcode = '42501', message = 'Solo el organizador puede reemplazar jugadores de un equipo.';
  end if;

  if char_length(v_new_name) not between 1 and 80 then
    raise exception using errcode = 'P0001', message = 'El nombre del jugador tiene que tener entre 1 y 80 caracteres.';
  end if;

  if not exists (select 1 from public.team_members where id = p_member_id and team_id = p_team_id) then
    raise exception using errcode = 'P0001', message = 'El integrante a reemplazar no pertenece a este equipo.';
  end if;

  -- Actualizar el integrante: nuevo nombre visible y desvincular email/user_id anterior si tenía
  update public.team_members
  set display_name = v_new_name,
      email = null,
      user_id = null
  where id = p_member_id and team_id = p_team_id;

  -- Si se indicó actualizar el nombre del equipo:
  if v_team_name is not null and char_length(v_team_name) > 0 then
    if char_length(v_team_name) not between 2 and 60 then
      raise exception using errcode = 'P0001', message = 'El nombre del equipo tiene que tener entre 2 y 60 caracteres.';
    end if;

    -- Validar que no haya otro equipo con el mismo nombre en el torneo
    if exists (
      select 1 from public.teams
      where tournament_id = v_team.tournament_id and lower(name) = lower(v_team_name) and id <> p_team_id
    ) then
      raise exception using errcode = 'P0001', message = 'Ya hay un equipo con ese nombre en el torneo.';
    end if;

    update public.teams
    set name = v_team_name
    where id = p_team_id;
  end if;
end;
$$;

revoke execute on function public.replace_team_player(uuid, uuid, text, text) from public, anon;
grant execute on function public.replace_team_player(uuid, uuid, text, text) to authenticated;
