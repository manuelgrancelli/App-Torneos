-- =============================================================================
-- Permitir al organizador eliminar torneos no finalizados
-- Un torneo solo queda protegido contra borrado cuando pasa a estado 'finished'.
-- =============================================================================

drop policy if exists "tournaments: el organizador borra antes de empezar" on public.tournaments;
drop policy if exists "tournaments: el organizador borra si no esta finalizado" on public.tournaments;

create policy "tournaments: el organizador borra si no esta finalizado"
  on public.tournaments for delete to authenticated
  using (organizer_id = (select auth.uid()) and status <> 'finished');
