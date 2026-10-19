import { redirect } from "next/navigation";
import { requireOrganizerTournament } from "@/lib/data/organizer";

/**
 * Redirección inteligente de la raíz del torneo al no existir más la pestaña Resumen.
 * Lleva al organizador directo a la sección activa según la fase actual:
 * - Borrador -> Categorías
 * - Inscripción abierta -> Inscripciones
 * - Fase de grupos -> Grupos
 * - Playoffs / Finalizado -> Cuadro
 */
export default async function TournamentRootPage({ params }: PageProps<"/torneos/[id]">) {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);

  if (tournament.status === "draft") {
    redirect(`/torneos/${id}/canchas-franjas`);
  } else if (tournament.status === "registration_open") {
    redirect(`/torneos/${id}/inscripciones`);
  } else if (tournament.status === "group_stage") {
    redirect(`/torneos/${id}/grupos`);
  } else {
    redirect(`/torneos/${id}/cuadro`);
  }
}
