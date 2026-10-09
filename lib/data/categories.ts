import "server-only";
import { cache } from "react";
import type { PlayoffConfig } from "@/lib/domain/bracket";
import type { ScoringConfig } from "@/lib/domain/scoring";
import type { StandingsConfig } from "@/lib/domain/standings";
import type { TournamentStatus } from "@/lib/domain/tournament-status";
import { createClient } from "@/lib/supabase/server";

export type TournamentCategory = {
  id: string;
  tournamentId: string;
  name: string;
  position: number;
  status: TournamentStatus;
  maxTeams: number;
  scoringConfig: ScoringConfig;
  standingsConfig: StandingsConfig;
  playoffConfig: PlayoffConfig;
  championTeamId: string | null;
  approvedTeamsCount: number;
  totalTeamsCount: number;
};

/** Categorías del torneo ordenadas por posición. */
export const getTournamentCategories = cache(async (tournamentId: string): Promise<TournamentCategory[]> => {
  const supabase = await createClient();
  const { data, error } = await (supabase as any)
    .from("tournament_categories")
    .select(
      "id, tournament_id, name, position, status, max_teams, scoring_config, standings_config, playoff_config, champion_team_id, teams:teams!teams_category_id_fkey(id, status)"
    )
    .eq("tournament_id", tournamentId)
    .order("position");

  if (error) {
    console.error("[getTournamentCategories] error with teams embed:", error);
    // Fallback: intentar consultar sin el embed de teams por si hay problemas de relación
    const { data: fallbackData, error: fallbackError } = await (supabase as any)
      .from("tournament_categories")
      .select(
        "id, tournament_id, name, position, status, max_teams, scoring_config, standings_config, playoff_config, champion_team_id"
      )
      .eq("tournament_id", tournamentId)
      .order("position");

    if (fallbackError || !fallbackData) {
      console.error("[getTournamentCategories] fallback error:", fallbackError);
      return [];
    }

    return fallbackData.map((row: any) => ({
      id: row.id,
      tournamentId: row.tournament_id,
      name: row.name,
      position: row.position,
      status: row.status as TournamentStatus,
      maxTeams: row.max_teams,
      scoringConfig: row.scoring_config as ScoringConfig,
      standingsConfig: row.standings_config as StandingsConfig,
      playoffConfig: row.playoff_config as PlayoffConfig,
      championTeamId: row.champion_team_id,
      approvedTeamsCount: 0,
      totalTeamsCount: 0,
    }));
  }

  return (data ?? []).map((row: any) => {
    const teams = Array.isArray(row.teams) ? row.teams : [];
    return {
      id: row.id,
      tournamentId: row.tournament_id,
      name: row.name,
      position: row.position,
      status: row.status as TournamentStatus,
      maxTeams: row.max_teams,
      scoringConfig: row.scoring_config as ScoringConfig,
      standingsConfig: row.standings_config as StandingsConfig,
      playoffConfig: row.playoff_config as PlayoffConfig,
      championTeamId: row.champion_team_id,
      approvedTeamsCount: teams.filter((t: any) => t.status === "approved").length,
      totalTeamsCount: teams.length,
    };
  });
});
