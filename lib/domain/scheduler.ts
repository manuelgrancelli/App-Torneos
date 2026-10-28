/**
 * Programación automática de partidos en franjas horarias y canchas.
 *
 * Restricciones (duras):
 * - Los dos equipos tienen que haber marcado disponibilidad en la franja.
 * - Un equipo no juega dos partidos superpuestos en el tiempo.
 * - Una cancha no tiene dos partidos superpuestos.
 * - Un partido no empieza antes de `notBefore` (en playoffs: después de los
 *   partidos que lo alimentan).
 *
 * Se trabaja con intervalos de tiempo (no con ids de franja): dos franjas
 * distintas pueden superponerse (p. ej. una general y otra de una cancha).
 *
 * Algoritmo: MRV (primero los partidos con menos opciones) + backtracking con
 * poda por cota superior y tope de iteraciones. Si no existe una asignación
 * completa, devuelve la mejor parcial encontrada. Es determinístico.
 */

export type SchedulerSlot = {
  id: string;
  /** Epoch en milisegundos. */
  start: number;
  end: number;
  /** null = la franja sirve para cualquier cancha. */
  courtId: string | null;
  day?: string;
};

export type SchedulerMatch = {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  /** No programar antes de este instante (epoch ms). */
  notBefore?: number;
  /** Desempate de orden (p. ej. número de fecha): menor primero. */
  order?: number;
  /** Partidos antecedentes (feeders) que deben terminar antes de este partido. */
  feederMatchIds?: readonly string[];
  /** Equipos del grupo si los rivales todavía no están definidos (ej. zona de 4). */
  groupTeamIds?: readonly string[];
  /** ID del grupo al que pertenece el partido. */
  groupId?: string;
  /** Número de ronda (ej. 1 o 2). */
  round?: number;
  /** Instante ideal para jugar después del anterior (epoch ms). */
  idealAfter?: number;
};

/** Partido que ya ocupa recursos y no se mueve (fijado a mano, jugado o no reprogramado). */
export type FixedAssignment = {
  matchId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  courtId: string | null;
  start: number;
  end: number;
  groupTeamIds?: readonly string[];
  groupId?: string;
  round?: number;
  day?: string;
};

export type ScheduleInput = {
  matches: readonly SchedulerMatch[];
  slots: readonly SchedulerSlot[];
  /** Canchas del torneo, en orden de preferencia. */
  courtIds: readonly string[];
  /** Franjas disponibles por equipo: teamId → ids de franja. */
  availability: Readonly<Record<string, readonly string[]>>;
  fixed?: readonly FixedAssignment[];
  maxIterations?: number;
};

export type Assignment = {
  matchId: string;
  slotId: string;
  courtId: string;
  start: number;
  end: number;
};

export type UnscheduledReason =
  /** En playoffs, todavía no se conocen los dos equipos. */
  | "missing_teams"
  /** No hay ninguna franja (válida) donde ambos equipos puedan jugar. */
  | "no_common_availability"
  /** Hay franjas en común, pero están ocupadas por otros partidos. */
  | "no_capacity";

export type ScheduleResult = {
  assignments: Assignment[];
  unscheduled: { matchId: string; reason: UnscheduledReason }[];
  /** true si se exploró todo el espacio (no se cortó por el tope de iteraciones). */
  exhaustive: boolean;
};

export const UNSCHEDULED_REASON_LABELS: Record<UnscheduledReason, string> = {
  missing_teams: "Todavía no se conocen los dos equipos.",
  no_common_availability: "Los equipos no tienen franjas en común.",
  no_capacity: "Las franjas en común ya están ocupadas.",
};

type Candidate = { slotId: string; courtId: string; start: number; end: number; day?: string };
type Interval = {
  start: number;
  end: number;
  matchId?: string;
  groupId?: string;
  round?: number;
  day?: string;
};

const DEFAULT_MAX_ITERATIONS = 150_000;

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/**
 * Penalización por distancia/descanso entre dos partidos consecutivos de un equipo o grupo.
 * - 0 a 2.5 horas: descanso ideal y partidos seguidos sin penalización (0 pts).
 * - 2.5 a 4.5 horas: espera aceptable en el club (10 pts por hora extra).
 * - 4.5 a 8 horas: espera larga/incómoda (20 + 25 pts por hora extra).
 * - > 8 horas (noche o días distintos): penalización severa (120 + 60 pts por hora extra).
 */
export function computeGapPenalty(gapMs: number): number {
  if (gapMs < 0) return 100_000;
  const gapMinutes = gapMs / (60 * 1000);
  if (gapMinutes <= 150) {
    return 0;
  }
  const excessHours = (gapMinutes - 150) / 60;
  if (excessHours <= 2) {
    return excessHours * 10;
  }
  if (excessHours <= 5.5) {
    return 20 + (excessHours - 2) * 25;
  }
  return 120 + (excessHours - 5.5) * 60;
}

/** Ocupación de canchas como lista de intervalos (estricta: una cancha nunca puede tener dos partidos simultáneos). */
class CourtOccupancy {
  private readonly busy = new Map<string, Interval[]>();

  isFree(courtId: string, interval: Interval): boolean {
    return !(this.busy.get(courtId) ?? []).some((other) => overlaps(other, interval));
  }

  add(courtId: string, interval: Interval): void {
    const list = this.busy.get(courtId);
    if (list) list.push(interval);
    else this.busy.set(courtId, [interval]);
  }

  remove(courtId: string, interval: Interval): void {
    const list = this.busy.get(courtId);
    const index = list?.lastIndexOf(interval) ?? -1;
    if (list && index >= 0) list.splice(index, 1);
  }

  getIntervals(courtId: string): readonly Interval[] {
    return this.busy.get(courtId) ?? [];
  }
}

/** Ocupación de equipos como lista de intervalos. */
class TeamOccupancy {
  private readonly busy = new Map<string, Interval[]>();

  isFree(teamId: string, interval: Interval): boolean {
    return !(this.busy.get(teamId) ?? []).some((other) => {
      if (!overlaps(other, interval)) return false;
      // En una zona de 4, los dos partidos de la misma fecha (ganadores y perdedores)
      // reparten los 4 equipos del grupo en dos cruces disjuntos. No chocan entre sí para los equipos.
      if (
        other.groupId &&
        interval.groupId &&
        other.groupId === interval.groupId &&
        other.round !== undefined &&
        interval.round !== undefined &&
        other.round === interval.round &&
        other.matchId !== interval.matchId
      ) {
        return false;
      }
      return true;
    });
  }

  add(teamId: string, interval: Interval): void {
    const list = this.busy.get(teamId);
    if (list) list.push(interval);
    else this.busy.set(teamId, [interval]);
  }

  remove(teamId: string, interval: Interval): void {
    const list = this.busy.get(teamId);
    const index = list?.lastIndexOf(interval) ?? -1;
    if (list && index >= 0) list.splice(index, 1);
  }

  getIntervals(teamId: string): readonly Interval[] {
    return this.busy.get(teamId) ?? [];
  }
}

function candidatePenalty(
  match: SchedulerMatch,
  candidate: Candidate,
  teams: TeamOccupancy,
  assignedIntervals: Map<string, Interval>,
  fixedIntervals: Map<string, Interval>,
  availability: Map<string, Set<string>>,
): number {
  let penalty = 0;
  const teamsToCheck =
    match.homeTeamId && match.awayTeamId
      ? [match.homeTeamId, match.awayTeamId]
      : match.groupTeamIds ?? [];

  for (const teamId of teamsToCheck) {
    const intervals = teams.getIntervals(teamId);
    let prevEnd: number | null = null;
    let nextStart: number | null = null;

    for (const iv of intervals) {
      // Ignorar partido hermano de la misma fecha en la misma zona de 4
      if (
        iv.groupId &&
        match.groupId &&
        iv.groupId === match.groupId &&
        iv.round !== undefined &&
        match.round !== undefined &&
        iv.round === match.round
      ) {
        continue;
      }
      if (iv.end <= candidate.start) {
        if (prevEnd === null || iv.end > prevEnd) prevEnd = iv.end;
      }
      if (iv.start >= candidate.end) {
        if (nextStart === null || iv.start < nextStart) nextStart = iv.start;
      }
    }

    if (prevEnd !== null) {
      penalty += computeGapPenalty(candidate.start - prevEnd);
    }
    if (nextStart !== null) {
      penalty += computeGapPenalty(nextStart - candidate.end);
    }
  }

  // Si los rivales del grupo aún no están definidos (fecha 2 en zona de 4), penalizar
  // franjas donde falten parejas para preferir en primer lugar aquellas donde los 4 puedan jugar.
  if ((!match.homeTeamId || !match.awayTeamId) && match.groupTeamIds && match.groupTeamIds.length > 0) {
    const missingCount = match.groupTeamIds.filter((t) => !availability.get(t)?.has(candidate.slotId)).length;
    penalty += missingCount * 30;
  }

  if (match.feederMatchIds && match.feederMatchIds.length > 0) {
    let latestFeederEnd: number | null = null;
    for (const feederId of match.feederMatchIds) {
      const fIv = assignedIntervals.get(feederId) ?? fixedIntervals.get(feederId);
      if (fIv && (latestFeederEnd === null || fIv.end > latestFeederEnd)) {
        latestFeederEnd = fIv.end;
      }
    }
    if (latestFeederEnd !== null) {
      if (candidate.start < latestFeederEnd) {
        return Number.POSITIVE_INFINITY;
      }
      penalty += computeGapPenalty(candidate.start - latestFeederEnd);
    }
  }

  if (match.idealAfter !== undefined && candidate.start >= match.idealAfter) {
    penalty += computeGapPenalty(candidate.start - match.idealAfter);
  }

  // Si el partido pertenece a un grupo, asegurar que TODOS los partidos del mismo grupo
  // se jueguen en el MISMO DÍA y en horarios contiguos/cercanos (sin dividirlos entre días distintos).
  if (match.groupId) {
    let diffDayMatches = 0;
    let groupPrevEnd: number | null = null;
    let groupNextStart: number | null = null;

    const checkGroupInterval = (iv: Interval) => {
      if (iv.groupId !== match.groupId || iv.matchId === match.id) return;

      const isDiffDay =
        candidate.day && iv.day
          ? candidate.day !== iv.day
          : Math.abs(candidate.start - iv.start) > 12 * 60 * 60 * 1000;

      if (isDiffDay) {
        diffDayMatches++;
      } else {
        if (iv.end <= candidate.start) {
          if (groupPrevEnd === null || iv.end > groupPrevEnd) groupPrevEnd = iv.end;
        }
        if (iv.start >= candidate.end) {
          if (groupNextStart === null || iv.start < groupNextStart) groupNextStart = iv.start;
        }
      }
    };

    for (const iv of assignedIntervals.values()) {
      checkGroupInterval(iv);
    }
    for (const iv of fixedIntervals.values()) {
      checkGroupInterval(iv);
    }

    if (diffDayMatches > 0) {
      // Penalización severa por mandar partidos de la misma zona a días diferentes
      penalty += diffDayMatches * 30_000;
    }

    if (groupPrevEnd !== null) {
      penalty += computeGapPenalty(candidate.start - groupPrevEnd);
    }
    if (groupNextStart !== null) {
      penalty += computeGapPenalty(groupNextStart - candidate.end);
    }
  }

  return penalty;
}

export function scheduleMatches(input: ScheduleInput): ScheduleResult {
  const maxIterations = input.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const availability = new Map(Object.entries(input.availability).map(([team, slots]) => [team, new Set(slots)]));
  const teams = new TeamOccupancy();
  const courts = new CourtOccupancy();

  // Lo fijo ocupa recursos desde el arranque.
  const fixedIntervals = new Map<string, Interval>();
  for (const fixed of input.fixed ?? []) {
    const interval: Interval = {
      start: fixed.start,
      end: fixed.end,
      matchId: fixed.matchId,
      groupId: fixed.groupId,
      round: fixed.round,
      day: fixed.day,
    };
    fixedIntervals.set(fixed.matchId, interval);
    if (fixed.homeTeamId) teams.add(fixed.homeTeamId, interval);
    if (fixed.awayTeamId) teams.add(fixed.awayTeamId, interval);
    if (fixed.courtId) courts.add(fixed.courtId, interval);
    if (!fixed.homeTeamId && !fixed.awayTeamId && fixed.groupTeamIds) {
      for (const t of fixed.groupTeamIds) teams.add(t, interval);
    }
  }

  // Franjas ordenadas cronológicamente (y por id para desempatar, determinismo).
  const slots = [...input.slots].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const courtOrder = new Map(input.courtIds.map((id, index) => [id, index]));
  const matchMap = new Map(input.matches.map((m) => [m.id, m]));
  const fixedMap = new Map((input.fixed ?? []).map((f) => [f.matchId, f]));

  const unscheduled: ScheduleResult["unscheduled"] = [];
  const candidates = new Map<string, Candidate[]>();

  for (const match of input.matches) {
    const isDefined = Boolean(match.homeTeamId && match.awayTeamId);
    const isGroupUnresolved = !isDefined && Boolean(match.groupTeamIds && match.groupTeamIds.length > 0);

    if (!isDefined && !isGroupUnresolved) {
      unscheduled.push({ matchId: match.id, reason: "missing_teams" });
      continue;
    }

    // Para partidos de zona de 4 donde aún no se conocen los rivales de fecha 2,
    // buscamos los cruces antecedentes (feeders de fecha 1).
    let feeder1Teams: string[] = [];
    let feeder2Teams: string[] = [];
    let hasFeederTeams = false;

    if (isGroupUnresolved && match.feederMatchIds && match.feederMatchIds.length === 2) {
      const [f1Id, f2Id] = match.feederMatchIds;
      if (f1Id && f2Id) {
        const f1 = matchMap.get(f1Id) ?? fixedMap.get(f1Id);
        const f2 = matchMap.get(f2Id) ?? fixedMap.get(f2Id);
        feeder1Teams = [f1?.homeTeamId, f1?.awayTeamId].filter((t): t is string => Boolean(t));
        feeder2Teams = [f2?.homeTeamId, f2?.awayTeamId].filter((t): t is string => Boolean(t));
        hasFeederTeams = feeder1Teams.length > 0 && feeder2Teams.length > 0;
      }
    }

    const list: Candidate[] = [];
    for (const slot of slots) {
      if (isDefined) {
        const homeOk = availability.get(match.homeTeamId!)?.has(slot.id) ?? false;
        const awayOk = availability.get(match.awayTeamId!)?.has(slot.id) ?? false;
        if (!homeOk || !awayOk) continue;
      } else if (hasFeederTeams) {
        // En fecha 2 de zona de 4 (ganador vs ganador o perdedor vs perdedor),
        // la franja es viable si al menos 1 equipo de la llave 1 y al menos 1 equipo de la llave 2 pueden jugar.
        const f1CanPlay = feeder1Teams.some((t) => availability.get(t)?.has(slot.id));
        const f2CanPlay = feeder2Teams.some((t) => availability.get(t)?.has(slot.id));
        if (!f1CanPlay || !f2CanPlay) continue;
      } else if (match.groupTeamIds) {
        // Fallback: al menos 2 integrantes del grupo tienen disponibilidad en la franja
        const availCount = match.groupTeamIds.filter((t) => availability.get(t)?.has(slot.id)).length;
        if (availCount < 2) continue;
      }

      if (match.notBefore !== undefined && slot.start < match.notBefore) continue;
      const slotCourts = slot.courtId ? [slot.courtId] : input.courtIds;
      for (const courtId of slotCourts) {
        list.push({ slotId: slot.id, courtId, start: slot.start, end: slot.end, day: slot.day });
      }
    }

    // Más temprano primero; a igual horario, la cancha preferida.
    // En partidos de grupo, priorizar franjas donde todos los integrantes del grupo estén disponibles.
    if (isGroupUnresolved && match.groupTeamIds) {
      const missing = (slotId: string) =>
        match.groupTeamIds!.filter((t) => !availability.get(t)?.has(slotId)).length;
      list.sort(
        (a, b) =>
          missing(a.slotId) - missing(b.slotId) ||
          a.start - b.start ||
          (courtOrder.get(a.courtId) ?? Number.MAX_SAFE_INTEGER) - (courtOrder.get(b.courtId) ?? Number.MAX_SAFE_INTEGER) ||
          a.slotId.localeCompare(b.slotId),
      );
    } else {
      list.sort(
        (a, b) =>
          a.start - b.start ||
          (courtOrder.get(a.courtId) ?? Number.MAX_SAFE_INTEGER) - (courtOrder.get(b.courtId) ?? Number.MAX_SAFE_INTEGER) ||
          a.slotId.localeCompare(b.slotId),
      );
    }

    if (list.length === 0) unscheduled.push({ matchId: match.id, reason: "no_common_availability" });
    else candidates.set(match.id, list);
  }

  // MRV + orden de rondas: rondas anteriores (order menor) se programan primero
  // para que las rondas siguientes conozcan exactamente el horario de sus feeders y partidos previos.
  const order = input.matches
    .filter((match) => candidates.has(match.id))
    .sort(
      (a, b) =>
        (a.order ?? 0) - (b.order ?? 0) ||
        (candidates.get(a.id)?.length ?? 0) - (candidates.get(b.id)?.length ?? 0) ||
        a.id.localeCompare(b.id),
    );

  const current: Assignment[] = [];
  const assignedIntervals = new Map<string, Interval>();
  let currentPenalty = 0;
  let best: Assignment[] = [];
  let bestPenalty = Number.POSITIVE_INFINITY;
  let iterations = 0;
  let aborted = false;

  const search = (index: number): void => {
    iterations++;
    if (iterations > maxIterations) {
      aborted = true;
      return;
    }
    // Cota superior de partidos: aunque se asignen todos los que faltan, ¿se supera la mejor cantidad?
    if (current.length + (order.length - index) < best.length) return;
    if (current.length + (order.length - index) === best.length && currentPenalty >= bestPenalty) return;

    if (index === order.length) {
      if (current.length > best.length || (current.length === best.length && currentPenalty < bestPenalty)) {
        best = [...current];
        bestPenalty = currentPenalty;
      }
      return;
    }

    const match = order[index] as SchedulerMatch;
    const matchCandidates = candidates.get(match.id) ?? [];
    const teamsToCheck =
      match.homeTeamId && match.awayTeamId
        ? [match.homeTeamId, match.awayTeamId]
        : match.groupTeamIds ?? [];

    const scoredCandidates: { candidate: Candidate; penalty: number; interval: Interval }[] = [];

    for (const candidate of matchCandidates) {
      const interval: Interval = {
        start: candidate.start,
        end: candidate.end,
        matchId: match.id,
        groupId: match.groupId,
        round: match.round,
        day: candidate.day,
      };
      if (!courts.isFree(candidate.courtId, interval)) continue;

      let teamsFree = true;
      for (const t of teamsToCheck) {
        if (!teams.isFree(t, interval)) {
          teamsFree = false;
          break;
        }
      }
      if (!teamsFree) continue;

      const p = candidatePenalty(match, candidate, teams, assignedIntervals, fixedIntervals, availability);
      if (!Number.isFinite(p)) continue;

      scoredCandidates.push({ candidate, penalty: p, interval });
    }

    scoredCandidates.sort(
      (a, b) =>
        a.penalty - b.penalty ||
        a.candidate.start - b.candidate.start ||
        (courtOrder.get(a.candidate.courtId) ?? Number.MAX_SAFE_INTEGER) -
          (courtOrder.get(b.candidate.courtId) ?? Number.MAX_SAFE_INTEGER) ||
        a.candidate.slotId.localeCompare(b.candidate.slotId),
    );

    for (const { candidate, penalty, interval } of scoredCandidates) {
      if (current.length + (order.length - index) === best.length && currentPenalty + penalty >= bestPenalty) {
        continue;
      }

      for (const t of teamsToCheck) teams.add(t, interval);
      courts.add(candidate.courtId, interval);
      assignedIntervals.set(match.id, interval);
      current.push({ matchId: match.id, ...candidate });
      currentPenalty += penalty;

      search(index + 1);

      currentPenalty -= penalty;
      current.pop();
      assignedIntervals.delete(match.id);
      courts.remove(candidate.courtId, interval);
      for (const t of teamsToCheck) teams.remove(t, interval);

      if (aborted || (best.length === order.length && bestPenalty === 0)) return;
    }

    // Probar dejándolo sin horario (quizás así entran más partidos).
    search(index + 1);
  };

  search(0);

  const assigned = new Set(best.map((assignment) => assignment.matchId));
  for (const match of order) {
    if (!assigned.has(match.id)) unscheduled.push({ matchId: match.id, reason: "no_capacity" });
  }

  const matchIndex = new Map(input.matches.map((match, index) => [match.id, index]));
  const byInputOrder = (a: { matchId: string }, b: { matchId: string }) =>
    (matchIndex.get(a.matchId) ?? 0) - (matchIndex.get(b.matchId) ?? 0);

  return {
    assignments: [...best].sort(byInputOrder),
    unscheduled: unscheduled.sort(byInputOrder),
    exhaustive: !aborted,
  };
}

/**
 * Valida una asignación manual contra la ocupación existente. Devuelve los
 * conflictos que la bloquean y las advertencias (disponibilidad no marcada).
 */
export function checkManualAssignment(params: {
  match: { id: string; homeTeamId: string | null; awayTeamId: string | null; homeName?: string; awayName?: string };
  slot: SchedulerSlot;
  courtId: string;
  others: readonly FixedAssignment[];
  availability: Readonly<Record<string, readonly string[]>>;
}): { conflicts: string[]; warnings: string[] } {
  const { match, slot, courtId, others, availability } = params;
  const interval = { start: slot.start, end: slot.end };
  const conflicts: string[] = [];
  const warnings: string[] = [];

  if (slot.courtId && slot.courtId !== courtId) {
    conflicts.push("Esa franja es de otra cancha.");
  }

  for (const other of others) {
    if (other.matchId === match.id) continue;
    const isOverlapping = overlaps(interval, other);
    if (isOverlapping) {
      if (other.courtId === courtId) conflicts.push("La cancha ya tiene otro partido en ese horario.");
      const teamsInOther = [other.homeTeamId, other.awayTeamId].filter(Boolean);
      if ([match.homeTeamId, match.awayTeamId].some((team) => team && teamsInOther.includes(team))) {
        conflicts.push("Un equipo ya juega otro partido en ese horario.");
      }
    }
  }

  for (const team of [match.homeTeamId, match.awayTeamId]) {
    if (team && !(availability[team] ?? []).includes(slot.id)) {
      warnings.push("Uno de los equipos no marcó disponibilidad en esa franja.");
    }
  }

  return { conflicts: [...new Set(conflicts)], warnings: [...new Set(warnings)] };
}

export type SlotStatus = "green" | "yellow" | "red";

export type SlotEvaluation = {
  status: SlotStatus;
  hasCourt: boolean;
  homeCanPlay: boolean;
  awayCanPlay: boolean;
  label: string;
  detail: string | null;
  busyCourtsCount: number;
  totalCourtsCount: number;
  freeCourtsCount: number;
};

/**
 * Evalúa la disponibilidad de una franja horaria para un partido según:
 * - Verde: disponibilidad de alguna cancha y ambas parejas pueden jugar.
 * - Amarillo: hay cancha libre, pero exactamente una de las parejas no puede jugar.
 * - Rojo: todas las canchas están ocupadas, o ninguna de las parejas puede jugar (o choque de horario).
 */
export function getSlotEvaluation(params: {
  slot: { id: string; startsAt: string; endsAt: string; courtId: string | null };
  match: { id: string; homeTeamId: string | null; awayTeamId: string | null; homeName?: string; awayName?: string };
  courts: readonly { id: string; name: string }[];
  scheduled: readonly FixedAssignment[];
  availability: Readonly<Record<string, readonly string[]>>;
}): SlotEvaluation {
  const { slot, match, courts, scheduled, availability } = params;
  const start = Date.parse(slot.startsAt);
  const end = Date.parse(slot.endsAt);
  const interval = { start, end };

  // Partidos concurrentes (que se superponen en el tiempo con esta franja)
  const overlapping = scheduled.filter(
    (o) => o.matchId !== match.id && overlaps(interval, o),
  );

  // 1. Canchas
  const totalCourtsCount = Math.max(courts.length, 1);
  let hasCourt = true;
  let busyCourtsCount = 0;

  if (slot.courtId) {
    // La franja está fija a una cancha específica
    const courtBusy = overlapping.some((o) => o.courtId === slot.courtId);
    hasCourt = !courtBusy;
    busyCourtsCount = courtBusy ? 1 : 0;
  } else {
    // La franja es general para el torneo
    busyCourtsCount = overlapping.length;
    hasCourt = busyCourtsCount < totalCourtsCount;
  }
  const freeCourtsCount = Math.max(0, totalCourtsCount - busyCourtsCount);

  // 2. Disponibilidad de las parejas
  const hasGlobalAvailability = Object.keys(availability).length > 0;

  // Choque de horario con otro partido
  const homeClash = Boolean(
    match.homeTeamId &&
      overlapping.some((o) => o.homeTeamId === match.homeTeamId || o.awayTeamId === match.homeTeamId),
  );
  const awayClash = Boolean(
    match.awayTeamId &&
      overlapping.some((o) => o.homeTeamId === match.awayTeamId || o.awayTeamId === match.awayTeamId),
  );

  // Marcó disponibilidad
  const homeAvailable = match.homeTeamId
    ? hasGlobalAvailability
      ? (availability[match.homeTeamId] ?? []).includes(slot.id)
      : true
    : true;

  const awayAvailable = match.awayTeamId
    ? hasGlobalAvailability
      ? (availability[match.awayTeamId] ?? []).includes(slot.id)
      : true
    : true;

  const homeCanPlay = !homeClash && homeAvailable;
  const awayCanPlay = !awayClash && awayAvailable;

  const homeName = match.homeName || "Pareja 1";
  const awayName = match.awayName || "Pareja 2";

  // 3. Clasificación de color:
  // ROJO: Todas las canchas ocupadas O las 2 parejas no pueden jugar (o choque duro)
  const isAllCourtsBusy = !hasCourt;
  const isBothCannotPlay = !homeCanPlay && !awayCanPlay;
  const isHardClash = homeClash || awayClash;

  if (isAllCourtsBusy || isBothCannotPlay || isHardClash) {
    let detail = "No disponible";
    if (isAllCourtsBusy) {
      detail = slot.courtId ? "Cancha ocupada" : "Todas las canchas ocupadas";
    } else if (homeClash && awayClash) {
      detail = "Ambas parejas ya juegan a esta hora";
    } else if (homeClash) {
      detail = `${homeName} ya juega a esta hora`;
    } else if (awayClash) {
      detail = `${awayName} ya juega a esta hora`;
    } else if (isBothCannotPlay) {
      detail = "Ninguna de las dos parejas puede jugar";
    }

    return {
      status: "red",
      hasCourt,
      homeCanPlay,
      awayCanPlay,
      label: "No disponible",
      detail,
      busyCourtsCount,
      totalCourtsCount,
      freeCourtsCount,
    };
  }

  // AMARILLO: Alguna pareja no puede jugar (y hay cancha disponible)
  if (!homeCanPlay || !awayCanPlay) {
    let detail = "1 pareja no disponible";
    if (!homeCanPlay) {
      detail = `${homeName} no puede en este horario`;
    } else if (!awayCanPlay) {
      detail = `${awayName} no puede en este horario`;
    }

    return {
      status: "yellow",
      hasCourt: true,
      homeCanPlay,
      awayCanPlay,
      label: "Una pareja no puede",
      detail,
      busyCourtsCount,
      totalCourtsCount,
      freeCourtsCount,
    };
  }

  // VERDE: Disponibilidad de alguna cancha Y las dos parejas pueden jugar
  return {
    status: "green",
    hasCourt: true,
    homeCanPlay: true,
    awayCanPlay: true,
    label: "Disponible",
    detail: freeCourtsCount > 1 ? `${freeCourtsCount} canchas libres` : "Cancha libre",
    busyCourtsCount,
    totalCourtsCount,
    freeCourtsCount,
  };
}

