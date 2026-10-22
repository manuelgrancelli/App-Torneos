-- Migration: Soporte integral para finalizar torneos con múltiples categorías
-- Actualiza set_tournament_status para obtener el ganador real (winner_team_id),
-- sincronizar el estado de todas las categorías a 'finished' y asignar sus campeones.

create or replace function public.set_tournament_status(
  p_tournament_id uuid,
  p_status public.tournament_status,
  p_champion_team_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament public.tournaments%rowtype;
  v_count integer;
  v_champion uuid;
begin
  select * into v_tournament
  from public.tournaments
  where id = p_tournament_id
  for update;

  if not found or not private.is_tournament_organizer(p_tournament_id) then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este torneo.';
  end if;

  if v_tournament.status = p_status then
    return;
  end if;

  if v_tournament.status = 'draft' and p_status = 'registration_open' then
    if not exists (select 1 from public.time_slots where tournament_id = p_tournament_id) then
      raise exception using errcode = 'P0001',
        message = 'Cargá al menos una franja horaria antes de abrir la inscripción.';
    end if;

  elsif v_tournament.status = 'registration_open' and p_status = 'draft' then
    if exists (select 1 from public.teams where tournament_id = p_tournament_id) then
      raise exception using errcode = 'P0001',
        message = 'No se puede volver a borrador: ya hay inscripciones.';
    end if;

  elsif v_tournament.status = 'registration_open' and p_status = 'group_stage' then
    select count(*) into v_count
    from public.teams
    where tournament_id = p_tournament_id and status = 'approved';

    if v_count < 2 then
      raise exception using errcode = 'P0001',
        message = 'Aprobá al menos 2 parejas para pasar a la fase de grupos.';
    end if;

  elsif v_tournament.status = 'group_stage' and p_status = 'playoffs' then
    if exists (
      select 1 from public.matches
      where tournament_id = p_tournament_id and stage = 'group' and result_status is null
    ) then
      raise exception using errcode = 'P0001',
        message = 'Hay partidos de grupos pendientes de resultado.';
    end if;

  elsif v_tournament.status = 'playoffs' and p_status = 'finished' then
    -- Obtener ganador real de la final de playoffs (winner_team_id)
    select winner_team_id into v_champion
    from public.matches
    where tournament_id = p_tournament_id
      and stage = 'playoff'
      and not is_third_place
      and next_match_id is null
      and winner_team_id is not null
    order by round desc
    limit 1;

    p_champion_team_id := coalesce(p_champion_team_id, v_champion);

    -- Si aún es null, buscar si alguna categoría ya tiene campeón registrado
    if p_champion_team_id is null then
      select champion_team_id into p_champion_team_id
      from public.tournament_categories
      where tournament_id = p_tournament_id and champion_team_id is not null
      limit 1;
    end if;

    if p_champion_team_id is null and not exists (
      select 1 from public.tournament_categories where tournament_id = p_tournament_id
    ) then
      raise exception using errcode = 'P0001',
        message = 'La final no tiene ganador registrado.';
    end if;

  elsif v_tournament.status = 'group_stage' and p_status = 'finished' then
    if p_champion_team_id is null then
      raise exception using errcode = 'P0001',
        message = 'Indicá el equipo campeón para finalizar el torneo.';
    end if;
  end if;

  -- Actualizar el estado del torneo
  update public.tournaments
  set status = p_status,
      champion_team_id = p_champion_team_id,
      updated_at = now()
  where id = p_tournament_id;

  -- Si el torneo pasa a 'finished', finalizar también todas sus categorías
  if p_status = 'finished' then
    update public.tournament_categories
    set status = 'finished',
        updated_at = now()
    where tournament_id = p_tournament_id;

    -- Asignar campeones a las categorías que no lo tuvieran registrado a partir del ganador de su cruce final
    update public.tournament_categories tc
    set champion_team_id = m.winner_team_id
    from public.matches m
    where tc.tournament_id = p_tournament_id
      and tc.champion_team_id is null
      and m.tournament_id = p_tournament_id
      and m.category_id = tc.id
      and m.stage = 'playoff'
      and not m.is_third_place
      and m.next_match_id is null
      and m.winner_team_id is not null;
  end if;
end;
$$;
