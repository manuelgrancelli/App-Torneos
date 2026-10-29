-- Migración para aislar estrictamente team_availability a la fase de grupos.
-- Las franjas de playoffs (stage = 'playoff') son para cruces de cuadro con 100% disponibilidad
-- y nunca deben formar parte de la disponibilidad de grupos ni generar falsas compatibilidades.

-- 1. Eliminar cualquier registro de team_availability que corresponda a franjas de playoffs
delete from public.team_availability ta
using public.time_slots ts
where ta.slot_id = ts.id and ts.stage = 'playoff';

-- 2. Actualizar set_team_availability para ignorar turnos de playoffs e insertar únicamente grupos
create or replace function public.set_team_availability(p_team_id uuid, p_slot_ids uuid[])
returns integer
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament_id uuid;
  v_is_organizer boolean;
  v_is_member boolean;
  v_tournament_status public.tournament_status;
  v_slot_ids uuid[] := coalesce(p_slot_ids, '{}');
begin
  if cardinality(v_slot_ids) > 1000 then
    raise exception using errcode = 'P0001', message = 'Demasiadas franjas.';
  end if;

  select t.tournament_id into v_tournament_id
  from public.teams t
  where t.id = p_team_id;

  if v_tournament_id is null then
    raise exception using errcode = 'P0002', message = 'Equipo inexistente.';
  end if;

  select tour.status into v_tournament_status
  from public.tournaments tour
  where tour.id = v_tournament_id;

  v_is_organizer := private.is_tournament_organizer(v_tournament_id);

  select exists (
    select 1 from public.team_members tm
    where tm.team_id = p_team_id and tm.user_id = v_uid
  ) into v_is_member;

  if not (coalesce(v_is_organizer, false) or v_is_member) then
    raise exception using errcode = '42501', message = 'No tenés permisos para modificar la disponibilidad de este equipo.';
  end if;

  if not coalesce(v_is_organizer, false) and v_tournament_status <> 'registration_open' then
    raise exception using errcode = 'P0001',
      message = 'La disponibilidad solo se puede cambiar con la inscripción abierta.';
  end if;

  if coalesce(v_is_organizer, false) and v_tournament_status = 'finished' then
    raise exception using errcode = 'P0001',
      message = 'El torneo ya está finalizado.';
  end if;

  if cardinality(v_slot_ids) > 0 and exists (
    select 1 from unnest(v_slot_ids) as s(id)
    where not exists (
      select 1 from public.time_slots ts where ts.id = s.id and ts.tournament_id = v_tournament_id
    )
  ) then
    raise exception using errcode = 'P0001', message = 'Alguna de las franjas no pertenece a este torneo.';
  end if;

  -- Borrar los que no estén en la nueva lista o que sean de playoff
  delete from public.team_availability ta
  where ta.team_id = p_team_id
    and (not (ta.slot_id = any(v_slot_ids)) or exists (
      select 1 from public.time_slots ts where ts.id = ta.slot_id and ts.stage = 'playoff'
    ));

  -- Insertar únicamente franjas de fase de grupos (stage = 'group')
  if cardinality(v_slot_ids) > 0 then
    insert into public.team_availability (team_id, slot_id, tournament_id)
    select p_team_id, ts.id, v_tournament_id
    from public.time_slots ts
    where ts.id = any(v_slot_ids)
      and ts.tournament_id = v_tournament_id
      and coalesce(ts.stage, 'group') = 'group'
    on conflict (team_id, slot_id) do nothing;
  end if;

  return (select count(*)::integer from public.team_availability where team_id = p_team_id);
end;
$$;

revoke execute on function public.set_team_availability(uuid, uuid[]) from public, anon;
grant execute on function public.set_team_availability(uuid, uuid[]) to authenticated;

