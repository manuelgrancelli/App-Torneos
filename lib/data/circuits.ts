import "server-only";
import { cache } from "react";
import {
  computeCircuitLeaderboard,
  DEFAULT_CIRCUIT_POINTS,
  type CircuitMatch,
  type CircuitPointsConfig,
  type CircuitTournamentData,
  type LeaderboardPlayer,
} from "@/lib/domain/circuits";
import type { TournamentStatus } from "@/lib/domain/tournament-status";
import { createClient } from "@/lib/supabase/server";

export type CircuitListItem = {
  id: string;
  name: string;
  slug: string;
  sportId: string;
  sportName: string;
  year: number;
  description: string | null;
  tournamentsCount: number;
  createdAt: string;
};

export type CircuitDetail = {
  id: string;
  name: string;
  slug: string;
  sportId: string;
  sportName: string;
  year: number;
  description: string | null;
  pointsConfig: CircuitPointsConfig;
  organizerId: string;
  createdAt: string;
};

export type CircuitDateItem = {
  id: string;
  name: string;
  slug: string;
  circuitOrder: number;
  status: TournamentStatus;
  startsOn: string;
  endsOn: string;
  maxTeams: number;
  approvedTeams: number;
  championTeamName: string | null;
};

/** Detecta si la tabla circuits o columnas asociadas aún no fueron creadas en la base. */
export function isSchemaPendingError(error: unknown): boolean {
  if (!error || typeof error !== "object") return false;
  const e = error as { code?: string; message?: string };
  return (
    e.code === "42P01" ||
    e.code === "42703" ||
    e.code === "PGRST204" ||
    e.code === "PGRST205" ||
    Boolean(
      typeof e.message === "string" &&
        (e.message.includes("circuits") ||
          e.message.includes("circuit_id") ||
          e.message.includes("does not exist") ||
          e.message.includes("could not find")),
    )
  );
}

/** Listado de circuitos del organizador. */
export const listOrganizedCircuits = cache(
  async (userId: string): Promise<{ circuits: CircuitListItem[]; migrationPending: boolean }> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("circuits")
      .select("id, name, slug, sport_id, year, description, created_at, sports(name), tournaments(id)")
      .eq("organizer_id", userId)
      .order("year", { ascending: false })
      .order("created_at", { ascending: false });

    if (error) {
      if (isSchemaPendingError(error)) {
        return { circuits: [], migrationPending: true };
      }
      throw error;
    }

    return {
      circuits: data.map((c) => ({
        id: c.id,
        name: c.name,
        slug: c.slug,
        sportId: c.sport_id,
        sportName: c.sports?.name ?? "",
        year: c.year,
        description: c.description,
        tournamentsCount: c.tournaments?.length ?? 0,
        createdAt: c.created_at,
      })),
      migrationPending: false,
    };
  },
);

/** Obtiene el circuito para el organizador. */
export const getOrganizerCircuit = cache(
  async (circuitId: string, userId: string): Promise<CircuitDetail | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("circuits")
      .select("id, name, slug, sport_id, year, description, points_config, organizer_id, created_at, sports(name)")
      .eq("id", circuitId)
      .maybeSingle();

    if (error) {
      if (isSchemaPendingError(error)) return null;
      throw error;
    }
    if (!data || data.organizer_id !== userId) return null;

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      sportId: data.sport_id,
      sportName: data.sports?.name ?? "",
      year: data.year,
      description: data.description,
      pointsConfig: (data.points_config as CircuitPointsConfig) ?? DEFAULT_CIRCUIT_POINTS,
      organizerId: data.organizer_id,
      createdAt: data.created_at,
    };
  },
);

/** Fechas / torneos vinculados a este circuito. */
export const getCircuitDates = cache(async (circuitId: string): Promise<CircuitDateItem[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select("id, name, slug, circuit_order, status, starts_on, ends_on, max_teams, champion_team_id, teams!teams_tournament_id_fkey(id, name, status)")
    .eq("circuit_id", circuitId)
    .order("circuit_order", { ascending: true })
    .order("starts_on", { ascending: true });

  if (error) {
    if (isSchemaPendingError(error)) return [];
    throw error;
  }

  return data.map((t, idx) => {
    const approvedTeams = t.teams.filter((team) => team.status === "approved").length;
    const championTeam = t.champion_team_id
      ? t.teams.find((team) => team.id === t.champion_team_id)?.name ?? null
      : null;

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      circuitOrder: t.circuit_order ?? idx + 1,
      status: t.status,
      startsOn: t.starts_on,
      endsOn: t.ends_on,
      maxTeams: t.max_teams,
      approvedTeams,
      championTeamName: championTeam,
    };
  });
});

/** Torneos del organizador del mismo deporte disponibles para ser vinculados como fechas. */
export const getAvailableTournamentsForCircuit = cache(
  async (userId: string, sportId: string, currentCircuitId: string): Promise<{ id: string; name: string; startsOn: string }[]> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tournaments")
      .select("id, name, starts_on, circuit_id")
      .eq("organizer_id", userId)
      .eq("sport_id", sportId)
      .or(`circuit_id.is.null,circuit_id.neq.${currentCircuitId}`)
      .order("starts_on", { ascending: false });

    if (error) {
      if (isSchemaPendingError(error)) return [];
      throw error;
    }
    return data.map((t) => ({ id: t.id, name: t.name, startsOn: t.starts_on }));
  },
);

/**
 * Carga todos los torneos, partidos y equipos del circuito y calcula
 * la tabla de posiciones / ranking individual acumulado.
 */
export const getCircuitLeaderboardData = cache(
  async (circuitId: string, pointsConfig: CircuitPointsConfig): Promise<LeaderboardPlayer[]> => {
    const supabase = await createClient();

    // 1. Obtener los torneos asociados al circuito
    const { data: tournaments, error: tourError } = await supabase
      .from("tournaments")
      .select("id, name, circuit_order, status, champion_team_id")
      .eq("circuit_id", circuitId)
      .order("circuit_order", { ascending: true });

    if (tourError) {
      if (isSchemaPendingError(tourError)) return [];
      throw tourError;
    }
    if (!tournaments || tournaments.length === 0) return [];

    const tournamentIds = tournaments.map((t) => t.id);

    // 2. Obtener partidos de los torneos
    const { data: matches, error: matchError } = await supabase
      .from("matches")
      .select("tournament_id, stage, round, home_team_id, away_team_id, winner_team_id, is_bye, is_third_place")
      .in("tournament_id", tournamentIds);

    if (matchError) throw matchError;

    // 3. Obtener equipos y sus miembros
    const { data: teams, error: teamError } = await supabase
      .from("teams")
      .select("id, tournament_id, name, team_members(user_id, display_name, profiles(full_name))")
      .in("tournament_id", tournamentIds)
      .neq("status", "rejected");

    if (teamError) throw teamError;

    // 4. Mapear la estructura para el motor de dominio
    const tournamentDataList: CircuitTournamentData[] = tournaments.map((t, idx) => {
      const tourMatches: CircuitMatch[] = (matches ?? [])
        .filter((m) => m.tournament_id === t.id)
        .map((m) => ({
          stage: m.stage as "group" | "playoff",
          round: m.round,
          homeTeamId: m.home_team_id,
          awayTeamId: m.away_team_id,
          winnerTeamId: m.winner_team_id,
          isBye: m.is_bye,
          isThirdPlace: m.is_third_place,
        }));

      const playoffRounds = tourMatches
        .filter((m) => m.stage === "playoff" && !m.isThirdPlace)
        .map((m) => m.round);
      const totalPlayoffRounds = playoffRounds.length > 0 ? Math.max(...playoffRounds) : 0;

      const tourTeams = (teams ?? [])
        .filter((tm) => tm.tournament_id === t.id)
        .map((tm) => ({
          id: tm.id,
          name: tm.name,
          members: tm.team_members.map((mem) => ({
            userId: mem.user_id,
            displayName: mem.display_name,
            fullName: mem.profiles?.full_name ?? null,
          })),
        }));

      return {
        id: t.id,
        name: t.name,
        circuitOrder: t.circuit_order ?? idx + 1,
        status: t.status,
        championTeamId: t.champion_team_id,
        totalPlayoffRounds,
        matches: tourMatches,
        teams: tourTeams,
      };
    });

    return computeCircuitLeaderboard(pointsConfig, tournamentDataList);
  },
);
