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

/**
 * Normaliza cualquier configuración de tabla de posiciones, incluso si proviene de
 * migraciones antiguas con campos planos ("pointsWin", "set_difference") o si es undefined/null.
 */
export function normalizeStandingsConfig(raw: unknown): StandingsConfig {
  const fallback: StandingsConfig = {
    points: { win: 2, draw: 1, loss: 0 },
    tiebreakers: ["points", "wins", "head_to_head", "set_diff", "game_diff"],
  };

  if (!raw || typeof raw !== "object") {
    return fallback;
  }

  const obj = raw as Record<string, unknown>;
  let points: { win: number; draw: number; loss: number } = fallback.points;

  if (obj.points && typeof obj.points === "object") {
    const p = obj.points as Record<string, unknown>;
    points = {
      win: typeof p.win === "number" ? p.win : fallback.points.win,
      draw: typeof p.draw === "number" ? p.draw : fallback.points.draw,
      loss: typeof p.loss === "number" ? p.loss : fallback.points.loss,
    };
  } else if ("pointsWin" in obj || "pointsLoss" in obj) {
    // Formato de migraciones previas con nombres planos (pointsWin, pointsDraw, pointsLoss)
    points = {
      win: typeof obj.pointsWin === "number" ? obj.pointsWin : fallback.points.win,
      draw: typeof obj.pointsDraw === "number" ? obj.pointsDraw : fallback.points.draw,
      loss: typeof obj.pointsLoss === "number" ? obj.pointsLoss : fallback.points.loss,
    };
  }

  let tiebreakers: readonly Tiebreaker[] = fallback.tiebreakers;
  if (Array.isArray(obj.tiebreakers) && obj.tiebreakers.length > 0) {
    const mapped = obj.tiebreakers
      .map((t) => {
        if (t === "set_difference") return "set_diff";
        if (t === "game_difference") return "game_diff";
        if (t === "goal_difference") return "goal_diff";
        return t;
      })
      .filter((t): t is Tiebreaker => TIEBREAKERS.includes(t as Tiebreaker));
    if (mapped.length > 0) {
      tiebreakers = mapped;
    }
  }

  return { points, tiebreakers: [...tiebreakers] };
}

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
  round?: number;
  position?: number;
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
  points?: StandingsConfig["points"],
): Map<string, Stats> {
  const pts = points && typeof points.win === "number" ? points : { win: 2, draw: 1, loss: 0 };
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
      home.points += pts.draw;
      away.points += pts.draw;
    } else {
      const [winner, loser] = match.winnerTeamId === home.teamId ? [home, away] : [away, home];
      winner.won++;
      loser.lost++;
      winner.points += pts.win;
      loser.points += pts.loss;
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
  const { teamIds, matches, scoring, config: rawConfig, seed } = input;
  const config = normalizeStandingsConfig(rawConfig);
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

  const isGsl4 =
    teamIds.length === 4 &&
    matches.length > 0 &&
    !matches.some((m) => (m.round ?? 0) >= 3) &&
    matches.some((m) => m.round !== undefined);

  let orderedTeamIds: string[];

  if (isGsl4) {
    const r1Matches = matches.filter((m) => m.round === 1);
    const r1_0 = matches.find((m) => m.round === 1 && m.position === 0) ?? r1Matches[0];
    const r1_1 = matches.find((m) => m.round === 1 && m.position === 1) ?? r1Matches[1];

    const getWinner = (m?: StandingsMatch) => (m && isDecided(m) ? m.winnerTeamId : null);
    const getLoser = (m?: StandingsMatch) => {
      if (!m || !isDecided(m) || !m.winnerTeamId) return null;
      return m.winnerTeamId === m.homeTeamId ? m.awayTeamId : m.homeTeamId;
    };

    const w0 = getWinner(r1_0);
    const l0 = getLoser(r1_0);
    const w1 = getWinner(r1_1);
    const l1 = getLoser(r1_1);

    if (w0 && l0 && w1 && l1) {
      // Ambos partidos de ronda 1 están resueltos
      const r2Matches = matches.filter((m) => m.round === 2);
      const r2_0 =
        matches.find((m) => m.round === 2 && m.position === 0) ??
        r2Matches.find(
          (m) => (m.homeTeamId === w0 || m.homeTeamId === w1) && (m.awayTeamId === w0 || m.awayTeamId === w1),
        );
      const r2_1 =
        matches.find((m) => m.round === 2 && m.position === 1) ??
        r2Matches.find(
          (m) => (m.homeTeamId === l0 || m.homeTeamId === l1) && (m.awayTeamId === l0 || m.awayTeamId === l1),
        );

      // Rama superior: ganadores de ronda 1 definen 1° y 2° puesto
      let upper: string[];
      const r2_0_win = getWinner(r2_0);
      const r2_0_lose = getLoser(r2_0);
      if (r2_0_win && r2_0_lose) {
        upper = [r2_0_win, r2_0_lose];
      } else {
        upper = rank([w0, w1], criteria);
      }

      // Rama inferior: perdedores de ronda 1 definen 3° puesto (clasifica) y 4° (eliminado)
      let lower: string[];
      const r2_1_win = getWinner(r2_1);
      const r2_1_lose = getLoser(r2_1);
      if (r2_1_win && r2_1_lose) {
        lower = [r2_1_win, r2_1_lose];
      } else {
        lower = rank([l0, l1], criteria);
      }

      orderedTeamIds = [...upper, ...lower];
    } else {
      orderedTeamIds = rank([...teamIds], criteria);
    }
  } else {
    orderedTeamIds = rank([...teamIds], criteria);
  }

  return orderedTeamIds.map((teamId, index) => ({
    ...(table.get(teamId) as Stats),
    position: index + 1,
    decidedByLottery: lottery.has(teamId),
  }));
}

