import { describe, expect, it } from "vitest";
import { compareMatchesChronological, buildBoardMatches, matchStageLabel, qualifiersFromStandings } from "./competition-view";
import type { MatchView, GroupView, ConfirmationView } from "@/lib/data/competition";
import type { StandingRow } from "@/lib/domain/standings";

describe("compareMatchesChronological", () => {
  it("ordena partidos del primero al último por fecha y franja horaria", () => {
    // Torneo de jueves a sábado con franjas de 10 a 15
    const matchJueves10 = {
      id: "m-jue-10",
      startsAt: "2026-10-15T13:00:00.000Z", // 10:00 UTC-3
      courtName: "Cancha 1",
    };
    const matchJueves11 = {
      id: "m-jue-11",
      startsAt: "2026-10-15T14:00:00.000Z", // 11:00 UTC-3
      courtName: "Cancha 1",
    };
    const matchViernes10 = {
      id: "m-vie-10",
      startsAt: "2026-10-16T13:00:00.000Z", // 10:00 UTC-3
      courtName: "Cancha 1",
    };
    const matchSabado14 = {
      id: "m-sab-14",
      startsAt: "2026-10-17T17:00:00.000Z", // 14:00 UTC-3
      courtName: "Cancha 1",
    };

    const list = [matchSabado14, matchJueves11, matchViernes10, matchJueves10];
    list.sort(compareMatchesChronological);

    expect(list.map((m) => m.id)).toEqual([
      "m-jue-10",
      "m-jue-11",
      "m-vie-10",
      "m-sab-14",
    ]);
  });

  it("a la misma hora y fecha desempata por cancha: Cancha 1, Cancha 2, Cancha 10", () => {
    // Ejemplo del usuario: "cancha 1 de 10 a 11 pareja a vs b, despues cancha 2 de 10 a 11 pareja c vs d"
    const matchCancha10 = {
      id: "m-c10",
      startsAt: "2026-10-15T13:00:00.000Z",
      courtName: "Cancha 10",
    };
    const matchCancha2 = {
      id: "m-c2",
      startsAt: "2026-10-15T13:00:00.000Z",
      courtName: "Cancha 2",
    };
    const matchCancha1 = {
      id: "m-c1",
      startsAt: "2026-10-15T13:00:00.000Z",
      courtName: "Cancha 1",
    };

    const list = [matchCancha10, matchCancha2, matchCancha1];
    list.sort(compareMatchesChronological);

    expect(list.map((m) => m.id)).toEqual(["m-c1", "m-c2", "m-c10"]);
  });

  it("ubica los partidos sin horario programado al final", () => {
    const scheduled = {
      id: "m-prog",
      startsAt: "2026-10-15T13:00:00.000Z",
      courtName: "Cancha 1",
    };
    const unscheduled1 = {
      id: "m-sin-1",
      startsAt: null,
      courtName: null,
      stage: "group",
      round: 1,
    };
    const unscheduled2 = {
      id: "m-sin-2",
      startsAt: null,
      courtName: null,
      stage: "group",
      round: 2,
    };

    const list = [unscheduled2, scheduled, unscheduled1];
    list.sort(compareMatchesChronological);

    expect(list.map((m) => m.id)).toEqual(["m-prog", "m-sin-1", "m-sin-2"]);
  });
});

describe("buildBoardMatches", () => {
  it("devuelve los partidos del tablero ordenados cronológicamente", () => {
    const rawMatches: MatchView[] = [
      {
        id: "m2",
        stage: "group",
        round: 1,
        position: 2,
        groupId: "g1",
        homeTeamId: "t3",
        awayTeamId: "t4",
        startsAt: "2026-10-15T13:00:00.000Z",
        endsAt: "2026-10-15T14:00:00.000Z",
        courtId: "c2",
        slotId: "s2",
        winnerTeamId: null,
        isDraw: false,
        result: null,
        isWalkover: false,
        isBye: false,
        isThirdPlace: false,
        resultStatus: null,
        scheduleLocked: false,
        categoryId: null,
        nextMatchId: null,
        nextMatchSide: null,
        loserNextMatchId: null,
        loserNextMatchSide: null,
      },
      {
        id: "m1",
        stage: "group",
        round: 1,
        position: 1,
        groupId: "g1",
        homeTeamId: "t1",
        awayTeamId: "t2",
        startsAt: "2026-10-15T13:00:00.000Z",
        endsAt: "2026-10-15T14:00:00.000Z",
        courtId: "c1",
        slotId: "s1",
        winnerTeamId: null,
        isDraw: false,
        result: null,
        isWalkover: false,
        isBye: false,
        isThirdPlace: false,
        resultStatus: null,
        scheduleLocked: false,
        categoryId: null,
        nextMatchId: null,
        nextMatchSide: null,
        loserNextMatchId: null,
        loserNextMatchSide: null,
      },
      {
        id: "m3",
        stage: "group",
        round: 2,
        position: 1,
        groupId: "g1",
        homeTeamId: "t1",
        awayTeamId: "t3",
        startsAt: "2026-10-15T14:00:00.000Z",
        endsAt: "2026-10-15T15:00:00.000Z",
        courtId: "c1",
        slotId: "s3",
        winnerTeamId: null,
        isDraw: false,
        result: null,
        isWalkover: false,
        isBye: false,
        isThirdPlace: false,
        resultStatus: null,
        scheduleLocked: false,
        categoryId: null,
        nextMatchId: null,
        nextMatchSide: null,
        loserNextMatchId: null,
        loserNextMatchSide: null,
      },
    ];

    const groups: GroupView[] = [
      { id: "g1", name: "Grupo A", position: 1, teamIds: ["t1", "t2", "t3", "t4"], tiebreakSeed: 0 },
    ];
    const teamNames = new Map([
      ["t1", "Pareja A"],
      ["t2", "Pareja B"],
      ["t3", "Pareja C"],
      ["t4", "Pareja D"],
    ]);
    const courtNames = new Map([
      ["c1", "Cancha 1"],
      ["c2", "Cancha 2"],
    ]);
    const confirmations: ConfirmationView[] = [];

    const board = buildBoardMatches(rawMatches, groups, teamNames, courtNames, confirmations);

    // Debe quedar primero m1 (Cancha 1, 10:00), luego m2 (Cancha 2, 10:00), luego m3 (Cancha 1, 11:00)
    expect(board.map((m) => m.id)).toEqual(["m1", "m2", "m3"]);
    expect(board[0]?.courtName).toBe("Cancha 1");
    expect(board[1]?.courtName).toBe("Cancha 2");
    expect(board[2]?.courtName).toBe("Cancha 1");
  });

  it("en grupos de 4 equipos, los partidos de fecha 2 muestran etiquetas y nombres de ganadores/perdedores", () => {
    const rawMatches: MatchView[] = [
      {
        id: "m-r2-0",
        stage: "group",
        round: 2,
        position: 0,
        groupId: "g1",
        homeTeamId: null,
        awayTeamId: null,
        startsAt: null,
        endsAt: null,
        courtId: null,
        slotId: null,
        winnerTeamId: null,
        isDraw: false,
        result: null,
        isWalkover: false,
        isBye: false,
        isThirdPlace: false,
        resultStatus: null,
        scheduleLocked: false,
        categoryId: null,
        nextMatchId: null,
        nextMatchSide: null,
        loserNextMatchId: null,
        loserNextMatchSide: null,
      },
      {
        id: "m-r2-1",
        stage: "group",
        round: 2,
        position: 1,
        groupId: "g1",
        homeTeamId: null,
        awayTeamId: null,
        startsAt: null,
        endsAt: null,
        courtId: null,
        slotId: null,
        winnerTeamId: null,
        isDraw: false,
        result: null,
        isWalkover: false,
        isBye: false,
        isThirdPlace: false,
        resultStatus: null,
        scheduleLocked: false,
        categoryId: null,
        nextMatchId: null,
        nextMatchSide: null,
        loserNextMatchId: null,
        loserNextMatchSide: null,
      },
    ];

    const groups: GroupView[] = [
      { id: "g1", name: "Grupo A", position: 0, teamIds: ["t1", "t2", "t3", "t4"], tiebreakSeed: 0 },
    ];

    expect(matchStageLabel(rawMatches[0]!, groups, 1)).toBe("Grupo A · Final (1° y 2° puesto)");
    expect(matchStageLabel(rawMatches[1]!, groups, 1)).toBe("Grupo A · Duelo 3° puesto (Pasa a playoff)");

    const board = buildBoardMatches(rawMatches, groups, new Map(), new Map(), []);
    expect(board[0]?.homeName).toBe("Ganador P1");
    expect(board[0]?.awayName).toBe("Ganador P2");
    expect(board[1]?.homeName).toBe("Perdedor P1");
    expect(board[1]?.awayName).toBe("Perdedor P2");
  });
});

describe("qualifiersFromStandings", () => {
  it("en grupos de 4 equipos clasifica exactamente a los 3 primeros aunque perGroup esté configurado en 2", () => {
    const group: GroupView = {
      id: "g1",
      name: "Grupo A",
      position: 0,
      teamIds: ["t1", "t2", "t3", "t4"],
      tiebreakSeed: 0,
    };
    const rows: StandingRow[] = [
      { teamId: "t1", position: 1, played: 2, won: 2, drawn: 0, lost: 0, points: 6, setsFor: 4, setsAgainst: 0, gamesFor: 24, gamesAgainst: 10, goalsFor: 0, goalsAgainst: 0, decidedByLottery: false },
      { teamId: "t2", position: 2, played: 2, won: 1, drawn: 0, lost: 1, points: 3, setsFor: 2, setsAgainst: 2, gamesFor: 18, gamesAgainst: 16, goalsFor: 0, goalsAgainst: 0, decidedByLottery: false },
      { teamId: "t3", position: 3, played: 2, won: 1, drawn: 0, lost: 1, points: 3, setsFor: 2, setsAgainst: 2, gamesFor: 16, gamesAgainst: 18, goalsFor: 0, goalsAgainst: 0, decidedByLottery: false },
      { teamId: "t4", position: 4, played: 2, won: 0, drawn: 0, lost: 2, points: 0, setsFor: 0, setsAgainst: 4, gamesFor: 8, gamesAgainst: 24, goalsFor: 0, goalsAgainst: 0, decidedByLottery: false },
    ];

    const qualifiers = qualifiersFromStandings([{ group, rows }], 2, "sets");
    expect(qualifiers.map((q) => q.teamId)).toEqual(["t1", "t2", "t3"]);
    expect(qualifiers).toHaveLength(3);
  });
});

