import { describe, expect, it } from "vitest";
import {
  generateAmericanFixedPairsFixture,
  generateAmericanRotativeFixture,
} from "./american-rotative";

describe("generateAmericanRotativeFixture", () => {
  it("valida que los participantes sean múltiplo de 4 y al menos 4", () => {
    expect(() =>
      generateAmericanRotativeFixture({
        participantIds: ["p1", "p2", "p3"],
        courtCount: 1,
      })
    ).toThrow("mínimo de 4 participantes");

    expect(() =>
      generateAmericanRotativeFixture({
        participantIds: ["p1", "p2", "p3", "p4", "p5", "p6"],
        courtCount: 2,
      })
    ).toThrow("múltiplo de 4");
  });

  it("valida que haya al menos 1 cancha disponible", () => {
    expect(() =>
      generateAmericanRotativeFixture({
        participantIds: ["p1", "p2", "p3", "p4"],
        courtCount: 0,
      })
    ).toThrow("al menos 1 cancha");
  });

  it("genera fixture canónico para N=4 sin repetir compañero", () => {
    const ids = ["p1", "p2", "p3", "p4"];
    const fixture = generateAmericanRotativeFixture({
      participantIds: ids,
      courtCount: 1,
      roundsCount: 3,
    });

    expect(fixture.length).toBe(3);

    // Contar cuántas veces p1 juega con cada otro
    const partnersOfP1 = new Set<string>();
    for (const match of fixture) {
      expect(match.courtNumber).toBe(1);
      expect(match.shiftNumber).toBe(1);

      if (match.sideA.includes("p1")) {
        const partner = match.sideA[0] === "p1" ? match.sideA[1] : match.sideA[0];
        partnersOfP1.add(partner);
      } else {
        const partner = match.sideB[0] === "p1" ? match.sideB[1] : match.sideB[0];
        partnersOfP1.add(partner);
      }
    }

    expect(partnersOfP1.size).toBe(3);
    expect(partnersOfP1.has("p2")).toBe(true);
    expect(partnersOfP1.has("p3")).toBe(true);
    expect(partnersOfP1.has("p4")).toBe(true);
  });

  it("genera Whist Tournament canónico Wh(8) para N=8 con 0 compañeros repetidos en 7 rondas", () => {
    const ids = ["p1", "p2", "p3", "p4", "p5", "p6", "p7", "p8"];
    const fixture = generateAmericanRotativeFixture({
      participantIds: ids,
      courtCount: 2,
      roundsCount: 7,
    });

    // 7 rondas * 2 partidos por ronda = 14 partidos
    expect(fixture.length).toBe(14);

    const partners = new Map<string, Set<string>>();
    ids.forEach((id) => partners.set(id, new Set()));

    for (const match of fixture) {
      // Validar que cada partido tenga 4 jugadores distintos
      const all4 = [...match.sideA, ...match.sideB];
      expect(new Set(all4).size).toBe(4);

      // Registrar compañeros
      const [a1, a2] = match.sideA;
      partners.get(a1)!.add(a2);
      partners.get(a2)!.add(a1);

      const [b1, b2] = match.sideB;
      partners.get(b1)!.add(b2);
      partners.get(b2)!.add(b1);
    }

    // Cada jugador debe haber sido compañero de los otros 7 exactamente una vez
    for (const id of ids) {
      expect(partners.get(id)!.size).toBe(7);
      expect(partners.get(id)!.has(id)).toBe(false);
    }
  });

  it("distribuye canchas y turnos correctamente cuando hay menos canchas que partidos simultáneos (N=12, 1 cancha)", () => {
    const ids = Array.from({ length: 12 }, (_, i) => `jugador_${i + 1}`);
    const fixture = generateAmericanRotativeFixture({
      participantIds: ids,
      courtCount: 1, // Solo 1 cancha para 3 partidos por ronda
      roundsCount: 3,
    });

    // 3 rondas * 3 partidos = 9 partidos
    expect(fixture.length).toBe(9);

    // En la ronda 1 debe haber 3 turnos (shiftNumber 1, 2, 3) todos en la cancha 1
    const round1 = fixture.filter((m) => m.roundNumber === 1);
    expect(round1.length).toBe(3);
    expect(round1.map((m) => m.shiftNumber)).toEqual([1, 2, 3]);
    expect(round1.every((m) => m.courtNumber === 1)).toBe(true);
  });

  it("genera fixture balanceado sin repetir compañeros para N=12 y N=16 en 5 rondas", () => {
    for (const count of [12, 16]) {
      const ids = Array.from({ length: count }, (_, i) => `p_${i + 1}`);
      const fixture = generateAmericanRotativeFixture({
        participantIds: ids,
        courtCount: count / 4,
        roundsCount: 5,
        seed: 12345,
      });

      expect(fixture.length).toBe(5 * (count / 4));

      const partnersCount = new Map<string, Map<string, number>>();
      ids.forEach((id) => partnersCount.set(id, new Map()));

      for (const match of fixture) {
        const [a1, a2] = match.sideA;
        partnersCount.get(a1)!.set(a2, (partnersCount.get(a1)!.get(a2) ?? 0) + 1);
        partnersCount.get(a2)!.set(a1, (partnersCount.get(a2)!.get(a1) ?? 0) + 1);

        const [b1, b2] = match.sideB;
        partnersCount.get(b1)!.set(b2, (partnersCount.get(b1)!.get(b2) ?? 0) + 1);
        partnersCount.get(b2)!.set(b1, (partnersCount.get(b2)!.get(b1) ?? 0) + 1);
      }

      // En 5 rondas ningún jugador debe repetir compañero
      for (const id of ids) {
        const pMap = partnersCount.get(id)!;
        for (const [other, times] of pMap.entries()) {
          expect(times).toBeLessThanOrEqual(1);
        }
      }
    }
  });
});

describe("generateAmericanFixedPairsFixture", () => {
  it("genera fixture todos contra todos con canchas y turnos para duplas fijas", () => {
    const duplas = ["Dupla 1", "Dupla 2", "Dupla 3", "Dupla 4"];
    const fixture = generateAmericanFixedPairsFixture(duplas, 2);

    // 4 equipos -> 3 fechas * 2 partidos = 6 partidos
    expect(fixture.length).toBe(6);

    const round1 = fixture.filter((m) => m.roundNumber === 1);
    expect(round1.length).toBe(2);
    expect(round1[0]?.courtNumber).toBe(1);
    expect(round1[1]?.courtNumber).toBe(2);
  });
});

