import { AuthApiError } from "@supabase/supabase-js";
import { describe, expect, it } from "vitest";
import { authErrorMessage, dbErrorMessage, isRateLimitError, isUserAlreadyExistsError } from "./errors";

describe("dbErrorMessage", () => {
  it("muestra los mensajes de negocio de las RPC (P0001)", () => {
    expect(dbErrorMessage({ code: "P0001", message: "El torneo ya completó el cupo." })).toBe(
      "El torneo ya completó el cupo.",
    );
  });

  it("muestra los mensajes de permisos propios pero no los de Postgres", () => {
    expect(dbErrorMessage({ code: "42501", message: "Solo el capitán puede editar el equipo." })).toBe(
      "Solo el capitán puede editar el equipo.",
    );
    expect(dbErrorMessage({ code: "42501", message: "permission denied for table teams" })).toBe(
      "No tenés permiso para hacer esto.",
    );
    expect(
      dbErrorMessage({ code: "42501", message: 'new row violates row-level security policy for table "courts"' }),
    ).toBe("No tenés permiso para hacer esto.");
  });

  it("traduce errores de integridad sin exponer el detalle", () => {
    expect(dbErrorMessage({ code: "23505", message: 'duplicate key value violates unique constraint "x"' })).toBe(
      "Ya existe un registro con esos datos.",
    );
    expect(dbErrorMessage({ code: "23P01", message: "conflicting key value" })).toBe(
      "La cancha ya tiene otro partido en ese horario.",
    );
  });

  it("usa el fallback para códigos desconocidos o sin error", () => {
    expect(dbErrorMessage({ code: "XX000", message: "internal error at line 3" }, "Falló")).toBe("Falló");
    expect(dbErrorMessage(null, "Falló")).toBe("Falló");
  });
});

describe("errores de auth", () => {
  it("traduce códigos conocidos y oculta los desconocidos", () => {
    expect(authErrorMessage(new AuthApiError("Invalid login credentials", 400, "invalid_credentials"))).toBe(
      "Email o contraseña incorrectos.",
    );
    expect(authErrorMessage(new AuthApiError("boom", 500, "unexpected_failure"), "Falló")).toBe("Falló");
    expect(authErrorMessage(new Error("no es de auth"), "Falló")).toBe("Falló");
  });

  it("detecta email existente y rate limit", () => {
    expect(isUserAlreadyExistsError(new AuthApiError("exists", 422, "user_already_exists"))).toBe(true);
    expect(isRateLimitError(new AuthApiError("slow down", 429, "over_request_rate_limit"))).toBe(true);
    expect(isRateLimitError(new AuthApiError("bad", 400, "invalid_credentials"))).toBe(false);
  });
});
