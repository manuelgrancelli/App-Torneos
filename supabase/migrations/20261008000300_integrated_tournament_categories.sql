-- =============================================================================
-- Torneos integrados: soporte para múltiples categorías en una misma fecha/torneo.
-- Cada categoría tiene sus propias inscripciones, sorteo de grupos, cuadro y
-- estado independiente (inscripción abierta -> grupos -> playoffs -> finalizado).
-- Todas las categorías comparten las canchas y franjas horarias del torneo,
-- permitiendo que el fixture mezcle partidos de distintas categorías en las canchas.
-- =============================================================================

-- -----------------------------------------------------------------------------
-- 1. Tabla de categorías del torneo
-- -----------------------------------------------------------------------------

create table if not exists public.tournament_categories (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  name text not null check (char_length(btrim(name)) between 1 and 60),
  position smallint not null default 0 check (position >= 0),
  status public.tournament_status not null default 'registration_open',
  max_teams integer not null default 16 check (max_teams between 2 and 64),
  scoring_config jsonb not null default '{"type": "sets", "setsToWin": 2, "gamesPerSet": 6, "tiebreak": true, "superTiebreakPoints": 11, "superTiebreakUntil": "quarterfinals"}'::jsonb,
  standings_config jsonb not null default '{"pointsWin": 2, "pointsDraw": 1, "pointsLoss": 0, "tiebreakers": ["head_to_head", "set_difference", "game_difference", "lottery"]}'::jsonb,
  playoff_config jsonb not null default '{"qualifiersPerGroup": 2, "thirdPlace": false}'::jsonb,
  champion_team_id uuid,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),
  unique (id, tournament_id)
);

create unique index if not exists tournament_categories_tournament_name_idx
  on public.tournament_categories (tournament_id, lower(btrim(name)));

comment on table public.tournament_categories is 'Categorías de un torneo integrado (ej. 6ta Caballeros, 4ta Femenino, 8va Damas).';

create index if not exists tournament_categories_tournament_idx on public.tournament_categories (tournament_id, position);

alter table public.tournament_categories enable row level security;

create trigger tournament_categories_set_updated_at
  before update on public.tournament_categories
  for each row execute function public.set_updated_at();

-- Políticas RLS
drop policy if exists "tournament_categories: lectura pública" on public.tournament_categories;
drop policy if exists "tournament_categories: lectura si el torneo es visible" on public.tournament_categories;
create policy "tournament_categories: lectura si el torneo es visible"
  on public.tournament_categories for select
  to anon, authenticated
  using (private.can_read_tournament(tournament_id));

drop policy if exists "tournament_categories: organizador inserta" on public.tournament_categories;
drop policy if exists "tournament_categories: el organizador crea" on public.tournament_categories;
create policy "tournament_categories: el organizador crea"
  on public.tournament_categories for insert
  to authenticated
  with check (private.is_tournament_organizer(tournament_id));

drop policy if exists "tournament_categories: organizador actualiza" on public.tournament_categories;
drop policy if exists "tournament_categories: el organizador edita" on public.tournament_categories;
create policy "tournament_categories: el organizador edita"
  on public.tournament_categories for update
  to authenticated
  using (private.is_tournament_organizer(tournament_id))
  with check (private.is_tournament_organizer(tournament_id));

drop policy if exists "tournament_categories: organizador elimina" on public.tournament_categories;
drop policy if exists "tournament_categories: el organizador borra" on public.tournament_categories;
create policy "tournament_categories: el organizador borra"
  on public.tournament_categories for delete
  to authenticated
  using (private.is_tournament_organizer(tournament_id));

revoke all on table public.tournament_categories from anon, authenticated;
grant select on table public.tournament_categories to anon, authenticated;
grant insert, update, delete on table public.tournament_categories to authenticated;

-- -----------------------------------------------------------------------------
-- 2. Vincular category_id en teams, tournament_groups y matches
-- -----------------------------------------------------------------------------

alter table public.teams
  add column if not exists category_id uuid references public.tournament_categories (id) on delete set null;

create index if not exists teams_category_id_idx on public.teams (category_id);

alter table public.tournament_groups
  add column if not exists category_id uuid references public.tournament_categories (id) on delete cascade;

create index if not exists tournament_groups_category_id_idx on public.tournament_groups (category_id);

-- En tournament_groups, permitir que cada categoría tenga su propio "Grupo A", "Grupo B"
alter table public.tournament_groups
  drop constraint if exists tournament_groups_tournament_id_name_key,
  drop constraint if exists tournament_groups_tournament_id_position_key;

create unique index if not exists tournament_groups_cat_name_idx
  on public.tournament_groups (tournament_id, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid), lower(name));

create unique index if not exists tournament_groups_cat_pos_idx
  on public.tournament_groups (tournament_id, coalesce(category_id, '00000000-0000-0000-0000-000000000000'::uuid), position);

alter table public.matches
  add column if not exists category_id uuid references public.tournament_categories (id) on delete cascade;

create index if not exists matches_category_id_idx on public.matches (category_id);

-- FK de campeón por categoría
alter table public.tournament_categories
  drop constraint if exists tournament_categories_champion_team_fk,
  add constraint tournament_categories_champion_team_fk
  foreign key (champion_team_id) references public.teams (id) on delete set null;

-- -----------------------------------------------------------------------------
-- 3. RPC: set_category_status
-- -----------------------------------------------------------------------------

create or replace function public.set_category_status(
  p_category_id uuid,
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
  v_cat public.tournament_categories%rowtype;
  v_tournament public.tournaments%rowtype;
  v_approved_count integer;
  v_pending_matches integer;
begin
  select * into v_cat from public.tournament_categories where id = p_category_id for update;
  if not found then
    raise exception using errcode = 'P0001', message = 'La categoría no existe.';
  end if;

  select * into v_tournament from public.tournaments where id = v_cat.tournament_id for update;
  if not found or v_tournament.organizer_id <> v_uid then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar esta categoría.';
  end if;

  if v_cat.status = p_status then
    return;
  end if;

  -- Reglas de transición de la categoría
  if v_cat.status = 'registration_open' and p_status = 'group_stage' then
    select count(*) into v_approved_count
    from public.teams
    where category_id = p_category_id and status = 'approved';

    if v_approved_count < 2 then
      raise exception using errcode = 'P0001', message = 'Para empezar la fase de grupos se necesitan al menos 2 parejas aprobadas en esta categoría.';
    end if;

  elsif v_cat.status = 'group_stage' and p_status in ('playoffs', 'finished') then
    select count(*) into v_pending_matches
    from public.matches
    where category_id = p_category_id and stage = 'group' and result_status is null;

    if v_pending_matches > 0 then
      raise exception using errcode = 'P0001', message = 'Todavía hay partidos de grupo sin resultado en esta categoría.';
    end if;
  end if;

  update public.tournament_categories
  set status = p_status,
      champion_team_id = case when p_status = 'finished' then p_champion_team_id else champion_team_id end,
      updated_at = now()
  where id = p_category_id;

  -- Sincronizar el estado del torneo si es necesario:
  -- Si alguna categoría entra en fase de grupos o playoffs, el torneo general pasa al menos a 'group_stage'.
  if p_status in ('group_stage', 'playoffs') and v_tournament.status = 'registration_open' then
    update public.tournaments set status = 'group_stage', updated_at = now() where id = v_tournament.id;
  end if;

  -- Si todas las categorías finalizaron, finalizar el torneo.
  if p_status = 'finished' and not exists (
    select 1 from public.tournament_categories where tournament_id = v_tournament.id and status <> 'finished'
  ) then
    update public.tournaments set status = 'finished', updated_at = now() where id = v_tournament.id;
  end if;
end;
$$;

revoke execute on function public.set_category_status(uuid, public.tournament_status, uuid) from public, anon;
grant execute on function public.set_category_status(uuid, public.tournament_status, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 4. Actualizar apply_groups para soportar categoría opcional
-- -----------------------------------------------------------------------------

create or replace function public.apply_groups(
  p_tournament_id uuid,
  p_groups jsonb,
  p_category_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament public.tournaments%rowtype;
  v_cat public.tournament_categories%rowtype;
  v_group jsonb;
  v_match jsonb;
  v_group_id uuid;
  v_position integer := 0;
  v_team_ids uuid[];
  v_all_teams uuid[] := '{}'::uuid[];
  v_approved uuid[];
  v_pairs text[] := '{}'::text[];
  v_home uuid;
  v_away uuid;
  v_pair text;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  if not found or v_tournament.organizer_id <> v_uid then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este torneo.';
  end if;

  if p_category_id is not null then
    select * into v_cat from public.tournament_categories where id = p_category_id and tournament_id = p_tournament_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'La categoría no pertenece a este torneo.';
    end if;
    if v_cat.status <> 'group_stage' and v_tournament.status <> 'group_stage' then
      raise exception using errcode = 'P0001', message = 'Los grupos se arman con la categoría en fase de grupos.';
    end if;
    if exists (
      select 1 from public.matches
      where tournament_id = p_tournament_id and category_id = p_category_id and result_status is not null
    ) then
      raise exception using errcode = 'P0001', message = 'Ya hay resultados cargados: no se pueden rearmar los grupos.';
    end if;
  else
    if v_tournament.status <> 'group_stage' then
      raise exception using errcode = 'P0001', message = 'Los grupos se arman con el torneo en fase de grupos.';
    end if;
    if exists (
      select 1 from public.matches where tournament_id = p_tournament_id and result_status is not null
    ) then
      raise exception using errcode = 'P0001', message = 'Ya hay resultados cargados: no se pueden rearmar los grupos.';
    end if;
  end if;

  if jsonb_typeof(p_groups) <> 'array' or jsonb_array_length(p_groups) not between 1 and 26 then
    raise exception using errcode = 'P0001', message = 'Tiene que haber entre 1 y 26 grupos.';
  end if;

  -- Equipos aprobados esperados
  if p_category_id is not null then
    select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_approved
    from public.teams where tournament_id = p_tournament_id and category_id = p_category_id and status = 'approved';
  else
    select coalesce(array_agg(id order by id), '{}'::uuid[]) into v_approved
    from public.teams where tournament_id = p_tournament_id and status = 'approved';
  end if;

  for v_group in select value from jsonb_array_elements(p_groups) loop
    select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_team_ids
    from jsonb_array_elements_text(v_group -> 'teamIds');
    if cardinality(v_team_ids) < 2 then
      raise exception using errcode = 'P0001', message = 'Cada grupo tiene que tener al menos 2 equipos.';
    end if;
    v_all_teams := v_all_teams || v_team_ids;
  end loop;

  if (select array_agg(t order by t) from unnest(v_all_teams) as t) is distinct from v_approved
     or cardinality(v_all_teams) <> (select count(distinct t) from unnest(v_all_teams) as t) then
    raise exception using errcode = 'P0001',
      message = 'Los grupos tienen que incluir a todas las inscripciones aprobadas, una sola vez cada una.';
  end if;

  -- Reemplazo de la fase de grupos (por categoría o global)
  if p_category_id is not null then
    delete from public.matches where tournament_id = p_tournament_id and category_id = p_category_id and stage = 'group';
    delete from public.tournament_groups where tournament_id = p_tournament_id and category_id = p_category_id;
  else
    delete from public.matches where tournament_id = p_tournament_id and stage = 'group';
    delete from public.tournament_groups where tournament_id = p_tournament_id;
  end if;

  for v_group in select value from jsonb_array_elements(p_groups) loop
    insert into public.tournament_groups (tournament_id, category_id, name, position)
    values (p_tournament_id, p_category_id, btrim(v_group ->> 'name'), v_position)
    returning id into v_group_id;

    select coalesce(array_agg(value::uuid), '{}'::uuid[]) into v_team_ids
    from jsonb_array_elements_text(v_group -> 'teamIds');

    insert into public.group_teams (group_id, team_id, tournament_id, position)
    select v_group_id, t.team_id, p_tournament_id, (t.ord - 1)::smallint
    from unnest(v_team_ids) with ordinality as t (team_id, ord);

    v_pairs := '{}'::text[];
    for v_match in select value from jsonb_array_elements(coalesce(v_group -> 'matches', '[]'::jsonb)) loop
      v_home := (v_match ->> 'home')::uuid;
      v_away := (v_match ->> 'away')::uuid;
      if not (v_home = any(v_team_ids)) or not (v_away = any(v_team_ids)) or v_home = v_away then
        raise exception using errcode = 'P0001', message = 'Hay un partido entre equipos que no son del mismo grupo.';
      end if;
      v_pair := least(v_home::text, v_away::text) || '|' || greatest(v_home::text, v_away::text);
      if v_pair = any(v_pairs) then
        raise exception using errcode = 'P0001', message = 'Hay partidos repetidos en un grupo.';
      end if;
      v_pairs := v_pairs || v_pair;

      insert into public.matches (tournament_id, category_id, stage, group_id, round, position, home_team_id, away_team_id)
      values (
        p_tournament_id, p_category_id, 'group', v_group_id,
        greatest(coalesce((v_match ->> 'round')::integer, 1), 1),
        greatest(coalesce((v_match ->> 'position')::integer, 0), 0),
        v_home, v_away
      );
    end loop;

    v_position := v_position + 1;
  end loop;

  -- Si el torneo general aún estaba en 'registration_open', pasarlo a 'group_stage'
  if v_tournament.status = 'registration_open' then
    update public.tournaments set status = 'group_stage', updated_at = now() where id = p_tournament_id;
  end if;
  if p_category_id is not null and v_cat.status = 'registration_open' then
    update public.tournament_categories set status = 'group_stage', updated_at = now() where id = p_category_id;
  end if;
end;
$$;

revoke execute on function public.apply_groups(uuid, jsonb, uuid) from public, anon;
grant execute on function public.apply_groups(uuid, jsonb, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 5. Actualizar apply_bracket para soportar categoría opcional
-- -----------------------------------------------------------------------------

create or replace function public.apply_bracket(
  p_tournament_id uuid,
  p_matches jsonb,
  p_category_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := public.require_user();
  v_tournament public.tournaments%rowtype;
  v_cat public.tournament_categories%rowtype;
  v_item jsonb;
  v_ids jsonb := '{}'::jsonb;
  v_keys text[] := '{}'::text[];
  v_teams uuid[] := '{}'::uuid[];
  v_team uuid;
  v_key text;
  v_link jsonb;
begin
  select * into v_tournament from public.tournaments where id = p_tournament_id for update;
  if not found or v_tournament.organizer_id <> v_uid then
    raise exception using errcode = '42501', message = 'No tenés permiso para modificar este torneo.';
  end if;

  if p_category_id is not null then
    select * into v_cat from public.tournament_categories where id = p_category_id and tournament_id = p_tournament_id;
    if not found then
      raise exception using errcode = 'P0001', message = 'La categoría no pertenece a este torneo.';
    end if;
    if exists (
      select 1 from public.matches
      where tournament_id = p_tournament_id and category_id = p_category_id and stage = 'playoff' and result_status is not null and not is_bye
    ) then
      raise exception using errcode = 'P0001', message = 'Ya hay resultados de playoffs: no se puede rearmar el cuadro.';
    end if;
  else
    if exists (
      select 1 from public.matches
      where tournament_id = p_tournament_id and stage = 'playoff' and result_status is not null and not is_bye
    ) then
      raise exception using errcode = 'P0001', message = 'Ya hay resultados de playoffs: no se puede rearmar el cuadro.';
    end if;
  end if;

  if jsonb_typeof(p_matches) <> 'array' or jsonb_array_length(p_matches) not between 1 and 64 then
    raise exception using errcode = 'P0001', message = 'El cuadro no es válido.';
  end if;

  for v_item in select value from jsonb_array_elements(p_matches) loop
    v_key := v_item ->> 'key';
    if v_key is null or v_key = any(v_keys) then
      raise exception using errcode = 'P0001', message = 'El cuadro tiene partidos repetidos.';
    end if;
    v_keys := v_keys || v_key;
    v_ids := v_ids || jsonb_build_object(v_key, gen_random_uuid());

    if coalesce((v_item ->> 'round')::integer, 0) = 1 then
      foreach v_team in array array_remove(array[(v_item ->> 'home')::uuid, (v_item ->> 'away')::uuid], null) loop
        if v_team = any(v_teams) then
          raise exception using errcode = 'P0001', message = 'Un equipo aparece dos veces en el cuadro.';
        end if;
        v_teams := v_teams || v_team;
      end loop;
    end if;
  end loop;

  -- Reemplazar solo los playoffs de esta categoría o globales
  if p_category_id is not null then
    delete from public.matches where tournament_id = p_tournament_id and category_id = p_category_id and stage = 'playoff';
  else
    delete from public.matches where tournament_id = p_tournament_id and stage = 'playoff';
  end if;

  for v_item in select value from jsonb_array_elements(p_matches) loop
    v_key := v_item ->> 'key';
    insert into public.matches (
      id, tournament_id, category_id, stage, round, position,
      home_team_id, away_team_id, is_bye, is_third_place, winner_team_id
    ) values (
      (v_ids ->> v_key)::uuid, p_tournament_id, p_category_id, 'playoff',
      (v_item ->> 'round')::smallint, (v_item ->> 'position')::smallint,
      (v_item ->> 'home')::uuid, (v_item ->> 'away')::uuid,
      coalesce((v_item ->> 'isBye')::boolean, false),
      coalesce((v_item ->> 'isThirdPlace')::boolean, false),
      (v_item ->> 'winner')::uuid
    );
  end loop;

  for v_item in select value from jsonb_array_elements(p_matches) loop
    v_key := v_item ->> 'key';
    v_link := v_item -> 'next';
    if v_link is not null and v_link <> 'null'::jsonb then
      update public.matches
      set next_match_id = (v_ids ->> (v_link ->> 'key'))::uuid,
          next_match_side = (v_link ->> 'side')::public.match_side
      where id = (v_ids ->> v_key)::uuid;
    end if;

    v_link := v_item -> 'loserNext';
    if v_link is not null and v_link <> 'null'::jsonb then
      update public.matches
      set loser_next_match_id = (v_ids ->> (v_link ->> 'key'))::uuid,
          loser_next_match_side = (v_link ->> 'side')::public.match_side
      where id = (v_ids ->> v_key)::uuid;
    end if;
  end loop;

  if p_category_id is not null and v_cat.status = 'group_stage' then
    update public.tournament_categories set status = 'playoffs', updated_at = now() where id = p_category_id;
  end if;
end;
$$;

revoke execute on function public.apply_bracket(uuid, jsonb, uuid) from public, anon;
grant execute on function public.apply_bracket(uuid, jsonb, uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- 6. Actualizar register_team para soportar categoría opcional
-- -----------------------------------------------------------------------------

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

  if v_email = any(v_emails) then
    raise exception using errcode = 'P0001', message = 'No incluyas tu propio email: ya quedás como capitán.';
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

  -- Regla: una persona juega en una sola pareja por torneo (mantiene unique tournament_id, email)
  if exists (
    select 1 from public.team_members
    where tournament_id = v_tournament.id and (user_id = v_uid or email = v_email)
  ) then
    raise exception using errcode = 'P0001', message = 'Ya estás inscripto en este torneo.';
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

  insert into public.teams (tournament_id, category_id, name, captain_id, status)
  values (v_tournament.id, p_category_id, v_name, v_uid, 'pending')
  returning id into v_team_id;

  insert into public.team_members (team_id, tournament_id, email, user_id, role)
  values (v_team_id, v_tournament.id, v_email, v_uid, 'captain');

  foreach v_member_email in array v_emails loop
    select id into v_existing_user
    from auth.users
    where lower(email) = v_member_email and email_confirmed_at is not null;

    insert into public.team_members (team_id, tournament_id, email, user_id, role)
    values (v_team_id, v_tournament.id, v_member_email, v_existing_user, 'player');
  end loop;

  return v_team_id;
end;
$$;

revoke execute on function public.register_team(text, text, text[], uuid) from public, anon;
grant execute on function public.register_team(text, text, text[], uuid) to authenticated;
