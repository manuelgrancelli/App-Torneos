import { describe, expect, it } from "vitest";
import { createTournamentSchema } from "./tournament";

describe("createTournamentSchema - validación de fechas", () => {
  const baseValid = {
    name: "Torneo Apertura",
    description: "Torneo de fin de semana",
    startsOn: "2026-10-10",
    endsOn: "2026-10-12",
    timezone: "America/Argentina/Buenos_Aires",
    maxTeams: 16,
    courtCount: 2,
    resultsRequireConfirmation: false,
    sportId: "padel",
    scoringConfig: {
      type: "sets" as const,
      bestOf: 3 as const,
      gamesPerSet: 6,
      tiebreak: true,
      decidingSet: "super_tiebreak" as const,
      superTiebreakPoints: 10 as const,
    },
    standingsConfig: {
      points: { win: 3, draw: 0, loss: 0 },
      tiebreakers: ["points" as const, "wins" as const, "head_to_head" as const, "set_diff" as const],
    },
    playoffConfig: {
      qualifiersPerGroup: 2,
      thirdPlace: false,
    },
  };

  it("acepta cuando startsOn es menor que endsOn", () => {
    const res = createTournamentSchema.safeParse({
      ...baseValid,
      startsOn: "2026-10-10",
      endsOn: "2026-10-12",
    });
    expect(res.success).toBe(true);
  });

  it("acepta cuando startsOn es igual a endsOn (torneo de un solo día)", () => {
    const res = createTournamentSchema.safeParse({
      ...baseValid,
      startsOn: "2026-10-10",
      endsOn: "2026-10-10",
    });
    expect(res.success).toBe(true);
  });

  it("rechaza cuando startsOn es mayor que endsOn y emite error en ambos campos", () => {
    const res = createTournamentSchema.safeParse({
      ...baseValid,
      startsOn: "2026-10-15",
      endsOn: "2026-10-10",
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const paths = res.error.issues.map((i) => i.path.join("."));
      expect(paths).toContain("startsOn");
      expect(paths).toContain("endsOn");

      const endsOnIssue = res.error.issues.find((i) => i.path[0] === "endsOn");
      expect(endsOnIssue?.message).toBe("La fecha de fin no puede ser anterior a la de inicio.");

      const startsOnIssue = res.error.issues.find((i) => i.path[0] === "startsOn");
      expect(startsOnIssue?.message).toBe("La fecha de inicio no puede ser posterior a la de fin.");
    }
  });
});

describe("updateTournamentBannerSchema", () => {
  it("valida url válida o null", async () => {
    const { updateTournamentBannerSchema } = await import("./tournament");
    const valid = updateTournamentBannerSchema.safeParse({
      tournamentId: "aaaaaaaa-0000-4000-8000-000000000001",
      bannerUrl: "https://yoqfldxelkjnpmnmllat.supabase.co/storage/v1/object/public/tournament-media/banners/test.png",
    });
    expect(valid.success).toBe(true);

    const validNull = updateTournamentBannerSchema.safeParse({
      tournamentId: "aaaaaaaa-0000-4000-8000-000000000001",
      bannerUrl: null,
    });
    expect(validNull.success).toBe(true);

    const invalid = updateTournamentBannerSchema.safeParse({
      tournamentId: "aaaaaaaa-0000-4000-8000-000000000001",
      bannerUrl: "no-es-una-url",
    });
    expect(invalid.success).toBe(false);
  });
});


describe("createTournamentSchema - multisede (D-194)", () => {
  const baseValid = {
    name: "Torneo Abierto Multisede",
    description: "Torneo provincial con 2 sedes",
    startsOn: "2026-10-10",
    endsOn: "2026-10-12",
    timezone: "America/Argentina/Buenos_Aires",
    maxTeams: 16,
    courtCount: 4,
    resultsRequireConfirmation: false,
    sportId: "padel",
    scoringConfig: {
      type: "sets" as const,
      bestOf: 3 as const,
      gamesPerSet: 6,
      tiebreak: true,
      decidingSet: "super_tiebreak" as const,
      superTiebreakPoints: 10 as const,
    },
    standingsConfig: {
      points: { win: 3, draw: 0, loss: 0 },
      tiebreakers: ["points" as const, "wins" as const, "head_to_head" as const, "set_diff" as const],
    },
    playoffConfig: {
      qualifiersPerGroup: 2,
      thirdPlace: false,
    },
  };

  it("acepta configuración válida con 2 sedes y nombres distintos", () => {
    const res = createTournamentSchema.safeParse({
      ...baseValid,
      hasMultipleVenues: true,
      venues: [
        { name: "Sede Central", courtCount: 2, isMain: true },
        { name: "Sede Norte", courtCount: 2, isMain: false },
      ],
    });
    expect(res.success).toBe(true);
  });

  it("rechaza si hasMultipleVenues es true pero tiene menos de 2 sedes", () => {
    const res = createTournamentSchema.safeParse({
      ...baseValid,
      hasMultipleVenues: true,
      venues: [{ name: "Sede Central", courtCount: 2, isMain: true }],
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toContain("al menos 2 sedes");
    }
  });

  it("rechaza si hay nombres de sedes repetidos", () => {
    const res = createTournamentSchema.safeParse({
      ...baseValid,
      hasMultipleVenues: true,
      venues: [
        { name: "Sede Central", courtCount: 2, isMain: true },
        { name: "sede central", courtCount: 2, isMain: false },
      ],
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      expect(res.error.issues[0]?.message).toContain("nombres repetidos");
    }
  });
});

describe("createTournamentSchema - torneo americano de pádel (Fase 1)", () => {
  const baseAmerican = {
    name: "Torneo Americano Pádel Express",
    description: "Americano de fin de semana",
    startsOn: "2026-11-10",
    endsOn: "2026-11-10",
    timezone: "America/Argentina/Buenos_Aires",
    courtCount: 3,
    resultsRequireConfirmation: false,
    sportId: "padel",
    scoringConfig: {
      type: "sets" as const,
      bestOf: 3 as const,
      gamesPerSet: 6,
      tiebreak: true,
      decidingSet: "super_tiebreak" as const,
      superTiebreakPoints: 10 as const,
    },
    standingsConfig: {
      points: { win: 3, draw: 0, loss: 0 },
      tiebreakers: ["points" as const, "wins" as const, "head_to_head" as const, "set_diff" as const],
    },
    playoffConfig: {
      qualifiersPerGroup: 2,
      thirdPlace: false,
    },
    isAmerican: true,
    americanConfig: {
      enabled: true,
      format: "INDIVIDUAL_ROTATIVO" as const,
      scoringMode: "fixed_points" as const,
      targetPoints: 24,
      roundDurationMinutes: 20,
      participantCount: 12,
    },
  };

  it("acepta configuración válida individual rotativo con múltiplo de 4", () => {
    const res = createTournamentSchema.safeParse(baseAmerican);
    expect(res.success).toBe(true);
  });

  it("rechaza individual rotativo si los participantes no son múltiplo de 4", () => {
    const res = createTournamentSchema.safeParse({
      ...baseAmerican,
      americanConfig: {
        ...baseAmerican.americanConfig,
        participantCount: 10, // No es múltiplo de 4
      },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path.join(".") === "americanConfig.participantCount");
      expect(issue?.message).toContain("múltiplo de 4");
    }
  });

  it("acepta parejas fijas con cualquier cantidad par >= 2", () => {
    const res = createTournamentSchema.safeParse({
      ...baseAmerican,
      americanConfig: {
        ...baseAmerican.americanConfig,
        format: "PAREJAS_FIJAS",
        participantCount: 6,
      },
    });
    expect(res.success).toBe(true);
  });

  it("rechaza si el puntaje objetivo es menor a 10 puntos", () => {
    const res = createTournamentSchema.safeParse({
      ...baseAmerican,
      americanConfig: {
        ...baseAmerican.americanConfig,
        targetPoints: 5,
      },
    });
    expect(res.success).toBe(false);
    if (!res.success) {
      const issue = res.error.issues.find((i) => i.path.join(".") === "americanConfig.targetPoints");
      expect(issue?.message).toContain("10 puntos");
    }
  });
});
