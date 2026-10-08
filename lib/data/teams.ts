import "server-only";
import { cache } from "react";
import type { TournamentStatus } from "@/lib/domain/tournament-status";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

/** Lecturas de inscripciones, integrantes y disponibilidad (con RLS). */

export type TeamStatus = Tables<"teams">["status"];

export type TeamMemberView = {
  id: string;
  email: string | null;
  displayName: string | null;
  userId: string | null;
  fullName: string | null;
  role: Tables<"team_members">["role"];
};

export type SlotView = { id: string; startsAt: string; endsAt: string; courtId: string | null };

export type MemberTeam = {
  id: string;
  name: string;
  status: TeamStatus;
  isCaptain: boolean;
  members: TeamMemberView[];
  availability: string[];
  tournament: {
    id: string;
    name: string;
    slug: string;
    status: TournamentStatus;
    timezone: string;
    startsOn: string;
    endsOn: string;
    sportName: string;
    minTeamSize: number;
    maxTeamSize: number;
    resultsRequireConfirmation: boolean;
    bannerUrl: string | null;
  };
  slots: SlotView[];
  courts: { id: string; name: string }[];
};

function toMember(row: {
  id: string;
  email: string | null;
  display_name: string | null;
  user_id: string | null;
  role: Tables<"team_members">["role"];
  profiles: { full_name: string } | null;
}): TeamMemberView {
  return {
    id: row.id,
    email: row.email,
    displayName: row.display_name,
    userId: row.user_id,
    fullName: row.profiles?.full_name ?? null,
    role: row.role,
  };
}

/**
 * Inscripción vista por uno de sus integrantes. null si no existe o si el
 * usuario no es integrante (la página responde 404).
 */
export const getTeamForMember = cache(async (teamId: string, userId: string): Promise<MemberTeam | null> => {
  const supabase = await createClient();
  const { data: team, error } = await supabase
    .from("teams")
    .select(
      "id, name, status, captain_id, tournament_id, team_members(id, email, display_name, user_id, role, profiles(full_name)), team_availability(slot_id), tournaments!teams_tournament_id_fkey(id, name, slug, status, timezone, starts_on, ends_on, results_require_confirmation, banner_url, sports(name, min_team_size, max_team_size))",
    )
    .eq("id", teamId)
    .maybeSingle();
  if (error) throw error;
  if (!team || !team.tournaments || !team.team_members.some((m) => m.user_id === userId)) return null;

  const [slots, courts] = await Promise.all([
    supabase
      .from("time_slots")
      .select("id, starts_at, ends_at, court_id")
      .eq("tournament_id", team.tournament_id)
      .order("starts_at"),
    supabase.from("courts").select("id, name").eq("tournament_id", team.tournament_id).order("position"),
  ]);
  if (slots.error) throw slots.error;
  if (courts.error) throw courts.error;

  const t = team.tournaments;
  return {
    id: team.id,
    name: team.name,
    status: team.status,
    isCaptain: team.captain_id === userId,
    members: team.team_members
      .map(toMember)
      .sort((a, b) =>
        a.role === b.role
          ? (a.fullName ?? a.displayName ?? a.email ?? "").localeCompare(b.fullName ?? b.displayName ?? b.email ?? "")
          : a.role === "captain"
            ? -1
            : 1,
      ),
    availability: team.team_availability.map((a) => a.slot_id),
    tournament: {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      timezone: t.timezone,
      startsOn: t.starts_on,
      endsOn: t.ends_on,
      sportName: t.sports?.name ?? "",
      minTeamSize: t.sports?.min_team_size ?? 2,
      maxTeamSize: t.sports?.max_team_size ?? 2,
      resultsRequireConfirmation: t.results_require_confirmation,
      bannerUrl: t.banner_url ?? null,
    },
    slots: slots.data.map((s) => ({ id: s.id, startsAt: s.starts_at, endsAt: s.ends_at, courtId: s.court_id })),
    courts: courts.data,
  };
});

export type OrganizerTeam = {
  id: string;
  name: string;
  status: TeamStatus;
  testGenerated: boolean;
  organizerRegistered: boolean;
  createdAt: string;
  members: TeamMemberView[];
  availabilityCount: number;
};

/** Inscripciones de un torneo vistas por su organizador (con emails de los integrantes). */
export const listTournamentTeams = cache(async (tournamentId: string): Promise<OrganizerTeam[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("teams")
    .select("id, name, status, test_generated, organizer_registered, created_at, team_members(id, email, display_name, user_id, role, profiles(full_name)), team_availability(count)")
    .eq("tournament_id", tournamentId)
    .order("created_at");
  if (error) throw error;

  return data.map((team) => ({
    id: team.id,
    name: team.name,
    status: team.status,
    testGenerated: team.test_generated,
    organizerRegistered: team.organizer_registered,
    createdAt: team.created_at,
    members: team.team_members
      .map(toMember)
      .sort((a, b) =>
        a.role === b.role
          ? (a.fullName ?? a.displayName ?? a.email ?? "").localeCompare(b.fullName ?? b.displayName ?? b.email ?? "")
          : a.role === "captain"
            ? -1
            : 1,
      ),
    availabilityCount: team.team_availability[0]?.count ?? 0,
  }));
});

export type AvailabilityMatrix = {
  teams: { id: string; name: string; status: TeamStatus }[];
  slots: SlotView[];
  rows: { teamId: string; slotId: string }[];
};

/** Datos para el resumen de disponibilidad del organizador (inscripciones no rechazadas). */
export const getAvailabilityMatrix = cache(async (tournamentId: string): Promise<AvailabilityMatrix> => {
  const supabase = await createClient();
  const [teams, slots, rows] = await Promise.all([
    supabase
      .from("teams")
      .select("id, name, status")
      .eq("tournament_id", tournamentId)
      .neq("status", "rejected")
      .order("name"),
    supabase.from("time_slots").select("id, starts_at, ends_at, court_id").eq("tournament_id", tournamentId).order("starts_at"),
    supabase.from("team_availability").select("team_id, slot_id").eq("tournament_id", tournamentId),
  ]);
  if (teams.error) throw teams.error;
  if (slots.error) throw slots.error;
  if (rows.error) throw rows.error;

  return {
    teams: teams.data,
    slots: slots.data.map((s) => ({ id: s.id, startsAt: s.starts_at, endsAt: s.ends_at, courtId: s.court_id })),
    rows: rows.data.map((r) => ({ teamId: r.team_id, slotId: r.slot_id })),
  };
});
