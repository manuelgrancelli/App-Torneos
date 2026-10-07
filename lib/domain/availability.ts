/**
 * Disponibilidad horaria: agrupar franjas por día y resumir quién puede
 * jugar cuándo. Funciones puras: la clave del día (que depende de la zona
 * horaria del torneo) la calcula quien llama.
 */

export type AvailabilitySlot = { id: string; startsAt: string; endsAt: string };

export type DayGroup<T> = { day: string; slots: T[] };

export type AvailabilityWindow<T = AvailabilitySlot> = {
  id: string;
  day: string;
  startsAt: string;
  endsAt: string;
  slots: T[];
  slotIds: string[];
};

export type DayWindows<T = AvailabilitySlot> = {
  day: string;
  windows: AvailabilityWindow<T>[];
};

/** Agrupa franjas por día respetando el orden cronológico. */
export function groupSlotsByDay<T extends AvailabilitySlot>(slots: readonly T[], dayOf: (slot: T) => string): DayGroup<T>[] {
  const sorted = [...slots].sort((a, b) => a.startsAt.localeCompare(b.startsAt) || a.id.localeCompare(b.id));
  const groups: DayGroup<T>[] = [];
  for (const slot of sorted) {
    const day = dayOf(slot);
    const last = groups[groups.length - 1];
    if (last && last.day === day) last.slots.push(slot);
    else groups.push({ day, slots: [slot] });
  }
  return groups;
}

/**
 * Agrupa los turnos individuales de un día en intervalos o franjas completas continuas
 * (con pausas entre turnos de hasta maxBreakMinutes, por defecto 45 min).
 * Permite que los participantes elijan la franja completa (ej. "09:00 a 15:00")
 * en vez de tener que seleccionar cada intervalo de 1 hora individualmente.
 */
export function groupDaySlotsIntoWindows<T extends AvailabilitySlot>(
  day: string,
  daySlots: readonly T[],
  maxBreakMinutes = 45,
): AvailabilityWindow<T>[] {
  if (daySlots.length === 0) return [];

  const sorted = [...daySlots].sort(
    (a, b) =>
      Date.parse(a.startsAt) - Date.parse(b.startsAt) ||
      Date.parse(a.endsAt) - Date.parse(b.endsAt) ||
      a.id.localeCompare(b.id),
  );

  const maxBreakMs = maxBreakMinutes * 60 * 1000;
  const windows: AvailabilityWindow<T>[] = [];
  let current: {
    startsAt: string;
    endsAt: string;
    startMs: number;
    endMs: number;
    slots: T[];
  } | null = null;

  for (const slot of sorted) {
    const slotStartMs = Date.parse(slot.startsAt);
    const slotEndMs = Date.parse(slot.endsAt);

    if (!current) {
      current = {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        startMs: slotStartMs,
        endMs: slotEndMs,
        slots: [slot],
      };
    } else if (slotStartMs <= current.endMs + maxBreakMs) {
      // Turno continuo o superpuesto dentro de la misma franja
      current.slots.push(slot);
      if (slotEndMs > current.endMs) {
        current.endMs = slotEndMs;
        current.endsAt = slot.endsAt;
      }
    } else {
      windows.push({
        id: `${day}-w${windows.length + 1}`,
        day,
        startsAt: current.startsAt,
        endsAt: current.endsAt,
        slots: current.slots,
        slotIds: current.slots.map((s) => s.id),
      });
      current = {
        startsAt: slot.startsAt,
        endsAt: slot.endsAt,
        startMs: slotStartMs,
        endMs: slotEndMs,
        slots: [slot],
      };
    }
  }

  if (current) {
    windows.push({
      id: `${day}-w${windows.length + 1}`,
      day,
      startsAt: current.startsAt,
      endsAt: current.endsAt,
      slots: current.slots,
      slotIds: current.slots.map((s) => s.id),
    });
  }

  return windows;
}

/** Agrupa los turnos de todos los días en franjas completas por día. */
export function groupSlotsIntoDayWindows<T extends AvailabilitySlot>(
  slots: readonly T[],
  dayOf: (slot: T) => string,
  maxBreakMinutes = 45,
): DayWindows<T>[] {
  const dayGroups = groupSlotsByDay(slots, dayOf);
  return dayGroups.map(({ day, slots: daySlots }) => ({
    day,
    windows: groupDaySlotsIntoWindows(day, daySlots, maxBreakMinutes),
  }));
}

export type AvailabilitySummary = {
  /** Cantidad de equipos disponibles por franja. */
  bySlot: Map<string, number>;
  /** Cantidad de franjas marcadas por equipo. */
  byTeam: Map<string, number>;
  /** Equipos que no marcaron ninguna franja. */
  teamsWithoutAvailability: string[];
  /** Franjas en las que no puede nadie. */
  emptySlots: string[];
  has: (teamId: string, slotId: string) => boolean;
};

/** Resume la disponibilidad de los equipos sobre las franjas del torneo. */
export function summarizeAvailability(
  teamIds: readonly string[],
  slotIds: readonly string[],
  rows: readonly { teamId: string; slotId: string }[],
): AvailabilitySummary {
  const teams = new Set(teamIds);
  const slots = new Set(slotIds);
  const pairs = new Set<string>();
  const bySlot = new Map(slotIds.map((id) => [id, 0]));
  const byTeam = new Map(teamIds.map((id) => [id, 0]));

  for (const { teamId, slotId } of rows) {
    const key = `${teamId}|${slotId}`;
    if (!teams.has(teamId) || !slots.has(slotId) || pairs.has(key)) continue;
    pairs.add(key);
    bySlot.set(slotId, (bySlot.get(slotId) ?? 0) + 1);
    byTeam.set(teamId, (byTeam.get(teamId) ?? 0) + 1);
  }

  return {
    bySlot,
    byTeam,
    teamsWithoutAvailability: teamIds.filter((id) => (byTeam.get(id) ?? 0) === 0),
    emptySlots: slotIds.filter((id) => (bySlot.get(id) ?? 0) === 0),
    has: (teamId, slotId) => pairs.has(`${teamId}|${slotId}`),
  };
}

/** Diferencia entre la selección guardada y la actual (para el aviso de "cambios sin guardar"). */
export function selectionChanged(saved: ReadonlySet<string>, current: ReadonlySet<string>): boolean {
  if (saved.size !== current.size) return true;
  for (const id of saved) if (!current.has(id)) return true;
  return false;
}

/** Separa una lista pegada de emails ("a@x.com, b@y.com\nc@z.com") en emails normalizados únicos. */
export function parseEmailList(text: string): string[] {
  const emails = text
    .split(/[\s,;]+/)
    .map((value) => value.trim().toLowerCase())
    .filter(Boolean);
  return [...new Set(emails)];
}
