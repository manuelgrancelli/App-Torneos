"use client";

import { Copy, RefreshCw, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { rotateInviteCode } from "@/app/(app)/torneos/[id]/actions";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { Button } from "@/components/ui/button";

/** "DEMQ2PADEL" → "DEMQ2-PADEL" (más fácil de dictar). */
export function formatInviteCode(code: string): string {
  return code.length === 10 ? `${code.slice(0, 5)}-${code.slice(5)}` : code;
}

type InviteCardProps = {
  tournamentId: string;
  tournamentName: string;
  code: string;
  /** URL absoluta del link de inscripción. */
  inviteUrl: string;
  registrationOpen: boolean;
};

/**
 * Link y código de inscripción: copiar, compartir y regenerar. Va dentro de una
 * sección plegable (D-052), que aporta el título y el marco.
 */
export function InviteCard({ tournamentId, tournamentName, code, inviteUrl, registrationOpen }: InviteCardProps) {
  const router = useRouter();
  const message = `Inscribite en "${tournamentName}": ${inviteUrl} (código ${formatInviteCode(code)})`;

  async function copy() {
    try {
      await navigator.clipboard.writeText(inviteUrl);
      toast.success("Copiamos el link.");
    } catch {
      toast.error("No pudimos copiar. Copialo a mano desde el recuadro.");
    }
  }

  async function share() {
    if (typeof navigator.share === "function") {
      try {
        await navigator.share({ title: tournamentName, text: message, url: inviteUrl });
        return;
      } catch (error) {
        // El usuario canceló: no es un error.
        if (error instanceof DOMException && error.name === "AbortError") return;
      }
    }
    window.open(`https://wa.me/?text=${encodeURIComponent(message)}`, "_blank", "noopener,noreferrer");
  }

  async function rotate() {
    const result = await rotateInviteCode({ tournamentId });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message ?? "Generamos un código nuevo.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      <p className="text-xs text-muted-foreground">
        {registrationOpen
          ? "Compartí el link o el código para que los participantes se anoten."
          : "Cuando abras la inscripción, con este link o código se anotan las parejas o equipos."}
      </p>

      <div className="flex flex-col sm:flex-row sm:items-center gap-2.5 rounded-lg border border-border/80 bg-muted/40 p-2.5">
        <div className="flex items-center gap-2 shrink-0">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">Código:</span>
          <span
            className="font-mono text-sm sm:text-base font-bold tracking-wider text-foreground bg-background px-2.5 py-0.5 rounded border border-border/80 shadow-2xs"
            data-testid="invite-code"
          >
            {formatInviteCode(code)}
          </span>
        </div>

        <div className="hidden sm:block h-4 w-px bg-border/80" aria-hidden="true" />

        <div className="flex items-center gap-2 min-w-0 flex-1">
          <span className="text-xs font-semibold text-muted-foreground uppercase tracking-wider shrink-0">Link:</span>
          <span
            className="truncate rounded bg-background px-2 py-0.5 font-mono text-xs text-muted-foreground border border-border/80 min-w-0 flex-1"
            data-testid="invite-url"
          >
            {inviteUrl}
          </span>
        </div>
      </div>

      <div className="flex flex-wrap items-center gap-2 pt-0.5">
        <Button type="button" size="sm" onClick={copy} className="h-8 text-xs font-medium">
          <Copy className="size-3.5 mr-1" aria-hidden="true" />
          Copiar link
        </Button>
        <Button type="button" variant="outline" size="sm" onClick={share} className="h-8 text-xs font-medium">
          <Share2 className="size-3.5 mr-1" aria-hidden="true" />
          Compartir
        </Button>
        <ConfirmActionButton
          variant="ghost"
          size="sm"
          title="¿Generar un código nuevo?"
          description={<p>El link y el código actuales dejan de funcionar. Las inscripciones ya hechas no cambian.</p>}
          confirmLabel="Generar código nuevo"
          onConfirm={rotate}
          className="h-8 text-xs text-muted-foreground hover:text-foreground"
        >
          <RefreshCw className="size-3.5 mr-1" aria-hidden="true" />
          Regenerar
        </ConfirmActionButton>
      </div>
    </div>
  );
}
