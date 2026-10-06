import { describe, expect, it } from "vitest";
import {
  computeCircuitLeaderboard,
  computeTeamRoundReached,
  DEFAULT_CIRCUIT_POINTS,
  type CircuitMatch,
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
