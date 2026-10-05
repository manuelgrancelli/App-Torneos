import { describe, expect, it } from "vitest";
import { buildTeamInvitationEmail } from "./team-invitation";

describe("buildTeamInvitationEmail", () => {
  it("escapa contenido variable en el asunto/cuerpo HTML y preserva el link", () => {
    const email = buildTeamInvitationEmail({
      teamName: '<Pareja "A&B">',
      tournamentName: "Copa <Sur>",
      acceptUrl: "https://torneos.example/invitacion/aceptar?token=abc_123",
    });

    expect(email.subject).toBe("Te invitaron a jugar en Copa <Sur>");
    expect(email.html).toContain("&lt;Pareja &quot;A&amp;B&quot;&gt;");
    expect(email.html).toContain("Copa &lt;Sur&gt;");
    expect(email.html).toContain(
      'href="https://torneos.example/invitacion/aceptar?token=abc_123"',
    );
    expect(email.text).toContain("token=abc_123");
  });
});
