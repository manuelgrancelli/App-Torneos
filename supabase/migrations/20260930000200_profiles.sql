-- =============================================================================
-- Perfiles públicos de usuario (nombre y avatar). El email NO se guarda acá:
-- vive solo en auth.users y nunca se expone por la API.
-- =============================================================================

create table public.profiles (
  id uuid primary key references auth.users (id) on delete cascade,
  full_name text not null check (char_length(btrim(full_name)) between 1 and 80),
  avatar_url text check (avatar_url is null or (avatar_url ~ '^https://' and char_length(avatar_url) <= 2048)),
  created_at timestamptz not null default now(),
  updated_at timestamptz not null default now()
);

comment on table public.profiles is 'Datos públicos del usuario. Se crea automáticamente al registrarse.';

alter table public.profiles enable row level security;

create trigger profiles_set_updated_at
  before update on public.profiles
  for each row execute function public.set_updated_at();

-- Privilegios explícitos: solo lectura y edición de nombre/avatar.
revoke all on table public.profiles from anon, authenticated;
grant select on table public.profiles to authenticated;
grant update (full_name, avatar_url) on table public.profiles to authenticated;

-- Cada usuario ve y edita su propio perfil. La visibilidad entre compañeros y
-- para organizadores se agrega en la migración de equipos.
create policy "profiles: ver el propio"
  on public.profiles for select to authenticated
  using (id = (select auth.uid()));

create policy "profiles: editar el propio"
  on public.profiles for update to authenticated
  using (id = (select auth.uid()))
  with check (id = (select auth.uid()));

-- -----------------------------------------------------------------------------
-- Alta automática del perfil al crearse un usuario en Supabase Auth.
-- -----------------------------------------------------------------------------

-- Arma nombre y avatar a partir de los metadatos del registro (email o Google).
create function public.profile_values_from_user(p_email text, p_meta jsonb)
returns table (full_name text, avatar_url text)
language plpgsql
immutable
set search_path = ''
as $$
declare
  v_name text := nullif(btrim(coalesce(p_meta ->> 'full_name', p_meta ->> 'name', '')), '');
  v_avatar text := coalesce(p_meta ->> 'avatar_url', p_meta ->> 'picture');
begin
  if v_name is null then
    v_name := nullif(split_part(coalesce(p_email, ''), '@', 1), '');
  end if;
  -- Solo avatares https y de largo razonable (lo valida también el CHECK).
  if v_avatar is not null and (v_avatar !~ '^https://' or char_length(v_avatar) > 2048) then
    v_avatar := null;
  end if;
  full_name := left(coalesce(v_name, 'Jugador'), 80);
  avatar_url := v_avatar;
  return next;
end;
$$;

create function public.handle_new_user()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
begin
  insert into public.profiles (id, full_name, avatar_url)
  select new.id, v.full_name, v.avatar_url
  from public.profile_values_from_user(new.email, coalesce(new.raw_user_meta_data, '{}'::jsonb)) as v
  on conflict (id) do nothing;
  return new;
end;
$$;

-- El nombre importa: los triggers AFTER se ejecutan en orden alfabético y la
-- vinculación de integrantes (on_auth_user_verified) necesita el perfil creado.
create trigger on_auth_user_created
  after insert on auth.users
  for each row execute function public.handle_new_user();

-- Usuarios que ya existían antes de esta migración (p. ej. cuentas de prueba).
insert into public.profiles (id, full_name, avatar_url)
select u.id, v.full_name, v.avatar_url
from auth.users as u
cross join lateral public.profile_values_from_user(u.email, coalesce(u.raw_user_meta_data, '{}'::jsonb)) as v
on conflict (id) do nothing;

revoke execute on function public.profile_values_from_user(text, jsonb) from public, anon, authenticated;
revoke execute on function public.handle_new_user() from public, anon, authenticated;
