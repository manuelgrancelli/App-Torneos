import { CalendarDays } from "lucide-react";
import { PublicPageLink } from "@/components/tournaments/public-page-link";
import { StatusBadge } from "@/components/tournaments/status-badge";
import { type PanelSection, TournamentNav } from "@/components/tournaments/tournament-nav";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { formatDateRange } from "@/lib/dates";

/** Secciones habilitadas del panel (se agregan a medida que existen las pantallas). */
const PANEL_SECTIONS: PanelSection[] = [
  "",
  "configuracion",
  "canchas-franjas",
  "inscripciones",
  "disponibilidad",
  "grupos",
  "partidos",
  "cuadro",
];

/** Panel del organizador: encabezado del torneo + pestañas de secciones. */
export default async function TournamentPanelLayout({ children, params }: LayoutProps<"/torneos/[id]">) {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);

  return (
    <div className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{tournament.name}</h1>
          <StatusBadge status={tournament.status} />
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span>{tournament.sport.name}</span>
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-4" aria-hidden="true" />
            {formatDateRange(tournament.startsOn, tournament.endsOn)}
          </span>
          <PublicPageLink slug={tournament.slug} status={tournament.status} />
        </p>
        <TournamentNav tournamentId={tournament.id} sections={PANEL_SECTIONS} />
      </header>
      {children}
    </div>
  );
}
