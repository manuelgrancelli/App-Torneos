"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { z } from "zod";
import {
  type MatchResult,
  type ScoringConfig,
  evaluateResult,
  generateSimulatedMatchResult,
  scoringConfigSchema,
  walkoverResult,
} from "@/lib/domain/scoring";
import { runAutoSchedule } from "@/lib/scheduling";
import { dbErrorMessage } from "@/lib/supabase/errors";
import {
  assignSlotSchema,
  autoScheduleSchema,
  matchActionSchema,
  recordResultSchema,
} from "@/lib/validation/competition";

const NOT_FOUND = "No encontramos el partido o no tenés permiso para modificarlo.";

function revalidate(tournamentId: string) {
  revalidatePath(`/torneos/${tournamentId}`, "layout");
  refreshPublicTournament(tournamentId);
}

/** Programación automática de los partidos (scheduler de lib/domain). */
export const autoSchedule = createAction(autoScheduleSchema, async ({ tournamentId, mode }, { supabase }) => {
  const result = await runAutoSchedule(supabase, tournamentId, mode);
  if (!result.ok) return actionError(dbErrorMessage(result.error));
  revalidate(tournamentId);

  const { assigned, unscheduled } = result.outcome;
  const message =
    unscheduled.length === 0
      ? `Programamos ${assigned} ${assigned === 1 ? "partido" : "partidos"}.`
      : `Programamos ${assigned}; ${unscheduled.length} ${unscheduled.length === 1 ? "quedó" : "quedaron"} sin horario.`;
  return actionOk(result.outcome, message);
});

/** Asignación manual de franja y cancha (queda fijada). Con slotId null, desasigna. */
export const assignSlot = createAction(assignSlotSchema, async (input, { supabase }) => {
  const { error } = await supabase.rpc("assign_match_slot", {
    p_match_id: input.matchId,
    p_slot_id: input.slotId as string,
    p_court_id: input.courtId as string,
  });
  if (error) return actionError(dbErrorMessage(error, NOT_FOUND));
  revalidate(input.tournamentId);
  return actionOk(undefined, input.slotId ? "Guardamos el horario." : "Quitamos el horario.");
});

/**
 * Carga un resultado: se valida con la configuración del torneo
 * (evaluateResult) y la RPC lo guarda y, en playoffs, hace avanzar al ganador.
 */
export const recordResult = createAction(recordResultSchema, async (input, { supabase }) => {
  const { data: match, error: matchError } = await (supabase as any)
    .from("matches")
    .select(
      "id, stage, round, is_third_place, category_id, home_team_id, away_team_id, next_match_id, loser_next_match_id, tournaments!matches_tournament_id_fkey(scoring_config)",
    )
    .eq("id", input.matchId)
    .eq("tournament_id", input.tournamentId)
    .maybeSingle();
  if (matchError) return actionError(dbErrorMessage(matchError));
  if (!match || !match.tournaments || !match.home_team_id || !match.away_team_id) return actionError(NOT_FOUND);

  let config: ScoringConfig;
  const categoryId = (match.category_id as string | null) ?? null;
  if (categoryId) {
    const { data: categoryData } = await (supabase as any)
      .from("tournament_categories")
      .select("scoring_config")
      .eq("id", categoryId)
      .maybeSingle();

    const parsedCatConfig = categoryData?.scoring_config
      ? scoringConfigSchema.safeParse(categoryData.scoring_config)
      : null;

    if (parsedCatConfig?.success) {
      config = parsedCatConfig.data;
    } else {
      const parsedConfig = scoringConfigSchema.safeParse(match.tournaments.scoring_config);
      if (!parsedConfig.success) return actionError("La configuración de puntuación del torneo no es válida.");
      config = parsedConfig.data;
    }
  } else {
    const parsedConfig = scoringConfigSchema.safeParse(match.tournaments.scoring_config);
    if (!parsedConfig.success) return actionError("La configuración de puntuación del torneo no es válida.");
    config = parsedConfig.data;
  }

  let result: MatchResult;
  let winnerSide: "home" | "away" | null;
  if (input.kind === "walkover") {
    result = walkoverResult(config, input.winner);
    winnerSide = input.winner;
  } else {
    let totalRounds: number | undefined = input.totalRounds;
    if (totalRounds === undefined && match.stage === "playoff") {
      let query = (supabase as any)
        .from("matches")
        .select("round")
        .eq("tournament_id", input.tournamentId)
        .eq("stage", "playoff");

      if (categoryId) {
        query = query.eq("category_id", categoryId);
      } else {
        query = query.is("category_id", null);
      }

      const { data: maxRoundMatch } = await query
        .order("round", { ascending: false })
        .limit(1)
        .maybeSingle();
      totalRounds = maxRoundMatch?.round ?? match.round;
    }
    const matchContext = {
      stage: match.stage,
      round: match.round,
      totalRounds,
      isThirdPlace: Boolean(match.is_third_place),
    };
    const evaluation = evaluateResult(config, input.result, matchContext);
    if (!evaluation.ok) return actionError(evaluation.errors.join(" "));
    result = input.result;
    winnerSide = evaluation.winner;
  }

  const winnerTeamId = winnerSide === "home" ? match.home_team_id : winnerSide === "away" ? match.away_team_id : null;
  const { error } = await supabase.rpc("record_match_result", {
    p_match_id: input.matchId,
    p_result: result,
    p_winner_team_id: winnerTeamId as string,
    p_is_draw: winnerSide === null,
    p_is_walkover: input.kind === "walkover",
  });
  if (error) return actionError(dbErrorMessage(error, NOT_FOUND));

  // Playoffs: si el partido siguiente (o el del 3er puesto) ya tiene sus dos
  // equipos y no tiene horario, se intenta programarlo (D-039).
  let scheduledNext = 0;
  const targets = [match.next_match_id, match.loser_next_match_id].filter((id): id is string => Boolean(id));
  if (targets.length > 0) {
    const { data: next } = await supabase
      .from("matches")
      .select("id, home_team_id, away_team_id")
      .in("id", targets)
      .is("result_status", null)
      .is("slot_id", null);
    const ready = (next ?? []).filter((m) => m.home_team_id && m.away_team_id).map((m) => m.id);
    if (ready.length > 0) {
      const scheduled = await runAutoSchedule(supabase, input.tournamentId, "unscheduled", ready);
      if (scheduled.ok) scheduledNext = scheduled.outcome.assigned;
    }
  }

  revalidate(input.tournamentId);
  return actionOk(
    { scheduledNext },
    scheduledNext > 0
      ? `Guardamos el resultado y programamos ${scheduledNext === 1 ? "el partido siguiente" : `${scheduledNext} partidos siguientes`}.`
      : "Guardamos el resultado.",
  );
});

/** Borra un resultado (para corregirlo); en playoffs deshace el avance. */
export const clearResult = createAction(matchActionSchema, async ({ tournamentId, matchId }, { supabase }) => {
  const { error } = await supabase.rpc("clear_match_result", { p_match_id: matchId });
  if (error) return actionError(dbErrorMessage(error, NOT_FOUND));
  revalidate(tournamentId);
  return actionOk(undefined, "Borramos el resultado.");
});

/** El organizador da por bueno un resultado provisional u objetado. */
export const confirmResult = createAction(matchActionSchema, async ({ tournamentId, matchId }, { supabase }) => {
  const { error } = await supabase.rpc("confirm_match_result", { p_match_id: matchId });
  if (error) return actionError(dbErrorMessage(error, NOT_FOUND));
  revalidate(tournamentId);
  return actionOk(undefined, "Resultado confirmado.");
});

/**
 * Simula resultados automáticos válidos para todos los partidos pendientes.
 * Disponible exclusivamente para torneos privados de prueba (is_test: true).
 */
export const simulateTournamentResults = createAction(
  z.object({ tournamentId: z.uuid() }),
  async ({ tournamentId }, { supabase, userId }) => {
    const { data: tournament, error: tourError } = await supabase
      .from("tournaments")
      .select("id, status, is_test, scoring_config")
      .eq("id", tournamentId)
      .eq("organizer_id", userId)
      .maybeSingle();

    if (tourError) return actionError(dbErrorMessage(tourError));
    if (!tournament) return actionError("No encontramos el torneo.");
    if (!tournament.is_test) {
      return actionError("La simulación de resultados solo está disponible en torneos privados de prueba.");
    }
    if (tournament.status !== "group_stage" && tournament.status !== "playoffs") {
      return actionError("Solo se pueden simular resultados en fase de grupos o playoffs.");
    }

    const parsedConfig = scoringConfigSchema.safeParse(tournament.scoring_config);
    if (!parsedConfig.success) return actionError("Configuración de puntuación inválida.");
    const scoringConfig = parsedConfig.data;

    let simulatedCount = 0;

    if (tournament.status === "group_stage") {
      const { data: matches, error: matchError } = await supabase
        .from("matches")
        .select("id, stage, round, home_team_id, away_team_id")
        .eq("tournament_id", tournamentId)
        .eq("stage", "group")
        .is("result_status", null);

      if (matchError) return actionError(dbErrorMessage(matchError));

      const pending = (matches ?? []).filter((m) => m.home_team_id && m.away_team_id);
      for (const match of pending) {
        const { result, winner } = generateSimulatedMatchResult(scoringConfig, { stage: "group" });
        const winnerTeamId = winner === "home" ? match.home_team_id : match.away_team_id;

        const { error } = await supabase.rpc("record_match_result", {
          p_match_id: match.id,
          p_result: result,
          p_winner_team_id: winnerTeamId as string,
          p_is_draw: false,
          p_is_walkover: false,
        });
        if (error) return actionError(dbErrorMessage(error));
        simulatedCount++;
      }

      revalidate(tournamentId);
      return actionOk(
        { count: simulatedCount },
        `Simulamos los resultados de ${simulatedCount} ${simulatedCount === 1 ? "partido" : "partidos"} de la fase de grupos.`,
      );
    }

    if (tournament.status === "playoffs") {
      const { data: allPlayoffMatches } = await (supabase as any)
        .from("matches")
        .select("category_id, round")
        .eq("tournament_id", tournamentId)
        .eq("stage", "playoff");

      const categoryRoundsMap = new Map<string | null, number>();
      for (const m of allPlayoffMatches ?? []) {
        const catKey = (m.category_id as string | null) ?? null;
        const current = categoryRoundsMap.get(catKey) ?? 0;
        if (m.round > current) categoryRoundsMap.set(catKey, m.round);
      }

      for (let iteration = 0; iteration < 10; iteration++) {
        const { data: matches, error: matchError } = await (supabase as any)
          .from("matches")
          .select("id, stage, round, is_third_place, is_bye, home_team_id, away_team_id, category_id")
          .eq("tournament_id", tournamentId)
          .eq("stage", "playoff")
          .is("result_status", null);

        if (matchError) return actionError(dbErrorMessage(matchError));

        const playable = (matches ?? []).filter(
          (m: any) => !m.is_bye && m.home_team_id && m.away_team_id,
        );

        if (playable.length === 0) break;

        for (const match of playable) {
          const catKey = (match.category_id as string | null) ?? null;
          const matchTotalRounds = categoryRoundsMap.get(catKey) ?? match.round;
          const matchContext = {
            stage: "playoff" as const,
            round: match.round,
            totalRounds: matchTotalRounds,
            isThirdPlace: Boolean(match.is_third_place),
          };
          const { result, winner } = generateSimulatedMatchResult(scoringConfig, matchContext);
          const winnerTeamId = winner === "home" ? match.home_team_id : match.away_team_id;

          const { error } = await supabase.rpc("record_match_result", {
            p_match_id: match.id,
            p_result: result,
            p_winner_team_id: winnerTeamId as string,
            p_is_draw: false,
            p_is_walkover: false,
          });
          if (error) return actionError(dbErrorMessage(error));
          simulatedCount++;
        }
      }

      revalidate(tournamentId);
      return actionOk(
        { count: simulatedCount },
        `Simulamos los resultados de los playoffs (${simulatedCount} ${simulatedCount === 1 ? "partido" : "partidos"}).`,
      );
    }

    return actionOk({ count: 0 }, "No había partidos pendientes para simular.");
  },
);

