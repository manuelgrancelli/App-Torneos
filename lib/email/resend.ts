import "server-only";

type InvitationEmail = {
  recipient: string;
  sender: string;
  subject: string;
  html: string;
  text: string;
};

export async function sendInvitationEmail(email: InvitationEmail): Promise<{ ok: true } | { ok: false; error: string }> {
  const apiKey = process.env.RESEND_API_KEY?.trim();
  const sender = email.sender.trim();

  if (!apiKey || !sender) {
    return {
      ok: false,
      error: "El envío de invitaciones no está configurado. Falta la clave o el remitente de Resend.",
    };
  }
  if (/[\r\n]/.test(sender)) {
    return { ok: false, error: "La dirección remitente configurada para Resend no es válida." };
  }

  let response: Response;
  try {
    response = await fetch("https://api.resend.com/emails", {
      method: "POST",
      headers: {
        Authorization: `Bearer ${apiKey}`,
        "Content-Type": "application/json",
      },
      body: JSON.stringify({
        from: sender,
        to: [email.recipient],
        subject: email.subject,
        html: email.html,
        text: email.text,
      }),
      signal: AbortSignal.timeout(10_000),
    });
  } catch (error) {
    console.error("[resend] No se pudo conectar con el servicio:", error instanceof Error ? error.name : "desconocido");
    return { ok: false, error: "No pudimos conectar con el servicio de correo. Esperá un minuto y probá de nuevo." };
  }

  if (!response.ok) {
    console.error("[resend] El servicio rechazó la invitación:", response.status);
    return {
      ok: false,
      error: "Resend no aceptó el correo. Revisá la clave y el remitente verificado en la configuración.",
    };
  }

  return { ok: true };
}
