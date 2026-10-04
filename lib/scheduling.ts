import "server-only";
import {
  type FixedAssignment,
  type SchedulerMatch,
  type UnscheduledReason,
  scheduleMatches,
} from "@/lib/domain/scheduler";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

export type AutoScheduleMode = "unscheduled" | "all";

export type AutoScheduleOutcome = {
  assigned: number;
  unscheduled: { matchId: string; reason: UnscheduledReason }[];
  exhaustive: boolean;
};

/**
 * Arma la entrada del scheduler (lib/domain) desde la base y aplica el
 * resultado con la RPC apply_schedule (D-026):
 * - "unscheduled": programa solo los partidos sin horario.
 * - "all": rehace todo lo no fijado a mano y no jugado.
 * Con `onlyMatchIds` se limita a esos partidos (p. ej. la ronda siguiente de playoffs).
 * Solo se programan partidos con sus dos equipos definidos.
 */
export async function runAutoSchedule(
  supabase: SupabaseServerClient,
  tournamentId: string,
  mode: AutoScheduleMode,
  onlyMatchIds?: readonly string[],
): Promise<{ ok: true; outcome: AutoScheduleOutcome } | { ok: false; error: { code?: string; message?: string } }> {
  const [matches, slots, courts, rows] = await Promise.all([
    supabase.from("matches").select("*").eq("tournament_id", tournamentId),
    supabase.from("time_slots").select("id, starts_at, ends_at, court_id").eq("tournament_id", tournamentId),
    supabase.from("courts").select("id").eq("tournament_id", tournamentId).order("position").order("name"),
    supabase.from("team_availability").select("team_id, slot_id").eq("tournament_id", tournamentId),
  ]);
  for (const result of [matches, slots, courts, rows]) {
    if (result.error) return { ok: false, error: result.error };
  }

  const all = matches.data ?? [];
  const isCandidate = (m: Tables<"matches">) =>
    m.result_status === null &&
    !m.schedule_locked &&
    !m.is_bye &&
    m.home_team_id !== null &&
    m.away_team_id !== null &&
    (mode === "all" || m.slot_id === null) &&
    (!onlyMatchIds || onlyMatchIds.includes(m.id));

  const toSchedule = all.filter(isCandidate);
  const toScheduleIds = new Set(toSchedule.map((m) => m.id));

  // Lo que no se reprograma sigue ocupando canchas y equipos.
  const fixed: FixedAssignment[] = all
    .filter((m) => !toScheduleIds.has(m.id) && m.starts_at && m.ends_at)
    .map((m) => ({
      matchId: m.id,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      courtId: m.court_id,
      start: Date.parse(m.starts_at as string),
      end: Date.parse(m.ends_at as string),
    }));

  // Playoffs: no antes de que terminen los partidos que lo alimentan.
  const feedersEnd = new Map<string, number>();
  for (const m of all) {
    for (const target of [m.next_match_id, m.loser_next_match_id]) {
      if (target && m.ends_at) {
        feedersEnd.set(target, Math.max(feedersEnd.get(target) ?? 0, Date.parse(m.ends_at)));
      }
    }
  }

  const schedulerMatches: SchedulerMatch[] = toSchedule.map((m) => ({
    id: m.id,
    homeTeamId: m.home_team_id,
    awayTeamId: m.away_team_id,
    notBefore: feedersEnd.get(m.id),
    // Grupos primero por fecha; playoffs después, por ronda.
    order: (m.stage === "group" ? 0 : 100) + m.round,
  }));

  const availability: Record<string, string[]> = {};
  for (const row of rows.data ?? []) (availability[row.team_id] ??= []).push(row.slot_id);

  const result = scheduleMatches({
    matches: schedulerMatches,
    slots: (slots.data ?? []).map((s) => ({
      id: s.id,
      start: Date.parse(s.starts_at),
      end: Date.parse(s.ends_at),
      courtId: s.court_id,
    })),
    courtIds: (courts.data ?? []).map((c) => c.id),
    availability,
    fixed,
  });

  if (result.assignments.length > 0 || mode === "all") {
    const { error } = await supabase.rpc("apply_schedule", {
      p_tournament_id: tournamentId,
      p_assignments: result.assignments.map((a) => ({ matchId: a.matchId, slotId: a.slotId, courtId: a.courtId })),
      p_clear_unlocked: mode === "all" && !onlyMatchIds,
    });
    if (error) return { ok: false, error };
  }

  return {
    ok: true,
    outcome: { assigned: result.assignments.length, unscheduled: result.unscheduled, exhaustive: result.exhaustive },
  };
}
