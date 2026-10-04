import { describe, expect, it } from "vitest";
import { slugWithSuffix, slugify } from "./slug";

describe("slugify", () => {
  it.each([
    ["Copa Verano Pádel 2026!", "copa-verano-padel-2026"],
    ["  Torneo   Ñandú — Fútbol 11 ", "torneo-nandu-futbol-11"],
    ["¿¿??", ""],
  ])("%j → %j", (input, expected) => {
    expect(slugify(input)).toBe(expected);
  });

  it("recorta a 80 caracteres sin dejar guiones al final", () => {
    const slug = slugify(`${"a".repeat(79)} b`);
    expect(slug.length).toBeLessThanOrEqual(80);
    expect(slug.endsWith("-")).toBe(false);
  });
});

describe("slugWithSuffix", () => {
  it("agrega un sufijo aleatorio válido para la base", () => {
    const slug = slugWithSuffix("Copa Verano");
    expect(slug).toMatch(/^copa-verano-[a-z2-9]{6}$/);
    expect(slug).toMatch(/^[a-z0-9]+(-[a-z0-9]+)*$/);
    expect(slugWithSuffix("Copa Verano")).not.toBe(slug);
  });

  it("usa 'torneo' si el nombre no deja nada", () => {
    expect(slugWithSuffix("!!!")).toMatch(/^torneo-[a-z2-9]{6}$/);
  });
});
