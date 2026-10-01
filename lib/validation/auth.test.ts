import { describe, expect, it } from "vitest";
import { loginSchema, signUpSchema, updatePasswordSchema } from "./auth";

describe("loginSchema", () => {
  it("normaliza el email", () => {
    const result = loginSchema.parse({ email: "  Juan@Mail.COM ", password: "x" });
    expect(result.email).toBe("juan@mail.com");
  });

  it("rechaza emails inválidos y contraseña vacía", () => {
    const result = loginSchema.safeParse({ email: "no-es-email", password: "" });
    expect(result.success).toBe(false);
    const fields = result.error?.issues.map((issue) => issue.path[0]);
    expect(fields).toEqual(expect.arrayContaining(["email", "password"]));
  });
});

describe("signUpSchema", () => {
  const valid = {
    fullName: "Juana Pérez",
    email: "juana@mail.com",
    password: "clave-segura",
    confirmPassword: "clave-segura",
  };

  it("acepta datos válidos", () => {
    expect(signUpSchema.safeParse(valid).success).toBe(true);
  });

  it("exige que las contraseñas coincidan", () => {
    const result = signUpSchema.safeParse({ ...valid, confirmPassword: "otra-clave" });
    expect(result.success).toBe(false);
    expect(result.error?.issues[0]?.path).toEqual(["confirmPassword"]);
  });

  it("exige contraseñas de 8 a 72 caracteres", () => {
    expect(signUpSchema.safeParse({ ...valid, password: "corta", confirmPassword: "corta" }).success).toBe(false);
    const long = "a".repeat(73);
    expect(signUpSchema.safeParse({ ...valid, password: long, confirmPassword: long }).success).toBe(false);
  });

  it("exige nombre", () => {
    expect(signUpSchema.safeParse({ ...valid, fullName: " " }).success).toBe(false);
  });
});

describe("updatePasswordSchema", () => {
  it("exige que las contraseñas coincidan", () => {
    const result = updatePasswordSchema.safeParse({ password: "nueva-clave", confirmPassword: "nueva-clav" });
    expect(result.success).toBe(false);
  });
});
