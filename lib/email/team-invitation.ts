import { APP_NAME } from "@/lib/config";

type TeamInvitationContent = {
  teamName: string;
  tournamentName: string;
  acceptUrl: string;
};

function escapeHtml(value: string): string {
  return value
    .replaceAll("&", "&amp;")
    .replaceAll("<", "&lt;")
    .replaceAll(">", "&gt;")
    .replaceAll('"', "&quot;")
    .replaceAll("'", "&#39;");
}

export function buildTeamInvitationEmail({ teamName, tournamentName, acceptUrl }: TeamInvitationContent) {
  const safeTeamName = escapeHtml(teamName);
  const safeTournamentName = escapeHtml(tournamentName);
  const safeAcceptUrl = escapeHtml(acceptUrl);
  const subject = `Te invitaron a jugar en ${tournamentName}`;

  return {
    subject,
    text: `Te invitaron a formar parte de ${teamName} en el torneo ${tournamentName}. Para confirmar tu participación, abrí este link: ${acceptUrl}\n\nEl link vence en 7 días. Si no esperabas esta invitación, podés ignorar este correo.`,
    html: `<main style="font-family:Arial,sans-serif;line-height:1.6;color:#18181b"><h1 style="font-size:22px">${APP_NAME}</h1><p>Te invitaron a formar parte de <strong>${safeTeamName}</strong> en el torneo <strong>${safeTournamentName}</strong>.</p><p>Para confirmar tu participación, ingresá con la cuenta del email que recibió esta invitación y aceptala:</p><p><a href="${safeAcceptUrl}" style="display:inline-block;padding:12px 18px;background:#18181b;color:#fff;text-decoration:none;border-radius:8px">Aceptar invitación</a></p><p>El link vence en 7 días. Si no esperabas esta invitación, podés ignorar este correo.</p></main>`,
  };
}
