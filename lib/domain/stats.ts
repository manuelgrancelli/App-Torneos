/**
 * Historial y estadísticas del participante ("Mi historial"). Recibe filas de
 * la vista v_my_matches (partidos del usuario, sin byes).
 */

export type Outcome = "win" | "loss" | "draw";

export type HistoryMatch = {
  matchId: string;
  tournamentId: string;
  sportId: string;
  /** null = partido todavía sin resultado. */
  outcome: Outcome | null;
};

export type HistoryFilters = {
  tournamentId?: string;
  sportId?: string;
  outcome?: Outcome;
};

export type PlayerStats = {
  played: number;
  won: number;
  drawn: number;
  lost: number;
  /** Porcentaje de victorias sobre partidos jugados (0–100, 1 decimal). */
  winRate: number;
  /** Torneos con al menos un partido jugado. */
  tournaments: number;
  titles: number;
};

export function filterHistory<T extends HistoryMatch>(matches: readonly T[], filters: HistoryFilters): T[] {
  return matches.filter(
    (match) =>
      (!filters.tournamentId || match.tournamentId === filters.tournamentId) &&
      (!filters.sportId || match.sportId === filters.sportId) &&
      (!filters.outcome || match.outcome === filters.outcome),
  );
}

/**
 * Estadísticas sobre los partidos con resultado. `championTournamentIds` son
 * los torneos donde el equipo del usuario salió campeón.
 */
export function computePlayerStats(
  matches: readonly HistoryMatch[],
  championTournamentIds: readonly string[] = [],
): PlayerStats {
  const played = matches.filter((match) => match.outcome !== null);
  const won = played.filter((match) => match.outcome === "win").length;
  const drawn = played.filter((match) => match.outcome === "draw").length;
  const lost = played.filter((match) => match.outcome === "loss").length;

  return {
    played: played.length,
    won,
    drawn,
    lost,
    winRate: played.length === 0 ? 0 : Math.round((won / played.length) * 1000) / 10,
    tournaments: new Set(played.map((match) => match.tournamentId)).size,
    titles: new Set(championTournamentIds).size,
  };
}
