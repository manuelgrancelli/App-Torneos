-- =============================================================================
-- F4: reglas de edición del torneo según su estado (D-029).
-- - La tabla de posiciones (puntos/desempates) no se cambia con playoffs en curso.
-- - La zona horaria no se cambia si ya hay franjas (cambiaría su hora local).
-- - Las canchas se borran solo antes de empezar y siempre queda al menos una.
-- =============================================================================

-- Torneo todavía en preparación (borrador o inscripción abierta).
create function private.is_tournament_in_setup(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tournaments
    where id = p_tournament_id and status in ('draft', 'registration_open')
  );
$$;

revoke execute on function private.is_tournament_in_setup(uuid) from public;
grant execute on function private.is_tournament_in_setup(uuid) to authenticated;

-- Reemplaza el guard de la migración 400 sumando las reglas nuevas.
create or replace function public.tournaments_guard()
returns trigger
language plpgsql
set search_path = ''
as $$
declare
  v_scoring_type public.scoring_type;
begin
  if tg_op = 'INSERT' or new.timezone is distinct from old.timezone then
    if not exists (select 1 from pg_catalog.pg_timezone_names where name = new.timezone) then
      raise exception using errcode = 'P0001', message = 'La zona horaria no es válida.';
    end if;
  end if;

  if tg_op = 'INSERT' or new.scoring_config is distinct from old.scoring_config then
    select scoring_type into v_scoring_type from public.sports where id = new.sport_id;
    if new.scoring_config ->> 'type' is distinct from v_scoring_type::text then
      raise exception using errcode = 'P0001',
        message = 'La configuración de puntuación no corresponde al deporte del torneo.';
    end if;
  end if;

  if tg_op = 'UPDATE' then
    if new.sport_id is distinct from old.sport_id then
      raise exception using errcode = 'P0001', message = 'No se puede cambiar el deporte de un torneo.';
    end if;
    if old.status not in ('draft', 'registration_open')
       and new.scoring_config is distinct from old.scoring_config then
      raise exception using errcode = 'P0001',
        message = 'No se puede cambiar la puntuación con el torneo en curso.';
    end if;
    if old.status in ('playoffs', 'finished')
       and new.playoff_config is distinct from old.playoff_config then
      raise exception using errcode = 'P0001',
        message = 'No se puede cambiar la configuración de playoffs después de generar el cuadro.';
    end if;
    -- Nuevo: la tabla de posiciones define la siembra del cuadro.
    if old.status in ('playoffs', 'finished')
       and new.standings_config is distinct from old.standings_config then
      raise exception using errcode = 'P0001',
        message = 'No se puede cambiar la tabla de posiciones después de terminar la fase de grupos.';
    end if;
    -- Nuevo: las franjas son instantes absolutos; cambiar la zona movería su hora local.
    if new.timezone is distinct from old.timezone
       and exists (select 1 from public.time_slots where tournament_id = new.id) then
      raise exception using errcode = 'P0001',
        message = 'No se puede cambiar la zona horaria: el torneo ya tiene franjas cargadas.';
    end if;
  end if;

  return new;
end;
$$;

-- Canchas: solo se borran antes de empezar (después tienen partidos asignados).
alter policy "courts: el organizador borra"
  on public.courts
  using (private.is_tournament_organizer(tournament_id) and private.is_tournament_in_setup(tournament_id));

-- Siempre queda al menos una cancha (salvo cuando se borra el torneo entero).
create function public.courts_keep_one()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  -- En el borrado en cascada el torneo ya no existe: se permite.
  if exists (select 1 from public.tournaments where id = old.tournament_id)
     and (select count(*) from public.courts where tournament_id = old.tournament_id) <= 1 then
    raise exception using errcode = 'P0001', message = 'El torneo tiene que tener al menos una cancha.';
  end if;
  return old;
end;
$$;

create trigger courts_keep_one
  before delete on public.courts
  for each row execute function public.courts_keep_one();

revoke execute on function public.courts_keep_one() from public, anon, authenticated;
