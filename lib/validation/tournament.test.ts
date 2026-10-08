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

