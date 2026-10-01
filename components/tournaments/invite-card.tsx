"use client";

import { Copy, RefreshCw, Share2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { rotateInviteCode } from "@/app/(app)/torneos/[id]/actions";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

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

/** Link y código de inscripción: copiar, compartir y regenerar. */
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
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Inscripción</h2>
        </CardTitle>
        <CardDescription>
          {registrationOpen
            ? "Compartí el link o el código: con eso se anotan las parejas o equipos."
            : "Cuando abras la inscripción, con este link o código se anotan las parejas o equipos."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Código</p>
          <p className="font-mono text-2xl font-semibold tracking-wider" data-testid="invite-code">
            {formatInviteCode(code)}
          </p>
        </div>
        <div className="space-y-1">
          <p className="text-sm text-muted-foreground">Link</p>
          <p className="break-all rounded-lg bg-muted px-3 py-2 font-mono text-sm" data-testid="invite-url">
            {inviteUrl}
          </p>
        </div>
        <div className="flex flex-col gap-2 sm:flex-row">
          <Button type="button" onClick={copy}>
            <Copy aria-hidden="true" />
            Copiar link
          </Button>
          <Button type="button" variant="outline" onClick={share}>
            <Share2 aria-hidden="true" />
            Compartir
          </Button>
          <ConfirmActionButton
            variant="ghost"
            title="¿Generar un código nuevo?"
            description={<p>El link y el código actuales dejan de funcionar. Las inscripciones ya hechas no cambian.</p>}
            confirmLabel="Generar código nuevo"
            onConfirm={rotate}
          >
            <RefreshCw aria-hidden="true" />
            Regenerar
          </ConfirmActionButton>
        </div>
      </CardContent>
    </Card>
  );
}
