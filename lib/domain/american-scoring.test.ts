import { describe, expect, it } from "vitest";
import { validateAmericanScore } from "./american-scoring";

describe("validateAmericanScore", () => {
  describe("fixed_points (a 24 puntos)", () => {
    const opts = { scoringMode: "fixed_points" as const, targetPoints: 24 };

    it("acepta marcadores cuya suma es exactamente 24 puntos", () => {
      expect(validateAmericanScore(14, 10, opts).valid).toBe(true);
      expect(validateAmericanScore(13, 11, opts).valid).toBe(true);
      expect(validateAmericanScore(12, 12, opts).valid).toBe(true);
      expect(validateAmericanScore(24, 0, opts).valid).toBe(true);
      expect(validateAmericanScore(0, 24, opts).valid).toBe(true);
      expect(validateAmericanScore(16, 8, opts).valid).toBe(true);
    });

    it("acepta si uno de los lados llegó a 24 puntos (primero a 24)", () => {
      expect(validateAmericanScore(24, 18, opts).valid).toBe(true);
      expect(validateAmericanScore(15, 24, opts).valid).toBe(true);
    });

    it("rechaza tanteadores incompletos o inválidos como 3-0", () => {
      const res = validateAmericanScore(3, 0, opts);
      expect(res.valid).toBe(false);
      expect(res.error).toContain("24 puntos");
    });

    it("rechaza marcadores como 5-2 o 10-4 en torneo a 24 puntos", () => {
      expect(validateAmericanScore(5, 2, opts).valid).toBe(false);
      expect(validateAmericanScore(10, 4, opts).valid).toBe(false);
    });

    it("rechaza números negativos o no enteros", () => {
      expect(validateAmericanScore(-1, 25, opts).valid).toBe(false);
      expect(validateAmericanScore(12.5, 11.5, opts).valid).toBe(false);
    });
  });

  describe("fixed_points (a 16 puntos)", () => {
    const opts = { scoringMode: "fixed_points" as const, targetPoints: 16 };

    it("acepta suma 16", () => {
      expect(validateAmericanScore(9, 7, opts).valid).toBe(true);
      expect(validateAmericanScore(10, 6, opts).valid).toBe(true);
    });

    it("rechaza 3-0 en torneo a 16", () => {
      expect(validateAmericanScore(3, 0, opts).valid).toBe(false);
    });
  });

  describe("single_set (a 1 set reglamentario)", () => {
    const opts = { scoringMode: "single_set" as const };

    it("acepta sets válidos", () => {
      expect(validateAmericanScore(6, 3, opts).valid).toBe(true);
      expect(validateAmericanScore(6, 4, opts).valid).toBe(true);
      expect(validateAmericanScore(6, 0, opts).valid).toBe(true);
      expect(validateAmericanScore(7, 5, opts).valid).toBe(true);
      expect(validateAmericanScore(7, 6, opts).valid).toBe(true);
      expect(validateAmericanScore(3, 6, opts).valid).toBe(true);
    });

    it("rechaza sets incompletos como 3-0, 4-2 o 5-3", () => {
      expect(validateAmericanScore(3, 0, opts).valid).toBe(false);
      expect(validateAmericanScore(4, 2, opts).valid).toBe(true); // short set
      expect(validateAmericanScore(5, 2, opts).valid).toBe(false);
      expect(validateAmericanScore(6, 5, opts).valid).toBe(false);
      expect(validateAmericanScore(6, 6, opts).valid).toBe(false);
    });
  });
});

