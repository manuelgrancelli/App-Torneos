import { describe, expect, it } from "vitest";
import { generateRoundRobin, roundRobinMatchCount } from "./round-robin";

const teams = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);
const pairKey = (a: string, b: string) => [a, b].sort().join("-");

describe("generateRoundRobin", () => {
  it.each([2, 3, 4, 5, 6, 7, 8])("con %i equipos todos se enfrentan exactamente una vez", (n) => {
    const rounds = generateRoundRobin(teams(n));
    const pairs = rounds.flatMap((r) => r.pairings.map((p) => pairKey(p.home, p.away)));
    expect(pairs).toHaveLength(roundRobinMatchCount(n));
    expect(new Set(pairs).size).toBe(pairs.length);
    expect(rounds).toHaveLength(n % 2 === 0 ? n - 1 : n);
  });

  it("cada equipo juega a lo sumo una vez por fecha", () => {
    for (const round of generateRoundRobin(teams(6))) {
      const playing = round.pairings.flatMap((p) => [p.home, p.away]);
      expect(new Set(playing).size).toBe(playing.length);
    }
  });

  it("con cantidad impar cada equipo tiene exactamente una fecha libre", () => {
    const rounds = generateRoundRobin(teams(5));
    const byes = rounds.map((r) => r.bye);
    expect(byes.every(Boolean)).toBe(true);
    expect(new Set(byes).size).toBe(5);
  });

  it("reparte la localía (diferencia de a lo sumo 1 con pares)", () => {
    for (const n of [4, 6, 8]) {
      const home = new Map<string, number>();
      for (const round of generateRoundRobin(teams(n))) {
        for (const p of round.pairings) home.set(p.home, (home.get(p.home) ?? 0) + 1);
      }
      for (const team of teams(n)) {
        const homeGames = home.get(team) ?? 0;
        const awayGames = n - 1 - homeGames;
        expect(Math.abs(homeGames - awayGames)).toBeLessThanOrEqual(1);
      }
    }
  });

  it("casos borde", () => {
    expect(generateRoundRobin([])).toEqual([]);
    expect(generateRoundRobin(["solo"])).toEqual([]);
    expect(() => generateRoundRobin(["a", "a"])).toThrow("repetidos");
    expect(roundRobinMatchCount(1)).toBe(0);
    expect(roundRobinMatchCount(4)).toBe(6);
  });
});
