import { CalendarDays } from "lucide-react";
import { PublicPageLink } from "@/components/tournaments/public-page-link";
import { StatusBadge } from "@/components/tournaments/status-badge";
import { buildPhaseGuide } from "@/components/tournaments/phase-guide-model";
import { type NavGroupKey, TournamentNav } from "@/components/tournaments/tournament-nav";
import { TournamentProgress } from "@/components/tournaments/tournament-progress";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { getTournamentCounts } from "@/lib/data/tournaments";
import { formatDateRange } from "@/lib/dates";
import type { TournamentStatus } from "@/lib/domain/tournament-status";

/** Pestaña donde está el trabajo de cada fase (se marca como recomendada). */
const RECOMMENDED_TAB: Record<TournamentStatus, NavGroupKey> = {
  draft: "canchas",
  registration_open: "inscripciones",
  group_stage: "competencia",
  playoffs: "competencia",
  finished: "resumen",
};

/** Panel del organizador: encabezado del torneo, progreso y pestañas de secciones (D-053). */
export default async function TournamentPanelLayout({ children, params }: LayoutProps<"/torneos/[id]">) {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);
  // `getTournamentCounts` está memoizado por request: las páginas hijas lo reutilizan.
  const counts = await getTournamentCounts(tournament.id);
  const guide = buildPhaseGuide(tournament.status, counts, {
    tournamentId: tournament.id,
    maxTeams: tournament.maxTeams,
    teamSize: tournament.sport.min_team_size,
  });

  return (
    <div className="space-y-6">
      <header className="space-y-4">
        <div className="space-y-2">
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
        </div>
        <TournamentProgress status={tournament.status} detail={guide.progress.short || undefined} />
        <TournamentNav
          tournamentId={tournament.id}
          recommended={RECOMMENDED_TAB[tournament.status]}
          badges={{
            inscripciones: tournament.status === "registration_open" ? counts.pendingTeams : 0,
            competencia: tournament.status === "group_stage" ? counts.pendingGroupMatches : 0,
          }}
        />
      </header>
      {children}
    </div>
  );
}
