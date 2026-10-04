import { z } from "zod";

/**
 * Puntuación: esquemas de configuración y de resultados (contrato JSON de
 * docs/PROYECTO.md §7), validación de marcadores y totales para la tabla.
 */

// -----------------------------------------------------------------------------
// Configuración
// -----------------------------------------------------------------------------

export const setsScoringConfigSchema = z.object({
  type: z.literal("sets"),
  /** Partido al mejor de N sets. */
  bestOf: z.union([z.literal(1), z.literal(3), z.literal(5)]),
  /** Games para ganar un set (6 normal, 4 set corto, 9 pro set). */
  gamesPerSet: z.number().int().min(2).max(9),
  /** Con tie-break el set termina G+1 a G (7-6); sin tie-break se juega por diferencia de 2. */
  tiebreak: z.boolean(),
  /** El set decisivo puede ser un set normal o un super tie-break a puntos. */
  decidingSet: z.enum(["full", "super_tiebreak"]),
  superTiebreakPoints: z.union([z.literal(7), z.literal(10)]),
});

export const goalsScoringConfigSchema = z.object({
  type: z.literal("goals"),
  /** En playoffs un empate se define por penales. */
  playoffTiebreak: z.literal("penalties"),
});

export const scoringConfigSchema = z.discriminatedUnion("type", [
  setsScoringConfigSchema,
  goalsScoringConfigSchema,
]);

export type SetsScoringConfig = z.infer<typeof setsScoringConfigSchema>;
export type GoalsScoringConfig = z.infer<typeof goalsScoringConfigSchema>;
export type ScoringConfig = z.infer<typeof scoringConfigSchema>;

// -----------------------------------------------------------------------------
// Resultados (matches.result)
// -----------------------------------------------------------------------------

const scoreSchema = z.number().int().min(0).max(99);
const sidesSchema = z.object({ home: scoreSchema, away: scoreSchema });

export const setsResultSchema = z.object({
  type: z.literal("sets"),
  sets: z.array(sidesSchema).min(1).max(5),
});

export const goalsResultSchema = z.object({
  type: z.literal("goals"),
  home: scoreSchema,
  away: scoreSchema,
  penalties: sidesSchema.optional(),
});

export const matchResultSchema = z.discriminatedUnion("type", [setsResultSchema, goalsResultSchema]);

export type SetScore = z.infer<typeof sidesSchema>;
export type SetsResult = z.infer<typeof setsResultSchema>;
export type GoalsResult = z.infer<typeof goalsResultSchema>;
export type MatchResult = z.infer<typeof matchResultSchema>;

export type Side = "home" | "away";
export type MatchStage = "group" | "playoff";

export type ResultEvaluation =
  | { ok: true; winner: Side | null }
  | { ok: false; errors: string[] };

// -----------------------------------------------------------------------------
// Validación
// -----------------------------------------------------------------------------

/** Sets necesarios para ganar el partido (2 de 3, 3 de 5...). */
export function setsToWin(config: SetsScoringConfig): number {
  return Math.ceil(config.bestOf / 2);
}

/** ¿El set número `index` (base 0) es el decisivo y se juega como super tie-break? */
export function isSuperTiebreakSet(config: SetsScoringConfig, index: number): boolean {
  return config.decidingSet === "super_tiebreak" && config.bestOf > 1 && index === config.bestOf - 1;
}

/** Valida un set de games. Devuelve el ganador o null si el marcador es imposible. */
function gameSetWinner(config: SetsScoringConfig, set: SetScore): Side | null {
  const { gamesPerSet: g } = config;
  const high = Math.max(set.home, set.away);
  const low = Math.min(set.home, set.away);
  const winner: Side = set.home > set.away ? "home" : "away";
  if (high === low) return null;

  // 6-0 … 6-4
  if (high === g && low <= g - 2) return winner;
  if (config.tiebreak) {
    // 7-5 o 7-6 (tie-break)
    if (high === g + 1 && (low === g - 1 || low === g)) return winner;
    return null;
  }
  // Sin tie-break: se sigue hasta sacar 2 de diferencia (7-5, 8-6, 9-7…).
  if (high > g && low >= g - 1 && high - low === 2) return winner;
  return null;
}

/** Super tie-break a P puntos con diferencia de 2 (10-8, 11-9, 12-10…). */
function superTiebreakWinner(points: number, set: SetScore): Side | null {
  const high = Math.max(set.home, set.away);
  const low = Math.min(set.home, set.away);
  const winner: Side = set.home > set.away ? "home" : "away";
  if (high < points || high - low < 2) return null;
  if (high > points && high - low !== 2) return null;
  return winner;
}

function formatSet(set: SetScore): string {
  return `${set.home}-${set.away}`;
}

export function evaluateSetsResult(config: SetsScoringConfig, result: SetsResult): ResultEvaluation {
  const errors: string[] = [];
  const needed = setsToWin(config);
  let home = 0;
  let away = 0;

  result.sets.forEach((set, index) => {
    const label = isSuperTiebreakSet(config, index) ? "Super tie-break" : `Set ${index + 1}`;
    if (home === needed || away === needed) {
      errors.push(`${label}: el partido ya estaba definido, sobra este set.`);
      return;
    }
    const winner = isSuperTiebreakSet(config, index)
      ? superTiebreakWinner(config.superTiebreakPoints, set)
      : gameSetWinner(config, set);
    if (!winner) {
      errors.push(`${label}: ${formatSet(set)} no es un resultado válido.`);
      return;
    }
    if (winner === "home") home++;
    else away++;
  });

  if (errors.length === 0 && home < needed && away < needed) {
    errors.push(`Faltan sets: gana quien llega a ${needed}.`);
  }
  if (result.sets.length > config.bestOf) {
    errors.push(`El partido es al mejor de ${config.bestOf} sets.`);
  }

  if (errors.length > 0) return { ok: false, errors: [...new Set(errors)] };
  return { ok: true, winner: home > away ? "home" : "away" };
}

export function evaluateGoalsResult(result: GoalsResult, stage: MatchStage): ResultEvaluation {
  const tied = result.home === result.away;

  if (!tied) {
    if (result.penalties) {
      return { ok: false, errors: ["Los penales solo se cargan si el partido terminó empatado."] };
    }
    return { ok: true, winner: result.home > result.away ? "home" : "away" };
  }

  if (stage === "group") {
    if (result.penalties) {
      return { ok: false, errors: ["En la fase de grupos no hay definición por penales."] };
    }
    return { ok: true, winner: null };
  }

  // Playoffs: el empate se define por penales.
  if (!result.penalties) {
    return { ok: false, errors: ["En playoffs un empate se define por penales: cargá el resultado de los penales."] };
  }
  if (result.penalties.home === result.penalties.away) {
    return { ok: false, errors: ["Los penales no pueden terminar empatados."] };
  }
  return { ok: true, winner: result.penalties.home > result.penalties.away ? "home" : "away" };
}

/**
 * Valida un resultado contra la configuración del torneo y devuelve el
 * ganador (`null` = empate, solo posible en grupos con goles).
 */
export function evaluateResult(config: ScoringConfig, result: MatchResult, stage: MatchStage): ResultEvaluation {
  if (config.type !== result.type) {
    return { ok: false, errors: ["El tipo de resultado no corresponde al deporte del torneo."] };
  }
  if (config.type === "sets" && result.type === "sets") return evaluateSetsResult(config, result);
  if (result.type === "goals") return evaluateGoalsResult(result, stage);
  return { ok: false, errors: ["Resultado inválido."] };
}

/**
 * Resultado de un W.O.: el marcador ganador mínimo (D-011).
 * Sets: gana todos los sets necesarios G-0. Goles: 3-0.
 */
export function walkoverResult(config: ScoringConfig, winner: Side): MatchResult {
  const pick = (winning: number): SetScore =>
    winner === "home" ? { home: winning, away: 0 } : { home: 0, away: winning };

  if (config.type === "goals") {
    return { type: "goals", ...pick(3) };
  }
  return {
    type: "sets",
    sets: Array.from({ length: setsToWin(config) }, () => pick(config.gamesPerSet)),
  };
}

// -----------------------------------------------------------------------------
// Totales para la tabla de posiciones
// -----------------------------------------------------------------------------

export type ResultTotals = {
  setsHome: number;
  setsAway: number;
  gamesHome: number;
  gamesAway: number;
  goalsHome: number;
  goalsAway: number;
};

/**
 * Totales de un resultado ya validado. Convención: el super tie-break cuenta
 * como un set ganado y como un único game (1-0), no por sus puntos. Los
 * penales no suman goles.
 */
export function resultTotals(config: ScoringConfig, result: MatchResult): ResultTotals {
  const totals: ResultTotals = { setsHome: 0, setsAway: 0, gamesHome: 0, gamesAway: 0, goalsHome: 0, goalsAway: 0 };

  if (result.type === "goals") {
    totals.goalsHome = result.home;
    totals.goalsAway = result.away;
    return totals;
  }

  result.sets.forEach((set, index) => {
    const homeWon = set.home > set.away;
    if (homeWon) totals.setsHome++;
    else totals.setsAway++;

    if (config.type === "sets" && isSuperTiebreakSet(config, index)) {
      if (homeWon) totals.gamesHome++;
      else totals.gamesAway++;
    } else {
      totals.gamesHome += set.home;
      totals.gamesAway += set.away;
    }
  });
  return totals;
}

/** Texto corto del marcador: "6-4 3-6 10-8" o "2-2 (4-3 pen.)". */
export function formatResult(result: MatchResult): string {
  if (result.type === "goals") {
    const base = `${result.home}-${result.away}`;
    return result.penalties ? `${base} (${result.penalties.home}-${result.penalties.away} pen.)` : base;
  }
  return result.sets.map(formatSet).join(" ");
}
