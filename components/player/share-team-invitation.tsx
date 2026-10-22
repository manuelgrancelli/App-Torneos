"use client";

import { Check, Copy, Link2, Mail, MessageCircle } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createTeamInvitationLink, sendTeamInvitation } from "@/app/(app)/inscripciones/[teamId]/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type Props = {
  teamId: string;
  memberId: string;
  /** Nombre o email del integrante pendiente, para el texto de ayuda. */
  memberLabel: string;
};

/**
 * Invitación de la pareja/compañero (D-122): además del email, el capitán
 * genera un link y lo comparte por WhatsApp o lo copia. El link se genera
 * en dos pasos (primero el link, después compartir) para que el navegador
 * no bloquee la ventana de WhatsApp por abrirse después de una espera.
 */
export function ShareTeamInvitation({ teamId, memberId, memberLabel }: Props) {
  const [link, setLink] = useState<{ url: string; teamName: string; tournamentName: string } | null>(null);
  const [copied, setCopied] = useState(false);
  const [isGenerating, startGenerating] = useTransition();
  const [isSending, startSending] = useTransition();

  function generate() {
    startGenerating(async () => {
      const result = await createTeamInvitationLink({ teamId, memberId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLink(result.data);
      toast.success("Link listo para compartir. Los links anteriores dejan de funcionar.");
    });
  }

  function sendEmail() {
    startSending(async () => {
      const result = await sendTeamInvitation({ teamId, memberId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      setLink(null);
      toast.success(result.message ?? "Enviamos la invitación.");
    });
  }

  async function copy() {
    if (!link) return;
    try {
      await navigator.clipboard.writeText(link.url);
      setCopied(true);
      toast.success("Link copiado.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("No pudimos copiar el link. Seleccionalo y copialo a mano.");
    }
  }

  const whatsappText = link
    ? `¡Hola! Te anoté como mi pareja en *${link.tournamentName}* (equipo "${link.teamName}"). ` +
      `Aceptá la invitación desde este link para completar la inscripción:\n\n${link.url}`
    : "";

  return (
    <div className="space-y-3 rounded-xl border border-dashed border-primary/30 bg-primary/5 p-3">
      <p className="text-xs text-muted-foreground">
        <span className="font-medium text-foreground">{memberLabel}</span> todavía no aceptó. Mandale la invitación:
        tiene que entrar con una cuenta de ese mismo email.
      </p>

      {link ? (
        <div className="space-y-2">
          <label className="sr-only" htmlFor={`invite-link-${memberId}`}>
            Link de invitación
          </label>
          <Input
            id={`invite-link-${memberId}`}
            readOnly
            value={link.url}
            onFocus={(e) => e.currentTarget.select()}
            className="h-10 md:h-8 font-mono text-xs"
          />
          <div className="flex flex-wrap gap-2">
            <Button asChild size="sm" className="bg-emerald-600 text-white hover:bg-emerald-700">
              <a href={`https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappText)}`} target="_blank" rel="noopener noreferrer">
                <MessageCircle aria-hidden="true" />
                Enviar por WhatsApp
              </a>
            </Button>
            <Button type="button" size="sm" variant="outline" onClick={copy}>
              {copied ? <Check aria-hidden="true" /> : <Copy aria-hidden="true" />}
              {copied ? "Copiado" : "Copiar link"}
            </Button>
          </div>
        </div>
      ) : null}

      <div className="flex flex-wrap gap-2">
        {!link ? (
          <Button type="button" size="sm" disabled={isGenerating} onClick={generate}>
            {isGenerating ? <Spinner /> : <Link2 aria-hidden="true" />}
            Invitar por WhatsApp o link
          </Button>
        ) : null}
        <Button type="button" size="sm" variant="outline" disabled={isSending} onClick={sendEmail}>
          {isSending ? <Spinner /> : <Mail aria-hidden="true" />}
          Enviar por email
        </Button>
      </div>
    </div>
  );
}
