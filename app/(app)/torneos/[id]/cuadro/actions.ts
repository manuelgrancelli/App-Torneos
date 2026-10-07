"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { groupStandings, qualifiersFromStandings } from "@/lib/competition-view";
import { getCompetition } from "@/lib/data/competition";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { buildBracket, playoffConfigSchema } from "@/lib/domain/bracket";
import { scoringConfigSchema } from "@/lib/domain/scoring";
import { standingsConfigSchema } from "@/lib/domain/standings";
import { runAutoSchedule } from "@/lib/scheduling";
import { dbErrorMessage } from "@/lib/supabase/errors";

const generateBracketSchema = z.object({
  tournamentId: z.uuid(),
  qualifiersPerGroup: z.number().int().min(1).max(8),
  thirdPlace: z.boolean(),
});

/**
 * Asegura que el cuadro de playoffs exista en la base de datos si el torneo está en playoffs.
 * Se ejecuta automáticamente al pasar a playoffs o al entrar al cuadro, sin necesidad de que el
 * organizador tenga que armarlo a mano (D-060).
 */
export async function ensurePlayoffBracket(
  supabase: SupabaseServerClient,
  tournamentId: string,
  options?: { qualifiersPerGroup?: number; thirdPlace?: boolean },
): Promise<{ ok: boolean; count?: number; error?: string; warnings?: string[] }> {
  const { data: existing, error: existError } = await supabase
    .from("matches")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("stage", "playoff")
    .limit(1);
  if (existError) return { ok: false, error: dbErrorMessage(existError) };
  if (existing && existing.length > 0 && !options) return { ok: true, count: existing.length };

  const { data: tournament, error: tourError } = await supabase
    .from("tournaments")
    .select("id, status, scoring_config, standings_config, playoff_config")
    .eq("id", tournamentId)
    .maybeSingle();
  if (tourError || !tournament) return { ok: false, error: "No encontramos el torneo." };
  if (tournament.status !== "playoffs") return { ok: false, error: "El torneo no está en playoffs." };

  const scoring = scoringConfigSchema.parse(tournament.scoring_config);
  const standingsConfig = standingsConfigSchema.parse(tournament.standings_config);
  const defaultPlayoffConfig = playoffConfigSchema.parse(tournament.playoff_config);

  const qualifiersPerGroup = options?.qualifiersPerGroup ?? defaultPlayoffConfig.qualifiersPerGroup;
  const thirdPlace = options?.thirdPlace ?? defaultPlayoffConfig.thirdPlace;

  const competition = await getCompetition(tournamentId);
  const standings = groupStandings(competition.groups, competition.matches, scoring, standingsConfig);
  const qualifiers = qualifiersFromStandings(standings, qualifiersPerGroup, scoring.type);

  if (qualifiers.length < 2) return { ok: false, error: "Tienen que clasificar al menos 2 equipos." };
  if (qualifiers.length > 32) return { ok: false, error: "El cuadro admite hasta 32 clasificados." };

  const plan = buildBracket(qualifiers, { thirdPlace });
  const payload = plan.matches.map((m) => ({
    key: m.key,
    round: m.round,
    position: m.position,
    home: m.home,
    away: m.away,
    isBye: m.isBye,
    isThirdPlace: m.isThirdPlace,
    winner: m.winnerTeamId,
    next: m.next,
    loserNext: m.loserNext,
  }));

  const { error: rpcError } = await supabase.rpc("apply_bracket", {
    p_tournament_id: tournamentId,
    p_matches: payload,
  });
  if (rpcError) return { ok: false, error: dbErrorMessage(rpcError) };

  // Primera ronda (y partidos que ya tengan sus dos equipos por byes).
  const { data: ready } = await supabase
    .from("matches")
    .select("id, home_team_id, away_team_id")
    .eq("tournament_id", tournamentId)
    .eq("stage", "playoff")
    .eq("is_bye", false)
    .is("result_status", null);
  const readyIds = (ready ?? []).filter((m) => m.home_team_id && m.away_team_id).map((m) => m.id);
  if (readyIds.length > 0) {
    await runAutoSchedule(supabase, tournamentId, "unscheduled", readyIds);
  }

  revalidatePath(`/torneos/${tournamentId}`, "layout");
  refreshPublicTournament(tournamentId);
  return { ok: true, count: plan.matches.length, warnings: plan.warnings };
}

/**
 * Arma o rearma el cuadro con los clasificados de las tablas finales.
 */
export const generateBracket = createAction(generateBracketSchema, async (input, { supabase }) => {
  const result = await ensurePlayoffBracket(supabase, input.tournamentId, {
    qualifiersPerGroup: input.qualifiersPerGroup,
    thirdPlace: input.thirdPlace,
  });
  if (!result.ok) return actionError(result.error ?? "No pudimos generar el cuadro.");
  return actionOk({ warnings: result.warnings ?? [] }, "Generamos el cuadro.");
});
