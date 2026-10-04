"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { reviewRegistrationSchema } from "@/lib/validation/registration";

/** Aprobar o rechazar una inscripción (la RPC controla cupo y plantel completo). */
export const reviewRegistration = createAction(reviewRegistrationSchema, async (input, { supabase }) => {
  const { error } = await supabase.rpc("review_registration", {
    p_team_id: input.teamId,
    p_decision: input.decision,
  });
  if (error) return actionError(dbErrorMessage(error));
  revalidatePath(`/torneos/${input.tournamentId}`, "layout");
  refreshPublicTournament(input.tournamentId);
  return actionOk(undefined, input.decision === "approved" ? "Inscripción aprobada." : "Inscripción rechazada.");
});
