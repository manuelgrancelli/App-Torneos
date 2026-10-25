import { describe, expect, it } from "vitest";
import {
  joinTeamByInviteCodeSchema,
  organizerCreateTeamSchema,
  registerTeamSchema,
  replaceTeamPlayerSchema,
} from "./registration";

describe("organizerCreateTeamSchema", () => {
  const baseData = {
    tournamentId: "11111111-1111-4111-8111-111111111111",
    playerNames: ["Juan Perez", "Carlos Gomez"],
    slotIds: ["22222222-2222-4222-8222-222222222222"],
  };

  it("acepta inscripción de pádel sin teamName explícito", () => {
    const result = organizerCreateTeamSchema.safeParse(baseData);
    expect(result.success).toBe(true);
  });

  it("acepta inscripción con teamName explícito", () => {
    const result = organizerCreateTeamSchema.safeParse({
      ...baseData,
      teamName: "Los Galácticos",
    });
    expect(result.success).toBe(true);
  });

  it("acepta inscripción sin franjas horarias seleccionadas (disponibilidad vacía)", () => {
    const result = organizerCreateTeamSchema.safeParse({
      ...baseData,
      slotIds: [],
    });
    expect(result.success).toBe(true);
  });

  it("falla si algún nombre de jugador está vacío", () => {
    const result = organizerCreateTeamSchema.safeParse({
      ...baseData,
      playerNames: ["Juan Perez", "   "],
    });
    expect(result.success).toBe(false);
  });

  it("falla si el nombre resultante excede los 60 caracteres", () => {
    const result = organizerCreateTeamSchema.safeParse({
      ...baseData,
      playerNames: [
        "Jugador con nombre sumamente largo que sobrepasa",
        "Otro jugador con apellido igualmente larguísimo",
      ],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues.some((i) => i.message.includes("60 caracteres"))).toBe(true);
    }
  });
});

describe("replaceTeamPlayerSchema", () => {
  const validData = {
    tournamentId: "11111111-1111-4111-8111-111111111111",
    teamId: "22222222-2222-4222-8222-222222222222",
    memberId: "33333333-3333-4333-8333-333333333333",
    newPlayerName: "Martín Palermo",
    newTeamName: "Riquelme / Palermo",
  };

  it("acepta reemplazo válido de jugador y nombre de equipo", () => {
    const res = replaceTeamPlayerSchema.safeParse(validData);
    expect(res.success).toBe(true);
  });

  it("acepta reemplazo sin especificar newTeamName", () => {
    const { newTeamName, ...withoutTeamName } = validData;
    const res = replaceTeamPlayerSchema.safeParse(withoutTeamName);
    expect(res.success).toBe(true);
  });

  it("rechaza si newPlayerName está vacío", () => {
    const res = replaceTeamPlayerSchema.safeParse({
      ...validData,
      newPlayerName: "   ",
    });
    expect(res.success).toBe(false);
  });

  it("rechaza si newTeamName es menor a 2 caracteres", () => {
    const res = replaceTeamPlayerSchema.safeParse({
      ...validData,
      newTeamName: "A",
    });
    expect(res.success).toBe(false);
  });
});

describe("registerTeamSchema & joinTeamByInviteCodeSchema", () => {
  it("acepta escudo con preset vectorial preset:f-*", () => {
    const res = registerTeamSchema.safeParse({
      code: "ABCDEF",
      teamName: "Deportivo Antigravity",
      memberEmails: ["amigo@torneos.app"],
      logoUrl: "preset:f-azulgrana",
    });
    expect(res.success).toBe(true);
  });

  it("acepta escudo con URL https", () => {
    const res = registerTeamSchema.safeParse({
      code: "ABCDEF",
      teamName: "Atlético Club",
      memberEmails: ["amigo@torneos.app"],
      logoUrl: "https://example.com/escudo.png",
    });
    expect(res.success).toBe(true);
  });

  it("valida joinTeamByInviteCodeSchema con código válido", () => {
    const res = joinTeamByInviteCodeSchema.safeParse({
      inviteCode: "abc12345",
    });
    expect(res.success).toBe(true);
    if (res.success) {
      expect(res.data.inviteCode).toBe("abc12345");
    }
  });

  it("rechaza joinTeamByInviteCodeSchema si el código es inválido", () => {
    const res = joinTeamByInviteCodeSchema.safeParse({
      inviteCode: "ab",
    });
    expect(res.success).toBe(false);
  });
});

