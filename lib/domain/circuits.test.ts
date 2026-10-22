import { describe, expect, it } from "vitest";
import {
  computeCircuitCategoryLeaderboards,
  computeCircuitLeaderboard,
  computeTeamRoundReached,
  DEFAULT_CIRCUIT_POINTS,
  type CircuitMatch,
  type CircuitMultiCategoryTournamentData,
  type CircuitTournamentData,
} from "./circuits";

describe("computeTeamRoundReached", () => {
  it("asigna campeón al equipo ganador de la final", () => {
    const matches: CircuitMatch[] = [
      { stage: "playoff", round: 1, homeTeamId: "team-1", awayTeamId: "team-2", winnerTeamId: "team-1" },
      { stage: "playoff", round: 2, homeTeamId: "team-1", awayTeamId: "team-3", winnerTeamId: "team-1" },
    ];
    const round = computeTeamRoundReached("team-1", matches, "team-1", 2);
    expect(round).toBe("champion");
  });

  it("asigna subcampeón al perdedor de la final", () => {
    const matches: CircuitMatch[] = [
      { stage: "playoff", round: 2, homeTeamId: "team-1", awayTeamId: "team-3", winnerTeamId: "team-1" },
    ];
    const round = computeTeamRoundReached("team-3", matches, "team-1", 2);
    expect(round).toBe("runner_up");
  });

  it("identifica al campeón a partir de la final cuando championTeamId es null", () => {
    const matches: CircuitMatch[] = [
      { stage: "playoff", round: 1, homeTeamId: "team-1", awayTeamId: "team-2", winnerTeamId: "team-1" },
      { stage: "playoff", round: 2, homeTeamId: "team-1", awayTeamId: "team-3", winnerTeamId: "team-1" },
    ];
    // championTeamId = null
    const roundChamp = computeTeamRoundReached("team-1", matches, null, 2);
    expect(roundChamp).toBe("champion");

    const roundRunnerUp = computeTeamRoundReached("team-3", matches, null, 2);
    expect(roundRunnerUp).toBe("runner_up");
  });

  it("asigna semifinales si quedó eliminado en la penúltima ronda", () => {
    const matches: CircuitMatch[] = [
      { stage: "playoff", round: 1, homeTeamId: "team-4", awayTeamId: "team-5", winnerTeamId: "team-4" },
      { stage: "playoff", round: 2, homeTeamId: "team-1", awayTeamId: "team-4", winnerTeamId: "team-1" },
      { stage: "playoff", round: 3, homeTeamId: "team-1", awayTeamId: "team-2", winnerTeamId: "team-1" },
    ];
    // Total playoff rounds = 3 (final). Ronda 2 = semis.
    const round = computeTeamRoundReached("team-4", matches, "team-1", 3);
    expect(round).toBe("semis");
  });

  it("asigna fase de grupos si no participó en playoffs", () => {
    const matches: CircuitMatch[] = [
      { stage: "group", round: 1, homeTeamId: "team-x", awayTeamId: "team-y", winnerTeamId: "team-x" },
    ];
    const round = computeTeamRoundReached("team-x", matches, "team-champion", 2);
    expect(round).toBe("group_stage");
  });
});

describe("computeCircuitLeaderboard", () => {
  it("acumula puntos individuales correctamente aunque un jugador cambie de pareja", () => {
    // Torneo 1 (Fecha 1): Jugador A juega con Jugador B y salen Campeones (100 pts)
    // Jugador C y Jugador D pierden la final (Subcampeones, 60 pts)
    const t1: CircuitTournamentData = {
      id: "t1",
      name: "Fecha 1",
      circuitOrder: 1,
      status: "finished",
      championTeamId: "team-ab",
      totalPlayoffRounds: 1,
      matches: [
        { stage: "playoff", round: 1, homeTeamId: "team-ab", awayTeamId: "team-cd", winnerTeamId: "team-ab" },
      ],
      teams: [
        {
          id: "team-ab",
          name: "A / B",
          members: [
            { userId: "user-a", displayName: null, fullName: "Jugador A" },
            { userId: "user-b", displayName: null, fullName: "Jugador B" },
          ],
        },
        {
          id: "team-cd",
          name: "C / D",
          members: [
            { userId: "user-c", displayName: null, fullName: "Jugador C" },
            { userId: "user-d", displayName: null, fullName: "Jugador D" },
          ],
        },
      ],
    };

    // Torneo 2 (Fecha 2): Jugador A juega ahora con Jugador C y salen Campeones (100 pts)
    // Jugador B juega con Jugador E y quedan en Semis (35 pts)
    const t2: CircuitTournamentData = {
      id: "t2",
      name: "Fecha 2",
      circuitOrder: 2,
      status: "finished",
      championTeamId: "team-ac",
      totalPlayoffRounds: 2,
      matches: [
        { stage: "playoff", round: 1, homeTeamId: "team-be", awayTeamId: "team-other", winnerTeamId: "team-other" },
        { stage: "playoff", round: 2, homeTeamId: "team-ac", awayTeamId: "team-other", winnerTeamId: "team-ac" },
      ],
      teams: [
        {
          id: "team-ac",
          name: "A / C",
          members: [
            { userId: "user-a", displayName: null, fullName: "Jugador A" },
            { userId: "user-c", displayName: null, fullName: "Jugador C" },
          ],
        },
        {
          id: "team-be",
          name: "B / E",
          members: [
            { userId: "user-b", displayName: null, fullName: "Jugador B" },
            { userId: null, displayName: "Jugador E", fullName: null },
          ],
        },
      ],
    };

    const leaderboard = computeCircuitLeaderboard(DEFAULT_CIRCUIT_POINTS, [t1, t2]);

    // Jugador A: 100 (Fecha 1) + 100 (Fecha 2) = 200 pts, 2 títulos, puesto 1
    // Jugador C: 60 (Fecha 1) + 100 (Fecha 2) = 160 pts, 1 título, puesto 2
    // Jugador B: 100 (Fecha 1) + 35 (Fecha 2) = 135 pts, 1 título, puesto 3
    // Jugador D: 60 (Fecha 1) = 60 pts, 0 títulos, puesto 4
    // Jugador E: 35 (Fecha 2) = 35 pts, 0 títulos, puesto 5

    expect(leaderboard[0]?.playerName).toBe("Jugador A");
    expect(leaderboard[0]?.totalPoints).toBe(200);
    expect(leaderboard[0]?.titles).toBe(2);
    expect(leaderboard[0]?.rank).toBe(1);

    expect(leaderboard[1]?.playerName).toBe("Jugador C");
    expect(leaderboard[1]?.totalPoints).toBe(160);
    expect(leaderboard[1]?.titles).toBe(1);
    expect(leaderboard[1]?.rank).toBe(2);

    expect(leaderboard[2]?.playerName).toBe("Jugador B");
    expect(leaderboard[2]?.totalPoints).toBe(135);
    expect(leaderboard[2]?.titles).toBe(1);
    expect(leaderboard[2]?.rank).toBe(3);

    expect(leaderboard[3]?.playerName).toBe("Jugador D");
    expect(leaderboard[3]?.totalPoints).toBe(60);
    expect(leaderboard[3]?.rank).toBe(4);

    expect(leaderboard[4]?.playerName).toBe("Jugador E");
    expect(leaderboard[4]?.totalPoints).toBe(35);
    expect(leaderboard[4]?.rank).toBe(5);
  });
});

describe("computeCircuitCategoryLeaderboards", () => {
  it("separa las tablas de posiciones por categoría deportiva de forma independiente", () => {
    // Torneo con 2 categorías: "6ta" y "+10"
    const tour: CircuitMultiCategoryTournamentData = {
      id: "t1",
      name: "Fecha 1 Circuito",
      circuitOrder: 1,
      status: "finished",
      championTeamId: null,
      categories: [
        { id: "cat-6ta", tournamentId: "t1", name: "6ta", position: 1, championTeamId: "team-1" },
        { id: "cat-10", tournamentId: "t1", name: "+10", position: 2, championTeamId: "team-3" },
      ],
      matches: [
        // Final de 6ta
        {
          id: "m-6ta",
          tournamentId: "t1",
          categoryId: "cat-6ta",
          stage: "playoff",
          round: 1,
          homeTeamId: "team-1",
          awayTeamId: "team-2",
          winnerTeamId: "team-1",
        },
        // Final de +10
        {
          id: "m-10",
          tournamentId: "t1",
          categoryId: "cat-10",
          stage: "playoff",
          round: 1,
          homeTeamId: "team-3",
          awayTeamId: "team-4",
          winnerTeamId: "team-3",
        },
      ],
      teams: [
        {
          id: "team-1",
          tournamentId: "t1",
          categoryId: "cat-6ta",
          name: "A / B",
          members: [
            { userId: "u-a", displayName: "Jugador A", fullName: null },
            { userId: "u-b", displayName: "Jugador B", fullName: null },
          ],
        },
        {
          id: "team-2",
          tournamentId: "t1",
          categoryId: "cat-6ta",
          name: "C / D",
          members: [
            { userId: "u-c", displayName: "Jugador C", fullName: null },
            { userId: "u-d", displayName: "Jugador D", fullName: null },
          ],
        },
        {
          id: "team-3",
          tournamentId: "t1",
          categoryId: "cat-10",
          name: "E / F",
          members: [
            { userId: "u-e", displayName: "Jugador E", fullName: null },
            { userId: "u-f", displayName: "Jugador F", fullName: null },
          ],
        },
        {
          id: "team-4",
          tournamentId: "t1",
          categoryId: "cat-10",
          name: "G / H",
          members: [
            { userId: "u-g", displayName: "Jugador G", fullName: null },
            { userId: "u-h", displayName: "Jugador H", fullName: null },
          ],
        },
      ],
    };

    const tables = computeCircuitCategoryLeaderboards(DEFAULT_CIRCUIT_POINTS, [tour]);
    expect(tables).toHaveLength(2);

    const table6ta = tables.find((t) => t.categoryName === "6ta");
    const table10 = tables.find((t) => t.categoryName === "+10");

    expect(table6ta).toBeDefined();
    expect(table10).toBeDefined();

    // En 6ta solo están A, B, C, D
    expect(table6ta?.leaderboard).toHaveLength(4);
    expect(table6ta?.leaderboard[0]?.playerName).toBe("Jugador A");
    expect(table6ta?.leaderboard[0]?.totalPoints).toBe(100);
    expect(table6ta?.leaderboard[0]?.titles).toBe(1);
    expect(table6ta?.leaderboard.map((p) => p.playerName)).not.toContain("Jugador E");

    // En +10 solo están E, F, G, H
    expect(table10?.leaderboard).toHaveLength(4);
    expect(table10?.leaderboard[0]?.playerName).toBe("Jugador E");
    expect(table10?.leaderboard[0]?.totalPoints).toBe(100);
    expect(table10?.leaderboard[0]?.titles).toBe(1);
    expect(table10?.leaderboard.map((p) => p.playerName)).not.toContain("Jugador A");
  });

  it("consolida en una sola tabla General cuando los torneos no tienen categorías", () => {
    const tour: CircuitMultiCategoryTournamentData = {
      id: "t1",
      name: "Torneo Abierto",
      circuitOrder: 1,
      status: "finished",
      championTeamId: "team-1",
      categories: [],
      matches: [
        {
          id: "m-1",
          tournamentId: "t1",
          stage: "playoff",
          round: 1,
          homeTeamId: "team-1",
          awayTeamId: "team-2",
          winnerTeamId: "team-1",
        },
      ],
      teams: [
        {
          id: "team-1",
          tournamentId: "t1",
          name: "A / B",
          members: [{ userId: "u-a", displayName: "Jugador A", fullName: null }],
        },
        {
          id: "team-2",
          tournamentId: "t1",
          name: "C / D",
          members: [{ userId: "u-c", displayName: "Jugador C", fullName: null }],
        },
      ],
    };

    const tables = computeCircuitCategoryLeaderboards(DEFAULT_CIRCUIT_POINTS, [tour]);
    expect(tables).toHaveLength(1);
    expect(tables[0]?.categoryName).toBe("General");
    expect(tables[0]?.leaderboard).toHaveLength(2);
  });

  it("asigna 100 puntos y título al campeón aunque championTeamId sea null en la categoría", () => {
    const tour: CircuitMultiCategoryTournamentData = {
      id: "t1",
      name: "Fecha 1",
      circuitOrder: 1,
      status: "playoffs",
      championTeamId: null,
      categories: [
        { id: "cat-6ta", tournamentId: "t1", name: "6ta", position: 1, championTeamId: null },
      ],
      matches: [
        {
          id: "m-final",
          tournamentId: "t1",
          categoryId: "cat-6ta",
          stage: "playoff",
          round: 2,
          homeTeamId: "team-champ",
          awayTeamId: "team-sub",
          winnerTeamId: "team-champ",
        },
      ],
      teams: [
        {
          id: "team-champ",
          tournamentId: "t1",
          categoryId: "cat-6ta",
          name: "Campeones",
          members: [{ userId: "u-champ", displayName: "Campeón", fullName: null }],
        },
        {
          id: "team-sub",
          tournamentId: "t1",
          categoryId: "cat-6ta",
          name: "Subcampeones",
          members: [{ userId: "u-sub", displayName: "Subcampeón", fullName: null }],
        },
      ],
    };

    const tables = computeCircuitCategoryLeaderboards(DEFAULT_CIRCUIT_POINTS, [tour]);
    const lb = tables[0]?.leaderboard;
    expect(lb).toBeDefined();
    expect(lb).toHaveLength(2);

    const champ = lb?.find((p) => p.playerName === "Campeón");
    const sub = lb?.find((p) => p.playerName === "Subcampeón");

    expect(champ?.totalPoints).toBe(100);
    expect(champ?.titles).toBe(1);
    expect(champ?.rank).toBe(1);

    expect(sub?.totalPoints).toBe(60);
    expect(sub?.titles).toBe(0);
    expect(sub?.rank).toBe(2);
  });
});
