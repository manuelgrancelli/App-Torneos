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
};

export type SchedulerMatch = {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  /** No programar antes de este instante (epoch ms). */
  notBefore?: number;
  /** Desempate de orden (p. ej. número de fecha): menor primero. */
  order?: number;
};

/** Partido que ya ocupa recursos y no se mueve (fijado a mano, jugado o no reprogramado). */
export type FixedAssignment = {
  matchId: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  courtId: string | null;
  start: number;
  end: number;
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

type Candidate = { slotId: string; courtId: string; start: number; end: number };
type Interval = { start: number; end: number };

const DEFAULT_MAX_ITERATIONS = 50_000;

function overlaps(a: Interval, b: Interval): boolean {
  return a.start < b.end && b.start < a.end;
}

/** Ocupación de un recurso (equipo o cancha) como lista de intervalos. */
class Occupancy {
  private readonly busy = new Map<string, Interval[]>();

  isFree(key: string, interval: Interval): boolean {
    return !(this.busy.get(key) ?? []).some((other) => overlaps(other, interval));
  }

  add(key: string, interval: Interval): void {
    const list = this.busy.get(key);
    if (list) list.push(interval);
    else this.busy.set(key, [interval]);
  }

  remove(key: string, interval: Interval): void {
    const list = this.busy.get(key);
    const index = list?.lastIndexOf(interval) ?? -1;
    if (list && index >= 0) list.splice(index, 1);
  }
}

export function scheduleMatches(input: ScheduleInput): ScheduleResult {
  const maxIterations = input.maxIterations ?? DEFAULT_MAX_ITERATIONS;
  const availability = new Map(Object.entries(input.availability).map(([team, slots]) => [team, new Set(slots)]));
  const teams = new Occupancy();
  const courts = new Occupancy();

  // Lo fijo ocupa recursos desde el arranque.
  for (const fixed of input.fixed ?? []) {
    const interval = { start: fixed.start, end: fixed.end };
    if (fixed.homeTeamId) teams.add(fixed.homeTeamId, interval);
    if (fixed.awayTeamId) teams.add(fixed.awayTeamId, interval);
    if (fixed.courtId) courts.add(fixed.courtId, interval);
  }

  // Franjas ordenadas cronológicamente (y por id para desempatar, determinismo).
  const slots = [...input.slots].sort((a, b) => a.start - b.start || a.id.localeCompare(b.id));
  const courtOrder = new Map(input.courtIds.map((id, index) => [id, index]));

  const unscheduled: ScheduleResult["unscheduled"] = [];
  const candidates = new Map<string, Candidate[]>();

  for (const match of input.matches) {
    const { homeTeamId: home, awayTeamId: away } = match;
    if (!home || !away) {
      unscheduled.push({ matchId: match.id, reason: "missing_teams" });
      continue;
    }
    const homeSlots = availability.get(home);
    const awaySlots = availability.get(away);
    const list: Candidate[] = [];
    for (const slot of slots) {
      if (!homeSlots?.has(slot.id) || !awaySlots?.has(slot.id)) continue;
      if (match.notBefore !== undefined && slot.start < match.notBefore) continue;
      const slotCourts = slot.courtId ? [slot.courtId] : input.courtIds;
      for (const courtId of slotCourts) {
        list.push({ slotId: slot.id, courtId, start: slot.start, end: slot.end });
      }
    }
    // Más temprano primero; a igual horario, la cancha preferida.
    list.sort(
      (a, b) =>
        a.start - b.start ||
        (courtOrder.get(a.courtId) ?? Number.MAX_SAFE_INTEGER) - (courtOrder.get(b.courtId) ?? Number.MAX_SAFE_INTEGER) ||
        a.slotId.localeCompare(b.slotId),
    );
    if (list.length === 0) unscheduled.push({ matchId: match.id, reason: "no_common_availability" });
    else candidates.set(match.id, list);
  }

  // MRV: primero el partido con menos opciones.
  const order = input.matches
    .filter((match) => candidates.has(match.id))
    .sort(
      (a, b) =>
        (candidates.get(a.id)?.length ?? 0) - (candidates.get(b.id)?.length ?? 0) ||
        (a.order ?? 0) - (b.order ?? 0) ||
        a.id.localeCompare(b.id),
    );

  const current: Assignment[] = [];
  let best: Assignment[] = [];
  let iterations = 0;
  let aborted = false;

  const search = (index: number): void => {
    iterations++;
    if (iterations > maxIterations) {
      aborted = true;
      return;
    }
    // Cota superior: aunque se asignen todos los que faltan, ¿se supera la mejor?
    if (current.length + (order.length - index) <= best.length) return;
    if (index === order.length) {
      best = [...current];
      return;
    }

    const match = order[index] as SchedulerMatch;
    const home = match.homeTeamId as string;
    const away = match.awayTeamId as string;

    for (const candidate of candidates.get(match.id) ?? []) {
      const interval = { start: candidate.start, end: candidate.end };
      if (!teams.isFree(home, interval) || !teams.isFree(away, interval) || !courts.isFree(candidate.courtId, interval)) {
        continue;
      }
      teams.add(home, interval);
      teams.add(away, interval);
      courts.add(candidate.courtId, interval);
      current.push({ matchId: match.id, ...candidate });

      search(index + 1);

      current.pop();
      courts.remove(candidate.courtId, interval);
      teams.remove(away, interval);
      teams.remove(home, interval);

      if (aborted || best.length === order.length) return;
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
  match: { id: string; homeTeamId: string | null; awayTeamId: string | null };
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
    if (other.matchId === match.id || !overlaps(interval, other)) continue;
    if (other.courtId === courtId) conflicts.push("La cancha ya tiene otro partido en ese horario.");
    const teamsInOther = [other.homeTeamId, other.awayTeamId].filter(Boolean);
    if ([match.homeTeamId, match.awayTeamId].some((team) => team && teamsInOther.includes(team))) {
      conflicts.push("Un equipo ya juega otro partido en ese horario.");
    }
  }

  for (const team of [match.homeTeamId, match.awayTeamId]) {
    if (team && !(availability[team] ?? []).includes(slot.id)) {
      warnings.push("Uno de los equipos no marcó disponibilidad en esa franja.");
    }
  }

  return { conflicts: [...new Set(conflicts)], warnings: [...new Set(warnings)] };
}
