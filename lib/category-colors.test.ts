import { describe, expect, it } from "vitest";
import {
  CATEGORY_PALETTES,
  getCategoryColorByIndex,
  getCategoryColorByName,
} from "@/lib/category-colors";

describe("category-colors", () => {
  it("provides at least 8 distinct color themes", () => {
    expect(CATEGORY_PALETTES.length).toBeGreaterThanOrEqual(8);
    const ids = CATEGORY_PALETTES.map((p) => p.id);
    const uniqueIds = new Set(ids);
    expect(uniqueIds.size).toBe(CATEGORY_PALETTES.length);
  });

  it("retrieves colors sequentially by index with graceful wrapping", () => {
    const first = getCategoryColorByIndex(0);
    const second = getCategoryColorByIndex(1);
    expect(first.id).not.toBe(second.id);

    const wrapped = getCategoryColorByIndex(CATEGORY_PALETTES.length);
    expect(wrapped.id).toBe(first.id);
  });

  it("handles negative or floating indices safely", () => {
    const color = getCategoryColorByIndex(-3.5);
    expect(color).toBeDefined();
    expect(color.badge).toBeDefined();
  });

  it("hashes category names deterministically", () => {
    const colorA = getCategoryColorByName("8va");
    const colorB = getCategoryColorByName("8va");
    expect(colorA.id).toBe(colorB.id);

    const colorC = getCategoryColorByName("7ma");
    expect(colorC).toBeDefined();
  });

  it("returns fallback for null or empty category names", () => {
    const colorNull = getCategoryColorByName(null);
    const colorEmpty = getCategoryColorByName("   ");
    expect(colorNull.id).toBe(CATEGORY_PALETTES[0]?.id);
    expect(colorEmpty.id).toBe(CATEGORY_PALETTES[0]?.id);
  });
});
