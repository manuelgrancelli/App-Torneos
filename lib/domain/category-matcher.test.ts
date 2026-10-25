import { describe, expect, it } from "vitest";
import {
  areCategoriesEquivalent,
  damerauLevenshteinDistance,
  findDuplicateCategoryPairs,
  findMatchingCategory,
  normalizeCategory,
} from "./category-matcher";

describe("category-matcher", () => {
  describe("damerauLevenshteinDistance", () => {
    it("reconoce transposición de caracteres adyacentes en distancia 1", () => {
      // 're' vs 'er' en 'caballreos' vs 'caballeros'
      expect(damerauLevenshteinDistance("caballreos", "caballeros")).toBe(1);
    });

    it("calcula distancia 0 para strings idénticos", () => {
      expect(damerauLevenshteinDistance("5ta", "5ta")).toBe(0);
    });

    it("calcula sustituciones e inserciones estándar", () => {
      expect(damerauLevenshteinDistance("damas", "dmas")).toBe(1);
      expect(damerauLevenshteinDistance("5ta", "6ta")).toBe(1);
    });
  });

  describe("normalizeCategory", () => {
    it("extrae nivel y género canónico de 5ta caballreos y 5TA Caballeros", () => {
      const norm1 = normalizeCategory("5ta caballreos");
      expect(norm1.level).toBe("5");
      expect(norm1.gender).toBe("caballeros");
      expect(norm1.normalizedKey).toBe("5_caballeros");

      const norm2 = normalizeCategory("5TA Caballeros");
      expect(norm2.level).toBe("5");
      expect(norm2.gender).toBe("caballeros");
      expect(norm2.normalizedKey).toBe("5_caballeros");

      expect(norm1.normalizedKey).toBe(norm2.normalizedKey);
    });

    it("soporta números ordinales en palabras y símbolos", () => {
      expect(normalizeCategory("Quinta Caballeros").normalizedKey).toBe("5_caballeros");
      expect(normalizeCategory("5to Caballeros").normalizedKey).toBe("5_caballeros");
      expect(normalizeCategory("5ª Caballeros").normalizedKey).toBe("5_caballeros");
      expect(normalizeCategory("5° Caballeros").normalizedKey).toBe("5_caballeros");
      expect(normalizeCategory("5ta. Caballeros").normalizedKey).toBe("5_caballeros");
    });

    it("soporta categorías de Suma y hándicap", () => {
      expect(normalizeCategory("Suma 10 Caballeros").normalizedKey).toBe("suma_10_caballeros");
      expect(normalizeCategory("+10 Caballeros").normalizedKey).toBe("suma_10_caballeros");
      expect(normalizeCategory("suma10").normalizedKey).toBe("suma_10");
      expect(normalizeCategory("+12 Damas").normalizedKey).toBe("suma_12_damas");
    });

    it("reconoce abreviaturas y sinónimos de género", () => {
      expect(normalizeCategory("6ta Masc").gender).toBe("caballeros");
      expect(normalizeCategory("6ta Masculino").gender).toBe("caballeros");
      expect(normalizeCategory("6ta Varones").gender).toBe("caballeros");
      expect(normalizeCategory("7ma Fem").gender).toBe("damas");
      expect(normalizeCategory("7ma Femenino").gender).toBe("damas");
      expect(normalizeCategory("8va Mix").gender).toBe("mixto");
    });
  });

  describe("areCategoriesEquivalent", () => {
    it("identifica el caso exacto del usuario: '5ta caballreos' vs '5TA Caballeros'", () => {
      expect(areCategoriesEquivalent("5ta caballreos", "5TA Caballeros")).toBe(true);
      expect(areCategoriesEquivalent("5ta caballeros", "5TA Caballeros")).toBe(true);
      expect(areCategoriesEquivalent("5TA caballeros", "5ta caballeros")).toBe(true);
    });

    it("identifica variantes de puntuación, mayúsculas y orden", () => {
      expect(areCategoriesEquivalent("*➡️ 6ta Caballeros*", "6TA CABALLEROS")).toBe(true);
      expect(areCategoriesEquivalent("Caballeros 6ta", "6ta Caballeros")).toBe(true);
      expect(areCategoriesEquivalent("Cat. 7ma Damas", "7ma damas")).toBe(true);
      expect(areCategoriesEquivalent("Suma 10", "+10")).toBe(true);
    });

    it("rechaza categorías con distintos niveles aunque tengan el mismo género", () => {
      expect(areCategoriesEquivalent("5ta Caballeros", "6ta Caballeros")).toBe(false);
      expect(areCategoriesEquivalent("Suma 10", "Suma 12")).toBe(false);
      expect(areCategoriesEquivalent("7ma Damas", "8va Damas")).toBe(false);
    });

    it("rechaza categorías con distinto género aunque tengan el mismo nivel", () => {
      expect(areCategoriesEquivalent("5ta Caballeros", "5ta Damas")).toBe(false);
      expect(areCategoriesEquivalent("6ta Damas", "6ta Mixto")).toBe(false);
    });
  });

  describe("findMatchingCategory", () => {
    const existing = [
      { id: "cat-1", name: "5ta caballreos" },
      { id: "cat-2", name: "7ma Damas" },
      { id: "cat-3", name: "+10 Caballeros" },
    ];

    it("encuentra la categoría existente al importar '5TA Caballeros'", () => {
      const match = findMatchingCategory(existing, "5TA Caballeros");
      expect(match).not.toBeNull();
      expect(match?.id).toBe("cat-1");
      expect(match?.name).toBe("5ta caballreos");
    });

    it("encuentra la categoría con formato suma diferente", () => {
      const match = findMatchingCategory(existing, "Suma 10 Caballeros");
      expect(match).not.toBeNull();
      expect(match?.id).toBe("cat-3");
    });

    it("no confunde géneros opuestos", () => {
      const match = findMatchingCategory(existing, "7ma Caballeros");
      expect(match).toBeNull();
    });

    it("devuelve null si no existe ninguna compatible", () => {
      const match = findMatchingCategory(existing, "4ta Caballeros");
      expect(match).toBeNull();
    });
  });

  describe("findDuplicateCategoryPairs", () => {
    it("detecta duplicados en una lista de categorías del torneo", () => {
      const cats = [
        { id: "c1", name: "5ta caballreos" },
        { id: "c2", name: "5TA Caballeros" },
        { id: "c3", name: "7ma Damas" },
      ];

      const duplicates = findDuplicateCategoryPairs(cats);
      expect(duplicates).toHaveLength(1);
      expect(duplicates[0]?.primary.name).toBe("5TA Caballeros");
      expect(duplicates[0]?.duplicate.name).toBe("5ta caballreos");
    });
  });
});
