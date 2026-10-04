import { describe, expect, it } from "vitest";
import {
  formatDateRange,
  formatDayHeading,
  formatInTimeZone,
  formatShortDate,
  formatTimeRange,
  groupByLocalDay,
  listDates,
  localDateKey,
  localToUtcIso,
  todayInTimeZone,
} from "./dates";

describe("localToUtcIso", () => {
  it("Argentina (UTC-3, sin horario de verano)", () => {
    expect(localToUtcIso("2026-10-10", "09:00", "America/Argentina/Buenos_Aires")).toBe("2026-10-10T12:00:00.000Z");
  });

  it("24:00 es medianoche del día siguiente", () => {
    expect(localToUtcIso("2026-10-10", "24:00", "America/Argentina/Buenos_Aires")).toBe("2026-10-11T03:00:00.000Z");
  });

  it("respeta el horario de verano (Madrid)", () => {
    expect(localToUtcIso("2026-01-15", "10:00", "Europe/Madrid")).toBe("2026-01-15T09:00:00.000Z");
    expect(localToUtcIso("2026-07-15", "10:00", "Europe/Madrid")).toBe("2026-07-15T08:00:00.000Z");
  });
});

describe("formato en la zona del torneo", () => {
  const iso = "2026-10-10T12:00:00.000Z";

  it("muestra la hora local, no la del servidor", () => {
    expect(formatInTimeZone(iso, "America/Argentina/Buenos_Aires", "HH:mm")).toBe("09:00");
    expect(formatInTimeZone(iso, "Europe/Madrid", "HH:mm")).toBe("14:00");
    expect(formatTimeRange(iso, "2026-10-10T13:30:00.000Z", "America/Argentina/Buenos_Aires")).toBe("09:00–10:30");
  });

  it("agrupa por día local", () => {
    // 01:00 UTC del 11 = 22:00 del 10 en Argentina.
    expect(localDateKey("2026-10-11T01:00:00.000Z", "America/Argentina/Buenos_Aires")).toBe("2026-10-10");
    expect(todayInTimeZone("America/Argentina/Buenos_Aires", new Date("2026-10-11T01:00:00.000Z"))).toBe("2026-10-10");
  });
});

describe("fechas calendario", () => {
  it("encabezados y fechas cortas en español", () => {
    expect(formatDayHeading("2026-10-10")).toBe("sábado 10 de octubre");
    expect(formatShortDate("2026-10-10")).toBe("10 oct 2026");
  });

  it("rangos", () => {
    expect(formatDateRange("2026-10-10", "2026-10-10")).toBe("10 de octubre de 2026");
    expect(formatDateRange("2026-10-10", "2026-10-11")).toBe("10 al 11 de octubre de 2026");
    expect(formatDateRange("2026-09-30", "2026-10-02")).toBe("30 de septiembre al 2 de octubre de 2026");
    expect(formatDateRange("2026-12-30", "2027-01-02")).toBe("30 de diciembre de 2026 al 2 de enero de 2027");
  });

  it("lista los días del torneo", () => {
    expect(listDates("2026-10-30", "2026-11-02")).toEqual(["2026-10-30", "2026-10-31", "2026-11-01", "2026-11-02"]);
    expect(listDates("2026-10-10", "2026-10-09")).toEqual([]);
    expect(listDates("2026-01-01", "2026-12-31", 5)).toHaveLength(5);
  });
});

describe("groupByLocalDay", () => {
  const BA = "America/Argentina/Buenos_Aires";
  const MADRID = "Europe/Madrid";

  it("agrupa por día local, ordena por horario y deja los sin horario al final", () => {
    const items = [
      { id: "c", startsAt: "2026-10-11T13:00:00.000Z", tz: BA },
      { id: "x", startsAt: null, tz: BA },
      { id: "b", startsAt: "2026-10-10T22:00:00.000Z", tz: BA },
      { id: "a", startsAt: "2026-10-10T12:00:00.000Z", tz: BA },
      // 01:30 del 11 en UTC = 22:30 del 10 en Buenos Aires.
      { id: "d", startsAt: "2026-10-11T01:30:00.000Z", tz: BA },
    ];
    const groups = groupByLocalDay(items, (i) => i.tz);
    expect(groups.map((g) => [g.day, g.items.map((i) => i.id)])).toEqual([
      ["2026-10-10", ["a", "b", "d"]],
      ["2026-10-11", ["c"]],
      [null, ["x"]],
    ]);
  });

  it("usa la zona de cada ítem y no parte un mismo día en dos grupos", () => {
    const items = [
      // 23:00 UTC del 10 = 01:00 del 11 en Madrid.
      { id: "madrid", startsAt: "2026-10-10T23:00:00.000Z", tz: MADRID },
      // 00:00 UTC del 11 = 21:00 del 10 en Buenos Aires.
      { id: "ba", startsAt: "2026-10-11T00:00:00.000Z", tz: BA },
    ];
    const groups = groupByLocalDay(items, (i) => i.tz);
    expect(groups.map((g) => [g.day, g.items.map((i) => i.id)])).toEqual([
      ["2026-10-10", ["ba"]],
      ["2026-10-11", ["madrid"]],
    ]);
  });

  it("devuelve vacío sin ítems", () => {
    expect(groupByLocalDay([], () => BA)).toEqual([]);
  });
});
