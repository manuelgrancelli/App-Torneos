import { describe, expect, it } from "vitest";
import { generateSlots, isValidLocalDate, minutesToTime, timeToMinutes } from "./slots";

describe("conversión de horas", () => {
  it("ida y vuelta", () => {
    expect(timeToMinutes("09:30")).toBe(570);
    expect(timeToMinutes("24:00")).toBe(1440);
    expect(minutesToTime(570)).toBe("09:30");
    expect(() => timeToMinutes("25:00")).toThrow(RangeError);
    expect(() => timeToMinutes("9:30")).toThrow(RangeError);
  });

  it("valida fechas reales", () => {
    expect(isValidLocalDate("2026-02-28")).toBe(true);
    expect(isValidLocalDate("2026-02-30")).toBe(false);
    expect(isValidLocalDate("2026-13-01")).toBe(false);
  });
});

describe("generateSlots", () => {
  it("franjas consecutivas que entran completas en el horario", () => {
    const result = generateSlots({ dates: ["2026-10-10"], from: "09:00", to: "13:00", durationMinutes: 90 });
    expect(result).toEqual({
      ok: true,
      slots: [
        { date: "2026-10-10", start: "09:00", end: "10:30" },
        { date: "2026-10-10", start: "10:30", end: "12:00" },
      ],
    });
  });

  it("respeta la pausa, ordena y deduplica fechas", () => {
    const result = generateSlots({
      dates: ["2026-10-11", "2026-10-10", "2026-10-10"],
      from: "18:00",
      to: "24:00",
      durationMinutes: 60,
      breakMinutes: 30,
    });
    expect(result.ok && result.slots.map((s) => `${s.date} ${s.start}-${s.end}`)).toEqual([
      "2026-10-10 18:00-19:00",
      "2026-10-10 19:30-20:30",
      "2026-10-10 21:00-22:00",
      "2026-10-10 22:30-23:30",
      "2026-10-11 18:00-19:00",
      "2026-10-11 19:30-20:30",
      "2026-10-11 21:00-22:00",
      "2026-10-11 22:30-23:30",
    ]);
  });

  it("errores de validación", () => {
    expect(generateSlots({ dates: [], from: "10:00", to: "09:00", durationMinutes: 10 })).toEqual({
      ok: false,
      errors: [
        "Elegí al menos un día.",
        "La duración tiene que estar entre 15 y 480 minutos.",
        "La hora de fin tiene que ser posterior a la de inicio.",
      ],
    });
    expect(generateSlots({ dates: ["2026-10-10"], from: "10:00", to: "10:30", durationMinutes: 60 })).toEqual({
      ok: false,
      errors: ["Con esa duración no entra ninguna franja en el horario elegido."],
    });
    expect(generateSlots({ dates: ["x"], from: "9", to: "10:00", durationMinutes: 60, breakMinutes: -1 }).ok).toBe(false);
  });

  it("limita la cantidad total de franjas", () => {
    const dates = Array.from({ length: 40 }, (_, i) => `2026-10-${String((i % 28) + 1).padStart(2, "0")}`);
    const many = Array.from({ length: 31 }, (_, i) => `2026-11-${String((i % 30) + 1).padStart(2, "0")}`);
    const result = generateSlots({ dates: [...dates, ...many], from: "00:00", to: "24:00", durationMinutes: 60 });
    expect(result).toEqual({ ok: false, errors: ["Se generarían más de 500 franjas: achicá el rango."] });
  });
});
