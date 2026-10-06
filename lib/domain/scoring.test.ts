import { describe, expect, it } from "vitest";
import {
  type GoalsScoringConfig,
  type SetsScoringConfig,
  evaluateResult,
  formatResult,
  matchResultSchema,
  resultTotals,
  scoringConfigSchema,
  walkoverResult,
} from "./scoring";

const padel: SetsScoringConfig = {
  type: "sets", bestOf: 3, gamesPerSet: 6, tiebreak: true, decidingSet: "super_tiebreak", superTiebreakPoints: 10, superTiebreakUntil: "quarterfinals",
};
const tennisFull: SetsScoringConfig = { ...padel, decidingSet: "full" };
const noTiebreak: SetsScoringConfig = { ...padel, tiebreak: false, decidingSet: "full" };
const football: GoalsScoringConfig = { type: "goals", playoffTiebreak: "penalties" };

const sets = (...scores: [number, number][]) => ({
  type: "sets" as const,
  sets: scores.map(([home, away]) => ({ home, away })),
});

describe("esquemas", () => {
  it("aceptan las configs por defecto de los deportes del catálogo", () => {
    expect(scoringConfigSchema.safeParse(padel).success).toBe(true);
    expect(scoringConfigSchema.safeParse(football).success).toBe(true);
    expect(scoringConfigSchema.safeParse({ ...padel, bestOf: 2 }).success).toBe(false);
  });

  it("validan la forma del resultado", () => {
    expect(matchResultSchema.safeParse(sets([6, 4], [6, 3])).success).toBe(true);
    expect(matchResultSchema.safeParse({ type: "sets", sets: [] }).success).toBe(false);
    expect(matchResultSchema.safeParse({ type: "goals", home: -1, away: 0 }).success).toBe(false);
  });
});

describe("sets", () => {
  it.each([
    [[6, 0], [6, 4]],
    [[7, 5], [6, 4]],
    [[7, 6], [7, 6]],
  ] as [number, number][][])("resultado válido en dos sets: %j", (...scores) => {
    expect(evaluateResult(padel, sets(...scores), "group")).toEqual({ ok: true, winner: "home" });
  });

  it("gana el visitante en tres sets con super tie-break", () => {
    expect(evaluateResult(padel, sets([6, 4], [3, 6], [8, 10]), "group")).toEqual({ ok: true, winner: "away" });
    expect(evaluateResult(padel, sets([6, 4], [3, 6], [12, 10]), "group")).toEqual({ ok: true, winner: "home" });
  });

  it.each([
    [[6, 5], [6, 4], "Set 1: 6-5 no es un resultado válido."],
    [[8, 6], [6, 4], "Set 1: 8-6 no es un resultado válido."],
    [[6, 6], [6, 4], "Set 1: 6-6 no es un resultado válido."],
  ] as [[number, number], [number, number], string][])("marcador de set inválido %j", (a, b, message) => {
    const evaluation = evaluateResult(padel, sets(a, b), "group");
    expect(evaluation.ok).toBe(false);
    expect(!evaluation.ok && evaluation.errors).toContain(message);
  });

  it.each([
    [[10, 9], "Super tie-break: 10-9 no es un resultado válido."],
    [[9, 7], "Super tie-break: 9-7 no es un resultado válido."],
    [[12, 9], "Super tie-break: 12-9 no es un resultado válido."],
  ] as [[number, number], string][])("super tie-break inválido %j", (tb, message) => {
    const evaluation = evaluateResult(padel, sets([6, 4], [4, 6], tb), "group");
    expect(!evaluation.ok && evaluation.errors).toContain(message);
  });

  it("en tenis el tercer set es un set normal", () => {
    expect(evaluateResult(tennisFull, sets([6, 4], [4, 6], [7, 5]), "group")).toEqual({ ok: true, winner: "home" });
    const evaluation = evaluateResult(tennisFull, sets([6, 4], [4, 6], [10, 8]), "group");
    expect(evaluation.ok).toBe(false);
  });

  it("sin tie-break se juega por dos de diferencia", () => {
    expect(evaluateResult(noTiebreak, sets([8, 6], [6, 4]), "group")).toEqual({ ok: true, winner: "home" });
    expect(evaluateResult(noTiebreak, sets([7, 6], [6, 4]), "group").ok).toBe(false);
  });

  it("detecta sets faltantes y sobrantes", () => {
    const missing = evaluateResult(padel, sets([6, 4], [4, 6]), "group");
    expect(!missing.ok && missing.errors).toContain("Faltan sets: gana quien llega a 2.");
    const extra = evaluateResult(padel, sets([6, 4], [6, 4], [6, 4]), "group");
    expect(!extra.ok && extra.errors[0]).toMatch(/sobra este set/);
    const tooMany = evaluateResult(padel, sets([6, 4], [4, 6], [10, 8], [6, 1]), "group");
    expect(!tooMany.ok && tooMany.errors).toContain("El partido es al mejor de 3 sets.");
  });

  it("al mejor de 1 y de 5", () => {
    expect(evaluateResult({ ...padel, bestOf: 1 }, sets([6, 2]), "group")).toEqual({ ok: true, winner: "home" });
    const bestOf5 = { ...tennisFull, bestOf: 5 as const };
    expect(evaluateResult(bestOf5, sets([6, 4], [4, 6], [6, 3], [3, 6], [7, 5]), "playoff")).toEqual({ ok: true, winner: "home" });
  });

  it("super tie-break a 11 puntos por defecto", () => {
    const padel11: SetsScoringConfig = { ...padel, superTiebreakPoints: 11 };
    expect(evaluateResult(padel11, sets([6, 4], [4, 6], [11, 9]), "group")).toEqual({ ok: true, winner: "home" });
    expect(evaluateResult(padel11, sets([6, 4], [4, 6], [11, 10]), "group").ok).toBe(false);
    expect(evaluateResult(padel11, sets([6, 4], [4, 6], [13, 11]), "group")).toEqual({ ok: true, winner: "home" });
  });

  describe("fases donde aplica super tie-break (superTiebreakUntil)", () => {
    const padelUntilQF: SetsScoringConfig = {
      ...padel,
      superTiebreakPoints: 11,
      superTiebreakUntil: "quarterfinals",
    };

    it("aplica super tie-break en grupos y en cuartos", () => {
      // Fase de grupos
      expect(evaluateResult(padelUntilQF, sets([6, 4], [4, 6], [11, 8]), { stage: "group" })).toEqual({
        ok: true,
        winner: "home",
      });

      // Cuartos de final (totalRounds = 3: R1 cuartos, R2 semis, R3 final)
      const qfContext = { stage: "playoff" as const, round: 1, totalRounds: 3, isThirdPlace: false };
      expect(evaluateResult(padelUntilQF, sets([6, 4], [4, 6], [11, 8]), qfContext)).toEqual({
        ok: true,
        winner: "home",
      });
    });

    it("en semifinales, final y 3er puesto exige 3er set completo y rechaza super tie-break", () => {
      const semiContext = { stage: "playoff" as const, round: 2, totalRounds: 3, isThirdPlace: false };
      const finalContext = { stage: "playoff" as const, round: 3, totalRounds: 3, isThirdPlace: false };
      const thirdPlaceContext = { stage: "playoff" as const, round: 2, totalRounds: 3, isThirdPlace: true };

      // Semifinales: set normal válido, super tie-break inválido
      expect(evaluateResult(padelUntilQF, sets([6, 4], [4, 6], [6, 3]), semiContext)).toEqual({
        ok: true,
        winner: "home",
      });
      expect(evaluateResult(padelUntilQF, sets([6, 4], [4, 6], [11, 8]), semiContext).ok).toBe(false);

      // Final
      expect(evaluateResult(padelUntilQF, sets([6, 4], [4, 6], [7, 5]), finalContext)).toEqual({
        ok: true,
        winner: "home",
      });
      expect(evaluateResult(padelUntilQF, sets([6, 4], [4, 6], [11, 8]), finalContext).ok).toBe(false);

      // 3er puesto
      expect(evaluateResult(padelUntilQF, sets([6, 4], [4, 6], [6, 2]), thirdPlaceContext)).toEqual({
        ok: true,
        winner: "home",
      });
      expect(evaluateResult(padelUntilQF, sets([6, 4], [4, 6], [11, 8]), thirdPlaceContext).ok).toBe(false);
    });

    it("superTiebreakUntil: 'all' mantiene super tie-break en la final", () => {
      const padelAll: SetsScoringConfig = { ...padel, superTiebreakPoints: 11, superTiebreakUntil: "all" };
      const finalContext = { stage: "playoff" as const, round: 3, totalRounds: 3, isThirdPlace: false };
      expect(evaluateResult(padelAll, sets([6, 4], [4, 6], [11, 7]), finalContext)).toEqual({
        ok: true,
        winner: "home",
      });
    });

    it("superTiebreakUntil: 'groups' solo aplica en grupos; cuartos ya es set completo", () => {
      const padelGroupsOnly: SetsScoringConfig = { ...padel, superTiebreakPoints: 11, superTiebreakUntil: "groups" };
      const qfContext = { stage: "playoff" as const, round: 1, totalRounds: 3, isThirdPlace: false };
      expect(evaluateResult(padelGroupsOnly, sets([6, 4], [4, 6], [11, 7]), qfContext).ok).toBe(false);
      expect(evaluateResult(padelGroupsOnly, sets([6, 4], [4, 6], [6, 4]), qfContext)).toEqual({
        ok: true,
        winner: "home",
      });
    });
  });

  it("rechaza un resultado de goles en un torneo de sets", () => {
    const evaluation = evaluateResult(padel, { type: "goals", home: 1, away: 0 }, "group");
    expect(!evaluation.ok && evaluation.errors[0]).toMatch(/no corresponde al deporte/);
  });
});

describe("goles", () => {
  it("victoria y empate en grupos", () => {
    expect(evaluateResult(football, { type: "goals", home: 2, away: 1 }, "group")).toEqual({ ok: true, winner: "home" });
    expect(evaluateResult(football, { type: "goals", home: 1, away: 1 }, "group")).toEqual({ ok: true, winner: null });
  });

  it("en playoffs el empate exige penales con ganador", () => {
    expect(evaluateResult(football, { type: "goals", home: 1, away: 1 }, "playoff").ok).toBe(false);
    expect(
      evaluateResult(football, { type: "goals", home: 1, away: 1, penalties: { home: 3, away: 3 } }, "playoff").ok,
    ).toBe(false);
    expect(
      evaluateResult(football, { type: "goals", home: 1, away: 1, penalties: { home: 3, away: 4 } }, "playoff"),
    ).toEqual({ ok: true, winner: "away" });
  });

  it("no acepta penales si no hubo empate o si es fase de grupos", () => {
    expect(evaluateResult(football, { type: "goals", home: 2, away: 1, penalties: { home: 1, away: 0 } }, "playoff").ok).toBe(false);
    expect(evaluateResult(football, { type: "goals", home: 1, away: 1, penalties: { home: 1, away: 0 } }, "group").ok).toBe(false);
  });
});

describe("walkoverResult", () => {
  it("sets: gana los sets necesarios G-0", () => {
    expect(walkoverResult(padel, "away")).toEqual(sets([0, 6], [0, 6]));
    expect(evaluateResult(padel, walkoverResult(padel, "home"), "group")).toEqual({ ok: true, winner: "home" });
  });

  it("goles: 3-0", () => {
    expect(walkoverResult(football, "home")).toEqual({ type: "goals", home: 3, away: 0 });
  });
});

describe("resultTotals y formatResult", () => {
  it("el super tie-break cuenta como set y como un único game", () => {
    expect(resultTotals(padel, sets([6, 4], [3, 6], [10, 8]))).toEqual({
      setsHome: 2, setsAway: 1, gamesHome: 10, gamesAway: 10, goalsHome: 0, goalsAway: 0,
    });
  });

  it("los penales no suman goles", () => {
    expect(resultTotals(football, { type: "goals", home: 1, away: 1, penalties: { home: 5, away: 4 } })).toMatchObject({
      goalsHome: 1, goalsAway: 1,
    });
  });

  it("formatea el marcador", () => {
    expect(formatResult(sets([6, 4], [3, 6], [10, 8]))).toBe("6-4 3-6 10-8");
    expect(formatResult({ type: "goals", home: 2, away: 2, penalties: { home: 4, away: 3 } })).toBe("2-2 (4-3 pen.)");
    expect(formatResult({ type: "goals", home: 1, away: 0 })).toBe("1-0");
  });
});

describe("generateSimulatedMatchResult", () => {
  it("genera resultados válidos evaluables por evaluateResult", async () => {
    const { generateSimulatedMatchResult } = await import("./scoring");
    for (let i = 0; i < 20; i++) {
      const { result, winner } = generateSimulatedMatchResult(padel, { stage: "group" });
      const evaluation = evaluateResult(padel, result, { stage: "group" });
      expect(evaluation.ok).toBe(true);
      if (evaluation.ok) {
        expect(evaluation.winner).toBe(winner);
      }
    }
  });
});

