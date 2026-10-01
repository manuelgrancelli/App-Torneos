import { Network, Trophy } from "lucide-react";
import type { Metadata } from "next";
import { BracketGenerator } from "@/components/bracket/bracket-generator";
import { BracketView } from "@/components/bracket/bracket-view";
import { MatchesBoard } from "@/components/matches/matches-board";
import { EmptyState } from "@/components/shared/empty-state";
import {
  buildBoardMatches,
  cardsFromMatches,
  groupStandings,
  qualifiersFromStandings,
} from "@/lib/competition-view";
import { getCompetition, getSchedulingData } from "@/lib/data/competition";
import { requireOrganizerTournament } from "@/lib/data/organizer";

export const metadata: Metadata = { title: "Cuadro" };

/** Cuadro de playoffs: armado (con vista previa), resultados y campeón. */
export default async function BracketPage({ params }: PageProps<"/torneos/[id]/cuadro">) {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);

  if (tournament.status !== "playoffs" && tournament.status !== "finished") {
    return (
      <EmptyState
        icon={Network}
        title="El cuadro se arma al terminar la fase de grupos"
        description="Cuando todos los partidos de grupo tengan resultado, pasá el torneo a playoffs desde el resumen."
      />
    );
  }

  const [competition, scheduling] = await Promise.all([getCompetition(tournament.id), getSchedulingData(tournament.id)]);
  const teamNames = new Map(competition.teams.map((t) => [t.id, t.name]));
  const courtNames = new Map(scheduling.courts.map((c) => [c.id, c.name]));
  const playoffMatches = competition.matches.filter((m) => m.stage === "playoff");
  const hasResults = playoffMatches.some((m) => m.resultStatus !== null && !m.isBye);
  const champion = tournament.championTeamId ? teamNames.get(tournament.championTeamId) : null;

  // Candidatos: todos los equipos de cada grupo en orden de tabla (el generador elige cuántos pasan).
  const standings = groupStandings(competition.groups, competition.matches, tournament.scoringConfig, tournament.standingsConfig);
  const candidates = qualifiersFromStandings(standings, 99, tournament.scoringConfig.type);

  const board = buildBoardMatches(playoffMatches, competition.groups, teamNames, courtNames, competition.confirmations);

  return (
    <div className="space-y-6">
      {champion ? (
        <p className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-medium text-amber-950">
          <Trophy className="size-5 text-amber-600" aria-hidden="true" />
          Campeón: {champion}
        </p>
      ) : null}

      {tournament.status === "playoffs" && !hasResults ? (
        <BracketGenerator
          tournamentId={tournament.id}
          timezone={tournament.timezone}
          candidates={candidates}
          groupCount={competition.groups.length}
          teamNames={Object.fromEntries(teamNames)}
          defaultQualifiers={tournament.playoffConfig.qualifiersPerGroup}
          defaultThirdPlace={tournament.playoffConfig.thirdPlace}
          hasBracket={playoffMatches.length > 0}
        />
      ) : null}

      {playoffMatches.length > 0 ? (
        <>
          <section aria-labelledby="cuadro" className="space-y-3">
            <h2 id="cuadro" className="text-lg font-semibold">
              Cuadro
            </h2>
            <BracketView cards={cardsFromMatches(playoffMatches, teamNames, courtNames)} timezone={tournament.timezone} />
          </section>
          <section aria-labelledby="partidos-playoff" className="space-y-3">
            <h2 id="partidos-playoff" className="text-lg font-semibold">
              Partidos
            </h2>
            <MatchesBoard
              tournamentId={tournament.id}
              timezone={tournament.timezone}
              scoring={tournament.scoringConfig}
              matches={board}
              slots={scheduling.slots}
              courts={scheduling.courts}
              availability={scheduling.availability}
              canEdit={tournament.status === "playoffs"}
            />
          </section>
        </>
      ) : null}
    </div>
  );
}
