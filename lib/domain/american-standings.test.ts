import { describe, expect, it } from "vitest";
import {
  type AmericanMatchScoreInput,
  computeAmericanStandings,
} from "./american-standings";

describe("computeAmericanStandings", () => {
  it("inicializa a los participantes con valores en 0 cuando no hay partidos jugados", () => {
    const ids = ["p1", "p2", "p3", "p4"];
    const standings = computeAmericanStandings(ids, []);

    expect(standings.length).toBe(4);
    for (const row of standings) {
      expect(row.played).toBe(0);
      expect(row.won).toBe(0);
      expect(row.lost).toBe(0);
      expect(row.pointsFor).toBe(0);
      expect(row.pointsAgainst).toBe(0);
      expect(row.pointDiff).toBe(0);
    }
  });

  it("calcula correctamente la acumulación individual: (p1+p2) vs (p3+p4) con resultado 14-10", () => {
    const ids = ["p1", "p2", "p3", "p4"];
    const matches: AmericanMatchScoreInput[] = [
      {
        sideA: ["p1", "p2"],
        sideB: ["p3", "p4"],
        scoreSideA: 14,
        scoreSideB: 10,
        status: "completed",
      },
    ];

    const standings = computeAmericanStandings(ids, matches);

    const sP1 = standings.find((s) => s.participantId === "p1")!;
    const sP2 = standings.find((s) => s.participantId === "p2")!;
    const sP3 = standings.find((s) => s.participantId === "p3")!;
    const sP4 = standings.find((s) => s.participantId === "p4")!;

    // p1 y p2 sumaron 14 a favor, 10 en contra, 1 ganado, 1 jugado
    expect(sP1.played).toBe(1);
    expect(sP1.won).toBe(1);
    expect(sP1.lost).toBe(0);
    expect(sP1.pointsFor).toBe(14);
    expect(sP1.pointsAgainst).toBe(10);
    expect(sP1.pointDiff).toBe(4);

    expect(sP2.pointsFor).toBe(14);
    expect(sP2.pointDiff).toBe(4);

    // p3 y p4 sumaron 10 a favor, 14 en contra, 1 perdido, 1 jugado
    expect(sP3.played).toBe(1);
    expect(sP3.won).toBe(0);
    expect(sP3.lost).toBe(1);
    expect(sP3.pointsFor).toBe(10);
    expect(sP3.pointsAgainst).toBe(14);
    expect(sP3.pointDiff).toBe(-4);

    expect(sP4.pointsFor).toBe(10);
    expect(sP4.pointDiff).toBe(-4);
  });

  it("ordena por 1° puntos acumulados, 2° diferencia (+/-), 3° partidos ganados", () => {
    const ids = ["p1", "p2", "p3", "p4"];
    const matches: AmericanMatchScoreInput[] = [
      // Ronda 1: p1+p2 (16) vs p3+p4 (8)
      {
        sideA: ["p1", "p2"],
        sideB: ["p3", "p4"],
        scoreSideA: 16,
        scoreSideB: 8,
        status: "completed",
      },
      // Ronda 2: p1+p3 (10) vs p2+p4 (12)
      {
        sideA: ["p1", "p3"],
        sideB: ["p2", "p4"],
        scoreSideA: 10,
        scoreSideB: 12,
        status: "completed",
      },
    ];

    // Totales:
    // p1: 16 + 10 = 26 pts, contra: 8 + 12 = 20 pts, dif: +6, won: 1, lost: 1
    // p2: 16 + 12 = 28 pts, contra: 8 + 10 = 18 pts, dif: +10, won: 2, lost: 0
    // p3: 8 + 10 = 18 pts, contra: 16 + 12 = 28 pts, dif: -10, won: 0, lost: 2
    // p4: 8 + 12 = 20 pts, contra: 16 + 10 = 26 pts, dif: -6, won: 1, lost: 1

    const standings = computeAmericanStandings(ids, matches);

    expect(standings.map((s) => s.participantId)).toEqual(["p2", "p1", "p4", "p3"]);
    expect(standings[0]?.rank).toBe(1);
    expect(standings[0]?.participantId).toBe("p2");
    expect(standings[1]?.rank).toBe(2);
    expect(standings[1]?.participantId).toBe("p1");
  });

  it("desempata por enfrentamiento directo (Head to Head) cuando igualan puntos y diferencia", () => {
    const ids = ["p1", "p2"];
    // Supongamos p1 y p2 terminan empatados en puntos totales y diferencia,
    // pero se enfrentaron directamente y p1 venció a p2
    const matches: AmericanMatchScoreInput[] = [
      // Cruce directo: p1 le gana a p2
      {
        sideA: ["p1", "otro_a"],
        sideB: ["p2", "otro_b"],
        scoreSideA: 16,
        scoreSideB: 12,
        status: "completed",
      },
      // Otro partido para equilibrar puntos y diferencia
      {
        sideA: ["p1", "otro_c"],
        sideB: ["otro_d", "otro_e"],
        scoreSideA: 12,
        scoreSideB: 16,
        status: "completed",
      },
      {
        sideA: ["p2", "otro_f"],
        sideB: ["otro_g", "otro_h"],
        scoreSideA: 16,
        scoreSideB: 12,
        status: "completed",
      },
    ];

    // p1: 16 + 12 = 28 pts, contra: 12 + 16 = 28 pts, dif: 0, won: 1
    // p2: 12 + 16 = 28 pts, contra: 16 + 12 = 28 pts, dif: 0, won: 1
    // Están exactamente empatados en puntos a favor, diferencia y partidos ganados.
    // En el cruce directo, p1 (16) superó a p2 (12). Por tanto, p1 debe quedar primero.

    const standings = computeAmericanStandings(ids, matches);

    expect(standings[0]?.participantId).toBe("p1");
    expect(standings[1]?.participantId).toBe("p2");
  });

  it("en modo single_set clasifica por diferencia de games: 6-3 (+3) supera a 7-6 (+1)", () => {
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
    const matches: AmericanMatchScoreInput[] = [
      // Partido 1: p1 gana 6 - 3 (diferencia +3, games a favor 6)
      {
        sideA: ["p1", "p3"],
        sideB: ["p4", "p5"],
        scoreSideA: 6,
        scoreSideB: 3,
        status: "completed",
      },
      // Partido 2: p2 gana 7 - 6 (diferencia +1, games a favor 7)
      {
        sideA: ["p2", "p6"],
        sideB: ["p7", "p8"],
        scoreSideA: 7,
        scoreSideB: 6,
        status: "completed",
      },
    ];

    const standings = computeAmericanStandings(ids, matches, { scoringMode: "single_set" });

    // p1 y p3 tienen dif +3, p2 y p6 tienen dif +1.
    // En modo single_set, los que tienen dif +3 deben quedar en los primeros 2 lugares sobre los de dif +1 aunque estos últimos hayan metido 7 games.
    const topPair = [standings[0]?.participantId, standings[1]?.participantId];
    expect(topPair).toContain("p1");
    expect(topPair).toContain("p3");
    expect(standings[0]?.pointDiff).toBe(3);
    expect(standings[1]?.pointDiff).toBe(3);

    const nextPair = [standings[2]?.participantId, standings[3]?.participantId];
    expect(nextPair).toContain("p2");
    expect(nextPair).toContain("p6");
    expect(standings[2]?.pointDiff).toBe(1);
    expect(standings[3]?.pointDiff).toBe(1);
  });
});

