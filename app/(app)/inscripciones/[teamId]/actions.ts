"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { dbErrorMessage } from "@/lib/supabase/errors";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { respondResultSchema } from "@/lib/validation/competition";
import { availabilitySchema, teamIdSchema, updateRosterSchema } from "@/lib/validation/registration";

function revalidateTeam(teamId: string) {
  revalidatePath(`/inscripciones/${teamId}`);
  revalidatePath("/torneos");
}

/**
 * Torneo del equipo (antes de la RPC: la baja lo borra). Hace falta para
 * invalidar la página pública, que lista los equipos aprobados.
 */
async function teamTournamentId(supabase: SupabaseServerClient, teamId: string): Promise<string | null> {
  const { data } = await supabase.from("teams").select("tournament_id").eq("id", teamId).maybeSingle();
  return data?.tournament_id ?? null;
}

/** El capitán cambia nombre o integrantes; si cambia el plantel vuelve a "pendiente". */
export const updateRoster = createAction(updateRosterSchema, async (input, { supabase }) => {
  const tournamentId = await teamTournamentId(supabase, input.teamId);
  const { error } = await supabase.rpc("update_team_roster", {
    p_team_id: input.teamId,
    p_team_name: input.teamName,
    p_member_emails: input.memberEmails,
  });
  if (error) return actionError(dbErrorMessage(error));
  revalidateTeam(input.teamId);
  if (tournamentId) refreshPublicTournament(tournamentId);
  return actionOk(undefined, "Guardamos el equipo.");
});

/** El capitán da de baja la inscripción (se borra el equipo). */
export const withdrawTeam = createAction(teamIdSchema, async ({ teamId }, { supabase }) => {
  const tournamentId = await teamTournamentId(supabase, teamId);
  const { error } = await supabase.rpc("withdraw_team", { p_team_id: teamId });
  if (error) return actionError(dbErrorMessage(error));
  revalidatePath("/torneos");
  if (tournamentId) refreshPublicTournament(tournamentId);
  return actionOk(undefined, "Diste de baja la inscripción.");
});

/** Un integrante se sale del equipo (protección ante vínculos sin consentimiento, D-005). */
export const leaveTeam = createAction(teamIdSchema, async ({ teamId }, { supabase }) => {
  const tournamentId = await teamTournamentId(supabase, teamId);
  const { error } = await supabase.rpc("leave_team", { p_team_id: teamId });
  if (error) return actionError(dbErrorMessage(error));
  revalidatePath("/torneos");
  if (tournamentId) refreshPublicTournament(tournamentId);
  return actionOk(undefined, "Saliste del equipo.");
});

/** Reemplaza la disponibilidad del equipo por la selección actual. */
export const saveAvailability = createAction(availabilitySchema, async (input, { supabase }) => {
  const { data, error } = await supabase.rpc("set_team_availability", {
    p_team_id: input.teamId,
    p_slot_ids: input.slotIds,
  });
  if (error) return actionError(dbErrorMessage(error));
  revalidateTeam(input.teamId);
  return actionOk({ count: data }, data === 1 ? "Guardamos 1 franja." : `Guardamos ${data} franjas.`);
});

/** Un equipo confirma u objeta el resultado cargado por el organizador. */
export const respondResult = createAction(respondResultSchema, async (input, { supabase }) => {
  const { data, error } = await supabase.rpc("respond_result", {
    p_match_id: input.matchId,
    p_response: input.response,
    p_comment: input.comment,
  });
  if (error) return actionError(dbErrorMessage(error));
  revalidateTeam(input.teamId);
  return actionOk(
    { status: data },
    input.response === "confirmed" ? "Confirmaste el resultado." : "Le avisamos al organizador que el resultado está objetado.",
  );
});
