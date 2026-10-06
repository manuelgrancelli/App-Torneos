import type { Metadata } from "next";
import { PageHeader } from "@/components/shared/page-header";
import type { SportOption } from "@/components/tournaments/tournament-form";
import { TournamentWizard } from "@/components/tournaments/tournament-wizard";
import { getSports } from "@/lib/data/tournaments";
import type { ScoringConfig } from "@/lib/domain/scoring";
import type { StandingsConfig } from "@/lib/domain/standings";

export const metadata: Metadata = { title: "Crear torneo" };

export default async function NewTournamentPage() {
  const sports = await getSports();
  const options: SportOption[] = sports.map((sport) => {
    const raw = sport.default_scoring_config as Record<string, unknown>;
    const defaultScoringConfig = (raw?.type === "sets"
      ? {
          ...raw,
          superTiebreakPoints: sport.id === "padel" && raw.superTiebreakPoints === 10 ? 11 : (raw.superTiebreakPoints ?? 11),
          superTiebreakUntil: raw.superTiebreakUntil ?? (sport.id === "padel" ? "quarterfinals" : "all"),
        }
      : raw) as ScoringConfig;

    return {
      id: sport.id,
      name: sport.name,
      minTeamSize: sport.min_team_size,
      defaultScoringConfig,
      defaultStandingsConfig: sport.default_standings_config as StandingsConfig,
    };
  });

  return (
    <div className="mx-auto max-w-2xl">
      <PageHeader title="Crear torneo" description="Te guiamos paso a paso. Son 4 pasos y podés volver cuando quieras." />
      {options.length > 0 ? (
        <TournamentWizard sports={options} />
      ) : (
        <p className="text-muted-foreground">No hay deportes configurados.</p>
      )}
    </div>
  );
}
