import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { dbErrorMessage } from "@/lib/supabase/errors";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { buildTeamInvitationEmail } from "./team-invitation";
import { sendInvitationEmail } from "./resend";

type PreparedInvitation = {
  acceptUrl: string;
  recipientEmail: string;
  teamName: string;
  tournamentName: string;
};

/**
 * Crea (o renueva) la invitación de un integrante pendiente y devuelve el link
 * de aceptación. El token solo vive en el link: la base guarda su SHA-256, y
 * renovar invalida el anterior (D-044). La RPC valida que quien llama sea el
 * capitán y limita a una renovación por minuto.
 */
export async function prepareTeamInvitation({
  supabase,
  teamId,
  memberId,
  origin,
}: {
  supabase: SupabaseServerClient;
  teamId: string;
  memberId: string;
  origin: string;
}): Promise<({ ok: true } & PreparedInvitation) | { ok: false; error: string }> {
  const token = randomBytes(32).toString("base64url");
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const { data, error } = await supabase.rpc("create_team_invitation", {
    p_team_id: teamId,
    p_team_member_id: memberId,
    p_token_hash: tokenHash,
  });
  if (error) return { ok: false, error: dbErrorMessage(error, "No pudimos preparar la invitación.") };

  const invitation = data[0];
  if (!invitation) return { ok: false, error: "No pudimos preparar la invitación. Probá de nuevo." };

  const acceptUrl = new URL("/invitacion/aceptar", origin);
  acceptUrl.searchParams.set("token", token);
  return {
    ok: true,
    acceptUrl: acceptUrl.toString(),
    recipientEmail: invitation.recipient_email,
    teamName: invitation.team_name,
    tournamentName: invitation.tournament_name,
  };
}

export async function createAndSendTeamInvitation({
  supabase,
  teamId,
  memberId,
  origin,
}: {
  supabase: SupabaseServerClient;
  teamId: string;
  memberId: string;
  origin: string;
}): Promise<{ ok: true; email: string } | { ok: false; error: string }> {
  const sender = process.env.RESEND_FROM_EMAIL?.trim();
  if (!process.env.RESEND_API_KEY?.trim() || !sender) {
    return {
      ok: false,
      error: "Falta configurar el envío de emails. Compartí la invitación por WhatsApp o copiando el link.",
    };
  }

  const prepared = await prepareTeamInvitation({ supabase, teamId, memberId, origin });
  if (!prepared.ok) return prepared;

  const content = buildTeamInvitationEmail({
    teamName: prepared.teamName,
    tournamentName: prepared.tournamentName,
    acceptUrl: prepared.acceptUrl,
  });
  const result = await sendInvitationEmail({
    recipient: prepared.recipientEmail,
    sender,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
  if (!result.ok) return result;

  return { ok: true, email: prepared.recipientEmail };
}
