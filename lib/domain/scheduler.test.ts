import { describe, expect, it } from "vitest";
import { type ScheduleInput, type SchedulerSlot, checkManualAssignment, computeGapPenalty, scheduleMatches } from "./scheduler";

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

describe("asignación inteligente de horarios y proximidad", () => {
  it("en zona de 4, asigna la fecha 2 (gan vs gan y per vs per) cerca de la fecha 1 y no en franjas lejanas", () => {
    // Fecha 1 se jugó de 0 a 1.5h en Cancha 1 y Cancha 2.
    // Ganadores: T1 y T3. Perdedores: T2 y T4.
    // Franjas disponibles para fecha 2:
    // - s_close1 (2h): 30m de descanso (ideal)
    // - s_close2 (3.5h): 2h de descanso (ideal)
    // - s_far (10h): 8.5h de espera (muy lejana)
    // - s_next_day (26h): día siguiente (lejana)
    const teams = ["T1", "T2", "T3", "T4"];
    const slots = [
      slot("s_close1", 2, "c1"),
      slot("s_close2", 3.5, "c1"),
      slot("s_far", 10, "c1"),
      slot("s_next_day", 26, "c1"),
    ];
    const availability = Object.fromEntries(teams.map((t) => [t, slots.map((s) => s.id)]));

    const fixed = [
      { matchId: "r1_m1", homeTeamId: "T1", awayTeamId: "T2", courtId: "c1", start: T0, end: T0 + 1.5 * H },
      { matchId: "r1_m2", homeTeamId: "T3", awayTeamId: "T4", courtId: "c2", start: T0, end: T0 + 1.5 * H },
    ];

    const data = input({
      matches: [
        { id: "r2_win", homeTeamId: "T1", awayTeamId: "T3", notBefore: T0 + 1.5 * H, feederMatchIds: ["r1_m1", "r1_m2"], order: 2 },
        { id: "r2_lose", homeTeamId: "T2", awayTeamId: "T4", notBefore: T0 + 1.5 * H, feederMatchIds: ["r1_m1", "r1_m2"], order: 2 },
      ],
      slots,
      courtIds: ["c1"],
      availability,
      fixed,
    });

    const result = scheduleMatches(data);
    expect(result.unscheduled).toEqual([]);

    const assignedSlotIds = result.assignments.map((a) => a.slotId);
    // Ambos deben haber sido programados en las franjas cercanas (s_close1 y s_close2)
    expect(assignedSlotIds).toContain("s_close1");
    expect(assignedSlotIds).toContain("s_close2");
    // Ninguno debe haber sido puesto en s_far ni en s_next_day
    expect(assignedSlotIds).not.toContain("s_far");
    expect(assignedSlotIds).not.toContain("s_next_day");
  });

  it("programa simultáneamente fecha 1 y fecha 2 en una zona de 4 manteniendo continuidad", () => {
    // 2 canchas: Cancha 1 y Cancha 2.
    // s1 (0h), s2 (1.5h), s3 (3h), s_distant (12h).
    const teams = ["T1", "T2", "T3", "T4"];
    const slots = [
      slot("s1_c1", 0, "c1"),
      slot("s1_c2", 0, "c2"),
      slot("s2_c1", 1.5, "c1"),
      slot("s2_c2", 1.5, "c2"),
      slot("s_distant", 12, "c1"),
    ];
    const availability = Object.fromEntries(teams.map((t) => [t, slots.map((s) => s.id)]));

    const data = input({
      matches: [
        { id: "r1_m1", homeTeamId: "T1", awayTeamId: "T2", order: 1, groupId: "g1", round: 1 },
        { id: "r1_m2", homeTeamId: "T3", awayTeamId: "T4", order: 1, groupId: "g1", round: 1 },
        { id: "r2_win", homeTeamId: null, awayTeamId: null, groupTeamIds: teams, feederMatchIds: ["r1_m1", "r1_m2"], order: 2, groupId: "g1", round: 2 },
        { id: "r2_lose", homeTeamId: null, awayTeamId: null, groupTeamIds: teams, feederMatchIds: ["r1_m1", "r1_m2"], order: 2, groupId: "g1", round: 2 },
      ],
      slots,
      courtIds: ["c1", "c2"],
      availability,
    });

    const result = scheduleMatches(data);
    expect(result.unscheduled).toEqual([]);

    const slotMap = new Map(result.assignments.map((a) => [a.matchId, a.slotId]));
    // Fecha 1 debe estar en la franja s1 (0h)
    expect(["s1_c1", "s1_c2"]).toContain(slotMap.get("r1_m1"));
    expect(["s1_c1", "s1_c2"]).toContain(slotMap.get("r1_m2"));
    // Fecha 2 debe estar en la franja s2 (1.5h, inmediatamente posterior)
    expect(["s2_c1", "s2_c2"]).toContain(slotMap.get("r2_win"));
    expect(["s2_c1", "s2_c2"]).toContain(slotMap.get("r2_lose"));
    // Ninguno en s_distant
    expect(Array.from(slotMap.values())).not.toContain("s_distant");
  });

  it("no asigna el segundo partido antes del primero aunque exista una franja previa disponible", () => {
    const data = input({
      matches: [
        { id: "m2", homeTeamId: "A", awayTeamId: "B", notBefore: T0 + 4 * H, order: 2 },
      ],
      slots: [
        slot("s_morning", 0), // 09:00 AM (antes del partido previo de las 13:00)
        slot("s_afternoon", 5), // 14:00 PM (después del partido previo)
      ],
      availability: { A: ["s_morning", "s_afternoon"], B: ["s_morning", "s_afternoon"] },
      fixed: [
        { matchId: "m1", homeTeamId: "A", awayTeamId: "C", courtId: "c1", start: T0 + 2 * H, end: T0 + 3.5 * H },
      ],
    });

    const result = scheduleMatches(data);
    expect(result.assignments).toHaveLength(1);
    expect(result.assignments[0]?.slotId).toBe("s_afternoon");
  });

  it("calcula las penalizaciones de descanso ideal y esperas excesivas", () => {
    // 0 min (back to back): fatiga
    expect(computeGapPenalty(0)).toBe(5);
    expect(computeGapPenalty(10 * 60 * 1000)).toBe(5);

    // 15 min a 150 min (ideal): 0 penalización
    expect(computeGapPenalty(15 * 60 * 1000)).toBe(0);
    expect(computeGapPenalty(60 * 60 * 1000)).toBe(0);
    expect(computeGapPenalty(90 * 60 * 1000)).toBe(0);
    expect(computeGapPenalty(150 * 60 * 1000)).toBe(0);

    // Esperas más largas: penalización progresiva
    expect(computeGapPenalty(210 * 60 * 1000)).toBe(10); // 3.5h (+1h sobre 2.5h)
    expect(computeGapPenalty(270 * 60 * 1000)).toBe(20); // 4.5h (+2h)
    expect(computeGapPenalty(390 * 60 * 1000)).toBe(70); // 6.5h
    expect(computeGapPenalty(600 * 60 * 1000)).toBe(240); // 10h
    expect(computeGapPenalty(24 * 60 * 60 * 1000)).toBe(1080); // 24h
  });
});
