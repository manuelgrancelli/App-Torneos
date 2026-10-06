import type { Metadata } from "next";
import { type FormLocks, TournamentForm } from "@/components/tournaments/tournament-form";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { getTournamentCounts } from "@/lib/data/tournaments";
import type { ScoringConfig } from "@/lib/domain/scoring";
import type { StandingsConfig } from "@/lib/domain/standings";

export const metadata: Metadata = { title: "Configuración del torneo" };

/** Configuración del torneo. Lo que el estado no permite cambiar queda bloqueado con su motivo (D-029). */
export default async function TournamentSettingsPage({ params }: PageProps<"/torneos/[id]/configuracion">) {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);
  const counts = await getTournamentCounts(tournament.id);
  const inSetup = tournament.status === "draft" || tournament.status === "registration_open";
  const afterGroups = tournament.status === "playoffs" || tournament.status === "finished";

  const locks: FormLocks = {
    scoring: inSetup ? undefined : "La puntuación no se puede cambiar con el torneo en curso.",
    standings: afterGroups ? "La tabla de posiciones no se puede cambiar después de la fase de grupos." : undefined,
    playoff: afterGroups ? "La configuración de playoffs no se puede cambiar después de generar el cuadro." : undefined,
    timezone: counts.slots > 0 ? "La zona horaria no se puede cambiar porque ya hay franjas cargadas." : undefined,
  };

  return (
    <div className="max-w-2xl">
      <TournamentForm
        tournamentId={tournament.id}
        sport={{
          id: tournament.sport.id,
          name: tournament.sport.name,
          minTeamSize: tournament.sport.min_team_size,
          defaultScoringConfig: tournament.sport.default_scoring_config as ScoringConfig,
          defaultStandingsConfig: tournament.sport.default_standings_config as StandingsConfig,
        }}
        defaults={{
          name: tournament.name,
          description: tournament.description ?? "",
          startsOn: tournament.startsOn,
          endsOn: tournament.endsOn,
          timezone: tournament.timezone,
          maxTeams: tournament.maxTeams,
          resultsRequireConfirmation: tournament.resultsRequireConfirmation,
          scoringConfig: tournament.scoringConfig,
          standingsConfig: tournament.standingsConfig,
          playoffConfig: tournament.playoffConfig,
        }}
        locks={locks}
      />
    </div>
  );
}
