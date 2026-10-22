import { describe, expect, it } from "vitest";
import type { Competition, MatchView } from "@/lib/data/competition";
import type { ScoringConfig } from "@/lib/domain/scoring";
import type { StandingsConfig } from "@/lib/domain/standings";
import { buildPlayerProgress, qualifiersForGroup } from "./player-progress";

const scoring: ScoringConfig = { type: "sets", bestOf: 3, gamesPerSet: 6, tiebreak: true, decidingSet: "full" } as ScoringConfig;
const standings: StandingsConfig = {
  points: { win: 3, draw: 1, loss: 0 },
  tiebreakers: ["points", "head_to_head", "set_diff", "game_diff", "games_won"],
};
const playoff = { qualifiersPerGroup: 2, thirdPlace: false };

function match(partial: Partial<MatchView> & Pick<MatchView, "id">): MatchView {
  return {
    categoryId: null,
    stage: "group",
    groupId: "g1",
    round: 1,
    position: 0,
    homeTeamId: null,
    awayTeamId: null,
    isBye: false,
    isThirdPlace: false,
    nextMatchId: null,
    nextMatchSide: null,
    loserNextMatchId: null,
    loserNextMatchSide: null,
    slotId: null,
    courtId: null,
    startsAt: null,
    endsAt: null,
    scheduleLocked: false,
    result: null,
    winnerTeamId: null,
    isDraw: false,
    isWalkover: false,
    resultStatus: null,
    ...partial,
  };
}

const win = (home: number, away: number) => ({ type: "sets" as const, sets: [{ home, away }, { home, away }] });

function competition(matches: MatchView[]): Competition {
  return {
    teams: ["a", "b", "c"].map((id) => ({ id, name: `Equipo ${id.toUpperCase()}`, status: "approved" as const })),
    groups: [{ id: "g1", name: "Zona A", position: 0, tiebreakSeed: 1, teamIds: ["a", "b", "c"] }],
    matches,
    confirmations: [],
    categories: [],
  };
}

const base = { teamId: "a", championTeamId: null, scoring, standings, playoff } as const;

describe("buildPlayerProgress", () => {
  it("antes de los grupos queda en inscripción y sin zona", () => {
    const progress = buildPlayerProgress({ ...base, tournamentStatus: "registration_open", competition: { ...competition([]), groups: [] } });
    expect(progress.phase).toBe("registration");
    expect(progress.group).toBeNull();
    expect(progress.nextMatch).toBeNull();
  });

  it("en grupos calcula posición, récord y próximo partido", () => {
    const matches = [
      match({ id: "m1", homeTeamId: "a", awayTeamId: "b", winnerTeamId: "a", result: win(6, 2), resultStatus: "confirmed" }),
      match({ id: "m2", round: 2, homeTeamId: "c", awayTeamId: "a", startsAt: "2026-10-22T13:00:00.000Z" }),
      match({ id: "m3", round: 3, homeTeamId: "b", awayTeamId: "c" }),
    ];
    const progress = buildPlayerProgress({ ...base, tournamentStatus: "group_stage", competition: competition(matches) });
    expect(progress.phase).toBe("groups");
    expect(progress.group?.position).toBe(1);
    expect(progress.group?.qualifiers).toBe(2);
    expect(progress.record).toEqual({ played: 1, won: 1, lost: 0, drawn: 0 });
    expect(progress.nextMatch?.match.id).toBe("m2");
    expect(progress.nextMatch?.rivalName).toBe("Equipo C");
  });

  it("marca la eliminación cuando pierde un cruce sin partido de consuelo", () => {
    const matches = [
      match({ id: "f", stage: "playoff", groupId: null, round: 1, homeTeamId: "a", awayTeamId: "b", winnerTeamId: "b", result: win(2, 6) }),
    ];
    const progress = buildPlayerProgress({ ...base, tournamentStatus: "playoffs", competition: competition(matches) });
    expect(progress.phase).toBe("eliminated");
    expect(progress.eliminatedAt).toBe("Final");
  });

  it("detecta al campeón", () => {
    const progress = buildPlayerProgress({ ...base, championTeamId: "a", tournamentStatus: "finished", competition: competition([]) });
    expect(progress.phase).toBe("champion");
  });
});

describe("qualifiersForGroup", () => {
  it("zonas de 4 clasifican 3 y una zona única al menos 2", () => {
    const group = { id: "g", name: "Zona", position: 0, tiebreakSeed: 1, teamIds: ["a", "b", "c", "d"] };
    expect(qualifiersForGroup(group, 2, 2)).toBe(3);
    expect(qualifiersForGroup({ ...group, teamIds: ["a", "b", "c"] }, 1, 1)).toBe(2);
    expect(qualifiersForGroup({ ...group, teamIds: ["a", "b", "c"] }, 3, 1)).toBe(1);
  });
});
