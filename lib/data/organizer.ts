import "server-only";
import { notFound } from "next/navigation";
import { z } from "zod";
import { getCurrentUser } from "@/lib/auth";
import { type OrganizerTournament, getOrganizerTournament } from "./tournaments";

/**
 * Carga el torneo para las pantallas del panel del organizador. Responde 404
 * si el id no es válido, si no existe o si quien navega no lo organiza (así
 * no se revela que el torneo existe).
 */
export async function requireOrganizerTournament(tournamentId: string): Promise<OrganizerTournament> {
  if (!z.uuid().safeParse(tournamentId).success) notFound();
  const user = await getCurrentUser();
  if (!user) notFound();
  const tournament = await getOrganizerTournament(tournamentId, user.id);
  if (!tournament) notFound();
  return tournament;
}
