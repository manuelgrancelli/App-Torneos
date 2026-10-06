import { describe, expect, it } from "vitest";
import { organizerCreateTeamSchema } from "./registration";

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

  it("falla si no hay franjas horarias seleccionadas", () => {
    const result = organizerCreateTeamSchema.safeParse({
      ...baseData,
      slotIds: [],
    });
    expect(result.success).toBe(false);
    if (!result.success) {
      expect(result.error.issues[0]?.message).toBe("Elegí al menos una franja disponible.");
    }
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
