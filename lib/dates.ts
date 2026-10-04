import { TZDate } from "@date-fns/tz";
import { addDays, differenceInCalendarDays, format } from "date-fns";
import { es } from "date-fns/locale";

/**
 * Fechas y horas con la zona horaria del torneo (D-010). El servidor puede
 * correr en UTC: nunca se formatea con la zona del proceso.
 */

export const DEFAULT_TIMEZONE = "America/Argentina/Buenos_Aires";

/** Zonas ofrecidas al crear un torneo (Argentina y región; ampliable). */
export const TIMEZONE_OPTIONS = [
  { value: "America/Argentina/Buenos_Aires", label: "Argentina (Buenos Aires)" },
  { value: "America/Argentina/Cordoba", label: "Argentina (Córdoba)" },
  { value: "America/Argentina/Mendoza", label: "Argentina (Mendoza)" },
  { value: "America/Montevideo", label: "Uruguay" },
  { value: "America/Santiago", label: "Chile" },
  { value: "America/Asuncion", label: "Paraguay" },
  { value: "America/Sao_Paulo", label: "Brasil (São Paulo)" },
  { value: "America/La_Paz", label: "Bolivia" },
  { value: "America/Lima", label: "Perú" },
  { value: "America/Bogota", label: "Colombia" },
  { value: "America/Mexico_City", label: "México (CDMX)" },
  { value: "Europe/Madrid", label: "España (Madrid)" },
] as const;

export type TimezoneOption = (typeof TIMEZONE_OPTIONS)[number]["value"];

function parseDateParts(date: string): [number, number, number] {
  const [year, month, day] = date.split("-").map(Number);
  return [year ?? 1970, (month ?? 1) - 1, day ?? 1];
}

/** "YYYY-MM-DD" + "HH:mm" en la zona `timeZone` → ISO en UTC. "24:00" = 00:00 del día siguiente. */
export function localToUtcIso(date: string, time: string, timeZone: string): string {
  const [year, month, day] = parseDateParts(date);
  const [hours, minutes] = time.split(":").map(Number);
  const instant = new TZDate(year, month, day, hours ?? 0, minutes ?? 0, timeZone);
  // TZDate.toISOString() devuelve el offset de la zona; se normaliza a UTC ("Z").
  return new Date(instant.getTime()).toISOString();
}

/** Formatea un instante (ISO o Date) en la zona del torneo, en español. */
export function formatInTimeZone(value: string | Date, timeZone: string, pattern: string): string {
  return format(new TZDate(new Date(value).getTime(), timeZone), pattern, { locale: es });
}

/** Fecha local "YYYY-MM-DD" de un instante en la zona del torneo (para agrupar por día). */
export function localDateKey(value: string | Date, timeZone: string): string {
  return formatInTimeZone(value, timeZone, "yyyy-MM-dd");
}

/** "09:00–10:30" en la zona del torneo. */
export function formatTimeRange(start: string | Date, end: string | Date, timeZone: string): string {
  return `${formatInTimeZone(start, timeZone, "HH:mm")}–${formatInTimeZone(end, timeZone, "HH:mm")}`;
}

/** "sábado 10 de octubre" a partir de "YYYY-MM-DD" (fecha calendario, sin zona). */
export function formatDayHeading(date: string): string {
  const [year, month, day] = parseDateParts(date);
  return format(new Date(year, month, day), "EEEE d 'de' MMMM", { locale: es });
}

/** "10 oct 2026" a partir de "YYYY-MM-DD". */
export function formatShortDate(date: string): string {
  const [year, month, day] = parseDateParts(date);
  return format(new Date(year, month, day), "d MMM yyyy", { locale: es });
}

/** Rango de fechas del torneo: "10 al 11 de octubre de 2026", "30 de sep. al 2 de oct. de 2026"… */
export function formatDateRange(startsOn: string, endsOn: string): string {
  const [sy, sm, sd] = parseDateParts(startsOn);
  const [ey, em, ed] = parseDateParts(endsOn);
  const start = new Date(sy, sm, sd);
  const end = new Date(ey, em, ed);
  const long = (d: Date) => format(d, "d 'de' MMMM 'de' yyyy", { locale: es });

  if (startsOn === endsOn) return long(start);
  if (sy === ey && sm === em) return `${sd} al ${long(end)}`;
  if (sy === ey) return `${format(start, "d 'de' MMMM", { locale: es })} al ${long(end)}`;
  return `${long(start)} al ${long(end)}`;
}

/** Días calendario entre dos fechas, inclusive ("YYYY-MM-DD"). Máximo `limit` días. */
export function listDates(startsOn: string, endsOn: string, limit = 62): string[] {
  const [sy, sm, sd] = parseDateParts(startsOn);
  const [ey, em, ed] = parseDateParts(endsOn);
  const start = new Date(sy, sm, sd);
  const days = Math.min(differenceInCalendarDays(new Date(ey, em, ed), start) + 1, limit);
  return Array.from({ length: Math.max(days, 0) }, (_, i) => format(addDays(start, i), "yyyy-MM-dd"));
}

/** Hoy en la zona del torneo ("YYYY-MM-DD"). */
export function todayInTimeZone(timeZone: string, now: Date = new Date()): string {
  return localDateKey(now, timeZone);
}

export type DayGroup<T> = {
  /** "YYYY-MM-DD" en la zona de cada ítem; null = sin horario. */
  day: string | null;
  items: T[];
};

/**
 * Agrupa por día local (cada ítem en su zona: un usuario puede jugar torneos
 * en zonas distintas). Ordena por horario; los "sin horario" van al final.
 */
export function groupByLocalDay<T extends { startsAt: string | null }>(
  items: readonly T[],
  timeZoneOf: (item: T) => string,
): DayGroup<T>[] {
  // Primero por día local y después por instante: con zonas distintas, el
  // orden por instante solo podría partir un mismo día en dos grupos.
  const keyed = items.map((item) => ({
    item,
    day: item.startsAt ? localDateKey(item.startsAt, timeZoneOf(item)) : null,
    time: item.startsAt ? new Date(item.startsAt).getTime() : 0,
  }));
  keyed.sort((a, b) => {
    if (a.day !== b.day) {
      if (a.day === null) return 1;
      if (b.day === null) return -1;
      return a.day < b.day ? -1 : 1;
    }
    return a.time - b.time;
  });
  const groups: DayGroup<T>[] = [];
  for (const { item, day } of keyed) {
    const last = groups.at(-1);
    if (last && last.day === day) last.items.push(item);
    else groups.push({ day, items: [item] });
  }
  return groups;
}
