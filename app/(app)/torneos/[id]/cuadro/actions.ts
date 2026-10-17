"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { groupStandings, qualifiersFromStandings } from "@/lib/competition-view";
import { getCompetition } from "@/lib/data/competition";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { buildBracket, normalizePlayoffConfig, playoffConfigSchema } from "@/lib/domain/bracket";
import { normalizeScoringConfig, scoringConfigSchema } from "@/lib/domain/scoring";
import { normalizeStandingsConfig, standingsConfigSchema } from "@/lib/domain/standings";
import { runAutoSchedule } from "@/lib/scheduling";
import { dbErrorMessage } from "@/lib/supabase/errors";

const generateBracketSchema = z.object({
  tournamentId: z.string().uuid(),
  categoryId: z.string().uuid().optional(),
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
  options?: {
    qualifiersPerGroup?: number;
    thirdPlace?: boolean;
    categoryId?: string;
    revalidate?: boolean;
  },
): Promise<{ ok: boolean; count?: number; error?: string; warnings?: string[] }> {
  const { data: tournament, error: tourError } = await supabase
    .from("tournaments")
    .select("id, status, scoring_config, standings_config, playoff_config")
    .eq("id", tournamentId)
    .maybeSingle();
  if (tourError || !tournament) return { ok: false, error: "No encontramos el torneo." };

  const competition = await getCompetition(tournamentId);

  // Si el torneo tiene múltiples categorías y no se especificó una en particular,
  // aseguramos el cuadro de playoffs de cada categoría individualmente.
  if (!options?.categoryId && competition.categories.length > 0) {
    let totalMatches = 0;
    const allWarnings: string[] = [];
    for (const cat of competition.categories) {
      const catGroupMatches = competition.matches.filter((m) => m.categoryId === cat.id && m.stage === "group");
      const catAllDone = catGroupMatches.length > 0 && catGroupMatches.every((m) => m.resultStatus !== null);
      if (cat.status === "playoffs" || tournament.status === "playoffs" || catAllDone) {
        const res = await ensurePlayoffBracket(supabase, tournamentId, {
          categoryId: cat.id,
          qualifiersPerGroup: options?.qualifiersPerGroup ?? cat.playoffConfig?.qualifiersPerGroup,
          thirdPlace: options?.thirdPlace ?? cat.playoffConfig?.thirdPlace,
          revalidate: false,
        });
        if (res.ok) {
          totalMatches += res.count ?? 0;
          if (res.warnings) allWarnings.push(...res.warnings);
        }
      }
    }
    if (options?.revalidate !== false) {
      revalidatePath(`/torneos/${tournamentId}`, "layout");
      refreshPublicTournament(tournamentId);
    }
    return { ok: true, count: totalMatches, warnings: allWarnings };
  }

  let existQuery = supabase
    .from("matches")
    .select("id")
    .eq("tournament_id", tournamentId)
    .eq("stage", "playoff");

  if (options?.categoryId) {
    existQuery = (existQuery as any).eq("category_id", options.categoryId);
  }

  const { data: existing, error: existError } = await existQuery.limit(1);
  if (existError) return { ok: false, error: dbErrorMessage(existError) };
  if (existing && existing.length > 0 && !options?.qualifiersPerGroup) {
    return { ok: true, count: existing.length };
  }

  let categoryPlayoffConfig = tournament.playoff_config;
  let categoryScoringConfig = tournament.scoring_config;
  let categoryStandingsConfig = tournament.standings_config;

  let canBuildPlayoffs = tournament.status === "playoffs";
  let catStatus: string = tournament.status;
  if (options?.categoryId) {
    const { data: cat } = await (supabase as any)
      .from("tournament_categories")
      .select("id, status, scoring_config, standings_config, playoff_config")
      .eq("id", options.categoryId)
      .maybeSingle();
    if (cat) {
      catStatus = cat.status;
      if (cat.status === "playoffs" || tournament.status === "playoffs") {
        canBuildPlayoffs = true;
      }
      if (cat.playoff_config) categoryPlayoffConfig = cat.playoff_config;
      if (cat.scoring_config) categoryScoringConfig = cat.scoring_config;
      if (cat.standings_config) categoryStandingsConfig = cat.standings_config;
    }
  }

  const groups = options?.categoryId
    ? competition.groups.filter((g) => g.categoryId === options.categoryId)
    : competition.groups;
  const matches = options?.categoryId
    ? competition.matches.filter((m) => m.categoryId === options.categoryId)
    : competition.matches;

  const groupMatches = matches.filter((m) => m.stage === "group");
  const allGroupMatchesFinished =
    groupMatches.length > 0 && groupMatches.every((m) => m.resultStatus !== null);

  // Se permite generar playoffs si ya está en playoffs, si terminaron todos los partidos de grupo,
  // o si el organizador solicitó explícitamente armar el cuadro
  if (allGroupMatchesFinished || options?.qualifiersPerGroup !== undefined) {
    canBuildPlayoffs = true;
    if (options?.categoryId && catStatus !== "playoffs") {
      await (supabase as any)
        .from("tournament_categories")
        .update({ status: "playoffs" })
        .eq("id", options.categoryId);
    }
    if (!options?.categoryId && tournament.status === "group_stage") {
      await (supabase as any)
        .from("tournaments")
        .update({ status: "playoffs" })
        .eq("id", tournamentId);
    }
  }

  if (!canBuildPlayoffs) return { ok: false, error: "La fase de grupos todavía tiene partidos pendientes de resultado." };

  const scoring = normalizeScoringConfig(categoryScoringConfig);
  const standingsConfig = normalizeStandingsConfig(categoryStandingsConfig);
  const defaultPlayoffConfig = normalizePlayoffConfig(categoryPlayoffConfig);

  let qualifiersPerGroup = options?.qualifiersPerGroup ?? defaultPlayoffConfig.qualifiersPerGroup;
  // Si la categoría tiene un único grupo (zona única), deben clasificar al menos 2 parejas para poder jugar la final
  if (groups.length === 1 && qualifiersPerGroup < 2) {
    qualifiersPerGroup = 2;
  }
  const thirdPlace = options?.thirdPlace ?? defaultPlayoffConfig.thirdPlace;

  const standings = groupStandings(groups, matches, scoring, standingsConfig);
  const qualifiers = qualifiersFromStandings(standings, qualifiersPerGroup, scoring.type);

  if (qualifiers.length < 2) return { ok: false, error: "Tienen que clasificar al menos 2 equipos." };
  if (qualifiers.length > 64) return { ok: false, error: "El cuadro admite hasta 64 clasificados." };

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

  const { error: rpcError } = await (supabase.rpc as any)("apply_bracket", {
    p_tournament_id: tournamentId,
    p_matches: payload,
    p_category_id: options?.categoryId ?? null,
  });
  if (rpcError) return { ok: false, error: dbErrorMessage(rpcError) };

  // D-078: En playoffs los horarios y resultados los define el organizador directamente;
  // no se fuerza la auto-programación a franjas horarias arbitrarias.

  if (options?.revalidate !== false) {
    revalidatePath(`/torneos/${tournamentId}`, "layout");
    refreshPublicTournament(tournamentId);
  }
  return { ok: true, count: plan.matches.length, warnings: plan.warnings };
}

/**
 * Arma o rearma el cuadro con los clasificados de las tablas finales.
 */
export const generateBracket = createAction(generateBracketSchema, async (input, { supabase }) => {
  const result = await ensurePlayoffBracket(supabase, input.tournamentId, {
    categoryId: input.categoryId,
    qualifiersPerGroup: input.qualifiersPerGroup,
    thirdPlace: input.thirdPlace,
  });
  if (!result.ok) return actionError(result.error ?? "No pudimos generar el cuadro.");
  return actionOk({ warnings: result.warnings ?? [] }, "Generamos el cuadro.");
});
