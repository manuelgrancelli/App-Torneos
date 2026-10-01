-- =============================================================================
-- Base: extensiones, tipos enumerados y funciones utilitarias.
-- =============================================================================

-- btree_gist: permite constraints de exclusión que combinan igualdad (cancha)
-- con superposición de rangos de tiempo (partidos en la misma cancha).
create extension if not exists btree_gist with schema extensions;
-- pgcrypto: bytes aleatorios criptográficamente seguros para los códigos de invitación.
create extension if not exists pgcrypto with schema extensions;

-- Schema privado para los helpers de autorización que usan las políticas RLS.
-- No está expuesto por la API (PostgREST solo expone public), así que nadie
-- puede invocarlos por /rpc, pero las políticas sí pueden usarlos.
create schema if not exists private;
revoke all on schema private from public;
grant usage on schema private to anon, authenticated;

-- -----------------------------------------------------------------------------
-- Tipos enumerados
-- -----------------------------------------------------------------------------

-- Sistema de puntuación del deporte: sets/games (pádel, tenis) o goles (fútbol).
create type public.scoring_type as enum ('sets', 'goals');

-- Ciclo de vida del torneo. "Publicado" = cualquier estado distinto de draft.
create type public.tournament_status as enum (
  'draft',             -- borrador (privado)
  'registration_open', -- inscripción abierta
  'group_stage',       -- fase de grupos
  'playoffs',          -- cruces
  'finished'           -- finalizado
);

-- Estado de la inscripción de un equipo/pareja.
create type public.team_status as enum ('pending', 'approved', 'rejected');

create type public.team_member_role as enum ('captain', 'player');

create type public.match_stage as enum ('group', 'playoff');

-- Lado del partido siguiente al que avanza un ganador/perdedor en playoffs.
create type public.match_side as enum ('home', 'away');

-- Estado del resultado cuando el torneo pide confirmación de los equipos.
create type public.result_status as enum ('provisional', 'confirmed', 'disputed');

create type public.confirmation_response as enum ('confirmed', 'disputed');

-- -----------------------------------------------------------------------------
-- Funciones utilitarias
-- -----------------------------------------------------------------------------

-- Mantiene updated_at en cada UPDATE.
create function public.set_updated_at()
returns trigger
language plpgsql
set search_path = ''
as $$
begin
  new.updated_at := now();
  return new;
end;
$$;

-- Código aleatorio legible (sin 0/O/1/I para evitar confusiones al tipearlo).
-- 10 caracteres de un alfabeto de 32 = 50 bits de entropía.
create function public.generate_code(p_length integer default 10)
returns text
language plpgsql
volatile
set search_path = ''
as $$
declare
  alphabet constant text := 'ABCDEFGHJKLMNPQRSTUVWXYZ23456789';
  bytes bytea := extensions.gen_random_bytes(p_length);
  result text := '';
begin
  for i in 0 .. p_length - 1 loop
    -- 256 es múltiplo de 32: el módulo no introduce sesgo.
    result := result || substr(alphabet, (get_byte(bytes, i) % 32) + 1, 1);
  end loop;
  return result;
end;
$$;

-- Las funciones utilitarias no se exponen por la API.
revoke execute on function public.set_updated_at() from public, anon, authenticated;
revoke execute on function public.generate_code(integer) from public, anon, authenticated;
