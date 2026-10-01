import "server-only";
import { cache } from "react";
import { roundName } from "@/lib/domain/bracket";
import { type MatchResult, formatResult } from "@/lib/domain/scoring";
import type { Outcome } from "@/lib/domain/stats";
import type { TournamentStatus } from "@/lib/domain/tournament-status";
import { createClient } from "@/lib/supabase/server";

/** Partidos del usuario (vista v_my_matches, con RLS) para historial y próximos. */

export type MyMatchRow = {
  matchId: string;
  tournamentId: string;
  tournamentName: string;
  tournamentSlug: string;
  tournamentStatus: TournamentStatus;
  timezone: string;
  sportId: string;
  sportName: string;
  stageLabel: string;
  startsAt: string | null;
  endsAt: string | null;
  courtName: string | null;
  courtVenue: string | null;
  myTeamId: string;
  myTeamName: string;
  rivalName: string;
  partners: string[];
  resultText: string | null;
  resultStatus: "provisional" | "confirmed" | "disputed" | null;
  outcome: Outcome | null;
};

export type MyHistory = {
  matches: MyMatchRow[];
  championTournamentIds: string[];
};

export const getMyMatches = cache(async (userId: string): Promise<MyHistory> => {
  const supabase = await createClient();
  const { data: rows, error } = await supabase.from("v_my_matches").select("*");
  if (error) throw error;

  const teamIds = [...new Set(rows.map((r) => r.my_team_id).filter((id): id is string => Boolean(id)))];
  const tournamentIds = [...new Set(rows.map((r) => r.tournament_id).filter((id): id is string => Boolean(id)))];

  const [members, playoffs, champions] = await Promise.all([
    teamIds.length
      ? supabase.from("team_members").select("team_id, user_id, email, profiles(full_name)").in("team_id", teamIds)
      : Promise.resolve({ data: [], error: null }),
    tournamentIds.length
      ? supabase.from("matches").select("tournament_id, round").eq("stage", "playoff").in("tournament_id", tournamentIds)
      : Promise.resolve({ data: [], error: null }),
    teamIds.length
      ? supabase.from("tournaments").select("id").in("champion_team_id", teamIds)
      : Promise.resolve({ data: [], error: null }),
  ]);
  if (members.error) throw members.error;
  if (playoffs.error) throw playoffs.error;
  if (champions.error) throw champions.error;

  // Compañeros por equipo (sin el usuario); los no registrados se muestran por email.
  const partners = new Map<string, string[]>();
  for (const m of members.data ?? []) {
    if (m.user_id === userId) continue;
    const name = (m.profiles as { full_name: string } | null)?.full_name ?? m.email;
    partners.set(m.team_id, [...(partners.get(m.team_id) ?? []), name]);
  }
  const playoffRounds = new Map<string, number>();
  for (const p of playoffs.data ?? []) {
    playoffRounds.set(p.tournament_id, Math.max(playoffRounds.get(p.tournament_id) ?? 0, p.round));
  }

  const matches = rows
    .filter((r) => r.match_id && r.tournament_id && r.my_team_id)
    .map((r) => {
      const stageLabel =
        r.stage === "group"
          ? `Fase de grupos · Fecha ${r.round}`
          : r.is_third_place
            ? "3er puesto"
            : roundName(r.round ?? 1, playoffRounds.get(r.tournament_id as string) ?? r.round ?? 1);
      const result = r.result as MatchResult | null;
      return {
        matchId: r.match_id as string,
        tournamentId: r.tournament_id as string,
        tournamentName: r.tournament_name ?? "",
        tournamentSlug: r.tournament_slug ?? "",
        tournamentStatus: r.tournament_status as TournamentStatus,
        timezone: r.timezone ?? "America/Argentina/Buenos_Aires",
        sportId: r.sport_id ?? "",
        sportName: r.sport_name ?? "",
        stageLabel,
        startsAt: r.starts_at,
        endsAt: r.ends_at,
        courtName: r.court_name,
        courtVenue: r.court_venue,
        myTeamId: r.my_team_id as string,
        myTeamName: r.my_team_name ?? "",
        rivalName: r.rival_team_name ?? "A definir",
        partners: partners.get(r.my_team_id as string) ?? [],
        resultText: result ? `${formatResult(result)}${r.is_walkover ? " (W.O.)" : ""}` : null,
        resultStatus: r.result_status,
        outcome: (r.outcome as Outcome | null) ?? null,
      };
    });

  return { matches, championTournamentIds: (champions.data ?? []).map((t) => t.id) };
});
