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
  const { data, error } = await (supabase.rpc as any)("register_team", {
    p_code: input.code,
    p_team_name: input.teamName,
    p_member_emails: input.memberEmails,
    p_category_id: input.categoryId ?? null,
    p_logo_url: input.logoUrl ?? null,
  });
  if (error) return actionError(dbErrorMessage(error));

  // Inicializar disponibilidad completa para la pareja si el torneo ya tiene franjas cargadas
  let registeredTournamentId: string | null = null;
  try {
    const { data: teamRow } = await supabase
      .from("teams")
      .select("id, tournament_id")
      .eq("id", data)
      .maybeSingle();

    if (teamRow?.tournament_id) {
      registeredTournamentId = teamRow.tournament_id;
      const { data: slots } = await supabase
        .from("time_slots")
        .select("id")
        .eq("tournament_id", teamRow.tournament_id);

      if (slots && slots.length > 0) {
        await (supabase.rpc as any)("set_team_availability", {
          p_team_id: data,
          p_slot_ids: slots.map((s) => s.id),
        });
      }
    }
  } catch (availErr) {
    console.error("[registerTeam] Error al inicializar disponibilidad:", availErr);
  }

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

  const { data: teamData } = await supabase
    .from("teams")
    .select("status")
    .eq("id", data)
    .maybeSingle();

  const isApproved = teamData?.status === "approved";

  revalidatePath("/torneos");
  revalidatePath(`/inscripciones/${data}`);
  if (registeredTournamentId) {
    revalidatePath(`/torneos/${registeredTournamentId}/grupos`);
    revalidatePath(`/torneos/${registeredTournamentId}/inscripciones`);
    revalidatePath(`/torneos/${registeredTournamentId}/partidos`);
  }
  return actionOk(
    { teamId: data },
    isApproved
      ? "¡Listo! La pareja quedó inscripta y aprobada en el torneo."
      : invitationWarning
        ? "La inscripción quedó pendiente. No pudimos enviar la invitación; podés reenviarla desde tu equipo."
        : "¡Listo! Tu inscripción quedó pendiente de aprobación.",
  );
});
