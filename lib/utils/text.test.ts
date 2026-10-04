import { describe, expect, it } from "vitest";
import { getInitials, truncate } from "./text";

describe("getInitials", () => {
  it.each([
    ["Juana Pérez", "JP"],
    ["juana maría pérez", "JP"],
    ["  Juana  ", "J"],
    ["juana@mail.com", "J"],
    ["", "?"],
  ])("%j → %j", (name, expected) => {
    expect(getInitials(name)).toBe(expected);
  });
});

describe("truncate", () => {
  it("deja igual lo que entra", () => {
    expect(truncate("Copa", 10)).toBe("Copa");
    expect(truncate("1234567890", 10)).toBe("1234567890");
  });

  it("recorta con elipsis dentro del máximo y sin espacio final", () => {
    expect(truncate("Copa de verano", 6)).toBe("Copa…");
    expect(truncate("Copa de verano", 8)).toHaveLength(8);
  });
});
