import "server-only";
import { cache } from "react";
import {
  computeCircuitCategoryLeaderboards,
  computeCircuitLeaderboard,
  DEFAULT_CIRCUIT_POINTS,
  type CircuitCategoryLeaderboard,
  type CircuitMatch,
  type CircuitMultiCategoryTournamentData,
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
 * Carga todos los torneos, categorías, partidos y equipos del circuito y calcula
 * las tablas de posiciones / rankings individuales acumulados por categoría.
 */
export const getCircuitLeaderboardData = cache(
  async (circuitId: string, pointsConfig: CircuitPointsConfig): Promise<CircuitCategoryLeaderboard[]> => {
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

    // 2. Obtener categorías de los torneos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: categories, error: catError } = await (supabase as any)
      .from("tournament_categories")
      .select("id, tournament_id, name, position, champion_team_id")
      .in("tournament_id", tournamentIds)
      .order("position");

    if (catError && !isSchemaPendingError(catError)) {
      console.error("[getCircuitLeaderboardData] error fetching categories:", catError);
    }

    // 3. Obtener partidos de los torneos
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: matches, error: matchError } = await (supabase as any)
      .from("matches")
      .select("id, tournament_id, category_id, stage, round, home_team_id, away_team_id, winner_team_id, is_bye, is_third_place")
      .in("tournament_id", tournamentIds);

    if (matchError) throw matchError;

    // 4. Obtener equipos y sus miembros
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: teams, error: teamError } = await (supabase as any)
      .from("teams")
      .select("id, tournament_id, category_id, name, team_members(user_id, display_name, profiles(full_name))")
      .in("tournament_id", tournamentIds)
      .neq("status", "rejected");

    if (teamError) throw teamError;

    // 5. Mapear para el motor de dominio multideporte / multicategoría
    const multiCatTournaments: CircuitMultiCategoryTournamentData[] = tournaments.map((t, idx) => ({
      id: t.id,
      name: t.name,
      circuitOrder: t.circuit_order ?? idx + 1,
      status: t.status,
      championTeamId: t.champion_team_id,
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      categories: (categories ?? [])
        .filter((c: any) => c.tournament_id === t.id)
        .map((c: any) => ({
          id: c.id,
          tournamentId: c.tournament_id,
          name: c.name,
          position: c.position,
          championTeamId: c.champion_team_id,
        })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      matches: (matches ?? [])
        .filter((m: any) => m.tournament_id === t.id)
        .map((m: any) => ({
          id: m.id,
          tournamentId: m.tournament_id,
          categoryId: m.category_id,
          stage: m.stage,
          round: m.round,
          homeTeamId: m.home_team_id,
          awayTeamId: m.away_team_id,
          winnerTeamId: m.winner_team_id,
          isBye: m.is_bye,
          isThirdPlace: m.is_third_place,
        })),
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      teams: (teams ?? [])
        .filter((tm: any) => tm.tournament_id === t.id)
        .map((tm: any) => ({
          id: tm.id,
          tournamentId: tm.tournament_id,
          categoryId: tm.category_id,
          name: tm.name,
          members: (tm.team_members ?? []).map((mem: any) => ({
            userId: mem.user_id,
            displayName: mem.display_name,
            fullName: mem.profiles?.full_name ?? null,
          })),
        })),
    }));

    return computeCircuitCategoryLeaderboards(pointsConfig, multiCatTournaments);
  },
);
