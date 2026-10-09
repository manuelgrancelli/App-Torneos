import "server-only";
import { cache } from "react";
import type { MatchResult } from "@/lib/domain/scoring";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";
import { getTournamentCategories, type TournamentCategory } from "./categories";

/** Lecturas de la competencia: grupos, partidos, programación y confirmaciones (con RLS). */

export type MatchView = {
  id: string;
  categoryId?: string | null;
  stage: Tables<"matches">["stage"];
  groupId: string | null;
  round: number;
  position: number;
  homeTeamId: string | null;
  awayTeamId: string | null;
  isBye: boolean;
  isThirdPlace: boolean;
  nextMatchId: string | null;
  nextMatchSide: Tables<"matches">["next_match_side"];
  loserNextMatchId: string | null;
  loserNextMatchSide: Tables<"matches">["loser_next_match_side"];
  slotId: string | null;
  courtId: string | null;
  startsAt: string | null;
  endsAt: string | null;
  scheduleLocked: boolean;
  result: MatchResult | null;
  winnerTeamId: string | null;
  isDraw: boolean;
  isWalkover: boolean;
  resultStatus: Tables<"matches">["result_status"];
};

export type GroupView = {
  id: string;
  categoryId?: string | null;
  name: string;
  position: number;
  tiebreakSeed: number;
  teamIds: string[];
};

export type ConfirmationView = {
  matchId: string;
  teamId: string;
  response: Tables<"match_confirmations">["response"];
  comment: string | null;
};

export type Competition = {
  teams: { id: string; name: string; status: Tables<"teams">["status"]; categoryId?: string | null }[];
  groups: GroupView[];
  matches: MatchView[];
  confirmations: ConfirmationView[];
  categories: TournamentCategory[];
};

export function toMatchView(m: Tables<"matches">): MatchView {
  return {
    id: m.id,
    categoryId: (m as Record<string, unknown>).category_id as string | null ?? null,
    stage: m.stage,
    groupId: m.group_id,
    round: m.round,
    position: m.position,
    homeTeamId: m.home_team_id,
    awayTeamId: m.away_team_id,
    isBye: m.is_bye,
    isThirdPlace: m.is_third_place,
    nextMatchId: m.next_match_id,
    nextMatchSide: m.next_match_side,
    loserNextMatchId: m.loser_next_match_id,
    loserNextMatchSide: m.loser_next_match_side,
    slotId: m.slot_id,
    courtId: m.court_id,
    startsAt: m.starts_at,
    endsAt: m.ends_at,
    scheduleLocked: m.schedule_locked,
    result: m.result as MatchResult | null,
    winnerTeamId: m.winner_team_id,
    isDraw: m.is_draw,
    isWalkover: m.is_walkover,
    resultStatus: m.result_status,
  };
}

/** Equipos, grupos, partidos y confirmaciones del torneo (lo que el usuario pueda ver). */
export const getCompetition = cache(async (tournamentId: string): Promise<Competition> => {
  const supabase = await createClient();
  const [teams, groups, matches, confirmations, categories] = await Promise.all([
    supabase.from("teams").select("*, team_members(id)").eq("tournament_id", tournamentId).order("name"),
    supabase
      .from("tournament_groups")
      .select("*, group_teams(team_id, position)")
      .eq("tournament_id", tournamentId)
      .order("position"),
    supabase
      .from("matches")
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("stage")
      .order("round")
      .order("position"),
    supabase.from("match_confirmations").select("match_id, team_id, response, comment").eq("tournament_id", tournamentId),
    getTournamentCategories(tournamentId),
  ]);
  for (const result of [teams, groups, matches, confirmations]) {
    if (result.error) throw result.error;
  }

  const singleCategoryId = categories.length === 1 ? categories[0]!.id : null;

  return {
    teams: (teams.data ?? []).map((t: Record<string, unknown>) => ({
      id: t.id as string,
      name: t.name as string,
      status: t.status as Tables<"teams">["status"],
      categoryId: ((t.category_id as string | null) ?? null) || singleCategoryId,
    })),
    groups: (groups.data ?? []).map((g: Record<string, unknown>) => ({
      id: g.id as string,
      categoryId: (g.category_id as string | null) ?? null,
      name: g.name as string,
      position: g.position as number,
      tiebreakSeed: g.tiebreak_seed as number,
      teamIds: [
        ...((g.group_teams as { team_id: string; position: number }[]) ?? []),
      ]
        .sort((a, b) => a.position - b.position)
        .map((gt) => gt.team_id),
    })),
    matches: (matches.data ?? []).map(toMatchView),
    confirmations: (confirmations.data ?? []).map((c) => ({
      matchId: c.match_id,
      teamId: c.team_id,
      response: c.response,
      comment: c.comment,
    })),
    categories,
  };
});

export type SchedulingData = {
  slots: { id: string; startsAt: string; endsAt: string; courtId: string | null }[];
  courts: { id: string; name: string; venue: string | null }[];
  availability: Record<string, string[]>;
};

/** Franjas, canchas y disponibilidad (por equipo) para programar partidos. */
export const getSchedulingData = cache(async (tournamentId: string): Promise<SchedulingData> => {
  const supabase = await createClient();
  const [slots, courts, rows] = await Promise.all([
    supabase.from("time_slots").select("id, starts_at, ends_at, court_id").eq("tournament_id", tournamentId).order("starts_at"),
    supabase.from("courts").select("id, name, venue").eq("tournament_id", tournamentId).order("position").order("name"),
    supabase.from("team_availability").select("team_id, slot_id").eq("tournament_id", tournamentId),
  ]);
  if (slots.error) throw slots.error;
  if (courts.error) throw courts.error;
  if (rows.error) throw rows.error;

  const availability: Record<string, string[]> = {};
  for (const row of rows.data) (availability[row.team_id] ??= []).push(row.slot_id);

  return {
    slots: slots.data.map((s) => ({ id: s.id, startsAt: s.starts_at, endsAt: s.ends_at, courtId: s.court_id })),
    courts: courts.data,
    availability,
  };
});
