import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import { type SportOption, TournamentForm } from "@/components/tournaments/tournament-form";
import { getSports } from "@/lib/data/tournaments";
import type { ScoringConfig } from "@/lib/domain/scoring";
import type { StandingsConfig } from "@/lib/domain/standings";

export const metadata: Metadata = { title: "Crear torneo" };

export default async function NewTournamentPage() {
  const sports = await getSports();
  const options: SportOption[] = sports.map((sport) => ({
    id: sport.id,
    name: sport.name,
    minTeamSize: sport.min_team_size,
    defaultScoringConfig: sport.default_scoring_config as ScoringConfig,
    defaultStandingsConfig: sport.default_standings_config as StandingsConfig,
  }));

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Crear torneo" description="Podés cambiar todo esto después, mientras el torneo no empiece." />
      {options.length > 0 ? (
        <TournamentForm mode="create" sports={options} />
      ) : (
        <p className="text-muted-foreground">No hay deportes configurados.</p>
      )}
    </div>
  );
}
