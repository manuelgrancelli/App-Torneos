import { describe, expect, it } from "vitest";
import { type ScheduleInput, type SchedulerSlot, checkManualAssignment, computeGapPenalty, getSlotEvaluation, scheduleMatches } from "./scheduler";

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

  it("nunca asigna dos partidos del mismo grupo en round 2 a la misma cancha al mismo tiempo", () => {
    const data = input({
      matches: [
        { id: "m1", homeTeamId: null, awayTeamId: null, groupTeamIds: ["A", "B", "C", "D"], groupId: "g1", round: 2 },
        { id: "m2", homeTeamId: null, awayTeamId: null, groupTeamIds: ["A", "B", "C", "D"], groupId: "g1", round: 2 },
      ],
      slots: [slot("s1", 0)],
      courtIds: ["c1"],
      availability: { A: ["s1"], B: ["s1"], C: ["s1"], D: ["s1"] },
    });
    const result = scheduleMatches(data);
    // Solo hay 1 cancha y 1 franja: no pueden jugar en simultáneo en la misma cancha
    expect(result.assignments).toHaveLength(1);
    expect(result.unscheduled).toHaveLength(1);
    expect(result.unscheduled[0]?.reason).toBe("no_capacity");
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

  it("permite partidos seguidos sin advertencia de fatiga", () => {
    // other termina en T0 + 1.5*H (10:30)
    // slot empieza en T0 + 1.5*H (partidos seguidos, 0 minutos de descanso)
    const contiguousSlot: SchedulerSlot = {
      id: "s_contiguous",
      start: T0 + 1.5 * H,
      end: T0 + 3 * H,
      courtId: null,
    };
    const result = checkManualAssignment({
      match: { id: "m2", homeTeamId: "A", awayTeamId: "B", homeName: "Pareja A" },
      slot: contiguousSlot,
      courtId: "c1",
      others,
      availability: { A: ["s_contiguous"], B: ["s_contiguous"] },
    });
    expect(result.conflicts).toEqual([]);
    expect(result.warnings).toEqual([]);
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

  it("programa fecha 2 en zona de 4 incluso si ninguna franja de la tarde tiene a las 4 parejas simultáneamente disponibles", () => {
    // Escenario real:
    // Fecha 1: T1 vs T2 (m1) y T3 vs T4 (m2) en la mañana (s1).
    // En la tarde:
    // En s2 (1.5h): T1 y T3 están disponibles (T2 y T4 no).
    // En s3 (3h): T2 y T4 están disponibles (T1 y T3 no).
    // Ninguna franja de la tarde tiene a las 4 parejas a la vez.
    const teams = ["T1", "T2", "T3", "T4"];
    const slots = [
      slot("s1_c1", 0, "c1"),
      slot("s1_c2", 0, "c2"),
      slot("s2_c1", 1.5, "c1"),
      slot("s3_c1", 3.0, "c1"),
    ];
    const availability = {
      T1: ["s1_c1", "s1_c2", "s2_c1"],
      T2: ["s1_c1", "s1_c2", "s3_c1"],
      T3: ["s1_c1", "s1_c2", "s2_c1"],
      T4: ["s1_c1", "s1_c2", "s3_c1"],
    };

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
    expect(result.assignments).toHaveLength(4);

    const slotMap = new Map(result.assignments.map((a) => [a.matchId, a.slotId]));
    expect(["s2_c1", "s3_c1"]).toContain(slotMap.get("r2_win"));
    expect(["s2_c1", "s3_c1"]).toContain(slotMap.get("r2_lose"));
    expect(slotMap.get("r2_win")).not.toBe(slotMap.get("r2_lose"));
  });

  it("prioriza franjas donde los 4 integrantes de la zona de 4 pueden jugar sobre franjas con disponibilidad parcial", () => {
    const teams = ["T1", "T2", "T3", "T4"];
    const slots = [
      slot("s1_c1", 0, "c1"),
      slot("s1_c2", 0, "c2"),
      slot("s_partial", 1.5, "c1"), // Solo T1 y T3
      slot("s_full", 3.0, "c1"),    // Los 4 equipos
      slot("s_another", 4.5, "c1"), // Los 4 equipos
    ];
    const availability = {
      T1: ["s1_c1", "s1_c2", "s_partial", "s_full", "s_another"],
      T2: ["s1_c1", "s1_c2", "s_full", "s_another"],
      T3: ["s1_c1", "s1_c2", "s_partial", "s_full", "s_another"],
      T4: ["s1_c1", "s1_c2", "s_full", "s_another"],
    };

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
    // Como s_full y s_another tienen a los 4 equipos disponibles (missingCount = 0),
    // se prefieren antes que s_partial (que tiene penalización por falta de T2 y T4).
    expect(["s_full", "s_another"]).toContain(slotMap.get("r2_win"));
    expect(["s_full", "s_another"]).toContain(slotMap.get("r2_lose"));
  });
  it("con múltiples zonas de 4 y franjas en distintos días, termina cada zona completa en el mismo día sin separar fechas en días distintos", () => {
    // Viernes (día 1): franjas a las 0h y 2h en c1 y c2 (4 turnos)
    // Sábado (día 2): franjas a las 20h y 22h en c1 y c2 (4 turnos)
    const slotWithDay = (id: string, hours: number, courtId: string, day: string) => {
      const s = slot(id, hours, courtId);
      s.day = day;
      return s;
    };

    const slots = [
      slotWithDay("fri_14_c1", 0, "c1", "2026-10-30"),
      slotWithDay("fri_14_c2", 0, "c2", "2026-10-30"),
      slotWithDay("fri_16_c1", 2, "c1", "2026-10-30"),
      slotWithDay("fri_16_c2", 2, "c2", "2026-10-30"),
      slotWithDay("sat_10_c1", 20, "c1", "2026-10-31"),
      slotWithDay("sat_10_c2", 20, "c2", "2026-10-31"),
      slotWithDay("sat_12_c1", 22, "c1", "2026-10-31"),
      slotWithDay("sat_12_c2", 22, "c2", "2026-10-31"),
    ];

    const g1Teams = ["T1", "T2", "T3", "T4"];
    const g2Teams = ["T5", "T6", "T7", "T8"];
    const allTeams = [...g1Teams, ...g2Teams];
    const availability = Object.fromEntries(allTeams.map((t) => [t, slots.map((s) => s.id)]));

    const matches = [
      // Zona 1 (g1): orden en bloque de grupo (order 1..2)
      { id: "g1_r1_m1", homeTeamId: "T1", awayTeamId: "T2", order: 1, groupId: "g1", round: 1 },
      { id: "g1_r1_m2", homeTeamId: "T3", awayTeamId: "T4", order: 1, groupId: "g1", round: 1 },
      { id: "g1_r2_win", homeTeamId: null, awayTeamId: null, groupTeamIds: g1Teams, feederMatchIds: ["g1_r1_m1", "g1_r1_m2"], order: 2, groupId: "g1", round: 2 },
      { id: "g1_r2_lose", homeTeamId: null, awayTeamId: null, groupTeamIds: g1Teams, feederMatchIds: ["g1_r1_m1", "g1_r1_m2"], order: 2, groupId: "g1", round: 2 },

      // Zona 2 (g2): orden en bloque de grupo (order 11..12)
      { id: "g2_r1_m1", homeTeamId: "T5", awayTeamId: "T6", order: 11, groupId: "g2", round: 1 },
      { id: "g2_r1_m2", homeTeamId: "T7", awayTeamId: "T8", order: 11, groupId: "g2", round: 1 },
      { id: "g2_r2_win", homeTeamId: null, awayTeamId: null, groupTeamIds: g2Teams, feederMatchIds: ["g2_r1_m1", "g2_r1_m2"], order: 12, groupId: "g2", round: 2 },
      { id: "g2_r2_lose", homeTeamId: null, awayTeamId: null, groupTeamIds: g2Teams, feederMatchIds: ["g2_r1_m1", "g2_r1_m2"], order: 12, groupId: "g2", round: 2 },
    ];

    const data = input({
      matches,
      slots,
      courtIds: ["c1", "c2"],
      availability,
    });

    const result = scheduleMatches(data);
    expect(result.unscheduled).toEqual([]);

    const slotMap = new Map(result.assignments.map((a) => [a.matchId, a.slotId]));
    const fridaySlotIds = ["fri_14_c1", "fri_14_c2", "fri_16_c1", "fri_16_c2"];
    const saturdaySlotIds = ["sat_10_c1", "sat_10_c2", "sat_12_c1", "sat_12_c2"];

    // Zona 1 debe completarse ENTERA el viernes
    expect(fridaySlotIds).toContain(slotMap.get("g1_r1_m1"));
    expect(fridaySlotIds).toContain(slotMap.get("g1_r1_m2"));
    expect(fridaySlotIds).toContain(slotMap.get("g1_r2_win"));
    expect(fridaySlotIds).toContain(slotMap.get("g1_r2_lose"));

    // Zona 2 debe completarse ENTERA el sábado
    expect(saturdaySlotIds).toContain(slotMap.get("g2_r1_m1"));
    expect(saturdaySlotIds).toContain(slotMap.get("g2_r1_m2"));
    expect(saturdaySlotIds).toContain(slotMap.get("g2_r2_win"));
    expect(saturdaySlotIds).toContain(slotMap.get("g2_r2_lose"));
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
    // 0 a 150 min (ideal / partidos seguidos): 0 penalización
    expect(computeGapPenalty(0)).toBe(0);
    expect(computeGapPenalty(10 * 60 * 1000)).toBe(0);
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

describe("getSlotEvaluation (identificación de franjas por colores)", () => {
  const courts = [{ id: "c1", name: "Cancha 1" }, { id: "c2", name: "Cancha 2" }];
  const testSlot = {
    id: "s1",
    startsAt: new Date(T0).toISOString(),
    endsAt: new Date(T0 + 1.5 * H).toISOString(),
    courtId: null,
  };
  const match = {
    id: "m1",
    homeTeamId: "A",
    awayTeamId: "B",
    homeName: "Pareja A",
    awayName: "Pareja B",
  };

  it("verde: disponibilidad de alguna cancha y las dos parejas pueden jugar", () => {
    const evalResult = getSlotEvaluation({
      slot: testSlot,
      match,
      courts,
      scheduled: [],
      availability: { A: ["s1"], B: ["s1"] },
    });
    expect(evalResult.status).toBe("green");
    expect(evalResult.hasCourt).toBe(true);
    expect(evalResult.homeCanPlay).toBe(true);
    expect(evalResult.awayCanPlay).toBe(true);
  });

  it("amarillo: cancha libre pero alguna pareja no puede jugar", () => {
    // A puede pero B no
    const evalResult = getSlotEvaluation({
      slot: testSlot,
      match,
      courts,
      scheduled: [],
      availability: { A: ["s1"], B: [] },
    });
    expect(evalResult.status).toBe("yellow");
    expect(evalResult.hasCourt).toBe(true);
    expect(evalResult.homeCanPlay).toBe(true);
    expect(evalResult.awayCanPlay).toBe(false);
    expect(evalResult.detail).toContain("Pareja B no puede");
  });

  it("rojo: las 2 parejas no pueden jugar en ese horario", () => {
    const evalResult = getSlotEvaluation({
      slot: testSlot,
      match,
      courts,
      scheduled: [],
      availability: { A: [], B: [] },
    });
    expect(evalResult.status).toBe("red");
    expect(evalResult.homeCanPlay).toBe(false);
    expect(evalResult.awayCanPlay).toBe(false);
    expect(evalResult.detail).toBe("Ninguna de las dos parejas puede jugar");
  });

  it("rojo: todas las canchas están ocupadas en ese horario", () => {
    // 2 canchas, ambas ocupadas por otros partidos concurrentes
    const scheduled = [
      { matchId: "o1", homeTeamId: "X", awayTeamId: "Y", courtId: "c1", start: T0, end: T0 + 1.5 * H },
      { matchId: "o2", homeTeamId: "W", awayTeamId: "Z", courtId: "c2", start: T0, end: T0 + 1.5 * H },
    ];
    const evalResult = getSlotEvaluation({
      slot: testSlot,
      match,
      courts,
      scheduled,
      availability: { A: ["s1"], B: ["s1"] },
    });
    expect(evalResult.status).toBe("red");
    expect(evalResult.hasCourt).toBe(false);
    expect(evalResult.detail).toBe("Todas las canchas ocupadas");
  });

  it("rojo: una de las parejas ya juega otro partido a esa misma hora", () => {
    const scheduled = [
      { matchId: "o1", homeTeamId: "A", awayTeamId: "X", courtId: "c1", start: T0, end: T0 + 1.5 * H },
    ];
    const evalResult = getSlotEvaluation({
      slot: testSlot,
      match,
      courts,
      scheduled,
      availability: { A: ["s1"], B: ["s1"] },
    });
    expect(evalResult.status).toBe("red");
    expect(evalResult.detail).toContain("Pareja A ya juega a esta hora");
  });
});

describe("Programación automática de cuadro / playoffs", () => {
  it("asigna partidos de playoff a franjas de playoff sin exigir disponibilidad previa de parejas", () => {
    const sGroup = { id: "sg1", start: T0, end: T0 + 1.5 * H, courtId: "c1", stage: "group" as const };
    const sPlayoff1 = { id: "sp1", start: T0 + 4 * H, end: T0 + 5.5 * H, courtId: "c1", stage: "playoff" as const };
    const sPlayoff2 = { id: "sp2", start: T0 + 6 * H, end: T0 + 7.5 * H, courtId: "c1", stage: "playoff" as const };

    const data = input({
      matches: [
        {
          id: "m-semi",
          homeTeamId: null,
          awayTeamId: null,
          stage: "playoff",
          allAvailable: true,
          order: 10100,
        },
        {
          id: "m-final",
          homeTeamId: null,
          awayTeamId: null,
          stage: "playoff",
          allAvailable: true,
          feederMatchIds: ["m-semi"],
          order: 10200,
        },
      ],
      slots: [sGroup, sPlayoff1, sPlayoff2],
      availability: {}, // Vacía: los equipos de playoff no requieren marcar disponibilidad individual
    });

    const result = scheduleMatches(data);
    expect(result.unscheduled).toEqual([]);
    expect(result.assignments).toHaveLength(2);

    const semiAssign = result.assignments.find((a) => a.matchId === "m-semi")!;
    const finalAssign = result.assignments.find((a) => a.matchId === "m-final")!;

    expect(semiAssign.slotId).toBe("sp1");
    expect(finalAssign.slotId).toBe("sp2");
    expect(semiAssign.start).toBeLessThan(finalAssign.start);
  });

  it("separa franjas de grupos de las franjas de playoffs", () => {
    const sGroup = { id: "sg1", start: T0, end: T0 + 1.5 * H, courtId: "c1", stage: "group" as const };
    const sPlayoff = { id: "sp1", start: T0 + 3 * H, end: T0 + 4.5 * H, courtId: "c1", stage: "playoff" as const };

    const data = input({
      matches: [
        {
          id: "m-group",
          homeTeamId: "T1",
          awayTeamId: "T2",
          stage: "group",
          order: 1,
        },
        {
          id: "m-playoff",
          homeTeamId: null,
          awayTeamId: null,
          stage: "playoff",
          allAvailable: true,
          order: 10000,
        },
      ],
      slots: [sGroup, sPlayoff],
      availability: { T1: ["sg1", "sp1"], T2: ["sg1", "sp1"] },
    });

    const result = scheduleMatches(data);
    expect(result.unscheduled).toEqual([]);

    const groupAssign = result.assignments.find((a) => a.matchId === "m-group")!;
    const playoffAssign = result.assignments.find((a) => a.matchId === "m-playoff")!;

    expect(groupAssign.slotId).toBe("sg1");
    expect(playoffAssign.slotId).toBe("sp1");
  });

  it("getSlotEvaluation devuelve verde para partidos de playoff aunque no haya disponibilidad en availability", () => {
    const testSlot = { id: "sp1", startsAt: new Date(T0).toISOString(), endsAt: new Date(T0 + 1.5 * H).toISOString(), courtId: "c1" };
    const evalResult = getSlotEvaluation({
      slot: testSlot,
      match: {
        id: "m-playoff-1",
        homeTeamId: "T1",
        awayTeamId: "T2",
        homeName: "Clasificado 1",
        awayName: "Clasificado 2",
        stage: "playoff",
      },
      courts: [{ id: "c1", name: "Cancha 1" }],
      scheduled: [],
      availability: { T1: [], T2: [] }, // No marcaron disponibilidad para grupos
    });

    expect(evalResult.status).toBe("green");
    expect(evalResult.homeCanPlay).toBe(true);
    expect(evalResult.awayCanPlay).toBe(true);
  });
  it("programa cruces de playoffs en orden estricto de categoría y ronda (octavos Cat 1, luego octavos Cat 2, cuartos Cat 1, cuartos Cat 2) y en paralelo si sobran canchas", () => {
    // Franjas de playoff:
    // Turno 1 (T0 + 4h): Cancha 1 y Cancha 2 (2 canchas en paralelo)
    // Turno 2 (T0 + 5.5h): Cancha 1 y Cancha 2
    // Turno 3 (T0 + 7h): Cancha 1 y Cancha 2
    const sp1_c1 = { id: "sp1_c1", start: T0 + 4 * H, end: T0 + 5.5 * H, courtId: "c1", stage: "playoff" as const };
    const sp1_c2 = { id: "sp1_c2", start: T0 + 4 * H, end: T0 + 5.5 * H, courtId: "c2", stage: "playoff" as const };
    const sp2_c1 = { id: "sp2_c1", start: T0 + 5.5 * H, end: T0 + 7 * H, courtId: "c1", stage: "playoff" as const };
    const sp2_c2 = { id: "sp2_c2", start: T0 + 5.5 * H, end: T0 + 7 * H, courtId: "c2", stage: "playoff" as const };
    const sp3_c1 = { id: "sp3_c1", start: T0 + 7 * H, end: T0 + 8.5 * H, courtId: "c1", stage: "playoff" as const };
    const sp3_c2 = { id: "sp3_c2", start: T0 + 7 * H, end: T0 + 8.5 * H, courtId: "c2", stage: "playoff" as const };

    const data = input({
      courtIds: ["c1", "c2"],
      slots: [sp1_c1, sp1_c2, sp2_c1, sp2_c2, sp3_c1, sp3_c2],
      matches: [
        // Octavos 6ta (Ronda 1, Cat 0: 6ta) -> deben ir lo más temprano posible (Turno 1 en paralelo)
        { id: "oct_6ta_1", homeTeamId: null, awayTeamId: null, stage: "playoff", allAvailable: true, categoryId: "cat-6ta", round: 1, order: 110001 },
        { id: "oct_6ta_2", homeTeamId: null, awayTeamId: null, stage: "playoff", allAvailable: true, categoryId: "cat-6ta", round: 1, order: 110002 },

        // Octavos 5ta (Ronda 1, Cat 1: 5ta) -> deben ir luego de los octavos de 6ta (Turno 2 en paralelo)
        { id: "oct_5ta_1", homeTeamId: null, awayTeamId: null, stage: "playoff", allAvailable: true, categoryId: "cat-5ta", round: 1, order: 110101 },
        { id: "oct_5ta_2", homeTeamId: null, awayTeamId: null, stage: "playoff", allAvailable: true, categoryId: "cat-5ta", round: 1, order: 110102 },

        // Cuartos 6ta (Ronda 2, Cat 0: 6ta) -> después de octavos de 6ta
        { id: "cuartos_6ta_1", homeTeamId: null, awayTeamId: null, stage: "playoff", allAvailable: true, categoryId: "cat-6ta", round: 2, feederMatchIds: ["oct_6ta_1", "oct_6ta_2"], order: 120001 },

        // Cuartos 5ta (Ronda 2, Cat 1: 5ta) -> después de octavos de 5ta
        { id: "cuartos_5ta_1", homeTeamId: null, awayTeamId: null, stage: "playoff", allAvailable: true, categoryId: "cat-5ta", round: 2, feederMatchIds: ["oct_5ta_1", "oct_5ta_2"], order: 120101 },
      ],
      availability: {},
    });

    const result = scheduleMatches(data);
    expect(result.unscheduled).toEqual([]);
    expect(result.assignments).toHaveLength(6);

    const oct6_1 = result.assignments.find((a) => a.matchId === "oct_6ta_1")!;
    const oct6_2 = result.assignments.find((a) => a.matchId === "oct_6ta_2")!;
    const oct5_1 = result.assignments.find((a) => a.matchId === "oct_5ta_1")!;
    const oct5_2 = result.assignments.find((a) => a.matchId === "oct_5ta_2")!;
    const cto6_1 = result.assignments.find((a) => a.matchId === "cuartos_6ta_1")!;
    const cto5_1 = result.assignments.find((a) => a.matchId === "cuartos_5ta_1")!;

    // 1. Octavos de 6ta arrancan en el Turno 1 (T0 + 4h) en paralelo usando c1 y c2
    expect(oct6_1.start).toBe(T0 + 4 * H);
    expect(oct6_2.start).toBe(T0 + 4 * H);
    expect(new Set([oct6_1.courtId, oct6_2.courtId])).toEqual(new Set(["c1", "c2"]));

    // 2. Octavos de 5ta van a continuación (T0 + 5.5h) en paralelo usando c1 y c2
    expect(oct5_1.start).toBe(T0 + 5.5 * H);
    expect(oct5_2.start).toBe(T0 + 5.5 * H);
    expect(new Set([oct5_1.courtId, oct5_2.courtId])).toEqual(new Set(["c1", "c2"]));

    // 3. Cuartos van en el Turno 3 (T0 + 7h) después de concluir sus respectivos octavos
    expect(cto6_1.start).toBe(T0 + 7 * H);
    expect(cto5_1.start).toBe(T0 + 7 * H);
    expect(new Set([cto6_1.courtId, cto5_1.courtId])).toEqual(new Set(["c1", "c2"]));
  });
  it("con 8 partidos de octavos en la primera categoría (16 parejas), se completan todos los 8 partidos antes de pasar a los octavos de la siguiente categoría", () => {
    // 2 canchas y 8 turnos consecutivos de 1.5 hs (16 slots de cancha en total)
    const courtIds = ["c1", "c2"];
    const slots: any[] = [];
    for (let turn = 0; turn < 8; turn++) {
      const start = T0 + (4 + turn * 1.5) * H;
      const end = start + 1.5 * H;
      slots.push({ id: `sp_${turn}_c1`, start, end, courtId: "c1", stage: "playoff" });
      slots.push({ id: `sp_${turn}_c2`, start, end, courtId: "c2", stage: "playoff" });
    }

    // 8 partidos de octavos para 6ta (16 parejas clasificadas)
    const matches6ta = Array.from({ length: 8 }, (_, i) => ({
      id: `oct_6ta_${i + 1}`,
      homeTeamId: null,
      awayTeamId: null,
      stage: "playoff" as const,
      allAvailable: true,
      categoryId: "cat-6ta",
      round: 1,
      position: i + 1,
      order: 110000 + (i + 1),
    }));

    // 8 partidos de octavos para 5ta (16 parejas clasificadas)
    const matches5ta = Array.from({ length: 8 }, (_, i) => ({
      id: `oct_5ta_${i + 1}`,
      homeTeamId: null,
      awayTeamId: null,
      stage: "playoff" as const,
      allAvailable: true,
      categoryId: "cat-5ta",
      round: 1,
      position: i + 1,
      order: 110100 + (i + 1),
    }));

    const data = input({
      courtIds,
      slots,
      matches: [...matches6ta, ...matches5ta],
      availability: {},
    });

    const result = scheduleMatches(data);
    expect(result.unscheduled).toEqual([]);
    expect(result.assignments).toHaveLength(16);

    const assigns6ta = result.assignments.filter((a) => a.matchId.startsWith("oct_6ta_"));
    const assigns5ta = result.assignments.filter((a) => a.matchId.startsWith("oct_5ta_"));

    expect(assigns6ta).toHaveLength(8);
    expect(assigns5ta).toHaveLength(8);

    // Los 8 partidos de 6ta ocupan los turnos 0, 1, 2 y 3 (4 turnos x 2 canchas = 8 partidos)
    const maxEnd6ta = Math.max(...assigns6ta.map((a) => a.end));
    const minStart6ta = Math.min(...assigns6ta.map((a) => a.start));
    expect(minStart6ta).toBe(T0 + 4 * H); // Turno 0
    expect(maxEnd6ta).toBe(T0 + (4 + 4 * 1.5) * H); // Termina exactamente al final del Turno 3 (T0 + 10h)

    // Los 8 partidos de 5ta arrancan estrictamente DESPUÉS de que concluyeron los 8 de 6ta (Turno 4 en adelante)
    const minStart5ta = Math.min(...assigns5ta.map((a) => a.start));
    expect(minStart5ta).toBeGreaterThanOrEqual(maxEnd6ta);
  });
});
