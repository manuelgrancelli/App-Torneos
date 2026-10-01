import { updateTag } from "next/cache";

/** Tag de los datos cacheados de la página pública de un torneo (D-040). */
export function publicTournamentTag(tournamentId: string): string {
  return `public-tournament:${tournamentId}`;
}

/**
 * Invalida la página pública de un torneo. Solo se puede llamar desde Server
 * Actions (updateTag): la próxima visita espera datos frescos.
 */
export function refreshPublicTournament(tournamentId: string): void {
  updateTag(publicTournamentTag(tournamentId));
}
