import { describe, expect, it } from "vitest";
import { type HistoryMatch, computePlayerStats, filterHistory } from "./stats";

const history: HistoryMatch[] = [
  { matchId: "1", tournamentId: "t1", sportId: "padel", outcome: "win" },
  { matchId: "2", tournamentId: "t1", sportId: "padel", outcome: "loss" },
  { matchId: "3", tournamentId: "t2", sportId: "futbol-11", outcome: "draw" },
  { matchId: "4", tournamentId: "t2", sportId: "futbol-11", outcome: "win" },
  { matchId: "5", tournamentId: "t3", sportId: "padel", outcome: null },
];

describe("computePlayerStats", () => {
  it("cuenta solo partidos con resultado", () => {
    expect(computePlayerStats(history, ["t1", "t1"])).toEqual({
      played: 4, won: 2, drawn: 1, lost: 1, winRate: 50, tournaments: 2, titles: 1,
    });
  });

  it("sin partidos", () => {
    expect(computePlayerStats([])).toEqual({ played: 0, won: 0, drawn: 0, lost: 0, winRate: 0, tournaments: 0, titles: 0 });
  });

  it("redondea el porcentaje a 1 decimal", () => {
    const three = history.slice(0, 3);
    expect(computePlayerStats(three).winRate).toBe(33.3);
  });
});

describe("filterHistory", () => {
  it("combina filtros", () => {
    expect(filterHistory(history, { sportId: "padel" }).map((m) => m.matchId)).toEqual(["1", "2", "5"]);
    expect(filterHistory(history, { sportId: "padel", outcome: "win" }).map((m) => m.matchId)).toEqual(["1"]);
    expect(filterHistory(history, { tournamentId: "t2" })).toHaveLength(2);
    expect(filterHistory(history, {})).toHaveLength(5);
  });
});
