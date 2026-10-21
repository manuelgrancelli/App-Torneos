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
  const [matches, slots, courts, rows, groupTeams] = await Promise.all([
    supabase.from("matches").select("*").eq("tournament_id", tournamentId),
    supabase.from("time_slots").select("id, starts_at, ends_at, court_id").eq("tournament_id", tournamentId),
    supabase.from("courts").select("id").eq("tournament_id", tournamentId).order("position").order("name"),
    supabase.from("team_availability").select("team_id, slot_id").eq("tournament_id", tournamentId),
    supabase.from("group_teams").select("group_id, team_id").eq("tournament_id", tournamentId),
  ]);
  for (const result of [matches, slots, courts, rows, groupTeams]) {
    if (result.error) return { ok: false, error: result.error };
  }

  const all = matches.data ?? [];
  const groupTeamsMap = new Map<string, string[]>();
  for (const row of groupTeams.data ?? []) {
    const list = groupTeamsMap.get(row.group_id) ?? [];
    list.push(row.team_id);
    groupTeamsMap.set(row.group_id, list);
  }

  const isCandidate = (m: Tables<"matches">) =>
    m.result_status === null &&
    !m.schedule_locked &&
    !m.is_bye &&
    ((m.home_team_id !== null && m.away_team_id !== null) ||
      (m.stage === "group" && m.round === 2 && m.group_id !== null && groupTeamsMap.get(m.group_id)?.length === 4)) &&
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
      groupTeamIds: m.group_id ? groupTeamsMap.get(m.group_id) : undefined,
      groupId: m.group_id ?? undefined,
      round: m.round,
    }));

  const feederIdsMap = new Map<string, string[]>();
  const feedersEnd = new Map<string, number>();

  // 1. Playoffs feeders (vía next_match_id y loser_next_match_id)
  for (const m of all) {
    for (const target of [m.next_match_id, m.loser_next_match_id]) {
      if (target) {
        const list = feederIdsMap.get(target) ?? [];
        list.push(m.id);
        feederIdsMap.set(target, list);
        if (m.ends_at) {
          feedersEnd.set(target, Math.max(feedersEnd.get(target) ?? 0, Date.parse(m.ends_at)));
        }
      }
    }
  }

  // 2. Group stage feeders (zona de 4: round 2 depende de round 1 del mismo grupo)
  for (const m of all) {
    if (m.stage === "group" && m.round === 2 && m.group_id && groupTeamsMap.get(m.group_id)?.length === 4) {
      const r1Matches = all.filter((o) => o.group_id === m.group_id && o.round === 1);
      const list = feederIdsMap.get(m.id) ?? [];
      for (const r1 of r1Matches) {
        if (!list.includes(r1.id)) list.push(r1.id);
        if (r1.ends_at) {
          feedersEnd.set(m.id, Math.max(feedersEnd.get(m.id) ?? 0, Date.parse(r1.ends_at)));
        }
      }
      feederIdsMap.set(m.id, list);
    }
  }

  // 3. Team match history: si un equipo ya jugó o tiene partido fijo, su siguiente partido
  // no puede empezar antes de que termine el anterior
  const teamLatestFixedEnd = new Map<string, number>();
  for (const f of fixed) {
    if (f.homeTeamId) {
      teamLatestFixedEnd.set(f.homeTeamId, Math.max(teamLatestFixedEnd.get(f.homeTeamId) ?? 0, f.end));
    }
    if (f.awayTeamId) {
      teamLatestFixedEnd.set(f.awayTeamId, Math.max(teamLatestFixedEnd.get(f.awayTeamId) ?? 0, f.end));
    }
  }

  for (const m of toSchedule) {
    const t1End = m.home_team_id ? teamLatestFixedEnd.get(m.home_team_id) : undefined;
    const t2End = m.away_team_id ? teamLatestFixedEnd.get(m.away_team_id) : undefined;
    const maxTeamEnd = Math.max(t1End ?? 0, t2End ?? 0);
    if (maxTeamEnd > 0) {
      feedersEnd.set(m.id, Math.max(feedersEnd.get(m.id) ?? 0, maxTeamEnd));
    }
  }

  const schedulerMatches: SchedulerMatch[] = toSchedule.map((m) => {
    const gTeams = m.group_id ? groupTeamsMap.get(m.group_id) : undefined;
    return {
      id: m.id,
      homeTeamId: m.home_team_id,
      awayTeamId: m.away_team_id,
      notBefore: feedersEnd.get(m.id),
      // Grupos primero por fecha; playoffs después, por ronda.
      order: (m.stage === "group" ? 0 : 100) + m.round,
      feederMatchIds: feederIdsMap.get(m.id),
      groupTeamIds: (!m.home_team_id || !m.away_team_id) && gTeams && gTeams.length === 4 ? gTeams : undefined,
      groupId: m.group_id ?? undefined,
      round: m.round,
    };
  });

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
