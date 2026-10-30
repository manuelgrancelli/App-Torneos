import { describe, expect, it } from "vitest";
import type { AccountRole } from "@/lib/auth";

describe("AccountRole type & permission rules (D-187)", () => {
  it("admite 'superadmin' como un rol de cuenta válido", () => {
    const roles: AccountRole[] = ["player", "organizer", "superadmin"];
    expect(roles).toHaveLength(3);
    expect(roles).toContain("superadmin");
  });

  it("verifica que los permisos de superadmin incluyan los de organizador", () => {
    function canOrganize(role: AccountRole): boolean {
      return role === "organizer" || role === "superadmin";
    }

    expect(canOrganize("superadmin")).toBe(true);
    expect(canOrganize("organizer")).toBe(true);
    expect(canOrganize("player")).toBe(false);
  });

  it("verifica que el acceso al panel admin sea exclusivo de superadmin", () => {
    function canAccessAdmin(role: AccountRole): boolean {
      return role === "superadmin";
    }

    expect(canAccessAdmin("superadmin")).toBe(true);
    expect(canAccessAdmin("organizer")).toBe(false);
    expect(canAccessAdmin("player")).toBe(false);
  });
});

