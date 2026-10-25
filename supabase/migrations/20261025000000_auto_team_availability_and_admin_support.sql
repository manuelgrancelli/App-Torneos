-- Auto-activación de todas las franjas horarias en la inscripción de equipos
-- y soporte completo de co-administradores en set_team_availability

-- 1. Actualizar register_team para que cada pareja inscripta arranque con todas
-- las franjas horarias del torneo activadas por defecto en team_availability.
create or replace function public.register_team(
  p_code text,
  p_team_name text,
  p_member_emails text[],
  p_category_id uuid default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_email text;
  v_tournament public.tournaments%rowtype;
  v_cat public.tournament_categories%rowtype;
  v_sport public.sports%rowtype;
  v_emails text[];
  v_name text := btrim(coalesce(p_team_name, ''));
  v_team_id uuid;
  v_member_email text;
  v_existing_user uuid;
  v_is_organizer boolean;
  v_status public.team_status;
begin
  select lower(email) into v_email
  from auth.users
  where id = v_uid and email_confirmed_at is not null;
  if v_email is null then
    raise exception using errcode = 'P0001', message = 'Confirmá tu email antes de inscribirte.';
  end if;

  select t.* into v_tournament
  from public.tournament_invites i
  join public.tournaments t on t.id = i.tournament_id
  where i.code = public.normalize_code(p_code)
  for update of t;

  if not found then
    raise exception using errcode = 'P0001', message = 'El código de inscripción no es válido.';
  end if;

  v_is_organizer := (v_tournament.organizer_id = v_uid);
  if v_is_organizer then
    v_status := 'approved';
  else
    v_status := 'pending';
  end if;

  if p_category_id is not null then
    select * into v_cat from public.tournament_categories where id = p_category_id and tournament_id = v_tournament.id;
    if not found then
      raise exception using errcode = 'P0001', message = 'La categoría seleccionada no existe.';
    end if;
    if v_cat.status <> 'registration_open' then
      raise exception using errcode = 'P0001', message = 'La inscripción en esta categoría ya está cerrada.';
    end if;
    if (select count(*) from public.teams where tournament_id = v_tournament.id and category_id = p_category_id and status = 'approved')
       >= v_cat.max_teams then
      raise exception using errcode = 'P0001', message = 'Esta categoría ya completó el cupo.';
    end if;
  else
    if v_tournament.status <> 'registration_open' then
      raise exception using errcode = 'P0001', message = 'La inscripción de este torneo no está abierta.';
    end if;
    if (select count(*) from public.teams where tournament_id = v_tournament.id and status = 'approved')
       >= v_tournament.max_teams then
      raise exception using errcode = 'P0001', message = 'El torneo ya completó el cupo.';
    end if;
  end if;

  select * into v_sport from public.sports where id = v_tournament.sport_id;
  v_emails := public.normalize_emails(p_member_emails);

  -- Regla universal: quien inscribe queda como capitán, no puede ser su propio compañero
  if v_email = any(v_emails) then
    raise exception using errcode = 'P0001', message = 'No incluyas tu propio email: ya quedás como capitán.';
  end if;

  -- Si NO es el organizador haciendo pruebas, no puede inscribirse 2 veces en el torneo
  if not v_is_organizer then
    if exists (
      select 1 from public.team_members
      where tournament_id = v_tournament.id and (user_id = v_uid or email = v_email)
    ) then
      raise exception using errcode = 'P0001', message = 'Ya estás inscripto en este torneo.';
    end if;
  end if;

  -- Ningún compañero puede estar ya inscripto en el torneo
  if exists (
    select 1 from public.team_members
    where tournament_id = v_tournament.id and email = any(v_emails)
  ) then
    raise exception using errcode = 'P0001', message = 'Uno de los integrantes ya está inscripto en este torneo.';
  end if;

  if cardinality(v_emails) + 1 not between v_sport.min_team_size and v_sport.max_team_size then
    raise exception using errcode = 'P0001',
      message = case
        when v_sport.min_team_size = v_sport.max_team_size
          then format('El equipo tiene que tener %s integrantes, contándote a vos.', v_sport.min_team_size)
        else format('El equipo tiene que tener entre %s y %s integrantes, contándote a vos.',
          v_sport.min_team_size, v_sport.max_team_size)
      end;
  end if;

  if char_length(v_name) not between 2 and 60 then
    raise exception using errcode = 'P0001', message = 'El nombre del equipo tiene que tener entre 2 y 60 caracteres.';
  end if;
  if exists (
    select 1 from public.teams
    where tournament_id = v_tournament.id and lower(name) = lower(v_name)
  ) then
    raise exception using errcode = 'P0001', message = 'Ya hay un equipo con ese nombre en este torneo.';
  end if;

  insert into public.teams (tournament_id, category_id, name, captain_id, status, organizer_registered)
  values (v_tournament.id, p_category_id, v_name, v_uid, v_status, false)
  returning id into v_team_id;

  insert into public.team_members (team_id, tournament_id, email, user_id, role)
  values (v_team_id, v_tournament.id, v_email, v_uid, 'captain');

  foreach v_member_email in array v_emails loop
    select id into v_existing_user
    from auth.users
    where lower(email) = v_member_email and email_confirmed_at is not null;

    insert into public.team_members (team_id, tournament_id, email, user_id, role)
    values (v_team_id, v_tournament.id, v_member_email, v_existing_user, 'player')
    on conflict do nothing;
  end loop;

  -- Activar todas las franjas horarias existentes del torneo para el nuevo equipo
  insert into public.team_availability (team_id, slot_id, tournament_id)
  select v_team_id, ts.id, v_tournament.id
  from public.time_slots ts
  where ts.tournament_id = v_tournament.id
  on conflict (team_id, slot_id) do nothing;

  return v_team_id;
end;
$$;

revoke execute on function public.register_team(text, text, text[], uuid) from public, anon;
grant execute on function public.register_team(text, text, text[], uuid) to authenticated;

-- 2. Actualizar set_team_availability para soportar co-administradores y colaboradores
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

  delete from public.team_availability
  where team_id = p_team_id and not (slot_id = any(v_slot_ids));

  if cardinality(v_slot_ids) > 0 then
    insert into public.team_availability (team_id, slot_id, tournament_id)
    select p_team_id, s.id, v_tournament_id
    from (select distinct unnest(v_slot_ids) as id) as s
    on conflict (team_id, slot_id) do nothing;
  end if;

  return (select count(*)::integer from public.team_availability where team_id = p_team_id);
end;
$$;

revoke execute on function public.set_team_availability(uuid, uuid[]) from public, anon;
grant execute on function public.set_team_availability(uuid, uuid[]) to authenticated;
