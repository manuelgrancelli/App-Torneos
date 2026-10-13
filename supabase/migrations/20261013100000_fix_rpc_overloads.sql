-- =============================================================================
-- Fix de sobrecargas de funciones en PostgREST
-- Elimina las firmas obsoletas de 2 parámetros para evitar conflicto PGRST203
-- ("Could not choose the best candidate function")
-- =============================================================================

drop function if exists public.apply_groups(uuid, jsonb);
drop function if exists public.apply_bracket(uuid, jsonb);
