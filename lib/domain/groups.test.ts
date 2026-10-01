import { describe, expect, it } from "vitest";
import { drawGroups, groupCountOptions, groupName, validateGroups } from "./groups";

const teams = (n: number) => Array.from({ length: n }, (_, i) => `t${i + 1}`);

describe("groupName / groupCountOptions", () => {
  it("nombra con letras", () => {
    expect(groupName(0)).toBe("Grupo A");
    expect(groupName(25)).toBe("Grupo Z");
    expect(() => groupName(26)).toThrow(RangeError);
  });

  it("ofrece cantidades con grupos de al menos 2", () => {
    expect(groupCountOptions(7)).toEqual([1, 2, 3]);
    expect(groupCountOptions(1)).toEqual([]);
  });
});

describe("drawGroups", () => {
  it("reparte todos los equipos con tamaños que difieren a lo sumo en 1", () => {
    const groups = drawGroups(teams(11), 3, 123);
    expect(groups.flat().sort()).toEqual(teams(11).sort());
    const sizes = groups.map((g) => g.length);
    expect(Math.max(...sizes) - Math.min(...sizes)).toBeLessThanOrEqual(1);
  });

  it("es reproducible con la misma semilla y cambia con otra", () => {
    expect(drawGroups(teams(8), 2, 5)).toEqual(drawGroups(teams(8), 2, 5));
    expect(drawGroups(teams(8), 2, 5)).not.toEqual(drawGroups(teams(8), 2, 6));
  });

  it("valida la cantidad de grupos y los duplicados", () => {
    expect(() => drawGroups(teams(5), 3, 1)).toThrow(RangeError);
    expect(() => drawGroups(teams(5), 0, 1)).toThrow(RangeError);
    expect(() => drawGroups(["a", "a", "b"], 1, 1)).toThrow("repetidos");
  });
});

describe("validateGroups", () => {
  it("acepta un armado manual correcto", () => {
    expect(validateGroups(teams(4), [["t1", "t2"], ["t3", "t4"]])).toEqual({ ok: true });
  });

  it("detecta faltantes, repetidos, ajenos y grupos chicos", () => {
    const result = validateGroups(teams(5), [["t1", "t2", "t2"], ["t3"], ["x"]]);
    expect(result.ok).toBe(false);
    const errors = !result.ok ? result.errors : [];
    expect(errors).toContain("Un equipo aparece en más de un grupo.");
    expect(errors).toContain("Grupo B tiene que tener al menos 2 equipos.");
    expect(errors).toContain("Hay un equipo que no está aprobado en el torneo.");
    expect(errors).toContain("Faltan asignar 2 equipos.");
  });

  it("exige al menos un grupo", () => {
    expect(validateGroups(teams(2), [])).toEqual({
      ok: false,
      errors: ["Tiene que haber al menos un grupo.", "Faltan asignar 2 equipos."],
    });
    expect(validateGroups(["t1"], [["t2", "t3"]])).toMatchObject({ ok: false });
    expect(validateGroups(["t1", "t2", "t3"], [["t1", "t2"]])).toEqual({ ok: false, errors: ["Falta asignar 1 equipo."] });
  });
});
