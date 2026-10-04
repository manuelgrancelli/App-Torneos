/**
 * Generador de franjas horarias en lote. Trabaja con horas "de reloj" locales
 * del torneo ("YYYY-MM-DD" + "HH:mm"); la conversión a timestamptz la hace
 * quien persiste, con la zona horaria del torneo (D-010).
 */

export type LocalSlot = {
  /** Fecha local "YYYY-MM-DD". */
  date: string;
  /** Hora local de inicio "HH:mm". */
  start: string;
  /** Hora local de fin "HH:mm" (24:00 = medianoche del fin del día). */
  end: string;
};

export type SlotGeneratorInput = {
  dates: readonly string[];
  /** Primera hora posible "HH:mm". */
  from: string;
  /** Hora límite "HH:mm": la última franja termina a esta hora o antes. */
  to: string;
  durationMinutes: number;
  /** Pausa entre franjas consecutivas. */
  breakMinutes?: number;
};

export const MAX_GENERATED_SLOTS = 500;

const DATE_RE = /^\d{4}-(0[1-9]|1[0-2])-(0[1-9]|[12]\d|3[01])$/;
const TIME_RE = /^([01]\d|2[0-3]):[0-5]\d$|^24:00$/;

/** "HH:mm" → minutos desde las 00:00. */
export function timeToMinutes(time: string): number {
  if (!TIME_RE.test(time)) throw new RangeError(`Hora inválida: "${time}".`);
  const [hours, minutes] = time.split(":").map(Number);
  return (hours ?? 0) * 60 + (minutes ?? 0);
}

/** Minutos desde las 00:00 → "HH:mm". */
export function minutesToTime(total: number): string {
  const hours = Math.floor(total / 60);
  const minutes = total % 60;
  return `${String(hours).padStart(2, "0")}:${String(minutes).padStart(2, "0")}`;
}

export function isValidLocalDate(date: string): boolean {
  if (!DATE_RE.test(date)) return false;
  const parsed = new Date(`${date}T00:00:00Z`);
  return parsed.toISOString().startsWith(date);
}

export type SlotGeneration = { ok: true; slots: LocalSlot[] } | { ok: false; errors: string[] };

/**
 * Genera franjas consecutivas de `durationMinutes` (con `breakMinutes` entre
 * medio) desde `from` hasta `to`, para cada fecha. Una franja que no entra
 * completa antes de `to` se descarta.
 */
export function generateSlots(input: SlotGeneratorInput): SlotGeneration {
  const errors: string[] = [];
  const breakMinutes = input.breakMinutes ?? 0;

  if (input.dates.length === 0) errors.push("Elegí al menos un día.");
  for (const date of input.dates) {
    if (!isValidLocalDate(date)) errors.push(`Fecha inválida: "${date}".`);
  }
  if (!Number.isInteger(input.durationMinutes) || input.durationMinutes < 15 || input.durationMinutes > 480) {
    errors.push("La duración tiene que estar entre 15 y 480 minutos.");
  }
  if (!Number.isInteger(breakMinutes) || breakMinutes < 0 || breakMinutes > 240) {
    errors.push("La pausa tiene que estar entre 0 y 240 minutos.");
  }

  let from = 0;
  let to = 0;
  try {
    from = timeToMinutes(input.from);
    to = timeToMinutes(input.to);
    if (from >= to) errors.push("La hora de fin tiene que ser posterior a la de inicio.");
  } catch (error) {
    errors.push(error instanceof Error ? error.message : "Hora inválida.");
  }

  if (errors.length > 0) return { ok: false, errors };

  const perDay: { start: number; end: number }[] = [];
  for (let start = from; start + input.durationMinutes <= to; start += input.durationMinutes + breakMinutes) {
    perDay.push({ start, end: start + input.durationMinutes });
  }
  if (perDay.length === 0) {
    return { ok: false, errors: ["Con esa duración no entra ninguna franja en el horario elegido."] };
  }

  const dates = [...new Set(input.dates)].sort();
  if (perDay.length * dates.length > MAX_GENERATED_SLOTS) {
    return { ok: false, errors: [`Se generarían más de ${MAX_GENERATED_SLOTS} franjas: achicá el rango.`] };
  }

  const slots = dates.flatMap((date) =>
    perDay.map(({ start, end }) => ({ date, start: minutesToTime(start), end: minutesToTime(end) })),
  );
  return { ok: true, slots };
}
