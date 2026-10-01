import { describe, expect, it } from "vitest";
import type { GoalsScoringConfig, SetsScoringConfig } from "./scoring";
import { type StandingsConfig, type StandingsMatch, computeStandings, validateStandingsConfig } from "./standings";

const padel: SetsScoringConfig = {
  type: "sets", bestOf: 3, gamesPerSet: 6, tiebreak: true, decidingSet: "super_tiebreak", superTiebreakPoints: 10,
};
const football: GoalsScoringConfig = { type: "goals", playoffTiebreak: "penalties" };
const setsConfig: StandingsConfig = {
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ["points", "head_to_head", "set_diff", "game_diff", "games_won"],
};
const goalsConfig: StandingsConfig = {
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ["points", "goal_diff", "goals_for", "head_to_head"],
};

/** Partido de sets con ganador calculado del marcador. */
function setsMatch(home: string, away: string, ...scores: [number, number][]): StandingsMatch {
  const homeSets = scores.filter(([h, a]) => h > a).length;
  const awaySets = scores.length - homeSets;
  return {
    homeTeamId: home,
    awayTeamId: away,
    winnerTeamId: homeSets > awaySets ? home : away,
    isDraw: false,
    result: { type: "sets", sets: scores.map(([h, a]) => ({ home: h, away: a })) },
  };
}

function goalsMatch(home: string, away: string, h: number, a: number): StandingsMatch {
  return {
    homeTeamId: home,
    awayTeamId: away,
    winnerTeamId: h === a ? null : h > a ? home : away,
    isDraw: h === a,
    result: { type: "goals", home: h, away: a },
  };
}

const order = (rows: { teamId: string }[]) => rows.map((r) => r.teamId);

describe("computeStandings", () => {
  it("suma puntos, sets y games", () => {
    const rows = computeStandings({
      teamIds: ["A", "B", "C"],
      matches: [setsMatch("A", "B", [6, 4], [6, 4]), setsMatch("B", "C", [6, 4], [3, 6], [10, 8])],
      scoring: padel,
      config: setsConfig,
      seed: 1,
    });
    expect(order(rows)).toEqual(["A", "B", "C"]);
    expect(rows[1]).toMatchObject({
      teamId: "B", position: 2, played: 2, won: 1, lost: 1, points: 3,
      // vs A: 4-6 4-6 · vs C: 6-4 3-6 y super tie-break ganado (cuenta 1-0 en games).
      setsFor: 2, setsAgainst: 3, gamesFor: 8 + (6 + 3 + 1), gamesAgainst: 12 + (4 + 6), decidedByLottery: false,
    });
  });

  it("ignora partidos sin resultado y equipos ajenos al grupo", () => {
    const rows = computeStandings({
      teamIds: ["A", "B"],
      matches: [
        { homeTeamId: "A", awayTeamId: "B", winnerTeamId: null, isDraw: false, result: null },
        setsMatch("A", "Z", [6, 0], [6, 0]),
      ],
      scoring: padel,
      config: setsConfig,
      seed: 1,
    });
    expect(rows.every((r) => r.played === 0)).toBe(true);
  });

  it("desempata por enfrentamiento directo entre dos", () => {
    // A y B con 6 puntos; B le ganó a A.
    const rows = computeStandings({
      teamIds: ["A", "B", "C", "D"],
      matches: [
        setsMatch("B", "A", [6, 4], [6, 4]),
        setsMatch("A", "C", [6, 0], [6, 0]),
        setsMatch("A", "D", [6, 0], [6, 0]),
        setsMatch("B", "C", [6, 4], [3, 6], [10, 8]),
        setsMatch("D", "B", [6, 4], [6, 4]),
        setsMatch("C", "D", [6, 4], [6, 4]),
      ],
      scoring: padel,
      config: setsConfig,
      seed: 1,
    });
    expect(order(rows).slice(0, 2)).toEqual(["B", "A"]);
  });

  it("triple empate: mini-liga y después diferencia de sets", () => {
    // Ciclo A>B, B>C, C>A: empate también en el directo. Decide la diferencia de sets.
    const rows = computeStandings({
      teamIds: ["A", "B", "C"],
      matches: [
        setsMatch("A", "B", [6, 0], [6, 0]),
        setsMatch("B", "C", [6, 4], [3, 6], [10, 8]),
        setsMatch("C", "A", [6, 4], [3, 6], [10, 5]),
      ],
      scoring: padel,
      config: setsConfig,
      seed: 1,
    });
    // Sets: A 3-2 (+1), B 2-3 (-1), C 3-3 (0).
    expect(order(rows)).toEqual(["A", "C", "B"]);
  });

  it("empate total: sorteo determinístico marcado", () => {
    const params = {
      teamIds: ["A", "B"],
      matches: [goalsMatch("A", "B", 1, 1)],
      scoring: football,
      config: goalsConfig,
    };
    const first = computeStandings({ ...params, seed: 7 });
    expect(computeStandings({ ...params, seed: 7 })).toEqual(first);
    expect(first.every((r) => r.decidedByLottery)).toBe(true);
    const seeds = Array.from({ length: 20 }, (_, i) => order(computeStandings({ ...params, seed: i })).join());
    expect(new Set(seeds).size).toBe(2); // la semilla cambia el resultado del sorteo
  });

  it("fútbol: empates y diferencia de gol", () => {
    const rows = computeStandings({
      teamIds: ["A", "B", "C"],
      matches: [goalsMatch("A", "B", 2, 2), goalsMatch("A", "C", 3, 0), goalsMatch("B", "C", 1, 0)],
      scoring: football,
      config: goalsConfig,
      seed: 1,
    });
    expect(order(rows)).toEqual(["A", "B", "C"]);
    expect(rows[0]).toMatchObject({ points: 4, drawn: 1, goalsFor: 5, goalsAgainst: 2 });
  });

  it("puntos configurables (ej. 1 punto por perder)", () => {
    const rows = computeStandings({
      teamIds: ["A", "B"],
      matches: [setsMatch("A", "B", [6, 0], [6, 0])],
      scoring: padel,
      config: { ...setsConfig, points: { win: 2, draw: 0, loss: 1 } },
      seed: 1,
    });
    expect(rows.map((r) => r.points)).toEqual([2, 1]);
  });

  it("ignora criterios que no aplican al deporte", () => {
    const rows = computeStandings({
      teamIds: ["A", "B"],
      matches: [goalsMatch("A", "B", 0, 1)],
      scoring: football,
      config: { points: goalsConfig.points, tiebreakers: ["set_diff", "points"] },
      seed: 1,
    });
    expect(order(rows)).toEqual(["B", "A"]);
  });
});

describe("validateStandingsConfig", () => {
  it("acepta la config por defecto y rechaza criterios ajenos o repetidos", () => {
    expect(validateStandingsConfig(setsConfig, "sets")).toEqual({ ok: true, config: setsConfig });
    expect(validateStandingsConfig(setsConfig, "goals")).toEqual({
      ok: false,
      errors: [
        '"Diferencia de sets" no aplica a este deporte.',
        '"Diferencia de games" no aplica a este deporte.',
        '"Games ganados" no aplica a este deporte.',
      ],
    });
    const repeated = validateStandingsConfig({ ...setsConfig, tiebreakers: ["points", "points"] }, "sets");
    expect(repeated).toEqual({ ok: false, errors: ["No repitas criterios de desempate."] });
    expect(validateStandingsConfig({ points: {} }, "sets").ok).toBe(false);
  });
});
