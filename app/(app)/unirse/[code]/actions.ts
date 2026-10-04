"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { registerTeamSchema } from "@/lib/validation/registration";

/**
 * Inscribe un equipo con el código del torneo. La RPC valida estado, cupo,
 * tamaño del plantel y duplicados; quien inscribe queda como capitán (D-005).
 */
export const registerTeam = createAction(registerTeamSchema, async (input, { supabase }) => {
  const { data, error } = await supabase.rpc("register_team", {
    p_code: input.code,
    p_team_name: input.teamName,
    p_member_emails: input.memberEmails,
  });
  if (error) return actionError(dbErrorMessage(error));
  revalidatePath("/torneos");
  return actionOk({ teamId: data }, "¡Listo! Tu inscripción quedó pendiente de aprobación.");
});
