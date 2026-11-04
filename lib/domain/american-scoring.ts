/**
 * Módulo de validación de tanteadores para Torneos Americanos de Pádel.
 * Contempla:
 * 1. fixed_points (a 24, 16 o 32 puntos): la suma de ambos lados debe sumar los puntos pactados
 *    (ej. 14-10 = 24) o el ganador debe alcanzar los puntos pactados (ej. 24-18).
 * 2. single_set (a 1 set clásico): un set debe completarse reglamentariamente (6-0 a 6-4, 7-5 o 7-6).
 * 3. timed_round (tiempo corrido): partidos por reloj donde no pueden ser ambos 0.
 */

export type AmericanScoreValidation = {
  valid: boolean;
  error?: string;
  helper?: string;
};

export type AmericanScoreValidationOptions = {
  scoringMode?: "fixed_points" | "timed_round" | "single_set";
  targetPoints?: number;
};

/**
 * Valida si un tanteador es reglamentario según la modalidad del Torneo Americano.
 */
export function validateAmericanScore(
  scoreA: number | null | undefined,
  scoreB: number | null | undefined,
  options: AmericanScoreValidationOptions = {}
): AmericanScoreValidation {
  if (scoreA === null || scoreA === undefined || scoreB === null || scoreB === undefined) {
    return { valid: false, error: "Debés ingresar ambos tanteadores." };
  }

  if (Number.isNaN(scoreA) || Number.isNaN(scoreB)) {
    return { valid: false, error: "Los marcadores deben ser números válidos." };
  }

  if (!Number.isInteger(scoreA) || !Number.isInteger(scoreB) || scoreA < 0 || scoreB < 0) {
    return { valid: false, error: "Los marcadores deben ser números enteros no negativos (0 o más)." };
  }

  const mode = options.scoringMode ?? "fixed_points";
  const target = options.targetPoints || 24;

  if (mode === "fixed_points") {
    const sum = scoreA + scoreB;
    const isExactSum = sum === target;
    const isFirstToTarget =
      (scoreA === target && scoreB < target) || (scoreB === target && scoreA < target);

    if (isExactSum) {
      return {
        valid: true,
        helper: `Marcador reglamentario: ${scoreA} + ${scoreB} = ${target} puntos pactados.`,
      };
    }

    if (isFirstToTarget) {
      const winner = Math.max(scoreA, scoreB);
      const loser = Math.min(scoreA, scoreB);
      return {
        valid: true,
        helper: `Ganador a ${target} puntos (${winner}-${loser}).`,
      };
    }

    return {
      valid: false,
      error: `Para un torneo a ${target} puntos, la suma debe ser exactamente ${target} (ej. ${Math.ceil(target / 2)}-${Math.floor(target / 2)}) o el ganador debe llegar a ${target}.`,
    };
  }

  if (mode === "single_set") {
    const high = Math.max(scoreA, scoreB);
    const low = Math.min(scoreA, scoreB);

    if (high === low) {
      return {
        valid: false,
        error: "Un set no puede terminar empatado. Debe haber una pareja ganadora (ej. 7-6 en tie-break).",
      };
    }

    // Set normal a 6 games (6-0 a 6-4, 7-5, 7-6)
    const isStandardSet =
      (high === 6 && low <= 4) || (high === 7 && (low === 5 || low === 6));

    // Set corto a 4 games (4-0 a 4-2, 5-3, 5-4)
    const isShortSet =
      (high === 4 && low <= 2) || (high === 5 && (low === 3 || low === 4));

    if (isStandardSet || isShortSet) {
      const diff = high - low;
      return {
        valid: true,
        helper: `Set reglamentario válido (${high}-${low} · Diferencia: +${diff} games).`,
      };
    }

    return {
      valid: false,
      error: "Un set reglamentario debe terminar 6-0 a 6-4, 7-5 o 7-6 (ej. 6-3).",
    };
  }

  // mode === "timed_round"
  if (scoreA === 0 && scoreB === 0) {
    return {
      valid: false,
      error: "Al menos uno de los lados debe tener puntos o games anotados.",
    };
  }

  return {
    valid: true,
    helper: `Puntuación por tiempo: ${scoreA}-${scoreB}.`,
  };
}

