-- =============================================================================
-- Rol de cuenta: jugador u organizador (D-122).
-- Las cuentas nuevas son jugadoras: se inscriben, siguen su torneo e invitan a
-- su pareja, pero no pueden crear torneos ni circuitos. La base es la barrera
-- real: un trigger rechaza el alta de torneos y circuitos hechos por jugadores.
-- Para habilitar a alguien como organizador (SQL Editor de Supabase):
--   update public.profiles set account_role = 'organizer'
--   where id = (select id from auth.users where email = 'persona@ejemplo.com');
-- =============================================================================

alter table public.profiles
  add column if not exists account_role text not null default 'player'
  check (account_role in ('player', 'organizer'));

comment on column public.profiles.account_role is
  'player: solo participa en torneos. organizer: además puede crear torneos y circuitos. Solo se cambia desde SQL.';

-- Quien ya creó torneos o circuitos sigue siendo organizador.
update public.profiles p
set account_role = 'organizer'
where p.account_role <> 'organizer'
  and (
    exists (select 1 from public.tournaments t where t.organizer_id = p.id)
    or exists (select 1 from public.circuits c where c.organizer_id = p.id)
  );

-- El usuario no puede cambiar su propio rol: la columna no está en el grant de
-- update de profiles (solo full_name y avatar_url). Se deja explícito igual.
revoke update (account_role) on table public.profiles from authenticated;

-- -----------------------------------------------------------------------------
-- Helper: ¿el usuario tiene cuenta de organizador?
-- -----------------------------------------------------------------------------
create or replace function private.is_account_organizer(p_user_id uuid)
returns boolean
language sql
stable
security definer
set search_path = ''
as $$
  select exists (
    select 1 from public.profiles
    where id = p_user_id and account_role = 'organizer'
  );
$$;

revoke execute on function private.is_account_organizer(uuid) from public, anon;
grant execute on function private.is_account_organizer(uuid) to authenticated;

-- -----------------------------------------------------------------------------
-- Trigger: solo organizadores crean torneos y circuitos.
-- Aplica a pedidos que llegan por la API (hay auth.uid()); los scripts del
-- seed y las migraciones corren sin sesión y no se ven afectados.
-- -----------------------------------------------------------------------------
create or replace function private.require_account_organizer()
returns trigger
language plpgsql
security definer
set search_path = ''
as $$
declare
  v_uid uuid := auth.uid();
begin
  if v_uid is not null and not private.is_account_organizer(v_uid) then
    raise exception 'Tu cuenta es de jugador: no podés crear torneos ni circuitos.'
      using errcode = 'P0001';
  end if;
  return new;
end;
$$;

revoke execute on function private.require_account_organizer() from public, anon, authenticated;

drop trigger if exists tournaments_require_account_organizer on public.tournaments;
create trigger tournaments_require_account_organizer
  before insert on public.tournaments
  for each row execute function private.require_account_organizer();

drop trigger if exists circuits_require_account_organizer on public.circuits;
create trigger circuits_require_account_organizer
  before insert on public.circuits
  for each row execute function private.require_account_organizer();
