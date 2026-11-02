import { describe, expect, it } from "vitest";
import { drawGroups } from "./groups";
import { generateRoundRobin } from "./round-robin";
import {
  type ScheduleInput,
  type SchedulerMatch,
  type SchedulerSlot,
  scheduleMatches,
} from "./scheduler";
import { computeStandings, type StandingsConfig } from "./standings";
import { buildBracket, type Qualifier, type PlayoffConfig } from "./bracket";
import { type MatchResult, type ScoringConfig } from "./scoring";

describe("Mega Torneo Simulation: 8 Categorías (108 parejas, 4 canchas, Mié-Dom)", () => {
  it("ejecuta el ciclo de vida completo sin errores y con alto rendimiento", { timeout: 30000 }, () => {
    const startTime = Date.now();

    // 1. CONFIGURACIÓN DEL TORNEO
    // 8 categorías: 4 con 12 parejas y 4 con 15 parejas = 108 parejas
    const categories = [
      { id: "cat-1", name: "4ta Caballeros", teamCount: 12 },
      { id: "cat-2", name: "5ta Caballeros", teamCount: 12 },
      { id: "cat-3", name: "6ta Caballeros", teamCount: 12 },
      { id: "cat-4", name: "7ma Caballeros", teamCount: 12 },
      { id: "cat-5", name: "3ra Damas", teamCount: 15 },
      { id: "cat-6", name: "4ta Damas", teamCount: 15 },
      { id: "cat-7", name: "5ta Damas", teamCount: 15 },
      { id: "cat-8", name: "6ta Damas", teamCount: 15 },
    ];

    const courts = ["court-1", "court-2", "court-3", "court-4"];

    // Fechas: Miércoles a Domingo
    // Mié: 2026-11-04, Jue: 2026-11-05, Vie: 2026-11-06 (Fase de grupos: 09:00 a 22:00)
    // Sáb: 2026-11-07, Dom: 2026-11-08 (Playoffs: 08:00 a 22:00)
    const H = 60 * 60 * 1000;
    const M60 = 1.0 * H; // 60 minutos predeterminados por partido

    const slots: SchedulerSlot[] = [];
    let slotIdCounter = 1;

    // Miércoles, Jueves, Viernes (Fase de grupos: 09:00 a 22:00 = 13 turnos de 60m por día)
    const groupDays = ["2026-11-04", "2026-11-05", "2026-11-06"];
    for (const day of groupDays) {
      let t = Date.parse(`${day}T09:00:00-03:00`);
      const dayEnd = Date.parse(`${day}T22:00:00-03:00`);
      while (t + M60 <= dayEnd) {
        slots.push({
          id: `slot-group-${slotIdCounter++}`,
          start: t,
          end: t + M60,
          courtId: null,
          day,
          stage: "group",
        });
        t += M60;
      }
    }

    // Sábado y Domingo (Playoffs: 08:00 a 22:00 = 14 turnos de 60m por día)
    const playoffDays = ["2026-11-07", "2026-11-08"];
    for (const day of playoffDays) {
      let t = Date.parse(`${day}T08:00:00-03:00`);
      const dayEnd = Date.parse(`${day}T22:00:00-03:00`);
      while (t + M60 <= dayEnd) {
        slots.push({
          id: `slot-playoff-${slotIdCounter++}`,
          start: t,
          end: t + M60,
          courtId: null,
          day,
          stage: "playoff",
        });
        t += M60;
      }
    }

    // Capacidad de turnos de grupos:
    const groupSlots = slots.filter((s) => s.stage === "group");
    const playoffSlots = slots.filter((s) => s.stage === "playoff");
    expect(groupSlots.length).toBeGreaterThanOrEqual(24);
    expect(playoffSlots.length).toBeGreaterThanOrEqual(18);

    // 2. CREACIÓN DE PAREJAS Y DISPONIBILIDAD HORARIA
    // Cada categoría tiene sus parejas identificadas con nombres realistas
    type TeamInfo = { id: string; name: string; categoryId: string };
    const allTeams: TeamInfo[] = [];
    const teamAvailability: Record<string, string[]> = {};
    const groupSlotIds = groupSlots.map((s) => s.id);

    categories.forEach((cat, catIdx) => {
      for (let i = 1; i <= cat.teamCount; i++) {
        const teamId = `team-${cat.id}-${i}`;
        const teamName = `Pareja ${i} (${cat.name})`;
        allTeams.push({ id: teamId, name: teamName, categoryId: cat.id });

        // Disponibilidad realista: parejas con restricciones (ej. solo tardes/noches o solo mañanas)
        // Con franjas de 60m (capacidad 156 vs 108 partidos), el scheduler programa el 100% incluso con restricciones
        const offset = (catIdx * 3 + i) % 4;
        const available = groupSlotIds.filter((_, idx) => (idx + offset) % 3 !== 0 || idx >= 25);
        teamAvailability[teamId] = available;
      }
    });

    expect(allTeams).toHaveLength(108);

    // 3. SORTEO Y GENERACIÓN DE GRUPOS
    // Para 12 parejas: 4 zonas de 3 parejas (12 partidos)
    // Para 15 parejas: 5 zonas de 3 parejas (15 partidos)
    type GroupSim = {
      id: string;
      name: string;
      categoryId: string;
      teamIds: string[];
    };
    const allGroups: GroupSim[] = [];
    type MatchSim = {
      id: string;
      categoryId: string;
      groupId: string;
      homeTeamId: string;
      awayTeamId: string;
      stage: "group" | "playoff";
      round: number;
      position: number;
      result?: MatchResult;
      winnerTeamId?: string;
    };
    const groupMatches: MatchSim[] = [];

    categories.forEach((cat) => {
      const catTeamIds = allTeams.filter((t) => t.categoryId === cat.id).map((t) => t.id);
      const groupCount = cat.teamCount === 12 ? 4 : 5;
      const drawn = drawGroups(catTeamIds, groupCount, 12345, teamAvailability);

      expect(drawn).toHaveLength(groupCount);
      drawn.forEach((teamList) => {
        expect(teamList).toHaveLength(3); // Cada zona tiene exactamente 3 parejas
      });

      drawn.forEach((teamList, gIdx) => {
        const groupId = `grp-${cat.id}-${gIdx + 1}`;
        const groupLetter = String.fromCharCode(65 + gIdx);
        allGroups.push({
          id: groupId,
          name: `Zona ${groupLetter}`,
          categoryId: cat.id,
          teamIds: teamList,
        });

        // Generar partidos todos contra todos en la zona (round robin para 3 equipos = 3 partidos)
        const rr = generateRoundRobin(teamList);
        const pairings = rr.flatMap((r) => r.pairings);
        expect(pairings).toHaveLength(3);

        pairings.forEach((m, mIdx) => {
          groupMatches.push({
            id: `match-${groupId}-${mIdx + 1}`,
            categoryId: cat.id,
            groupId,
            homeTeamId: m.home,
            awayTeamId: m.away,
            stage: "group",
            round: mIdx + 1,
            position: mIdx + 1,
          });
        });
      });
    });

    // 4 categorías x 12 partidos (4x3) + 4 categorías x 15 partidos (5x3) = 48 + 60 = 108 partidos
    expect(groupMatches).toHaveLength(108);

    // 4. PROGRAMACIÓN AUTOMÁTICA DE LA FASE DE GRUPOS (SCHEDULER ENGINE)
    const schedulerMatches: SchedulerMatch[] = groupMatches.map((m, idx) => ({
      id: m.id,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      groupId: m.groupId,
      categoryId: m.categoryId,
      order: idx + 1,
      stage: "group",
    }));

    const scheduleInput: ScheduleInput = {
      matches: schedulerMatches,
      slots: groupSlots,
      courtIds: courts,
      availability: teamAvailability,
      maxIterations: 50000,
    };

    const scheduleResult = scheduleMatches(scheduleInput);

    console.log("Scheduler outcome:", {
      assigned: scheduleResult.assignments.length,
      unscheduled: scheduleResult.unscheduled,
      groupSlotsCount: groupSlots.length,
      capacity: groupSlots.length * courts.length,
    });
    // Verificar que se hayan asignado turnos a los partidos sin colisiones
    expect(scheduleResult.assignments.length).toBeGreaterThan(0);
    expect(scheduleResult.assignments.length).toBe(108); // ¡100% de los 108 partidos programados!
    expect(scheduleResult.unscheduled).toHaveLength(0);

    // Validar invariantes de no solapamiento: ninguna cancha tiene 2 partidos simultáneos
    const slotCourtUsage = new Set<string>();
    scheduleResult.assignments.forEach((a) => {
      const key = `${a.slotId}-${a.courtId}`;
      expect(slotCourtUsage.has(key)).toBe(false);
      slotCourtUsage.add(key);
    });

    // 5. SIMULACIÓN DE RESULTADOS DE LA FASE DE GRUPOS
    // Configuración estándar de pádel (sets a 6 con supertiebreak)
    const padelScoring: ScoringConfig = {
      type: "sets",
      bestOf: 3,
      gamesPerSet: 6,
      tiebreak: true,
      decidingSet: "super_tiebreak",
      superTiebreakPoints: 10,
      superTiebreakUntil: "all",
    };
    const padelStandings: StandingsConfig = {
      points: { win: 2, draw: 0, loss: 1 },
      tiebreakers: ["points", "wins", "head_to_head", "set_diff", "game_diff"],
    };

    groupMatches.forEach((m, idx) => {
      // Simular resultado determinístico
      const homeWins = (idx % 2 === 0);
      const winner = homeWins ? m.homeTeamId : m.awayTeamId;
      const sets = homeWins
        ? [{ home: 6, away: 4 }, { home: 6, away: 3 }]
        : [{ home: 3, away: 6 }, { home: 4, away: 6 }];

      m.result = {
        type: "sets",
        sets,
      };
      m.winnerTeamId = winner;
    });

    // 6. CALCULAR TABLAS DE POSICIONES Y CLASIFICADOS EN LAS 8 CATEGORÍAS
    // En las zonas de 3 pasan los 2 primeros a Playoffs
    const champions: Record<string, string> = {};

    categories.forEach((cat) => {
      const catGroups = allGroups.filter((g) => g.categoryId === cat.id);
      const catQualifiers: Qualifier[] = [];

      catGroups.forEach((grp, gIdx) => {
        const grpMatches = groupMatches
          .filter((m) => m.groupId === grp.id)
          .map((m) => ({
            homeTeamId: m.homeTeamId,
            awayTeamId: m.awayTeamId,
            result: m.result ?? null,
            winnerTeamId: m.winnerTeamId ?? null,
            isDraw: false,
          }));

        const standings = computeStandings({
          teamIds: grp.teamIds,
          matches: grpMatches,
          scoring: padelScoring,
          config: padelStandings,
          seed: 42 + gIdx,
        });
        expect(standings).toHaveLength(3);

        // Los dos primeros clasifican (place 1 y place 2)
        catQualifiers.push({
          teamId: standings[0]!.teamId,
          group: gIdx,
          place: 1,
          rating: [standings[0]!.points, standings[0]!.won],
        });
        catQualifiers.push({
          teamId: standings[1]!.teamId,
          group: gIdx,
          place: 2,
          rating: [standings[1]!.points, standings[1]!.won],
        });
      });

      // 4 zonas de 3 = 8 clasificados
      // 5 zonas de 3 = 10 clasificados
      if (cat.teamCount === 12) {
        expect(catQualifiers).toHaveLength(8);
      } else {
        expect(catQualifiers).toHaveLength(10);
      }

      // 7. GENERACIÓN Y SIMULACIÓN DEL CUADRO DE PLAYOFFS
      const bracketPlan = buildBracket(catQualifiers, { thirdPlace: false });
      expect(bracketPlan.matches.length).toBeGreaterThan(0);

      // Simular rondas de playoffs hasta definir el campeón
      const rounds = bracketPlan.rounds;
      const matchesByRound = new Map<number, typeof bracketPlan.matches>();
      for (let r = 1; r <= rounds; r++) {
        matchesByRound.set(r, bracketPlan.matches.filter((m) => m.round === r));
      }

      for (let r = 1; r <= rounds; r++) {
        const roundMatches = matchesByRound.get(r) ?? [];
        for (const match of roundMatches) {
          if (match.isBye) {
            // Ya tiene winnerTeamId asignado por el bye
            continue;
          }
          // Si ambos equipos están asignados, simular partido
          expect(match.home).not.toBeNull();
          expect(match.away).not.toBeNull();
          const winner = match.home!; // simular que gana el local
          match.winnerTeamId = winner;

          // Propagar al siguiente partido
          if (match.next) {
            const nextMatch = bracketPlan.matches.find((m) => m.key === match.next!.key);
            expect(nextMatch).toBeDefined();
            nextMatch![match.next.side] = winner;
          }
        }
      }

      // El partido final debe tener un campeón
      const finalMatch = bracketPlan.matches.find((m) => m.round === rounds && !m.isThirdPlace);
      expect(finalMatch).toBeDefined();
      expect(finalMatch?.winnerTeamId).toBeDefined();
      champions[cat.id] = finalMatch!.winnerTeamId!;
    });

    // Las 8 categorías deben tener su campeón definido sin excepciones
    expect(Object.keys(champions)).toHaveLength(8);
    for (const cat of categories) {
      expect(champions[cat.id]).toBeDefined();
    }

    const elapsed = Date.now() - startTime;
    console.log(`[Mega Torneo Simulation] 8 categorías, 108 parejas, 108 partidos de zona y 8 cuadros de playoff completados en ${elapsed}ms`);
    expect(elapsed).toBeLessThan(25000); // Menos de 25 segundos bajo carga concurrente de vitest
  });
});
