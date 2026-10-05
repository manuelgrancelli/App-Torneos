"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { createAndSendTeamInvitation } from "@/lib/email/send-team-invitation";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { getRequestOrigin } from "@/lib/utils/origin";
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

  const { data: members, error: membersError } = await supabase
    .from("team_members")
    .select("id, role, user_id")
    .eq("team_id", data);
  if (membersError) {
    console.error("[registration] No se pudieron consultar los integrantes para invitar:", membersError.code);
    revalidatePath("/torneos");
    return actionOk({ teamId: data }, "La inscripción quedó pendiente. No pudimos preparar la invitación; revisá tu equipo para reenviarla.");
  }

  const pendingMembers = members.filter((member) => member.role === "player" && member.user_id === null);
  let invitationWarning = false;
  if (pendingMembers.length > 0) {
    const origin = await getRequestOrigin();
    for (const member of pendingMembers) {
      const result = await createAndSendTeamInvitation({
        supabase,
        teamId: data,
        memberId: member.id,
        origin,
      });
      if (!result.ok) {
        console.error("[registration] No se pudo enviar una invitación a un integrante.");
        invitationWarning = true;
      }
    }
  }

  revalidatePath("/torneos");
  return actionOk(
    { teamId: data },
    invitationWarning
      ? "La inscripción quedó pendiente. No pudimos enviar la invitación; podés reenviarla desde tu equipo."
      : "¡Listo! Tu inscripción quedó pendiente de aprobación.",
  );
});
