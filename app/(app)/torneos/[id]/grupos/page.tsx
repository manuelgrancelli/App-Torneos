import { LayoutGrid } from "lucide-react";
import type { Metadata } from "next";
import { GroupBuilder } from "@/components/groups/group-builder";
import { StandingsTable } from "@/components/groups/standings-table";
import { EmptyState } from "@/components/shared/empty-state";
import { groupStandings } from "@/lib/competition-view";
import { getCompetition } from "@/lib/data/competition";
import { requireOrganizerTournament } from "@/lib/data/organizer";

export const metadata: Metadata = { title: "Grupos" };

/** Armado de grupos (mientras no haya resultados) y tablas de posiciones. */
export default async function GroupsPage({ params }: PageProps<"/torneos/[id]/grupos">) {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);

  if (tournament.status === "draft" || tournament.status === "registration_open") {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="Los grupos se arman al cerrar la inscripción"
        description="Desde el resumen, cerrá la inscripción y empezá la fase de grupos: ahí podés sortearlos."
      />
    );
  }

  const competition = await getCompetition(tournament.id);
  const approved = competition.teams.filter((t) => t.status === "approved");
  const teamNames = new Map(competition.teams.map((t) => [t.id, t.name]));
  const hasResults = competition.matches.some((m) => m.resultStatus !== null);
  const canEdit = tournament.status === "group_stage" && !hasResults;
  const standings = groupStandings(
    competition.groups,
    competition.matches,
    tournament.scoringConfig,
    tournament.standingsConfig,
  );

  return (
    <div className="space-y-6">
      {canEdit ? (
        <GroupBuilder
          tournamentId={tournament.id}
          teams={approved.map((t) => ({ id: t.id, name: t.name }))}
          initialGroups={competition.groups.map((g) => g.teamIds)}
        />
      ) : null}

      {standings.length > 0 ? (
        <section aria-labelledby="posiciones" className="space-y-3">
          <h2 id="posiciones" className="text-lg font-semibold">
            Posiciones
          </h2>
          {hasResults && tournament.status === "group_stage" ? (
            <p className="text-sm text-muted-foreground">
              Ya hay resultados cargados: los grupos no se pueden rearmar.
            </p>
          ) : null}
          <div className="grid gap-4 lg:grid-cols-2">
            {standings.map(({ group, rows }) => (
              <StandingsTable
                key={group.id}
                title={group.name}
                rows={rows}
                teamNames={teamNames}
                scoringType={tournament.scoringConfig.type}
                qualifiers={tournament.playoffConfig.qualifiersPerGroup}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
