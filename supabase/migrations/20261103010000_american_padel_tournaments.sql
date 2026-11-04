-- =============================================================================
-- Módulo de Torneos Americanos de Pádel (Fase 2 - D-200)
-- 1. Enums para formato americano, modo de puntuación y estado de partido.
-- 2. Tabla american_participants: jugadores individuales (rotativo) o duplas (fijas).
-- 3. Tabla american_matches: cruces rotativos por ronda, cancha y turno.
-- 4. Tabla american_standings: tabla de posiciones acumulada con puntos y diferencia.
-- 5. RPCs: save_american_match_score y recalculate_american_standings.
-- =============================================================================

-- 1. Enums
do $$
begin
  if not exists (select 1 from pg_type where typname = 'american_format') then
    create type public.american_format as enum ('INDIVIDUAL_ROTATIVO', 'PAREJAS_FIJAS');
  end if;

  if not exists (select 1 from pg_type where typname = 'american_scoring_mode') then
    create type public.american_scoring_mode as enum ('fixed_points', 'timed_round', 'single_set');
  else
    begin
      alter type public.american_scoring_mode add value if not exists 'single_set';
    exception
      when others then null;
    end;
  end if;

  if not exists (select 1 from pg_type where typname = 'american_match_status') then
    create type public.american_match_status as enum ('pending', 'in_progress', 'completed');
  end if;
end;
$$;

-- 2. Participantes del Torneo Americano
create table if not exists public.american_participants (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid references public.tournament_categories (id) on delete cascade,
  user_id uuid references public.profiles (id) on delete set null,
  display_name text not null check (char_length(btrim(display_name)) between 2 and 100),
  secondary_display_name text check (secondary_display_name is null or char_length(btrim(secondary_display_name)) between 2 and 100),
  email text,
  phone text check (phone is null or char_length(phone) <= 30),
  seed_number smallint check (seed_number is null or seed_number >= 1),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.american_participants is 'Participantes individuales o duplas para torneos formato americano.';

create index if not exists american_participants_tournament_idx
  on public.american_participants (tournament_id, category_id);

create index if not exists american_participants_user_idx
  on public.american_participants (user_id);

alter table public.american_participants enable row level security;

drop trigger if exists american_participants_set_updated_at on public.american_participants;
create trigger american_participants_set_updated_at
  before update on public.american_participants
  for each row execute function public.set_updated_at();

-- Políticas RLS american_participants
drop policy if exists "american_participants: lectura pública o visible" on public.american_participants;
create policy "american_participants: lectura pública o visible"
  on public.american_participants for select to anon, authenticated
  using (
    user_id = (select auth.uid())
    or (email is not null and lower(email) = lower((select auth.jwt()->>'email')))
    or private.can_read_tournament(tournament_id)
  );

drop policy if exists "american_participants: organizador inserta" on public.american_participants;
create policy "american_participants: organizador inserta"
  on public.american_participants for insert to authenticated
  with check (private.is_tournament_organizer(tournament_id));

drop policy if exists "american_participants: organizador actualiza" on public.american_participants;
create policy "american_participants: organizador actualiza"
  on public.american_participants for update to authenticated
  using (private.is_tournament_organizer(tournament_id))
  with check (private.is_tournament_organizer(tournament_id));

drop policy if exists "american_participants: organizador elimina" on public.american_participants;
create policy "american_participants: organizador elimina"
  on public.american_participants for delete to authenticated
  using (private.is_tournament_organizer(tournament_id));

revoke all on table public.american_participants from anon, authenticated;
grant select on table public.american_participants to anon, authenticated;
grant insert, update, delete on table public.american_participants to authenticated;

-- 3. Partidos del Torneo Americano
create table if not exists public.american_matches (
  id uuid primary key default gen_random_uuid(),
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid references public.tournament_categories (id) on delete cascade,
  round_number smallint not null check (round_number >= 1),
  court_number smallint not null check (court_number >= 1),
  shift_number smallint not null default 1 check (shift_number >= 1),
  order_number smallint not null default 0 check (order_number >= 0),
  court_id uuid references public.courts (id) on delete set null,
  
  -- Lado A
  player_a1_id uuid not null references public.american_participants (id) on delete cascade,
  player_a2_id uuid references public.american_participants (id) on delete cascade,
  score_side_a smallint check (score_side_a is null or score_side_a >= 0),

  -- Lado B
  player_b1_id uuid not null references public.american_participants (id) on delete cascade,
  player_b2_id uuid references public.american_participants (id) on delete cascade,
  score_side_b smallint check (score_side_b is null or score_side_b >= 0),

  status public.american_match_status not null default 'pending',
  played_at timestamptz,
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now(),

  -- Evitar que un mismo jugador esté en dos posiciones del mismo partido
  check (player_a2_id is null or player_a1_id <> player_a2_id),
  check (player_b2_id is null or player_b1_id <> player_b2_id),
  check (player_a1_id <> player_b1_id),
  check (player_b2_id is null or player_a1_id <> player_b2_id),
  check (player_a2_id is null or player_a2_id <> player_b1_id),
  check (player_a2_id is null or player_b2_id is null or player_a2_id <> player_b2_id)
);

comment on table public.american_matches is 'Partidos y rotaciones de torneos americanos de pádel.';

create index if not exists american_matches_tournament_round_idx
  on public.american_matches (tournament_id, round_number);

create index if not exists american_matches_court_idx
  on public.american_matches (court_id);

alter table public.american_matches enable row level security;

drop trigger if exists american_matches_set_updated_at on public.american_matches;
create trigger american_matches_set_updated_at
  before update on public.american_matches
  for each row execute function public.set_updated_at();

-- Políticas RLS american_matches
drop policy if exists "american_matches: lectura si el torneo es visible" on public.american_matches;
create policy "american_matches: lectura si el torneo es visible"
  on public.american_matches for select to anon, authenticated
  using (private.can_read_tournament(tournament_id));

drop policy if exists "american_matches: organizador crea" on public.american_matches;
create policy "american_matches: organizador crea"
  on public.american_matches for insert to authenticated
  with check (private.is_tournament_organizer(tournament_id));

drop policy if exists "american_matches: organizador edita" on public.american_matches;
create policy "american_matches: organizador edita"
  on public.american_matches for update to authenticated
  using (private.is_tournament_organizer(tournament_id))
  with check (private.is_tournament_organizer(tournament_id));

drop policy if exists "american_matches: organizador borra" on public.american_matches;
create policy "american_matches: organizador borra"
  on public.american_matches for delete to authenticated
  using (private.is_tournament_organizer(tournament_id));

revoke all on table public.american_matches from anon, authenticated;
grant select on table public.american_matches to anon, authenticated;
grant insert, update, delete on table public.american_matches to authenticated;

-- 4. Tabla de Posiciones de Torneos Americanos
create table if not exists public.american_standings (
  tournament_id uuid not null references public.tournaments (id) on delete cascade,
  category_id uuid references public.tournament_categories (id) on delete cascade,
  participant_id uuid not null references public.american_participants (id) on delete cascade,
  played smallint not null default 0 check (played >= 0),
  won smallint not null default 0 check (won >= 0),
  lost smallint not null default 0 check (lost >= 0),
  points_for integer not null default 0 check (points_for >= 0),
  points_against integer not null default 0 check (points_against >= 0),
  point_diff integer generated always as (points_for - points_against) stored,
  rank smallint default null check (rank is null or rank >= 1),
  updated_at timestamptz not null default now(),
  primary key (tournament_id, participant_id)
);

comment on table public.american_standings is 'Tabla acumulada de puntos y diferencia para torneos americanos.';

create index if not exists american_standings_category_idx
  on public.american_standings (tournament_id, category_id, rank);

alter table public.american_standings enable row level security;

-- Políticas RLS american_standings
drop policy if exists "american_standings: lectura si el torneo es visible" on public.american_standings;
create policy "american_standings: lectura si el torneo es visible"
  on public.american_standings for select to anon, authenticated
  using (private.can_read_tournament(tournament_id));

drop policy if exists "american_standings: organizador gestiona" on public.american_standings;
create policy "american_standings: organizador gestiona"
  on public.american_standings for all to authenticated
  using (private.is_tournament_organizer(tournament_id))
  with check (private.is_tournament_organizer(tournament_id));

revoke all on table public.american_standings from anon, authenticated;
grant select on table public.american_standings to anon, authenticated;
grant insert, update, delete on table public.american_standings to authenticated;

-- 5. RPC: recalculate_american_standings
create or replace function public.recalculate_american_standings(
  p_tournament_id uuid,
  p_category_id uuid default null
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_rec record;
  v_rank smallint := 1;
  v_scoring_mode text := 'fixed_points';
begin
  select coalesce(
    scoring_config->'american'->>'scoringMode',
    scoring_config->'american'->>'scoring_mode',
    'fixed_points'
  ) into v_scoring_mode
  from public.tournaments
  where id = p_tournament_id;

  -- 1. Inicializar todos los participantes de la categoría o torneo en cero
  insert into public.american_standings (
    tournament_id, category_id, participant_id,
    played, won, lost, points_for, points_against, updated_at
  )
  select
    p.tournament_id,
    p.category_id,
    p.id as participant_id,
    0, 0, 0, 0, 0, now()
  from public.american_participants p
  where p.tournament_id = p_tournament_id
    and (p_category_id is null or p.category_id = p_category_id)
  on conflict (tournament_id, participant_id) do update set
    played = 0,
    won = 0,
    lost = 0,
    points_for = 0,
    points_against = 0,
    rank = null,
    updated_at = now();

  -- 2. Acumular estadísticas de partidos finalizados
  -- Para cada participante sumamos partidos jugados, ganados, perdidos y tantos
  with completed_matches as (
    select
      m.id,
      m.tournament_id,
      m.category_id,
      m.player_a1_id,
      m.player_a2_id,
      m.player_b1_id,
      m.player_b2_id,
      coalesce(m.score_side_a, 0) as score_a,
      coalesce(m.score_side_b, 0) as score_b
    from public.american_matches m
    where m.tournament_id = p_tournament_id
      and (p_category_id is null or m.category_id = p_category_id)
      and m.status = 'completed'
      and m.score_side_a is not null
      and m.score_side_b is not null
  ),
  match_points as (
    -- Jugador A1
    select
      tournament_id, category_id, player_a1_id as participant_id,
      1 as played,
      case when score_a > score_b then 1 else 0 end as won,
      case when score_a < score_b then 1 else 0 end as lost,
      score_a as pts_for,
      score_b as pts_against
    from completed_matches
    union all
    -- Jugador A2 (si existe)
    select
      tournament_id, category_id, player_a2_id as participant_id,
      1 as played,
      case when score_a > score_b then 1 else 0 end as won,
      case when score_a < score_b then 1 else 0 end as lost,
      score_a as pts_for,
      score_b as pts_against
    from completed_matches
    where player_a2_id is not null
    union all
    -- Jugador B1
    select
      tournament_id, category_id, player_b1_id as participant_id,
      1 as played,
      case when score_b > score_a then 1 else 0 end as won,
      case when score_b < score_a then 1 else 0 end as lost,
      score_b as pts_for,
      score_a as pts_against
    from completed_matches
    union all
    -- Jugador B2 (si existe)
    select
      tournament_id, category_id, player_b2_id as participant_id,
      1 as played,
      case when score_b > score_a then 1 else 0 end as won,
      case when score_b < score_a then 1 else 0 end as lost,
      score_b as pts_for,
      score_a as pts_against
    from completed_matches
    where player_b2_id is not null
  ),
  aggregated as (
    select
      tournament_id,
      category_id,
      participant_id,
      sum(played)::smallint as total_played,
      sum(won)::smallint as total_won,
      sum(lost)::smallint as total_lost,
      sum(pts_for)::integer as total_pts_for,
      sum(pts_against)::integer as total_pts_against
    from match_points
    group by tournament_id, category_id, participant_id
  )
  update public.american_standings s
  set
    played = a.total_played,
    won = a.total_won,
    lost = a.total_lost,
    points_for = a.total_pts_for,
    points_against = a.total_pts_against,
    updated_at = now()
  from aggregated a
  where s.tournament_id = a.tournament_id
    and s.participant_id = a.participant_id;

  -- 3. Calcular orden / ranking:
  -- En modo 'single_set' la diferencia de games define el puntaje neto (+3 por 6-3, +1 por 7-6).
  -- En puntos fijos o tiempo, prioriza puntos a favor acumulados.
  if v_scoring_mode = 'single_set' then
    for v_rec in
      select participant_id
      from public.american_standings
      where tournament_id = p_tournament_id
        and (p_category_id is null or category_id = p_category_id)
      order by
        point_diff desc,
        won desc,
        points_for desc,
        points_against asc
    loop
      update public.american_standings
      set rank = v_rank
      where tournament_id = p_tournament_id
        and participant_id = v_rec.participant_id;

      v_rank := v_rank + 1;
    end loop;
  else
    for v_rec in
      select participant_id
      from public.american_standings
      where tournament_id = p_tournament_id
        and (p_category_id is null or category_id = p_category_id)
      order by
        points_for desc,
        point_diff desc,
        won desc,
        points_against asc
    loop
      update public.american_standings
      set rank = v_rank
      where tournament_id = p_tournament_id
        and participant_id = v_rec.participant_id;

      v_rank := v_rank + 1;
    end loop;
  end if;
end;
$$;

revoke execute on function public.recalculate_american_standings(uuid, uuid) from public, anon;
grant execute on function public.recalculate_american_standings(uuid, uuid) to authenticated;

-- 6. RPC: save_american_match_score
create or replace function public.save_american_match_score(
  p_match_id uuid,
  p_score_side_a smallint,
  p_score_side_b smallint,
  p_status public.american_match_status default 'completed'
)
returns void
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_match record;
begin
  select tournament_id, category_id into v_match
  from public.american_matches
  where id = p_match_id;

  if not found then
    raise exception using errcode = 'P0002', message = 'El partido no existe.';
  end if;

  if not private.is_tournament_organizer(v_match.tournament_id) then
    raise exception using errcode = '42501', message = 'No tenés permisos para cargar resultados en este torneo.';
  end if;

  update public.american_matches
  set
    score_side_a = p_score_side_a,
    score_side_b = p_score_side_b,
    status = p_status,
    played_at = case when p_status = 'completed' then now() else played_at end,
    updated_at = now()
  where id = p_match_id;

  -- Recalcular automáticamente las posiciones
  perform public.recalculate_american_standings(v_match.tournament_id, v_match.category_id);
end;
$$;

revoke execute on function public.save_american_match_score(uuid, smallint, smallint, public.american_match_status) from public, anon;
grant execute on function public.save_american_match_score(uuid, smallint, smallint, public.american_match_status) to authenticated;

-- 6. RPC: Auto-inscripción de jugador en Torneo Americano
create or replace function public.register_american_participant(
  p_code text,
  p_display_name text,
  p_secondary_display_name text default null
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
begin
  if v_uid is null then
    raise exception using errcode = '42501', message = 'Tenés que iniciar sesión para inscribirte.';
  end if;

  select lower(u.email) into v_email
  from auth.users u
  where u.id = v_uid;

  -- Resolver torneo por código
  select t.id, t.status, t.max_teams into v_tournament_id, v_status, v_max_teams
  from public.tournament_invites i
  join public.tournaments t on t.id = i.tournament_id
  where i.code = public.normalize_code(p_code);

  if v_tournament_id is null then
    raise exception using errcode = 'P0001', message = 'El código de torneo no es válido.';
  end if;

  if v_status not in ('draft', 'registration_open') then
    raise exception using errcode = 'P0001', message = 'La inscripción a este torneo no está abierta.';
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
    tournament_id, user_id, display_name, secondary_display_name, email
  ) values (
    v_tournament_id, v_uid, btrim(p_display_name), nullif(btrim(p_secondary_display_name), ''), v_email
  )
  returning id into v_participant_id;

  return v_participant_id;
end;
$$;

revoke execute on function public.register_american_participant(text, text, text) from public, anon;
grant execute on function public.register_american_participant(text, text, text) to authenticated;

-- 7. RLS Helper: Permite que jugadores de torneos americanos lean el torneo y sus fixtures
create or replace function private.is_tournament_participant(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.team_members
    where tournament_id = p_tournament_id and user_id = (select auth.uid())
  ) or exists (
    select 1 from public.american_participants
    where tournament_id = p_tournament_id
      and (
        user_id = (select auth.uid())
        or (email is not null and lower(email) = lower((select auth.jwt()->>'email')))
      )
  );
$$;

create or replace function private.can_read_tournament(p_tournament_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.tournaments t
    where t.id = p_tournament_id
      and (
        (t.status <> 'draft' and not t.is_test)
        or t.organizer_id = (select auth.uid())
        or private.is_tournament_participant(t.id)
      )
  );
$$;

-- 8. Auto-vincular user_id a partir del email registrado en auth.users
create or replace function private.set_american_participant_user_id()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  if new.user_id is null and new.email is not null and btrim(new.email) <> '' then
    select id into new.user_id
    from auth.users
    where lower(email) = lower(btrim(new.email))
    limit 1;
  elsif new.email is null and new.user_id is not null then
    select lower(email) into new.email
    from auth.users
    where id = new.user_id
    limit 1;
  end if;
  return new;
end;
$$;

drop trigger if exists american_participants_set_user_id on public.american_participants;
create trigger american_participants_set_user_id
  before insert or update on public.american_participants
  for each row execute function private.set_american_participant_user_id();

-- Actualizar registros previos que tengan email pero no user_id
update public.american_participants ap
set user_id = u.id
from auth.users u
where ap.user_id is null
  and ap.email is not null
  and lower(ap.email) = lower(u.email);

-- Deduplicar registros con el mismo email en un mismo torneo antes de aplicar índice único:
-- Si hay un participante sin user_id y otro con user_id, transferimos el user_id al más antiguo o al que ya esté en partidos.
update public.american_participants ap
set user_id = dup.user_id
from public.american_participants dup
where ap.tournament_id = dup.tournament_id
  and ap.email is not null
  and dup.email is not null
  and lower(ap.email) = lower(dup.email)
  and ap.user_id is null
  and dup.user_id is not null
  and ap.id <> dup.id;

delete from public.american_participants a
using public.american_participants b
where a.tournament_id = b.tournament_id
  and a.email is not null
  and b.email is not null
  and lower(a.email) = lower(b.email)
  and a.id <> b.id
  and (
    (a.user_id is null and b.user_id is not null)
    or ((a.user_id is null) = (b.user_id is null) and a.created_at > b.created_at)
  );

-- Índice único para evitar que se duplique un mismo email en el mismo torneo
create unique index if not exists american_participants_unique_email_idx
  on public.american_participants (tournament_id, lower(email))
  where email is not null;

-- Asegurar que torneos americanos creados no queden trabados en 'draft'
update public.tournaments
set status = case
  when exists (select 1 from public.american_matches where tournament_id = tournaments.id) then 'group_stage'::public.tournament_status
  else 'registration_open'::public.tournament_status
end
where scoring_config->'american' is not null
  and status = 'draft';

