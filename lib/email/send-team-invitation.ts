import "server-only";

import { createHash, randomBytes } from "node:crypto";
import { dbErrorMessage } from "@/lib/supabase/errors";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { buildTeamInvitationEmail } from "./team-invitation";
import { sendInvitationEmail } from "./resend";

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
      error: "Falta configurar RESEND_API_KEY y RESEND_FROM_EMAIL para enviar invitaciones.",
    };
  }

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
  const content = buildTeamInvitationEmail({
    teamName: invitation.team_name,
    tournamentName: invitation.tournament_name,
    acceptUrl: acceptUrl.toString(),
  });
  const result = await sendInvitationEmail({
    recipient: invitation.recipient_email,
    sender,
    subject: content.subject,
    html: content.html,
    text: content.text,
  });
  if (!result.ok) return result;

  return { ok: true, email: invitation.recipient_email };
}
