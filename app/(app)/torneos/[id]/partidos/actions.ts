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
      "id, stage, round, position, group_id, is_third_place, category_id, home_team_id, away_team_id, next_match_id, loser_next_match_id, tournaments!matches_tournament_id_fkey(scoring_config)",
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
    let totalRounds: number | undefined =
      input.totalRounds && input.totalRounds > 0 ? input.totalRounds : undefined;
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

  let scheduledNext = 0;

  // Fase de grupos (formato 4 parejas): el ganador avanza a la final de grupo (pos 0)
  // y el perdedor al duelo por el 3° puesto (pos 1).
  if (match.stage === "group" && match.round === 1 && match.group_id && winnerTeamId) {
    const loserTeamId = match.home_team_id === winnerTeamId ? match.away_team_id : match.home_team_id;
    const { data: r2Matches } = await (supabase as any)
      .from("matches")
      .select("id, position, home_team_id, away_team_id")
      .eq("group_id", match.group_id)
      .eq("round", 2);

    if (r2Matches && r2Matches.length > 0) {
      const winMatch = r2Matches.find((m: any) => m.position === 0);
      const loseMatch = r2Matches.find((m: any) => m.position === 1);
      const slotField = match.position === 0 ? "home_team_id" : "away_team_id";

      if (winMatch) {
        await (supabase as any)
          .from("matches")
          .update({ [slotField]: winnerTeamId })
          .eq("id", winMatch.id);
      }
      if (loseMatch && loserTeamId) {
        await (supabase as any)
          .from("matches")
          .update({ [slotField]: loserTeamId })
          .eq("id", loseMatch.id);
      }

      // Si algún partido de R2 ya tiene sus 2 equipos y no tiene franja, intentar programarlo
      const checkIds = [winMatch?.id, loseMatch?.id].filter(Boolean);
      if (checkIds.length > 0) {
        const { data: readyR2 } = await (supabase as any)
          .from("matches")
          .select("id, home_team_id, away_team_id")
          .in("id", checkIds)
          .is("result_status", null)
          .is("slot_id", null);

        const readyIds = (readyR2 ?? [])
          .filter((m: any) => m.home_team_id && m.away_team_id)
          .map((m: any) => m.id);

        if (readyIds.length > 0) {
          const scheduled = await runAutoSchedule(supabase, input.tournamentId, "unscheduled", readyIds);
          if (scheduled.ok) scheduledNext += scheduled.outcome.assigned;
        }
      }
    }
  }

  // Playoffs: si el partido siguiente (o el del 3er puesto) ya tiene sus dos
  // equipos y no tiene horario, se intenta programarlo (D-039).
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
      if (scheduled.ok) scheduledNext += scheduled.outcome.assigned;
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

/** Borra un resultado (para corregirlo); en playoffs y grupos de 4 deshace el avance. */
export const clearResult = createAction(matchActionSchema, async ({ tournamentId, matchId }, { supabase }) => {
  const { data: match } = await (supabase as any)
    .from("matches")
    .select("id, stage, round, position, group_id")
    .eq("id", matchId)
    .maybeSingle();

  if (match?.stage === "group" && match?.round === 1 && match?.group_id) {
    const { data: r2Matches } = await (supabase as any)
      .from("matches")
      .select("id, result_status")
      .eq("group_id", match.group_id)
      .eq("round", 2)
      .not("result_status", "is", null);

    if (r2Matches && r2Matches.length > 0) {
      return actionError("El partido definitorio de la fecha 2 ya tiene resultado: borralo antes de corregir este.");
    }
  }

  const { error } = await supabase.rpc("clear_match_result", { p_match_id: matchId });
  if (error) return actionError(dbErrorMessage(error, NOT_FOUND));

  // Si fue un partido de fecha 1 de grupo, quitar los equipos que habían avanzado a fecha 2
  if (match?.stage === "group" && match?.round === 1 && match?.group_id) {
    const slotField = match.position === 0 ? "home_team_id" : "away_team_id";
    await (supabase as any)
      .from("matches")
      .update({ [slotField]: null })
      .eq("group_id", match.group_id)
      .eq("round", 2);
  }

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
      while (true) {
        const { data: matches, error: matchError } = await (supabase as any)
          .from("matches")
          .select("id, stage, round, position, group_id, home_team_id, away_team_id")
          .eq("tournament_id", tournamentId)
          .eq("stage", "group")
          .is("result_status", null);

        if (matchError) return actionError(dbErrorMessage(matchError));

        const pending = (matches ?? []).filter((m: any) => m.home_team_id && m.away_team_id);
        if (pending.length === 0) break;

        for (const match of pending) {
          const { result, winner } = generateSimulatedMatchResult(scoringConfig, { stage: "group" });
          const winnerTeamId = winner === "home" ? match.home_team_id : match.away_team_id;
          const loserTeamId = winner === "home" ? match.away_team_id : match.home_team_id;

          const { error } = await supabase.rpc("record_match_result", {
            p_match_id: match.id,
            p_result: result,
            p_winner_team_id: winnerTeamId as string,
            p_is_draw: false,
            p_is_walkover: false,
          });
          if (error) return actionError(dbErrorMessage(error));
          simulatedCount++;

          // Si es fecha 1 de grupo con partidos de ronda 2 creados, propagar a ronda 2
          if (match.round === 1 && match.group_id) {
            const slotField = match.position === 0 ? "home_team_id" : "away_team_id";
            await (supabase as any)
              .from("matches")
              .update({ [slotField]: winnerTeamId })
              .eq("group_id", match.group_id)
              .eq("round", 2)
              .eq("position", 0);
            await (supabase as any)
              .from("matches")
              .update({ [slotField]: loserTeamId })
              .eq("group_id", match.group_id)
              .eq("round", 2)
              .eq("position", 1);
          }
        }
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

