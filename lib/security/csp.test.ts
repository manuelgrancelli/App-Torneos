import { describe, expect, it } from "vitest";
import { buildCsp, createNonce } from "./csp";

function directives(policy: string): Map<string, string> {
  return new Map(
    policy.split("; ").map((part) => {
      const [name = "", ...values] = part.split(" ");
      return [name, values.join(" ")];
    }),
  );
}

describe("buildCsp", () => {
  const prod = directives(buildCsp({ nonce: "abc123", isDev: false, supabaseUrl: "https://xyz.supabase.co" }));
  const dev = directives(buildCsp({ nonce: "abc123", isDev: true, supabaseUrl: "http://127.0.0.1:54321" }));

  it("scripts solo con nonce y strict-dynamic, sin unsafe-inline", () => {
    expect(prod.get("script-src")).toBe("'self' 'nonce-abc123' 'strict-dynamic'");
    expect(prod.get("script-src")).not.toContain("unsafe-inline");
  });

  it("unsafe-eval solo en desarrollo", () => {
    expect(prod.get("script-src")).not.toContain("unsafe-eval");
    expect(dev.get("script-src")).toContain("'unsafe-eval'");
  });

  it("bloquea frames, plugins y base/form ajenos", () => {
    expect(prod.get("frame-ancestors")).toBe("'none'");
    expect(prod.get("object-src")).toBe("'none'");
    expect(prod.get("base-uri")).toBe("'self'");
    expect(prod.get("form-action")).toBe("'self'");
  });

  it("permite conectar con Supabase (https/wss en producción, http/ws en local)", () => {
    expect(prod.get("connect-src")).toBe("'self' https://xyz.supabase.co wss://xyz.supabase.co");
    expect(dev.get("connect-src")).toBe("'self' http://127.0.0.1:54321 ws://127.0.0.1:54321");
  });

  it("upgrade-insecure-requests solo en producción", () => {
    expect(prod.has("upgrade-insecure-requests")).toBe(true);
    expect(dev.has("upgrade-insecure-requests")).toBe(false);
  });
});

describe("createNonce", () => {
  it("genera valores base64 distintos en cada llamada", () => {
    const a = createNonce();
    const b = createNonce();
    expect(a).not.toBe(b);
    expect(a).toMatch(/^[A-Za-z0-9+/]{22}==$/);
  });
});
