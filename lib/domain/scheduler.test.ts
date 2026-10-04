import { describe, expect, it } from "vitest";
import { type ScheduleInput, type SchedulerSlot, checkManualAssignment, scheduleMatches } from "./scheduler";

const H = 60 * 60 * 1000;
const T0 = Date.UTC(2026, 9, 10, 12); // 10/10/2026 09:00 en Argentina

/** Franja de 90 minutos que empieza `hoursFromStart` horas después de T0. */
function slot(id: string, hoursFromStart: number, courtId: string | null = null): SchedulerSlot {
  const start = T0 + hoursFromStart * H;
  return { id, start, end: start + 1.5 * H, courtId };
}

function input(overrides: Partial<ScheduleInput>): ScheduleInput {
  return { matches: [], slots: [], courtIds: ["c1"], availability: {}, ...overrides };
}

/** Verifica las restricciones duras sobre un resultado. */
function assertValid(data: ScheduleInput, assignments: ReturnType<typeof scheduleMatches>["assignments"]) {
  const matchById = new Map(data.matches.map((m) => [m.id, m]));
  for (let i = 0; i < assignments.length; i++) {
    const a = assignments[i]!;
    const match = matchById.get(a.matchId)!;
    for (const team of [match.homeTeamId!, match.awayTeamId!]) {
      expect(data.availability[team]).toContain(a.slotId);
    }
    for (let j = i + 1; j < assignments.length; j++) {
      const b = assignments[j]!;
      const overlap = a.start < b.end && b.start < a.end;
      if (!overlap) continue;
      expect(a.courtId).not.toBe(b.courtId);
      const other = matchById.get(b.matchId)!;
      const teamsA = [match.homeTeamId, match.awayTeamId];
      expect(teamsA).not.toContain(other.homeTeamId);
      expect(teamsA).not.toContain(other.awayTeamId);
    }
  }
}

describe("scheduleMatches", () => {
  it("asigna en la franja común más temprana", () => {
    const data = input({
      matches: [{ id: "m1", homeTeamId: "A", awayTeamId: "B" }],
      slots: [slot("s1", 0), slot("s2", 2)],
      availability: { A: ["s1", "s2"], B: ["s2"] },
    });
    const result = scheduleMatches(data);
    expect(result.assignments).toEqual([{ matchId: "m1", slotId: "s2", courtId: "c1", start: T0 + 2 * H, end: T0 + 3.5 * H }]);
    expect(result.unscheduled).toEqual([]);
    expect(result.exhaustive).toBe(true);
  });

  it("usa varias canchas en la misma franja y nunca repite equipo en simultáneo", () => {
    const data = input({
      matches: [
        { id: "m1", homeTeamId: "A", awayTeamId: "B" },
        { id: "m2", homeTeamId: "C", awayTeamId: "D" },
        { id: "m3", homeTeamId: "A", awayTeamId: "C" },
      ],
      slots: [slot("s1", 0), slot("s2", 2)],
      courtIds: ["c1", "c2"],
      availability: { A: ["s1", "s2"], B: ["s1", "s2"], C: ["s1", "s2"], D: ["s1", "s2"] },
    });
    const result = scheduleMatches(data);
    expect(result.unscheduled).toEqual([]);
    assertValid(data, result.assignments);
  });

  it("considera superposición entre franjas distintas (general vs. de una cancha)", () => {
    // s1: 09:00-10:30 cualquier cancha · s2: 10:00-11:30 solo c1 (se pisan).
    const data = input({
      matches: [
        { id: "m1", homeTeamId: "A", awayTeamId: "B" },
        { id: "m2", homeTeamId: "C", awayTeamId: "D" },
      ],
      slots: [slot("s1", 0), slot("s2", 1, "c1")],
      courtIds: ["c1"],
      availability: { A: ["s1"], B: ["s1"], C: ["s2"], D: ["s2"] },
    });
    const result = scheduleMatches(data);
    // Solo hay una cancha y las franjas se superponen: uno queda sin horario.
    expect(result.assignments).toHaveLength(1);
    expect(result.unscheduled).toEqual([{ matchId: expect.any(String), reason: "no_capacity" }]);
  });

  it("encuentra la asignación completa aunque el orden ingenuo falle (backtracking)", () => {
    // m1 puede en s1 o s2; m2 solo en s1. Greedy por orden de entrada pondría m1 en s1.
    const data = input({
      matches: [
        { id: "m1", homeTeamId: "A", awayTeamId: "B" },
        { id: "m2", homeTeamId: "A", awayTeamId: "C" },
        { id: "m3", homeTeamId: "B", awayTeamId: "C" },
      ],
      slots: [slot("s1", 0), slot("s2", 2), slot("s3", 4)],
      availability: { A: ["s1", "s2"], B: ["s1", "s2", "s3"], C: ["s1", "s3"] },
    });
    const result = scheduleMatches(data);
    expect(result.unscheduled).toEqual([]);
    assertValid(data, result.assignments);
  });

  it("marca los partidos imposibles con su motivo", () => {
    const data = input({
      matches: [
        { id: "m1", homeTeamId: "A", awayTeamId: "B" },
        { id: "m2", homeTeamId: "C", awayTeamId: null },
        { id: "m3", homeTeamId: "A", awayTeamId: "D" },
      ],
      slots: [slot("s1", 0)],
      availability: { A: ["s1"], B: ["s1"], D: [] },
    });
    const result = scheduleMatches(data);
    expect(result.assignments.map((a) => a.matchId)).toEqual(["m1"]);
    expect(result.unscheduled).toEqual([
      { matchId: "m2", reason: "missing_teams" },
      { matchId: "m3", reason: "no_common_availability" },
    ]);
  });

  it("respeta los partidos fijos y notBefore (playoffs)", () => {
    const data = input({
      matches: [{ id: "final", homeTeamId: "A", awayTeamId: "B", notBefore: T0 + 2 * H }],
      slots: [slot("s1", 0), slot("s2", 2), slot("s3", 4)],
      availability: { A: ["s1", "s2", "s3"], B: ["s1", "s2", "s3"] },
      // La cancha está ocupada en s2 por otro partido ya programado.
      fixed: [{ matchId: "x", homeTeamId: "X", awayTeamId: "Y", courtId: "c1", start: T0 + 2 * H, end: T0 + 3.5 * H }],
    });
    const result = scheduleMatches(data);
    expect(result.assignments[0]?.slotId).toBe("s3");
  });

  it("devuelve la mejor parcial cuando se corta por el tope de iteraciones", () => {
    const teams = ["A", "B", "C", "D", "E", "F"];
    const matches = teams.flatMap((a, i) =>
      teams.slice(i + 1).map((b) => ({ id: `${a}${b}`, homeTeamId: a, awayTeamId: b })),
    );
    const slots = Array.from({ length: 4 }, (_, i) => slot(`s${i}`, i * 2));
    const availability = Object.fromEntries(teams.map((t) => [t, slots.map((s) => s.id)]));
    const data = input({ matches, slots, availability, maxIterations: 50 });
    const result = scheduleMatches(data);
    expect(result.exhaustive).toBe(false);
    expect(result.assignments.length + result.unscheduled.length).toBe(matches.length);
    assertValid(data, result.assignments);
  });

  it("es determinístico", () => {
    const data = input({
      matches: [
        { id: "m1", homeTeamId: "A", awayTeamId: "B" },
        { id: "m2", homeTeamId: "C", awayTeamId: "D" },
      ],
      slots: [slot("s1", 0), slot("s2", 2)],
      courtIds: ["c1", "c2"],
      availability: { A: ["s1", "s2"], B: ["s1", "s2"], C: ["s1", "s2"], D: ["s1", "s2"] },
    });
    expect(scheduleMatches(data)).toEqual(scheduleMatches(data));
  });

  it("un grupo de 4 en 3 franjas con 2 canchas queda completo", () => {
    const teams = ["A", "B", "C", "D"];
    const matches = teams.flatMap((a, i) =>
      teams.slice(i + 1).map((b) => ({ id: `${a}${b}`, homeTeamId: a, awayTeamId: b })),
    );
    const slots = [slot("s1", 0), slot("s2", 2), slot("s3", 4)];
    const availability = Object.fromEntries(teams.map((t) => [t, ["s1", "s2", "s3"]]));
    const data = input({ matches, slots, courtIds: ["c1", "c2"], availability });
    const result = scheduleMatches(data);
    expect(result.unscheduled).toEqual([]);
    assertValid(data, result.assignments);
  });
});

describe("escenario realista", () => {
  it("16 parejas en 4 grupos, 12 franjas, 2 canchas y disponibilidad aleatoria: resultado válido y rápido", async () => {
    const { createRng } = await import("./random");
    const rng = createRng(2026);
    const teams = Array.from({ length: 16 }, (_, i) => `T${i + 1}`);
    const groups = [0, 1, 2, 3].map((g) => teams.slice(g * 4, g * 4 + 4));
    const matches = groups.flatMap((group, g) =>
      group.flatMap((a, i) => group.slice(i + 1).map((b) => ({ id: `g${g}-${a}-${b}`, homeTeamId: a, awayTeamId: b }))),
    );
    const slots = Array.from({ length: 12 }, (_, i) => slot(`s${i}`, i * 1.5));
    // Cada pareja marca ~70 % de las franjas.
    const availability = Object.fromEntries(
      teams.map((t) => [t, slots.filter(() => rng() < 0.7).map((s) => s.id)]),
    );
    const data = input({ matches, slots, courtIds: ["c1", "c2"], availability });

    const started = performance.now();
    const result = scheduleMatches(data);
    expect(performance.now() - started).toBeLessThan(2000);

    expect(result.assignments.length + result.unscheduled.length).toBe(matches.length);
    expect(result.assignments.length).toBeGreaterThanOrEqual(matches.length - 2);
    assertValid(data, result.assignments);
  });
});

describe("checkManualAssignment", () => {
  const others = [{ matchId: "o1", homeTeamId: "A", awayTeamId: "X", courtId: "c1", start: T0, end: T0 + 1.5 * H }];

  it("bloquea choques de cancha y de equipo", () => {
    const result = checkManualAssignment({
      match: { id: "m1", homeTeamId: "A", awayTeamId: "B" },
      slot: slot("s1", 0),
      courtId: "c1",
      others,
      availability: { A: ["s1"], B: ["s1"] },
    });
    expect(result.conflicts).toEqual([
      "La cancha ya tiene otro partido en ese horario.",
      "Un equipo ya juega otro partido en ese horario.",
    ]);
    expect(result.warnings).toEqual([]);
  });

  it("advierte disponibilidad no marcada y franja de otra cancha", () => {
    const result = checkManualAssignment({
      match: { id: "m1", homeTeamId: "C", awayTeamId: "D" },
      slot: slot("s9", 5, "c2"),
      courtId: "c1",
      others,
      availability: { C: ["s9"] },
    });
    expect(result.conflicts).toEqual(["Esa franja es de otra cancha."]);
    expect(result.warnings).toEqual(["Uno de los equipos no marcó disponibilidad en esa franja."]);
  });
});
