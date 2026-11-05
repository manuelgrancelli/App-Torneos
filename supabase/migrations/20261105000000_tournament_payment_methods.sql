-- =============================================================================
-- Migración: Sistema de Formas de Pago y Aranceles de Inscripción
-- Permite al organizador configurar aranceles y formas de pago admitidas:
-- Mercado Pago (Alias/CVU/Link), Transferencia bancaria y Efectivo en el torneo.
-- =============================================================================

-- 1. Agregar configuración de pagos a tournaments
alter table public.tournaments
  add column if not exists payment_config jsonb not null default '{
    "enabled": false,
    "currency": "ARS",
    "amount": null,
    "pricingType": "per_team",
    "methods": {
      "mercadopago": {"enabled": false},
      "transfer": {"enabled": false},
      "cash": {"enabled": false}
    },
    "instructions": null
  }'::jsonb;

grant update (payment_config) on table public.tournaments to authenticated;

-- 2. Columnas de pago en teams (torneos tradicionales)
alter table public.teams
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_method text,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_notes text;

alter table public.teams drop constraint if exists teams_payment_status_check;
alter table public.teams add constraint teams_payment_status_check
  check (payment_status in ('pending', 'paid', 'cash_on_arrival', 'not_required'));

alter table public.teams drop constraint if exists teams_payment_method_check;
alter table public.teams add constraint teams_payment_method_check
  check (payment_method is null or payment_method in ('mercadopago', 'transfer', 'cash'));

-- 3. Columnas de pago en american_participants (torneos americanos)
alter table public.american_participants
  add column if not exists payment_status text not null default 'pending',
  add column if not exists payment_method text,
  add column if not exists paid_at timestamptz,
  add column if not exists payment_notes text;

alter table public.american_participants drop constraint if exists american_participants_payment_status_check;
alter table public.american_participants add constraint american_participants_payment_status_check
  check (payment_status in ('pending', 'paid', 'cash_on_arrival', 'not_required'));

alter table public.american_participants drop constraint if exists american_participants_payment_method_check;
alter table public.american_participants add constraint american_participants_payment_method_check
  check (payment_method is null or payment_method in ('mercadopago', 'transfer', 'cash'));

-- 4. RPC: Actualizar estado de pago de un equipo (organizador o co-admin)
create or replace function public.update_team_payment_status(
  p_team_id uuid,
  p_payment_status text,
  p_payment_method text default null,
  p_payment_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid;
  v_status text := p_payment_status;
begin
  select tournament_id into v_tournament_id
  from public.teams
  where id = p_team_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'El equipo no existe.';
  end if;

  if not private.is_tournament_organizer(v_tournament_id) then
    raise exception using errcode = '42501', message = 'Solo el organizador puede modificar el estado de pago.';
  end if;

  if v_status not in ('pending', 'paid', 'cash_on_arrival', 'not_required') then
    raise exception using errcode = 'P0001', message = 'Estado de pago no válido.';
  end if;

  if p_payment_method is not null and p_payment_method not in ('mercadopago', 'transfer', 'cash') then
    raise exception using errcode = 'P0001', message = 'Método de pago no válido.';
  end if;

  update public.teams
  set payment_status = v_status,
      payment_method = coalesce(p_payment_method, payment_method),
      payment_notes = coalesce(p_payment_notes, payment_notes),
      paid_at = case when v_status = 'paid' then coalesce(paid_at, now()) else null end,
      updated_at = now()
  where id = p_team_id;
end;
$$;

revoke execute on function public.update_team_payment_status(uuid, text, text, text) from public, anon;
grant execute on function public.update_team_payment_status(uuid, text, text, text) to authenticated;

-- 5. RPC: Actualizar estado de pago de un participante americano (organizador o co-admin)
create or replace function public.update_american_participant_payment_status(
  p_participant_id uuid,
  p_payment_status text,
  p_payment_method text default null,
  p_payment_notes text default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid;
  v_status text := p_payment_status;
begin
  select tournament_id into v_tournament_id
  from public.american_participants
  where id = p_participant_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'El participante no existe.';
  end if;

  if not private.is_tournament_organizer(v_tournament_id) then
    raise exception using errcode = '42501', message = 'Solo el organizador puede modificar el estado de pago.';
  end if;

  if v_status not in ('pending', 'paid', 'cash_on_arrival', 'not_required') then
    raise exception using errcode = 'P0001', message = 'Estado de pago no válido.';
  end if;

  if p_payment_method is not null and p_payment_method not in ('mercadopago', 'transfer', 'cash') then
    raise exception using errcode = 'P0001', message = 'Método de pago no válido.';
  end if;

  update public.american_participants
  set payment_status = v_status,
      payment_method = coalesce(p_payment_method, payment_method),
      payment_notes = coalesce(p_payment_notes, payment_notes),
      paid_at = case when v_status = 'paid' then coalesce(paid_at, now()) else null end,
      updated_at = now()
  where id = p_participant_id;
end;
$$;

revoke execute on function public.update_american_participant_payment_status(uuid, text, text, text) from public, anon;
grant execute on function public.update_american_participant_payment_status(uuid, text, text, text) to authenticated;

-- 6. RPC: El capitán o integrante elige su método de pago previsto
create or replace function public.set_team_payment_method(
  p_team_id uuid,
  p_payment_method text
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_tournament_id uuid;
  v_current_status text;
  v_new_status text;
begin
  if not private.is_team_member(p_team_id) then
    raise exception using errcode = '42501', message = 'Solo un integrante del equipo puede seleccionar la forma de pago.';
  end if;

  if p_payment_method not in ('mercadopago', 'transfer', 'cash') then
    raise exception using errcode = 'P0001', message = 'Método de pago no válido.';
  end if;

  select tournament_id, payment_status into v_tournament_id, v_current_status
  from public.teams
  where id = p_team_id;

  if not found then
    raise exception using errcode = 'P0001', message = 'El equipo no existe.';
  end if;

  v_new_status := v_current_status;
  if v_current_status in ('pending', 'cash_on_arrival') then
    if p_payment_method = 'cash' then
      v_new_status := 'cash_on_arrival';
    else
      v_new_status := 'pending';
    end if;
  end if;

  update public.teams
  set payment_method = p_payment_method,
      payment_status = v_new_status,
      updated_at = now()
  where id = p_team_id;
end;
$$;

revoke execute on function public.set_team_payment_method(uuid, text) from public, anon;
grant execute on function public.set_team_payment_method(uuid, text) to authenticated;

-- 7. Asegurar columnas de tamaño de equipo en tournaments y limpiar sobrecargas previas de register_team
alter table public.tournaments
  add column if not exists min_team_size smallint check (min_team_size >= 1),
  add column if not exists max_team_size smallint check (max_team_size >= min_team_size);

drop function if exists public.register_team(text, text, text[]);
drop function if exists public.register_team(text, text, text[], uuid);
drop function if exists public.register_team(text, text, text[], uuid, text);
drop function if exists public.register_team(text, text, text[], uuid, text, text[]);
drop function if exists public.register_team(text, text, text[], uuid, text, text[], text);

create or replace function public.register_team(
  p_code text,
  p_team_name text,
  p_member_emails text[] default '{}'::text[],
  p_category_id uuid default null,
  p_logo_url text default null,
  p_member_names text[] default '{}'::text[],
  p_payment_method text default null
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
  v_names text[];
  v_name text := btrim(coalesce(p_team_name, ''));
  v_team_id uuid;
  v_curr_email text;
  v_curr_name text;
  v_existing_user uuid;
  v_is_organizer boolean;
  v_status public.team_status;
  v_payment_status text := 'pending';
  v_max_items integer;
  v_min_team_size integer;
  v_max_team_size integer;
  v_companion_count integer := 0;
  i integer;
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

  -- Determinar estado inicial del arancel
  if coalesce(
    (to_jsonb(v_tournament)->'payment_config'->>'enabled')::boolean,
    (v_tournament.standings_config->'payment'->>'enabled')::boolean,
    false
  ) then
    if p_payment_method = 'cash' then
      v_payment_status := 'cash_on_arrival';
    else
      v_payment_status := 'pending';
    end if;
  else
    v_payment_status := 'not_required';
  end if;

  if p_category_id is not null then
    select * into v_cat from public.tournament_categories where id = p_category_id and tournament_id = v_tournament.id;
    if not found then
      raise exception using errcode = 'P0001', message = 'La categoría seleccionada no existe.';
    end if;
    if v_cat.status <> 'registration_open' then
      raise exception using errcode = 'P0001', message = 'La inscripción en esta categoría ya está cerrada.';
    end if;
    if v_cat.max_teams is not null and (select count(*) from public.teams where tournament_id = v_tournament.id and category_id = p_category_id and status = 'approved')
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
  v_emails := coalesce(p_member_emails, '{}'::text[]);
  v_names := coalesce(p_member_names, '{}'::text[]);
  v_min_team_size := coalesce((to_jsonb(v_tournament)->>'min_team_size')::integer, (v_tournament.scoring_config->>'minTeamSize')::integer, v_sport.min_team_size);
  v_max_team_size := coalesce((to_jsonb(v_tournament)->>'max_team_size')::integer, (v_tournament.scoring_config->>'maxTeamSize')::integer, v_sport.max_team_size);

  -- Contar compañeros válidos cargados
  v_max_items := greatest(cardinality(v_emails), cardinality(v_names));
  if v_max_items is not null and v_max_items > 0 then
    for i in 1..v_max_items loop
      v_curr_email := null;
      v_curr_name := null;
      if i <= cardinality(v_emails) then
        v_curr_email := lower(btrim(coalesce(v_emails[i], '')));
        if v_curr_email = '' or v_curr_email = v_email then
          v_curr_email := null;
        end if;
      end if;

      if i <= cardinality(v_names) then
        v_curr_name := btrim(coalesce(v_names[i], ''));
        if v_curr_name = '' then
          v_curr_name := null;
        end if;
      end if;

      if v_curr_email is not null or v_curr_name is not null then
        v_companion_count := v_companion_count + 1;
      end if;
    end loop;
  end if;

  -- Validar límites reglamentarios del equipo (1 capitán + compañeros)
  if (1 + v_companion_count) not between v_min_team_size and v_max_team_size then
    raise exception using errcode = 'P0001',
      message = format('El equipo debe tener entre %s y %s integrantes reglamentarios (actualmente tiene %s contando al capitán).', v_min_team_size, v_max_team_size, 1 + v_companion_count);
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

  if char_length(v_name) not between 2 and 60 then
    raise exception using errcode = 'P0001', message = 'El nombre del equipo tiene que tener entre 2 y 60 caracteres.';
  end if;
  if exists (
    select 1 from public.teams
    where tournament_id = v_tournament.id and lower(name) = lower(v_name)
  ) then
    raise exception using errcode = 'P0001', message = 'Ya hay un equipo con ese nombre en este torneo.';
  end if;

  insert into public.teams (
    tournament_id, category_id, name, captain_id, status, organizer_registered, logo_url,
    payment_status, payment_method
  )
  values (
    v_tournament.id, p_category_id, v_name, v_uid, v_status, false, p_logo_url,
    v_payment_status, p_payment_method
  )
  returning id into v_team_id;

  -- Capitán
  insert into public.team_members (team_id, tournament_id, user_id, email, role)
  values (v_team_id, v_tournament.id, v_uid, v_email, 'captain');

  -- Integrantes compañeros
  if v_max_items is not null and v_max_items > 0 then
    for i in 1..v_max_items loop
      v_curr_email := null;
      v_curr_name := null;

      if i <= cardinality(v_emails) then
        v_curr_email := lower(btrim(coalesce(v_emails[i], '')));
        if v_curr_email = '' or v_curr_email = v_email then
          v_curr_email := null;
        end if;
      end if;

      if i <= cardinality(v_names) then
        v_curr_name := btrim(coalesce(v_names[i], ''));
        if v_curr_name = '' then
          v_curr_name := null;
        end if;
      end if;

      if v_curr_email is not null or v_curr_name is not null then
        v_existing_user := null;
        if v_curr_email is not null then
          select id into v_existing_user from auth.users where lower(email) = v_curr_email;
        end if;

        insert into public.team_members (team_id, tournament_id, user_id, email, display_name, role)
        values (v_team_id, v_tournament.id, v_existing_user, v_curr_email, v_curr_name, 'player');
      end if;
    end loop;
  end if;

  return v_team_id;
end;
$$;

revoke execute on function public.register_team(text, text, text[], uuid, text, text[], text) from public, anon;
grant execute on function public.register_team(text, text, text[], uuid, text, text[], text) to authenticated;

-- 8. Actualizar register_american_participant para incorporar payment_method y payment_status
drop function if exists public.register_american_participant(text, text, text);
drop function if exists public.register_american_participant(text, text, text, text);

create or replace function public.register_american_participant(
  p_code text,
  p_display_name text,
  p_secondary_display_name text default null,
  p_payment_method text default null
)
returns uuid
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
  v_email text;
  v_tournament_id uuid;
  v_participant_id uuid;
  v_max_teams integer;
  v_current_count integer;
  v_status public.tournament_status;
  v_payment_config jsonb;
  v_payment_status text := 'pending';
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Tenés que iniciar sesión para inscribirte.';
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid;

  -- Resolver torneo por código
  select t.id, t.status, t.max_teams, t.payment_config
  into v_tournament_id, v_status, v_max_teams, v_payment_config
  from public.tournament_invites i
  join public.tournaments t on t.id = i.tournament_id
  where i.code = public.normalize_code(p_code);

  if v_tournament_id is null then
    raise exception using errcode = 'P0001', message = 'El código de torneo no es válido.';
  end if;

  if v_status not in ('draft', 'registration_open') then
    raise exception using errcode = 'P0001', message = 'La inscripción a este torneo no está abierta.';
  end if;

  -- Determinar estado inicial del arancel
  if coalesce((v_payment_config->>'enabled')::boolean, false) then
    if p_payment_method = 'cash' then
      v_payment_status := 'cash_on_arrival';
    else
      v_payment_status := 'pending';
    end if;
  else
    v_payment_status := 'not_required';
  end if;

  -- Verificar si el usuario ya está inscripto
  if exists (
    select 1 from public.american_participants ap
    where ap.tournament_id = v_tournament_id
      and (ap.user_id = v_uid or (v_email is not null and lower(ap.email) = v_email))
  ) then
    raise exception using errcode = 'P0001', message = 'Ya estás inscripto en este torneo americano.';
  end if;

  -- Verificar cupo si está configurado
  select count(*)::integer into v_current_count
  from public.american_participants ap
  where ap.tournament_id = v_tournament_id;

  if v_max_teams is not null and v_current_count >= v_max_teams then
    raise exception using errcode = 'P0001', message = 'El torneo ya completó su cupo de participantes.';
  end if;

  insert into public.american_participants (
    tournament_id, user_id, display_name, secondary_display_name, email,
    payment_status, payment_method
  ) values (
    v_tournament_id, v_uid, btrim(p_display_name), nullif(btrim(p_secondary_display_name), ''), v_email,
    v_payment_status, p_payment_method
  )
  returning id into v_participant_id;

  return v_participant_id;
end;
$$;

revoke execute on function public.register_american_participant(text, text, text, text) from public, anon;
grant execute on function public.register_american_participant(text, text, text, text) to authenticated;

