"use client";

import { Check, Copy, Link2, MessageCircle, Sparkles } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";

type TeamInviteCardProps = {
  inviteCode: string;
  teamName: string;
  tournamentName: string;
};

export function TeamInviteCard({ inviteCode, teamName, tournamentName }: TeamInviteCardProps) {
  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
    }
  }, []);

  const inviteUrl = origin ? `${origin}/unirse-equipo/${inviteCode}` : `/unirse-equipo/${inviteCode}`;

  const whatsappMessage =
    `¡Hola! Sumate a nuestro equipo *${teamName}* para el torneo *${tournamentName}* usando este link:\n\n${inviteUrl}`;

  async function copyToClipboard() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Enlace de invitación copiado al portapapeles.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("No pudimos copiar automáticamente. Por favor seleccioná el texto y copialo.");
    }
  }

  return (
    <div className="space-y-2.5 rounded-xl border-2 border-emerald-500/30 bg-emerald-500/[0.04] p-3 sm:p-3.5 shadow-2xs">
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-2">
          <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Link2 className="size-4" aria-hidden="true" />
          </div>
          <div>
            <h3 className="text-xs font-bold text-foreground flex items-center gap-1.5">
              <span>Invitá a tus compañeros con link</span>
              <Sparkles className="size-3 text-amber-500 fill-amber-500" aria-hidden="true" />
            </h3>
            <p className="text-[11px] text-muted-foreground leading-tight">
              Tus compañeros abren el link y se suman automáticamente al equipo con su cuenta.
            </p>
          </div>
        </div>
      </div>

      <div className="flex flex-col sm:flex-row items-stretch gap-2 pt-0.5">
        <Input
          readOnly
          value={inviteUrl}
          onFocus={(e) => e.currentTarget.select()}
          className="h-8 font-mono text-[11px] bg-background text-foreground border-border/80"
          aria-label="Enlace de invitación directa al equipo"
        />

        <div className="flex items-center gap-1.5 shrink-0">
          <Button
            type="button"
            size="sm"
            onClick={copyToClipboard}
            variant="outline"
            className="h-8 text-xs gap-1.5 flex-1 sm:flex-initial"
          >
            {copied ? <Check className="size-3.5 text-emerald-600" /> : <Copy className="size-3.5" />}
            <span>{copied ? "Copiado" : "Copiar"}</span>
          </Button>

          <Button
            asChild
            size="sm"
            className="h-8 text-xs gap-1.5 bg-emerald-600 text-white hover:bg-emerald-700 flex-1 sm:flex-initial"
          >
            <a
              href={`https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`}
              target="_blank"
              rel="noopener noreferrer"
              aria-label="Compartir enlace de invitación por WhatsApp"
            >
              <MessageCircle className="size-3.5 fill-current" aria-hidden="true" />
              <span>WhatsApp</span>
            </a>
          </Button>
        </div>
      </div>
    </div>
  );
}
