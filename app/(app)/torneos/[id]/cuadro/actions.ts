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
    force?: boolean;
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
      const res = await ensurePlayoffBracket(supabase, tournamentId, {
        categoryId: cat.id,
        qualifiersPerGroup: options?.qualifiersPerGroup,
        thirdPlace: options?.thirdPlace,
        force: options?.force,
        revalidate: false,
      });
      if (res.ok) {
        totalMatches += res.count ?? 0;
        if (res.warnings) allWarnings.push(...res.warnings);
      }
    }
    if (options?.revalidate !== false) {
      revalidatePath(`/torneos/${tournamentId}`, "layout");
      refreshPublicTournament(tournamentId);
    }
    return { ok: true, count: totalMatches, warnings: allWarnings };
  }

  const groups = options?.categoryId
    ? competition.groups.filter((g) => g.categoryId === options.categoryId)
    : competition.groups;
  if (groups.length === 0) {
    return { ok: true, count: 0 };
  }

  let existQuery = supabase
    .from("matches")
    .select("id, round, position, is_third_place, home_team_id, away_team_id, starts_at, ends_at, court_id, slot_id")
    .eq("tournament_id", tournamentId)
    .eq("stage", "playoff");

  if (options?.categoryId) {
    existQuery = (existQuery as any).eq("category_id", options.categoryId);
  }

  const { data: existing, error: existError } = await existQuery;
  if (existError) return { ok: false, error: dbErrorMessage(existError) };

  let categoryPlayoffConfig = tournament.playoff_config;
  let categoryScoringConfig = tournament.scoring_config;
  let categoryStandingsConfig = tournament.standings_config;
  let catStatus: string = tournament.status;

  if (options?.categoryId) {
    const { data: cat } = await (supabase as any)
      .from("tournament_categories")
      .select("id, status, scoring_config, standings_config, playoff_config")
      .eq("id", options.categoryId)
      .maybeSingle();
    if (cat) {
      catStatus = cat.status;
      if (cat.playoff_config) categoryPlayoffConfig = cat.playoff_config;
      if (cat.scoring_config) categoryScoringConfig = cat.scoring_config;
      if (cat.standings_config) categoryStandingsConfig = cat.standings_config;
    }
  }

  const matches = options?.categoryId
    ? competition.matches.filter((m) => m.categoryId === options.categoryId)
    : competition.matches;

  const groupMatches = matches.filter((m) => m.stage === "group");
  const allGroupMatchesFinished =
    groupMatches.length > 0 && groupMatches.every((m) => m.resultStatus !== null);

  const scoring = normalizeScoringConfig(categoryScoringConfig);
  const standingsConfig = normalizeStandingsConfig(categoryStandingsConfig);
  const defaultPlayoffConfig = normalizePlayoffConfig(categoryPlayoffConfig);

  let qualifiersPerGroup = options?.qualifiersPerGroup ?? defaultPlayoffConfig.qualifiersPerGroup;
  if (groups.length === 1 && qualifiersPerGroup < 2) {
    qualifiersPerGroup = 2;
  }
  const thirdPlace = options?.thirdPlace ?? defaultPlayoffConfig.thirdPlace;

  const standings = groupStandings(groups, matches, scoring, standingsConfig);
  const qualifiers = qualifiersFromStandings(standings, qualifiersPerGroup, scoring.type);

  if (qualifiers.length < 2 || qualifiers.length > 64) {
    return { ok: true, count: 0 };
  }

  const plan = buildBracket(qualifiers, { thirdPlace });

  // Detectar si la base de datos contiene cruces duplicados (por inserciones fallidas o regeneraciones previas)
  const hasDuplicates = Boolean(
    existing &&
      (existing.length > plan.matches.length ||
        new Set(existing.map((e) => `${e.round}-${e.position}-${Boolean(e.is_third_place)}`)).size < existing.length),
  );

  const shouldRebuild = Boolean(options?.force || hasDuplicates);

  // Si los partidos ya existen, no hay duplicados corruptos y no se fuerza rearmar:
  if (existing && existing.length > 0 && !shouldRebuild) {
    // Si concluyó la fase de grupos, actualizamos las parejas clasificadas en los cruces
    // preservando los horarios y canchas ya programados por el organizador (D-168).
    if (allGroupMatchesFinished) {
      for (const m of plan.matches) {
        const existingMatch = existing.find(
          (em) => em.round === m.round && em.position === m.position && em.is_third_place === m.isThirdPlace,
        );
        if (existingMatch) {
          const homeId = m.home && m.home.length === 36 ? m.home : null;
          const awayId = m.away && m.away.length === 36 ? m.away : null;
          const winnerId =
            m.isBye && m.winnerTeamId && m.winnerTeamId.length === 36 ? m.winnerTeamId : null;
          await supabase
            .from("matches")
            .update({
              home_team_id: homeId,
              away_team_id: awayId,
              is_bye: m.isBye,
              winner_team_id: winnerId,
              result_status: m.isBye ? "confirmed" : null,
            })
            .eq("id", existingMatch.id);
        }
      }

      if (options?.categoryId && catStatus !== "playoffs") {
        await (supabase as any)
          .from("tournament_categories")
          .update({ status: "playoffs", updated_at: new Date().toISOString() })
          .eq("id", options.categoryId);
      }
      if (!options?.categoryId && tournament.status === "group_stage") {
        await (supabase as any)
          .from("tournaments")
          .update({ status: "playoffs", updated_at: new Date().toISOString() })
          .eq("id", tournamentId);
      }
    }

    return { ok: true, count: existing.length, warnings: plan.warnings };
  }

  // Si se debe rearmar (forzado o por duplicados detectados) y existen partidos anteriores:
  if (shouldRebuild && existing && existing.length > 0) {
    // Paso 0: Desvincular llaves auto-referenciales (next_match_id y loser_next_match_id)
    // para no violar el check constraint `((next_match_id is null) = (next_match_side is null))` (D-172)
    let unlinkQuery = supabase
      .from("matches")
      .update({
        next_match_id: null,
        next_match_side: null,
        loser_next_match_id: null,
        loser_next_match_side: null,
      })
      .eq("tournament_id", tournamentId)
      .eq("stage", "playoff");

    if (options?.categoryId) {
      unlinkQuery = (unlinkQuery as any).eq("category_id", options.categoryId);
    }
    const { error: unlinkError } = await unlinkQuery;
    if (unlinkError) {
      console.error("Error unlinking playoff matches:", unlinkError);
    }

    // Paso 0.1: Eliminar partidos de playoff anteriores
    let delQuery = supabase
      .from("matches")
      .delete()
      .eq("tournament_id", tournamentId)
      .eq("stage", "playoff");

    if (options?.categoryId) {
      delQuery = (delQuery as any).eq("category_id", options.categoryId);
    }
    const { error: delError } = await delQuery;
    if (delError) {
      return { ok: false, error: dbErrorMessage(delError) };
    }
  }

  const keyToId = new Map<string, string>();
  for (const m of plan.matches) {
    keyToId.set(m.key, crypto.randomUUID());
  }

  // Paso 1: Insertar partidos del cuadro
  const rowsToInsert = plan.matches.map((m) => {
    const id = keyToId.get(m.key)!;
    const homeId = allGroupMatchesFinished && m.home && m.home.length === 36 ? m.home : null;
    const awayId = allGroupMatchesFinished && m.away && m.away.length === 36 ? m.away : null;
    const winnerId =
      allGroupMatchesFinished && m.isBye && m.winnerTeamId && m.winnerTeamId.length === 36
        ? m.winnerTeamId
        : null;

    return {
      id,
      tournament_id: tournamentId,
      category_id: options?.categoryId ?? null,
      stage: "playoff" as const,
      round: m.round,
      position: m.position,
      is_bye: m.isBye,
      is_third_place: m.isThirdPlace,
      home_team_id: homeId,
      away_team_id: awayId,
      winner_team_id: winnerId,
      result_status: m.isBye && allGroupMatchesFinished ? ("confirmed" as const) : null,
    };
  });

  const { error: insertError } = await supabase.from("matches").insert(rowsToInsert);
  if (insertError) return { ok: false, error: dbErrorMessage(insertError) };

  // Paso 2: Vincular llaves next_match_id y loser_next_match_id
  for (const m of plan.matches) {
    const id = keyToId.get(m.key)!;
    const nextId = m.next ? keyToId.get(m.next.key) ?? null : null;
    const loserNextId = m.loserNext ? keyToId.get(m.loserNext.key) ?? null : null;

    if (nextId || loserNextId) {
      await supabase
        .from("matches")
        .update({
          next_match_id: nextId,
          next_match_side: m.next?.side ?? null,
          loser_next_match_id: loserNextId,
          loser_next_match_side: m.loserNext?.side ?? null,
        })
        .eq("id", id);
    }
  }

  // Paso 3: Actualizar estado solo si todos los grupos concluyeron
  if (allGroupMatchesFinished) {
    if (options?.categoryId && catStatus !== "playoffs") {
      await (supabase as any)
        .from("tournament_categories")
        .update({ status: "playoffs", updated_at: new Date().toISOString() })
        .eq("id", options.categoryId);
    }
    if (!options?.categoryId && tournament.status === "group_stage") {
      await (supabase as any)
        .from("tournaments")
        .update({ status: "playoffs", updated_at: new Date().toISOString() })
        .eq("id", tournamentId);
    }
  }

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
    force: true,
  });
  if (!result.ok) return actionError(result.error ?? "No pudimos generar el cuadro.");
  return actionOk({ warnings: result.warnings ?? [] }, "Generamos el cuadro.");
});
