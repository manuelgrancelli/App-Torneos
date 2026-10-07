"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { groupStandings } from "@/lib/competition-view";
import { getCompetition } from "@/lib/data/competition";
import { scoringConfigSchema } from "@/lib/domain/scoring";
import { standingsConfigSchema } from "@/lib/domain/standings";
import { dbErrorMessage } from "@/lib/supabase/errors";
import {
  changeStatusSchema,
  tournamentIdSchema,
  updateTournamentSchema,
} from "@/lib/validation/tournament";
import { ensurePlayoffBracket } from "./cuadro/actions";

const NOT_FOUND = "No encontramos el torneo o no tenés permiso para modificarlo.";

function revalidateTournament(tournamentId: string) {
  revalidatePath(`/torneos/${tournamentId}`, "layout");
  revalidatePath("/torneos");
  refreshPublicTournament(tournamentId);
}

/**
 * Guarda la configuración. RLS limita la edición al organizador y los
 * triggers bloquean lo que el estado no permite (D-029); el error llega
 * traducido por dbErrorMessage.
 */
export const updateTournament = createAction(updateTournamentSchema, async (input, { supabase }) => {
  const { data, error } = await supabase
    .from("tournaments")
    .update({
      name: input.name,
      description: input.description || null,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      timezone: input.timezone,
      max_teams: input.maxTeams,
      results_require_confirmation: input.resultsRequireConfirmation,
      scoring_config: input.scoringConfig,
      standings_config: input.standingsConfig,
      playoff_config: input.playoffConfig,
    })
    .eq("id", input.tournamentId)
    .select("id");

  if (error) return actionError(dbErrorMessage(error));
  if (data.length === 0) return actionError(NOT_FOUND);
  revalidateTournament(input.tournamentId);
  return actionOk(undefined, "Guardamos los cambios.");
});

/** Borra el torneo (solo en borrador o inscripción: lo aplica la política de RLS). */
export const deleteTournament = createAction(tournamentIdSchema, async ({ tournamentId }, { supabase }) => {
  const { data, error } = await supabase.from("tournaments").delete().eq("id", tournamentId).select("id");
  if (error) return actionError(dbErrorMessage(error));
  if (data.length === 0) {
    return actionError("Solo se puede eliminar un torneo en borrador o con la inscripción abierta.");
  }
  revalidatePath("/torneos");
  return actionOk(undefined, "Eliminamos el torneo.");
});

/** Cambia el estado con la RPC, que valida la transición y sus precondiciones (D-018). */
export const changeTournamentStatus = createAction(changeStatusSchema, async (input, { supabase }) => {
  // Torneo sin playoffs: con un único grupo, el campeón es el primero de la tabla.
  let championTeamId: string | undefined;
  if (input.status === "finished") {
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("status, scoring_config, standings_config")
      .eq("id", input.tournamentId)
      .maybeSingle();
    if (tournament?.status === "group_stage") {
      const competition = await getCompetition(input.tournamentId);
      if (competition.groups.length === 1) {
        const [table] = groupStandings(
          competition.groups,
          competition.matches,
          scoringConfigSchema.parse(tournament.scoring_config),
          standingsConfigSchema.parse(tournament.standings_config),
        );
        championTeamId = table?.rows[0]?.teamId;
      }
    }
  }

  const { error } = await supabase.rpc("set_tournament_status", {
    p_tournament_id: input.tournamentId,
    p_status: input.status,
    p_champion_team_id: championTeamId,
  });
  if (error) return actionError(dbErrorMessage(error));

  if (input.status === "playoffs") {
    await ensurePlayoffBracket(supabase, input.tournamentId);
  }

  revalidateTournament(input.tournamentId);
  return actionOk(undefined, "Actualizamos el estado del torneo.");
});

/** Genera un código nuevo: el link anterior deja de funcionar. */
export const rotateInviteCode = createAction(tournamentIdSchema, async ({ tournamentId }, { supabase }) => {
  const { data, error } = await supabase.rpc("rotate_invite_code", { p_tournament_id: tournamentId });
  if (error) return actionError(dbErrorMessage(error));
  revalidateTournament(tournamentId);
  return actionOk({ code: data }, "Generamos un código nuevo. El link anterior ya no funciona.");
});
