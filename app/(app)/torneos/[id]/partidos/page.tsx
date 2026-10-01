import { CalendarRange } from "lucide-react";
import type { Metadata } from "next";
import { AutoScheduleDialog } from "@/components/matches/auto-schedule-dialog";
import { MatchesBoard } from "@/components/matches/matches-board";
import { EmptyState } from "@/components/shared/empty-state";
import { buildBoardMatches } from "@/lib/competition-view";
import { getCompetition, getSchedulingData } from "@/lib/data/competition";
import { requireOrganizerTournament } from "@/lib/data/organizer";

export const metadata: Metadata = { title: "Partidos" };

/** Fixture con programación (automática y manual) y carga de resultados. */
export default async function MatchesPage({ params }: PageProps<"/torneos/[id]/partidos">) {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);
  const [competition, scheduling] = await Promise.all([getCompetition(tournament.id), getSchedulingData(tournament.id)]);

  if (competition.matches.length === 0) {
    return (
      <EmptyState
        icon={CalendarRange}
        title="Todavía no hay partidos"
        description="Se generan al confirmar los grupos (y después, al armar el cuadro de playoffs)."
      />
    );
  }

  const teamNames = new Map(competition.teams.map((t) => [t.id, t.name]));
  const courtNames = new Map(scheduling.courts.map((c) => [c.id, c.name]));
  const board = buildBoardMatches(
    competition.matches,
    competition.groups,
    teamNames,
    courtNames,
    competition.confirmations,
  );
  const canEdit = tournament.status === "group_stage" || tournament.status === "playoffs";
  const pending = board.filter((m) => !m.result && m.homeTeamId && m.awayTeamId);
  const unscheduled = pending.filter((m) => !m.slotId);

  return (
    <div className="space-y-4">
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <p className="text-sm text-muted-foreground">
          {pending.length === 0
            ? "Todos los partidos tienen resultado."
            : `${pending.length} partidos sin resultado · ${unscheduled.length} sin horario.`}
        </p>
        {canEdit && pending.length > 0 ? (
          <AutoScheduleDialog
            tournamentId={tournament.id}
            matchLabels={Object.fromEntries(board.map((m) => [m.id, `${m.homeName} vs ${m.awayName}`]))}
          />
        ) : null}
      </div>
      <MatchesBoard
        tournamentId={tournament.id}
        timezone={tournament.timezone}
        scoring={tournament.scoringConfig}
        matches={board}
        slots={scheduling.slots}
        courts={scheduling.courts}
        availability={scheduling.availability}
        canEdit={canEdit}
      />
    </div>
  );
}
