import "server-only";
import { cache } from "react";
import type { ScoringConfig } from "@/lib/domain/scoring";
import type { StandingsConfig } from "@/lib/domain/standings";
import type { PlayoffConfig } from "@/lib/domain/bracket";
import type { TournamentStatus } from "@/lib/domain/tournament-status";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Lecturas de torneos para Server Components. Todas pasan por RLS con la
 * sesión del usuario: nunca devuelven más de lo que puede ver.
 */

export type Sport = Tables<"sports">;

export const getSports = cache(async (): Promise<Sport[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sports").select("*").order("sort_order");
  if (error) throw error;
  return data;
});

export type TournamentListItem = {
  id: string;
  name: string;
  slug: string;
  status: TournamentStatus;
  startsOn: string;
  endsOn: string;
  sportName: string;
  teamSize: number;
  maxTeams: number;
  approvedTeams: number;
  pendingTeams: number;
  isTest: boolean;
};

/** Torneos que organiza el usuario, del más reciente al más viejo. */
export const listOrganizedTournaments = cache(async (userId: string): Promise<TournamentListItem[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("tournaments")
    .select(
      "id, name, slug, status, is_test, starts_on, ends_on, max_teams, sports(name, min_team_size), teams!teams_tournament_id_fkey(status)",
    )
    .eq("organizer_id", userId)
    .order("starts_on", { ascending: false });
  if (error) throw error;

  return data.map((t) => ({
    id: t.id,
    name: t.name,
    slug: t.slug,
    status: t.status,
    startsOn: t.starts_on,
    endsOn: t.ends_on,
    sportName: t.sports?.name ?? "",
    teamSize: t.sports?.min_team_size ?? 2,
    maxTeams: t.max_teams,
    approvedTeams: t.teams.filter((team) => team.status === "approved").length,
    pendingTeams: t.teams.filter((team) => team.status === "pending").length,
    isTest: t.is_test,
  }));
});

export type ParticipationItem = {
  teamId: string;
  teamName: string;
  teamStatus: Tables<"teams">["status"];
  role: Tables<"team_members">["role"];
  tournament: {
    id: string;
    name: string;
    slug: string;
    status: TournamentStatus;
    startsOn: string;
    endsOn: string;
    sportName: string;
  };
};

/** Torneos donde el usuario integra un equipo (cualquier estado de inscripción). */
export const listParticipations = cache(async (userId: string): Promise<ParticipationItem[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_members")
    .select(
      "role, teams!inner(id, name, status, tournaments!teams_tournament_id_fkey!inner(id, name, slug, status, starts_on, ends_on, sports(name)))",
    )
    .eq("user_id", userId);
  if (error) throw error;

  return data
    .map((member) => {
      const team = member.teams;
      const tournament = team.tournaments;
      return {
        teamId: team.id,
        teamName: team.name,
        teamStatus: team.status,
        role: member.role,
        tournament: {
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          status: tournament.status,
          startsOn: tournament.starts_on,
          endsOn: tournament.ends_on,
          sportName: tournament.sports?.name ?? "",
        },
      };
    })
    .sort((a, b) => b.tournament.startsOn.localeCompare(a.tournament.startsOn));
});

export type OrganizerTournament = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  status: TournamentStatus;
  startsOn: string;
  endsOn: string;
  timezone: string;
  maxTeams: number;
  resultsRequireConfirmation: boolean;
  scoringConfig: ScoringConfig;
  standingsConfig: StandingsConfig;
  playoffConfig: PlayoffConfig;
  championTeamId: string | null;
  sport: Sport;
  inviteCode: string | null;
  isTest: boolean;
};

/**
 * Torneo visto por su organizador. Devuelve null si no existe o si quien
 * consulta no lo organiza (las pantallas responden 404).
 */
export const getOrganizerTournament = cache(
  async (tournamentId: string, userId: string): Promise<OrganizerTournament | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tournaments")
      .select("*, sports(*), tournament_invites(code)")
      .eq("id", tournamentId)
      .maybeSingle();
    if (error) throw error;
    if (!data || data.organizer_id !== userId || !data.sports) return null;

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      status: data.status,
      startsOn: data.starts_on,
      endsOn: data.ends_on,
      timezone: data.timezone,
      maxTeams: data.max_teams,
      resultsRequireConfirmation: data.results_require_confirmation,
      // Las configs las valida la app al guardar (y la base su forma mínima).
      scoringConfig: data.scoring_config as ScoringConfig,
      standingsConfig: data.standings_config as StandingsConfig,
      playoffConfig: data.playoff_config as PlayoffConfig,
      championTeamId: data.champion_team_id,
      sport: data.sports,
      inviteCode: data.tournament_invites?.code ?? null,
      isTest: data.is_test,
    };
  },
);

export type TournamentCounts = {
  courts: number;
  slots: number;
  teams: number;
  approvedTeams: number;
  pendingTeams: number;
  rejectedTeams: number;
  groupMatches: number;
  pendingGroupMatches: number;
  /** Partidos de grupo sin franja asignada. */
  unscheduledGroupMatches: number;
  playoffMatches: number;
  pendingPlayoffMatches: number;
  finalDecided: boolean;
};

/** Números del panel del organizador y contexto para validar transiciones de estado. */
export const getTournamentCounts = cache(async (tournamentId: string): Promise<TournamentCounts> => {
  const supabase = await createClient();
  const [courts, slots, teams, matches] = await Promise.all([
    supabase.from("courts").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId),
    supabase.from("time_slots").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId),
    supabase.from("teams").select("status").eq("tournament_id", tournamentId),
    supabase
      .from("matches")
      .select("stage, result_status, is_third_place, next_match_id, winner_team_id, slot_id")
      .eq("tournament_id", tournamentId),
  ]);
  for (const result of [courts, slots, teams, matches]) {
    if (result.error) throw result.error;
  }

  const teamRows = teams.data ?? [];
  const matchRows = matches.data ?? [];
  const groupMatches = matchRows.filter((m) => m.stage === "group");
  const playoffMatches = matchRows.filter((m) => m.stage === "playoff");

  return {
    courts: courts.count ?? 0,
    slots: slots.count ?? 0,
    teams: teamRows.length,
    approvedTeams: teamRows.filter((t) => t.status === "approved").length,
    pendingTeams: teamRows.filter((t) => t.status === "pending").length,
    rejectedTeams: teamRows.filter((t) => t.status === "rejected").length,
    groupMatches: groupMatches.length,
    pendingGroupMatches: groupMatches.filter((m) => m.result_status === null).length,
    unscheduledGroupMatches: groupMatches.filter((m) => m.slot_id === null).length,
    playoffMatches: playoffMatches.length,
    pendingPlayoffMatches: playoffMatches.filter((m) => m.result_status === null).length,
    finalDecided: matchRows.some(
      (m) => m.stage === "playoff" && !m.is_third_place && m.next_match_id === null && m.winner_team_id !== null,
    ),
  };
});

export type CourtRow = { id: string; name: string; venue: string | null; position: number };
export type SlotRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  courtId: string | null;
  availableTeams: number;
  assignedMatches: number;
};

/** Canchas y franjas del torneo, con uso de cada franja (disponibilidad marcada y partidos). */
export const getCourtsAndSlots = cache(
  async (tournamentId: string): Promise<{ courts: CourtRow[]; slots: SlotRow[] }> => {
    const supabase = await createClient();
    const [courts, slots] = await Promise.all([
      supabase
        .from("courts")
        .select("id, name, venue, position")
        .eq("tournament_id", tournamentId)
        .order("position")
        .order("name"),
      supabase
        .from("time_slots")
        .select("id, starts_at, ends_at, court_id, team_availability(count), matches(count)")
        .eq("tournament_id", tournamentId)
        .order("starts_at"),
    ]);
    if (courts.error) throw courts.error;
    if (slots.error) throw slots.error;

    return {
      courts: courts.data,
      slots: slots.data.map((slot) => ({
        id: slot.id,
        startsAt: slot.starts_at,
        endsAt: slot.ends_at,
        courtId: slot.court_id,
        availableTeams: slot.team_availability[0]?.count ?? 0,
        assignedMatches: slot.matches[0]?.count ?? 0,
      })),
    };
  },
);
