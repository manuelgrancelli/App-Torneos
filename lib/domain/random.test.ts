import { describe, expect, it } from "vitest";
import { createRng, hashString, randomSeed, shuffle } from "./random";

describe("createRng", () => {
  it("es determinístico por semilla y está en [0, 1)", () => {
    const a = createRng(42);
    const b = createRng(42);
    const values = Array.from({ length: 100 }, () => a());
    expect(values).toEqual(Array.from({ length: 100 }, () => b()));
    expect(values.every((v) => v >= 0 && v < 1)).toBe(true);
  });

  it("semillas distintas dan secuencias distintas", () => {
    expect(createRng(1)()).not.toBe(createRng(2)());
  });
});

describe("shuffle", () => {
  it("no modifica el original y conserva los elementos", () => {
    const items = ["a", "b", "c", "d", "e"];
    const result = shuffle(items, createRng(7));
    expect(items).toEqual(["a", "b", "c", "d", "e"]);
    expect([...result].sort()).toEqual(items);
  });

  it("misma semilla, mismo orden", () => {
    const items = Array.from({ length: 20 }, (_, i) => `t${i}`);
    expect(shuffle(items, createRng(99))).toEqual(shuffle(items, createRng(99)));
  });
});

describe("hashString / randomSeed", () => {
  it("hash estable de 32 bits", () => {
    expect(hashString("abc")).toBe(hashString("abc"));
    expect(hashString("abc")).not.toBe(hashString("abd"));
    expect(hashString("abc")).toBeGreaterThanOrEqual(0);
    expect(hashString("abc")).toBeLessThan(2 ** 32);
  });

  it("randomSeed devuelve un entero positivo de 31 bits", () => {
    const seed = randomSeed();
    expect(Number.isInteger(seed)).toBe(true);
    expect(seed).toBeGreaterThanOrEqual(0);
    expect(seed).toBeLessThan(2 ** 31);
  });
});
