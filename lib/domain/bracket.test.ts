import { describe, expect, it } from "vitest";
import {
  type BracketMatchState,
  type Qualifier,
  bracketSize,
  buildBracket,
  orderSeeds,
  propagateResult,
  roundName,
  seedPositions,
} from "./bracket";

const LETTERS = "ABCDEFGH";

/** Clasificados "1A", "2A", "1B"… de `groups` grupos con `perGroup` por grupo. */
function qualifiers(groups: number, perGroup: number): Qualifier[] {
  return Array.from({ length: groups }, (_, g) =>
    Array.from({ length: perGroup }, (_, p) => ({ teamId: `${p + 1}${LETTERS[g]}`, group: g, place: p + 1 })),
  ).flat();
}

const firstRound = (plan: ReturnType<typeof buildBracket>) =>
  plan.matches.filter((m) => m.round === 1).map((m) => [m.home, m.away]);

describe("bracketSize / seedPositions / roundName", () => {
  it("potencia de 2 que alberga a los clasificados", () => {
    expect(bracketSize(2)).toBe(2);
    expect(bracketSize(3)).toBe(4);
    expect(bracketSize(6)).toBe(8);
    expect(bracketSize(16)).toBe(16);
    expect(() => bracketSize(1)).toThrow(RangeError);
    expect(() => bracketSize(33)).toThrow(RangeError);
  });

  it("siembra estándar", () => {
    expect(seedPositions(4)).toEqual([1, 4, 2, 3]);
    expect(seedPositions(8)).toEqual([1, 8, 4, 5, 2, 7, 3, 6]);
  });

  it("nombres de ronda", () => {
    expect(roundName(3, 3)).toBe("Final");
    expect(roundName(2, 3)).toBe("Semifinal");
    expect(roundName(1, 3)).toBe("Cuartos de final");
    expect(roundName(1, 4)).toBe("Octavos de final");
    expect(roundName(1, 5)).toBe("16avos de final");
  });
});

describe("buildBracket", () => {
  it("2 grupos × 2: cruce clásico 1°A vs 2°B y 1°B vs 2°A", () => {
    const plan = buildBracket(qualifiers(2, 2), { thirdPlace: false });
    expect(plan.size).toBe(4);
    expect(firstRound(plan)).toEqual([["1A", "2B"], ["1B", "2A"]]);
    expect(plan.matches).toHaveLength(3);
  });

  it("4 grupos × 2: sin cruces del mismo grupo y en mitades opuestas", () => {
    const plan = buildBracket(qualifiers(4, 2), { thirdPlace: true });
    expect(plan.size).toBe(8);
    const pairs = firstRound(plan);
    for (const [home, away] of pairs) expect(home?.[1]).not.toBe(away?.[1]);
    // Mitad superior = partidos 0 y 1; inferior = 2 y 3.
    const half = (team: string) => (pairs.findIndex((p) => p.includes(team)) < 2 ? "top" : "bottom");
    for (const g of "ABCD") expect(half(`1${g}`)).not.toBe(half(`2${g}`));
    // 7 partidos + 3er puesto, alimentado por los perdedores de semis.
    expect(plan.matches).toHaveLength(8);
    const semis = plan.matches.filter((m) => m.round === 2);
    expect(semis.map((m) => m.loserNext)).toEqual([
      { key: "third-place", side: "home" },
      { key: "third-place", side: "away" },
    ]);
  });

  it("3 grupos × 2 = 6 clasificados: 2 byes para los mejores primeros", () => {
    const q = qualifiers(3, 2).map((x) => (x.teamId === "1C" ? { ...x, rating: [3] } : { ...x, rating: [1] }));
    const plan = buildBracket(q, { thirdPlace: false });
    expect(plan.size).toBe(8);
    const byes = plan.matches.filter((m) => m.isBye);
    expect(byes).toHaveLength(2);
    // 1°C tiene mejor rendimiento: es el sembrado 1 y pasa directo.
    expect(byes.map((m) => m.winnerTeamId).sort()).toEqual(["1A", "1C"].sort());
    // El bye ya lo ubica en su partido de cuartos (ronda 2 de 3).
    const next = plan.matches.find((m) => m.key === byes[0]!.next!.key)!;
    expect([next.home, next.away]).toContain(byes[0]!.winnerTeamId);
    for (const [home, away] of firstRound(plan)) {
      if (home && away) expect(home[1]).not.toBe(away[1]);
    }
  });

  it("16 clasificados: 15 partidos, 4 rondas, sin byes", () => {
    const plan = buildBracket(qualifiers(8, 2), { thirdPlace: false });
    expect(plan.rounds).toBe(4);
    expect(plan.matches).toHaveLength(15);
    expect(plan.matches.some((m) => m.isBye)).toBe(false);
    for (const [home, away] of firstRound(plan)) expect(home?.[1]).not.toBe(away?.[1]);
    const final = plan.matches.find((m) => m.round === 4)!;
    expect(final.next).toBeNull();
  });

  it("3er puesto imposible con semifinal por bye o con 2 clasificados", () => {
    const three = buildBracket(qualifiers(3, 1), { thirdPlace: true });
    expect(three.matches.some((m) => m.isThirdPlace)).toBe(false);
    expect(three.warnings).toEqual(["No hay partido por el 3er puesto: una semifinal se define por bye."]);
    const two = buildBracket(qualifiers(2, 1), { thirdPlace: true });
    expect(two.warnings).toEqual(["Con 2 clasificados no hay partido por el 3er puesto."]);
  });

  it("encadena cada partido con el siguiente", () => {
    const plan = buildBracket(qualifiers(4, 2), { thirdPlace: false });
    const byKey = new Map(plan.matches.map((m) => [m.key, m]));
    for (const match of plan.matches) {
      if (!match.next) continue;
      const next = byKey.get(match.next.key)!;
      expect(next.round).toBe(match.round + 1);
      expect(next.position).toBe(Math.floor(match.position / 2));
    }
  });

  it("rechaza clasificados repetidos", () => {
    const q = qualifiers(2, 1);
    expect(() => buildBracket([...q, q[0]!], { thirdPlace: false })).toThrow("repetidos");
  });

  it("orderSeeds: puesto, rendimiento y grupo", () => {
    const ordered = orderSeeds([
      { teamId: "2A", group: 0, place: 2 },
      { teamId: "1B", group: 1, place: 1, rating: [2, 5] },
      { teamId: "1A", group: 0, place: 1, rating: [2, 7] },
      { teamId: "1C", group: 2, place: 1, rating: [2, 7] },
    ]);
    expect(ordered.map((q) => q.teamId)).toEqual(["1A", "1C", "1B", "2A"]);
  });
});

describe("propagateResult", () => {
  const state = (overrides: Partial<BracketMatchState> & { id: string }): BracketMatchState => ({
    homeTeamId: null, awayTeamId: null, winnerTeamId: null,
    nextMatchId: null, nextMatchSide: null, loserNextMatchId: null, loserNextMatchSide: null,
    ...overrides,
  });

  const bracket = [
    state({ id: "sf1", homeTeamId: "A", awayTeamId: "B", nextMatchId: "final", nextMatchSide: "home", loserNextMatchId: "third", loserNextMatchSide: "home" }),
    state({ id: "sf2", homeTeamId: "C", awayTeamId: "D", nextMatchId: "final", nextMatchSide: "away", loserNextMatchId: "third", loserNextMatchSide: "away" }),
    state({ id: "final" }),
    state({ id: "third" }),
  ];

  it("ganador a la final y perdedor al 3er puesto", () => {
    expect(propagateResult(bracket, "sf1", "B")).toEqual({
      ok: true,
      updates: [
        { matchId: "final", side: "home", teamId: "B" },
        { matchId: "third", side: "home", teamId: "A" },
      ],
    });
  });

  it("no permite corregir si el partido siguiente ya se jugó con otro equipo", () => {
    const played = bracket.map((m) =>
      m.id === "final" ? { ...m, homeTeamId: "A", awayTeamId: "C", winnerTeamId: "A" } : m,
    );
    expect(propagateResult(played, "sf1", "B")).toEqual({
      ok: false,
      error: "El partido siguiente ya tiene resultado: borralo antes de corregir este.",
    });
    // Recargar el mismo ganador no cambia nada.
    expect(propagateResult(played, "sf1", "A")).toEqual({ ok: true, updates: [{ matchId: "third", side: "home", teamId: "B" }] });
  });

  it("valida partido y ganador", () => {
    expect(propagateResult(bracket, "nope", "A")).toEqual({ ok: false, error: "El partido no existe." });
    expect(propagateResult(bracket, "sf1", "C")).toEqual({
      ok: false,
      error: "El ganador tiene que ser uno de los equipos del partido.",
    });
    const broken = [state({ id: "x", homeTeamId: "A", awayTeamId: "B", nextMatchId: "ghost", nextMatchSide: "home" })];
    expect(propagateResult(broken, "x", "A")).toEqual({ ok: false, error: "El cuadro está incompleto." });
  });
});
