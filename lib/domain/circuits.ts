import { z } from "zod";

/**
 * Dominio puro de circuitos y rankings acumulados multifecha.
 * Un circuito agrupa torneos ("fechas") y consolida un ranking individual
 * donde cada jugador suma puntos en función de la fase alcanzada en cada fecha.
 */

export const CIRCUIT_ROUNDS = [
  "champion",
  "runner_up",
  "semis",
  "quarters",
  "round_of_16",
  "round_of_32",
  "group_stage",
] as const;

export type CircuitRound = (typeof CIRCUIT_ROUNDS)[number];

export type CircuitPointsConfig = {
  champion: number;
  runner_up: number;
  semis: number;
  quarters: number;
  round_of_16: number;
  round_of_32: number;
  group_stage: number;
};

export const DEFAULT_CIRCUIT_POINTS: CircuitPointsConfig = {
  champion: 100,
  runner_up: 60,
  semis: 35,
  quarters: 20,
  round_of_16: 10,
  round_of_32: 5,
  group_stage: 0,
};

export const ROUND_LABELS: Record<CircuitRound, string> = {
  champion: "Campeón",
  runner_up: "Subcampeón",
  semis: "Semifinales",
  quarters: "Cuartos",
  round_of_16: "Octavos",
  round_of_32: "16avos",
  group_stage: "Grupos",
};

export const circuitPointsConfigSchema = z.object({
  champion: z.number().int().min(0, "Los puntos no pueden ser negativos.").max(10000),
  runner_up: z.number().int().min(0, "Los puntos no pueden ser negativos.").max(10000),
  semis: z.number().int().min(0, "Los puntos no pueden ser negativos.").max(10000),
  quarters: z.number().int().min(0, "Los puntos no pueden ser negativos.").max(10000),
  round_of_16: z.number().int().min(0, "Los puntos no pueden ser negativos.").max(10000),
  round_of_32: z.number().int().min(0, "Los puntos no pueden ser negativos.").max(10000),
  group_stage: z.number().int().min(0, "Los puntos no pueden ser negativos.").max(10000),
});

export const circuitSchema = z.object({
  name: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(100),
  sportId: z.string().min(1, "Elegí un deporte."),
  year: z.number().int().min(2000).max(2100),
  description: z.string().trim().max(2000).optional().nullable(),
  pointsConfig: circuitPointsConfigSchema,
});

export type CircuitInput = z.infer<typeof circuitSchema>;

export type CircuitMatch = {
  stage: "group" | "playoff";
  round: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  winnerTeamId: string | null;
  isBye?: boolean;
  isThirdPlace?: boolean;
};

export type CircuitTournamentTeam = {
  id: string;
  name: string;
  members: {
    userId: string | null;
    displayName: string | null;
    fullName: string | null;
  }[];
};

export type CircuitTournamentData = {
  id: string;
  name: string;
  circuitOrder: number | null;
  status: string;
  championTeamId: string | null;
  totalPlayoffRounds: number;
  matches: CircuitMatch[];
  teams: CircuitTournamentTeam[];
};

/** Determina la fase más avanzada alcanzada por un equipo en el torneo. */
export function computeTeamRoundReached(
  teamId: string,
  matches: readonly CircuitMatch[],
  championTeamId: string | null,
  totalPlayoffRounds: number,
): CircuitRound {
  if (championTeamId === teamId) {
    return "champion";
  }

  const teamPlayoffMatches = matches.filter(
    (m) =>
      m.stage === "playoff" &&
      !m.isThirdPlace &&
      (m.homeTeamId === teamId || m.awayTeamId === teamId),
  );

  if (teamPlayoffMatches.length === 0 || totalPlayoffRounds <= 0) {
    return "group_stage";
  }

  const maxRoundPlayed = Math.max(...teamPlayoffMatches.map((m) => m.round));
  const distanceToFinal = totalPlayoffRounds - maxRoundPlayed;

  if (distanceToFinal === 0) return "runner_up";
  if (distanceToFinal === 1) return "semis";
  if (distanceToFinal === 2) return "quarters";
  if (distanceToFinal === 3) return "round_of_16";
  if (distanceToFinal === 4) return "round_of_32";

  return "group_stage";
}

export type TournamentDatePerformance = {
  tournamentId: string;
  tournamentName: string;
  circuitOrder: number;
  round: CircuitRound;
  points: number;
};

export type LeaderboardPlayer = {
  playerId: string;
  playerName: string;
  totalPoints: number;
  tournamentsPlayed: number;
  titles: number;
  performances: TournamentDatePerformance[];
  rank: number;
};

/** Genera la clave única y estable para un jugador (userId o nombre normalizado). */
export function playerKey(member: { userId: string | null; displayName: string | null; fullName: string | null }): string {
  if (member.userId) return `user:${member.userId}`;
  const name = (member.fullName ?? member.displayName ?? "").trim().toLowerCase();
  return `anon:${name}`;
}

/** Obtiene el nombre visualmente representativo del jugador. */
export function playerDisplayName(member: { userId: string | null; displayName: string | null; fullName: string | null }): string {
  return member.fullName ?? member.displayName ?? "Jugador";
}

/**
 * Calcula la tabla general (ranking acumulado) de un circuito a partir
 * de las fechas jugadas y el baremo de puntos configurado.
 */
export function computeCircuitLeaderboard(
  pointsConfig: CircuitPointsConfig,
  tournaments: readonly CircuitTournamentData[],
): LeaderboardPlayer[] {
  const playersMap = new Map<
    string,
    {
      playerId: string;
      playerName: string;
      totalPoints: number;
      tournamentsPlayed: number;
      titles: number;
      performances: TournamentDatePerformance[];
    }
  >();

  // Ordenar fechas por circuitOrder ascendente
  const sortedTournaments = [...tournaments].sort(
    (a, b) => (a.circuitOrder ?? 9999) - (b.circuitOrder ?? 9999),
  );

  for (let index = 0; index < sortedTournaments.length; index++) {
    const t = sortedTournaments[index];
    if (!t) continue;
    const order = t.circuitOrder ?? index + 1;

    for (const team of t.teams) {
      const round = computeTeamRoundReached(
        team.id,
        t.matches,
        t.championTeamId,
        t.totalPlayoffRounds,
      );
      const points = pointsConfig[round] ?? 0;
      const isTitle = round === "champion";

      for (const member of team.members) {
        const key = playerKey(member);
        const name = playerDisplayName(member);

        let entry = playersMap.get(key);
        if (!entry) {
          entry = {
            playerId: key,
            playerName: name,
            totalPoints: 0,
            tournamentsPlayed: 0,
            titles: 0,
            performances: [],
          };
          playersMap.set(key, entry);
        } else if (entry.playerName === "Jugador" && name !== "Jugador") {
          entry.playerName = name;
        }

        entry.totalPoints += points;
        entry.tournamentsPlayed += 1;
        if (isTitle) entry.titles += 1;
        entry.performances.push({
          tournamentId: t.id,
          tournamentName: t.name,
          circuitOrder: order,
          round,
          points,
        });
      }
    }
  }

  // Ordenar el ranking: 1) puntos totales desc, 2) títulos desc, 3) fechas jugadas desc, 4) nombre
  const list = [...playersMap.values()].sort((a, b) => {
    if (b.totalPoints !== a.totalPoints) return b.totalPoints - a.totalPoints;
    if (b.titles !== a.titles) return b.titles - a.titles;
    if (b.tournamentsPlayed !== a.tournamentsPlayed) return b.tournamentsPlayed - a.tournamentsPlayed;
    return a.playerName.localeCompare(b.playerName);
  });

  // Asignar puestos (rank) respetando empates
  let currentRank = 1;
  return list.map((item, idx) => {
    if (idx > 0) {
      const prev = list[idx - 1];
      if (
        prev &&
        prev.totalPoints === item.totalPoints &&
        prev.titles === item.titles &&
        prev.tournamentsPlayed === item.tournamentsPlayed
      ) {
        // Mismo puesto que el anterior
        return { ...item, rank: currentRank };
      }
    }
    currentRank = idx + 1;
    return { ...item, rank: currentRank };
  });
}
