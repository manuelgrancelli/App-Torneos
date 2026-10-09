import { describe, expect, it } from "vitest";
import { drawGroups, getGroupAvailabilityConflicts, groupCountOptions, groupName, validateGroups } from "./groups";

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
  it("separa en grupos distintos a parejas sin franjas horarias en común", () => {
    // Pareja A y C pueden franjas 1 y 2; Pareja B y D solo franja 3
    const availability = {
      parejaA: ["franja1", "franja2"],
      parejaB: ["franja3"],
      parejaC: ["franja1"],
      parejaD: ["franja3"],
    };
    const teamList = ["parejaA", "parejaB", "parejaC", "parejaD"];
    const groups = drawGroups(teamList, 2, 42, availability);

    // Debe haber 2 grupos de 2 equipos
    expect(groups).toHaveLength(2);
    expect(groups[0]).toHaveLength(2);
    expect(groups[1]).toHaveLength(2);

    // Pareja A y Pareja B NO deben estar en el mismo grupo
    const groupWithA = groups.find((g) => g.includes("parejaA"))!;
    expect(groupWithA).not.toContain("parejaB");
    expect(groupWithA).not.toContain("parejaD");
    expect(groupWithA).toContain("parejaC");

    const groupWithB = groups.find((g) => g.includes("parejaB"))!;
    expect(groupWithB).toContain("parejaD");

    // No debe haber ningún conflicto de disponibilidad en ninguno de los grupos
    expect(getGroupAvailabilityConflicts(groups, availability)).toEqual([]);
  });

  it("es reproducible con disponibilidad y misma semilla", () => {
    const availability = {
      t1: ["f1"],
      t2: ["f1"],
      t3: ["f2"],
      t4: ["f2"],
    };
    const draw1 = drawGroups(["t1", "t2", "t3", "t4"], 2, 999, availability);
    const draw2 = drawGroups(["t1", "t2", "t3", "t4"], 2, 999, availability);
    expect(draw1).toEqual(draw2);
  });

  it("ubica a equipos sin disponibilidad cargada sin fallar ni romper restricciones de los demás", () => {
    const availability = {
      t1: ["f1"],
      t2: ["f1"],
      t3: ["f2"],
      t4: [], // sin franjas cargadas
    };
    const groups = drawGroups(["t1", "t2", "t3", "t4"], 2, 123, availability);
    // t1 y t3 no deben estar juntos porque f1 y f2 no se solapan
    const groupWithT1 = groups.find((g) => g.includes("t1"))!;
    expect(groupWithT1).not.toContain("t3");
  });
});

describe("getGroupAvailabilityConflicts", () => {
  it("detecta parejas sin franjas en común en el mismo grupo", () => {
    const availability = {
      t1: ["f1", "f2"],
      t2: ["f3"],
      t3: ["f1"],
    };
    const conflicts = getGroupAvailabilityConflicts([["t1", "t2", "t3"]], availability);
    expect(conflicts).toHaveLength(2);
    expect(conflicts).toContainEqual({ groupIndex: 0, teamA: "t1", teamB: "t2" });
    expect(conflicts).toContainEqual({ groupIndex: 0, teamA: "t2", teamB: "t3" });
  });

  it("no reporta conflicto si tienen al menos una franja en común o si alguno no cargó disponibilidad", () => {
    const availability = {
      t1: ["f1", "f2"],
      t2: ["f2", "f3"],
      t3: [],
    };
    const conflicts = getGroupAvailabilityConflicts([["t1", "t2", "t3"]], availability);
    expect(conflicts).toEqual([]);
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
