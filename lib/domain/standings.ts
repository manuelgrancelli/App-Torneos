import { z } from "zod";
import { hashString } from "./random";
import { type MatchResult, type ScoringConfig, resultTotals } from "./scoring";

/**
 * Tabla de posiciones de un grupo con puntos y criterios de desempate
 * configurables (tournaments.standings_config).
 *
 * Desempate: los criterios se aplican en orden sobre cada subgrupo de
 * empatados; "head_to_head" se recalcula solo entre los equipos todavía
 * empatados (mini-liga, sirve para triples empates). Si al final siguen
 * empatados, decide un sorteo determinístico con la semilla del grupo.
 */

export const TIEBREAKERS = [
  "points", "wins", "head_to_head", "set_diff", "game_diff", "sets_won", "games_won", "goal_diff", "goals_for",
] as const;
export type Tiebreaker = (typeof TIEBREAKERS)[number];

export const SETS_TIEBREAKERS: readonly Tiebreaker[] = ["points", "wins", "head_to_head", "set_diff", "game_diff", "sets_won", "games_won"];
export const GOALS_TIEBREAKERS: readonly Tiebreaker[] = ["points", "wins", "head_to_head", "goal_diff", "goals_for"];

export const standingsConfigSchema = z.object({
  points: z.object({
    win: z.number().int().min(0).max(10),
    draw: z.number().int().min(0).max(10),
    loss: z.number().int().min(0).max(10),
  }),
  tiebreakers: z
    .array(z.enum(TIEBREAKERS))
    .min(1)
    .max(TIEBREAKERS.length)
    .refine((list) => new Set(list).size === list.length, { error: "No repitas criterios de desempate." }),
});

export type StandingsConfig = z.infer<typeof standingsConfigSchema>;

/** Valida la configuración y que los criterios correspondan al deporte. */
export function validateStandingsConfig(
  config: unknown,
  scoringType: ScoringConfig["type"],
): { ok: true; config: StandingsConfig } | { ok: false; errors: string[] } {
  const parsed = standingsConfigSchema.safeParse(config);
  if (!parsed.success) return { ok: false, errors: parsed.error.issues.map((issue) => issue.message) };
  const allowed = tiebreakersFor(scoringType);
  const invalid = parsed.data.tiebreakers.filter((criterion) => !allowed.includes(criterion));
  if (invalid.length > 0) {
    return {
      ok: false,
      errors: invalid.map((criterion) => `"${TIEBREAKER_LABELS[criterion]}" no aplica a este deporte.`),
    };
  }
  return { ok: true, config: parsed.data };
}

export const TIEBREAKER_LABELS: Record<Tiebreaker, string> = {
  points: "Puntos",
  wins: "Partidos ganados",
  head_to_head: "Enfrentamiento directo",
  set_diff: "Diferencia de sets",
  game_diff: "Diferencia de games",
  sets_won: "Sets ganados",
  games_won: "Games ganados",
  goal_diff: "Diferencia de gol",
  goals_for: "Goles a favor",
};

/** Criterios válidos según el sistema de puntuación del deporte. */
export function tiebreakersFor(scoringType: ScoringConfig["type"]): readonly Tiebreaker[] {
  return scoringType === "sets" ? SETS_TIEBREAKERS : GOALS_TIEBREAKERS;
}

export type StandingsMatch = {
  homeTeamId: string;
  awayTeamId: string;
  /** null + isDraw=false = partido sin resultado (no cuenta). */
  winnerTeamId: string | null;
  isDraw: boolean;
  result: MatchResult | null;
};

export type StandingRow = {
  teamId: string;
  position: number;
  played: number;
  won: number;
  drawn: number;
  lost: number;
  points: number;
  setsFor: number;
  setsAgainst: number;
  gamesFor: number;
  gamesAgainst: number;
  goalsFor: number;
  goalsAgainst: number;
  /** true si su posición la definió el sorteo final (empate total). */
  decidedByLottery: boolean;
};

type Stats = Omit<StandingRow, "position" | "decidedByLottery">;

function emptyStats(teamId: string): Stats {
  return {
    teamId, played: 0, won: 0, drawn: 0, lost: 0, points: 0,
    setsFor: 0, setsAgainst: 0, gamesFor: 0, gamesAgainst: 0, goalsFor: 0, goalsAgainst: 0,
  };
}

function isDecided(match: StandingsMatch): boolean {
  return match.isDraw || match.winnerTeamId !== null;
}

function accumulate(
  teamIds: readonly string[],
  matches: readonly StandingsMatch[],
  scoring: ScoringConfig,
  points: StandingsConfig["points"],
): Map<string, Stats> {
  const table = new Map(teamIds.map((id) => [id, emptyStats(id)]));

  for (const match of matches) {
    const home = table.get(match.homeTeamId);
    const away = table.get(match.awayTeamId);
    if (!home || !away || !isDecided(match)) continue;

    home.played++;
    away.played++;
    if (match.isDraw) {
      home.drawn++;
      away.drawn++;
      home.points += points.draw;
      away.points += points.draw;
    } else {
      const [winner, loser] = match.winnerTeamId === home.teamId ? [home, away] : [away, home];
      winner.won++;
      loser.lost++;
      winner.points += points.win;
      loser.points += points.loss;
    }

    if (match.result) {
      const totals = resultTotals(scoring, match.result);
      home.setsFor += totals.setsHome;
      home.setsAgainst += totals.setsAway;
      away.setsFor += totals.setsAway;
      away.setsAgainst += totals.setsHome;
      home.gamesFor += totals.gamesHome;
      home.gamesAgainst += totals.gamesAway;
      away.gamesFor += totals.gamesAway;
      away.gamesAgainst += totals.gamesHome;
      home.goalsFor += totals.goalsHome;
      home.goalsAgainst += totals.goalsAway;
      away.goalsFor += totals.goalsAway;
      away.goalsAgainst += totals.goalsHome;
    }
  }
  return table;
}

function criterionValue(criterion: Tiebreaker, stats: Stats): number {
  switch (criterion) {
    case "points": return stats.points;
    case "wins": return stats.won;
    case "set_diff": return stats.setsFor - stats.setsAgainst;
    case "game_diff": return stats.gamesFor - stats.gamesAgainst;
    case "sets_won": return stats.setsFor;
    case "games_won": return stats.gamesFor;
    case "goal_diff": return stats.goalsFor - stats.goalsAgainst;
    case "goals_for": return stats.goalsFor;
    case "head_to_head": return 0; // se calcula aparte (depende del subgrupo)
  }
}

export type StandingsInput = {
  teamIds: readonly string[];
  matches: readonly StandingsMatch[];
  scoring: ScoringConfig;
  config: StandingsConfig;
  /** tournament_groups.tiebreak_seed: define el sorteo final. */
  seed: number;
};

export function computeStandings(input: StandingsInput): StandingRow[] {
  const { teamIds, matches, scoring, config, seed } = input;
  const table = accumulate(teamIds, matches, scoring, config.points);
  // Criterios que no aplican al deporte se ignoran (la config se valida al guardarla).
  const criteria = config.tiebreakers.filter((c) => tiebreakersFor(scoring.type).includes(c));
  const lottery = new Set<string>();

  // Puntos del enfrentamiento directo entre los equipos de `subset`.
  const headToHead = (subset: readonly string[]): Map<string, number> => {
    const inSubset = new Set(subset);
    const miniMatches = matches.filter((m) => inSubset.has(m.homeTeamId) && inSubset.has(m.awayTeamId));
    const mini = accumulate(subset, miniMatches, scoring, config.points);
    return new Map(subset.map((id) => [id, mini.get(id)?.points ?? 0]));
  };

  const rank = (subset: readonly string[], remaining: readonly Tiebreaker[]): string[] => {
    if (subset.length <= 1) return [...subset];
    const [criterion, ...rest] = remaining;

    if (!criterion) {
      // Empate total: sorteo reproducible.
      subset.forEach((id) => lottery.add(id));
      return [...subset].sort((a, b) => hashString(`${seed}:${a}`) - hashString(`${seed}:${b}`) || a.localeCompare(b));
    }

    const h2h = criterion === "head_to_head" ? headToHead(subset) : null;
    const value = (id: string) =>
      h2h ? (h2h.get(id) ?? 0) : criterionValue(criterion, table.get(id) as Stats);

    // Agrupar por valor (de mayor a menor) y desempatar cada grupo con el resto de criterios.
    const buckets = new Map<number, string[]>();
    for (const id of subset) {
      const key = value(id);
      buckets.set(key, [...(buckets.get(key) ?? []), id]);
    }
    return [...buckets.entries()]
      .sort(([a], [b]) => b - a)
      .flatMap(([, ids]) => rank(ids, rest));
  };

  return rank([...teamIds], criteria).map((teamId, index) => ({
    ...(table.get(teamId) as Stats),
    position: index + 1,
    decidedByLottery: lottery.has(teamId),
  }));
}
