import { describe, expect, it } from "vitest";
import { DEFAULT_REDIRECT, getSafeRedirectPath } from "./redirect";

describe("getSafeRedirectPath", () => {
  it("acepta rutas internas con query y hash", () => {
    expect(getSafeRedirectPath("/torneos")).toBe("/torneos");
    expect(getSafeRedirectPath("/unirse/ABC123?x=1#y")).toBe("/unirse/ABC123?x=1#y");
  });

  it("normaliza segmentos relativos sin salir del origen", () => {
    expect(getSafeRedirectPath("/torneos/../historial")).toBe("/historial");
  });

  it("usa el fallback cuando no hay valor", () => {
    expect(getSafeRedirectPath(undefined)).toBe(DEFAULT_REDIRECT);
    expect(getSafeRedirectPath(null)).toBe(DEFAULT_REDIRECT);
    expect(getSafeRedirectPath("")).toBe(DEFAULT_REDIRECT);
    expect(getSafeRedirectPath(null, "/perfil")).toBe("/perfil");
  });

  it.each([
    "https://evil.com",
    "http://evil.com/torneos",
    "//evil.com",
    "//evil.com/torneos",
    "/\\evil.com",
    "\\\\evil.com",
    "javascript:alert(1)",
    "torneos",
    "/torneos\n/evil",
    "/torneos\r\nSet-Cookie: x=1",
    "/\tevil",
  ])("rechaza %j", (value) => {
    expect(getSafeRedirectPath(value)).toBe(DEFAULT_REDIRECT);
  });
});
