-- =============================================================================
-- Circuitos / Torneos por fechas y rankings acumulados.
-- Un circuito agrupa múltiples fechas (torneos) y consolida el ranking
-- de jugadores según el baremo de puntos configurado por el organizador.
-- =============================================================================

create table if not exists public.circuits (
  id uuid primary key default gen_random_uuid(),
  organizer_id uuid not null references auth.users (id) on delete cascade,
  sport_id text not null references public.sports (id),
  name text not null check (char_length(btrim(name)) between 2 and 100),
  slug text not null unique check (char_length(slug) between 2 and 120),
  description text check (description is null or char_length(description) <= 2000),
  year smallint not null default extract(year from current_date)::smallint check (year between 2000 and 2100),
  points_config jsonb not null check (jsonb_typeof(points_config) = 'object'),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.circuits is 'Circuitos deportivos multifecha con ranking individual acumulado.';

create index if not exists circuits_organizer_id_idx on public.circuits (organizer_id);
create index if not exists circuits_sport_id_idx on public.circuits (sport_id);

alter table public.circuits enable row level security;

drop trigger if exists circuits_set_updated_at on public.circuits;
create trigger circuits_set_updated_at
  before update on public.circuits
  for each row execute function public.set_updated_at();

-- Lectura pública para cualquier usuario o visitante
drop policy if exists "circuits: lectura pública" on public.circuits;
create policy "circuits: lectura pública"
  on public.circuits for select to anon, authenticated
  using (true);

-- Gestión exclusiva del organizador
drop policy if exists "circuits: creación del organizador" on public.circuits;
create policy "circuits: creación del organizador"
  on public.circuits for insert to authenticated
  with check (organizer_id = auth.uid());

drop policy if exists "circuits: edición del organizador" on public.circuits;
create policy "circuits: edición del organizador"
  on public.circuits for update to authenticated
  using (organizer_id = auth.uid())
  with check (organizer_id = auth.uid());

drop policy if exists "circuits: eliminación del organizador" on public.circuits;
create policy "circuits: eliminación del organizador"
  on public.circuits for delete to authenticated
  using (organizer_id = auth.uid());

grant select on public.circuits to anon, authenticated;
grant insert, update, delete on public.circuits to authenticated;

-- Relación en la tabla de torneos
alter table public.tournaments
  add column if not exists circuit_id uuid references public.circuits (id) on delete set null,
  add column if not exists circuit_order smallint check (circuit_order is null or circuit_order > 0);

create index if not exists tournaments_circuit_id_idx on public.tournaments (circuit_id);

-- Permisos de actualización para asociar o desvincular torneos al circuito
grant update (circuit_id, circuit_order) on table public.tournaments to authenticated;
