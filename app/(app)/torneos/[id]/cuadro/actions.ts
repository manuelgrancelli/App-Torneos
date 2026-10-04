"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { groupStandings, qualifiersFromStandings } from "@/lib/competition-view";
import { getCompetition } from "@/lib/data/competition";
import { buildBracket } from "@/lib/domain/bracket";
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
 * Arma el cuadro con los clasificados de las tablas finales (lib/domain),
 * lo guarda con apply_bracket y programa la primera ronda (D-037).
 */
export const generateBracket = createAction(generateBracketSchema, async (input, { supabase }) => {
  const { data: tournament, error } = await supabase
    .from("tournaments")
    .select("id, status, scoring_config, standings_config")
    .eq("id", input.tournamentId)
    .maybeSingle();
  if (error) return actionError(dbErrorMessage(error));
  if (!tournament) return actionError("No encontramos el torneo.");
  if (tournament.status !== "playoffs") return actionError("El cuadro se arma con el torneo en playoffs.");

  const scoring = scoringConfigSchema.parse(tournament.scoring_config);
  const standingsConfig = standingsConfigSchema.parse(tournament.standings_config);
  const competition = await getCompetition(input.tournamentId);
  const standings = groupStandings(competition.groups, competition.matches, scoring, standingsConfig);
  const qualifiers = qualifiersFromStandings(standings, input.qualifiersPerGroup, scoring.type);
  if (qualifiers.length < 2) return actionError("Tienen que clasificar al menos 2 equipos.");
  if (qualifiers.length > 32) return actionError("El cuadro admite hasta 32 clasificados.");

  const plan = buildBracket(qualifiers, { thirdPlace: input.thirdPlace });
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
    p_tournament_id: input.tournamentId,
    p_matches: payload,
  });
  if (rpcError) return actionError(dbErrorMessage(rpcError));

  // Primera ronda (y partidos que ya tengan sus dos equipos por byes).
  const { data: ready } = await supabase
    .from("matches")
    .select("id, home_team_id, away_team_id")
    .eq("tournament_id", input.tournamentId)
    .eq("stage", "playoff")
    .eq("is_bye", false)
    .is("result_status", null);
  const readyIds = (ready ?? []).filter((m) => m.home_team_id && m.away_team_id).map((m) => m.id);
  const scheduled = readyIds.length
    ? await runAutoSchedule(supabase, input.tournamentId, "unscheduled", readyIds)
    : null;

  revalidatePath(`/torneos/${input.tournamentId}`, "layout");
  refreshPublicTournament(input.tournamentId);
  const assigned = scheduled?.ok ? scheduled.outcome.assigned : 0;
  const pending = readyIds.length - assigned;
  return actionOk(
    { warnings: plan.warnings },
    `Generamos el cuadro de ${plan.size}. ${
      pending === 0 ? "La primera ronda quedó programada." : `${pending} partidos quedaron sin horario.`
    }`,
  );
});
