"use client";

import { Check, Copy, Sparkles, Trophy, X } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";

export type TournamentCelebrationCardProps = {
  tournamentName: string;
  categoryCount: number;
  slotCount: number;
  inviteUrl?: string;
  onDismiss?: () => void;
};

/**
 * Tarjeta de celebración al completar exitosamente la preparación del torneo (D-072).
 * Incorpora microanimación de trofeo flotante con brillo (glow), partículas de confeti sutiles
 * y acento esmeralda controlado para recompensar sensorialmente al usuario.
 */
export function TournamentCelebrationCard({
  tournamentName,
  categoryCount,
  slotCount,
  inviteUrl,
  onDismiss,
}: TournamentCelebrationCardProps) {
  const [dismissed, setDismissed] = useState(false);
  const [copied, setCopied] = useState(false);

  if (dismissed) return null;

  async function handleCopy() {
    if (!inviteUrl) return;
    try {
      await navigator.clipboard.writeText(inviteUrl);
      setCopied(true);
      toast.success("Enlace de inscripción copiado al portapapeles");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("No se pudo copiar el enlace");
    }
  }

  function handleClose() {
    setDismissed(true);
    onDismiss?.();
  }

  return (
    <Card className="relative overflow-hidden border-emerald-500/30 bg-linear-to-br from-emerald-500/[0.07] via-card to-background shadow-md">
      {/* Partículas de confeti sutiles flotantes */}
      <div className="pointer-events-none absolute inset-0 overflow-hidden" aria-hidden="true">
        <span
          className="animate-confetti-particle absolute top-2 left-[12%] size-2 rounded-full bg-emerald-500/80"
          style={{ animationDelay: "0ms" }}
        />
        <span
          className="animate-confetti-particle absolute top-1 left-[28%] size-1.5 rounded-xs bg-amber-400/80"
          style={{ animationDelay: "350ms" }}
        />
        <span
          className="animate-confetti-particle absolute top-3 left-[45%] size-2.5 rounded-full bg-emerald-400/70"
          style={{ animationDelay: "150ms" }}
        />
        <span
          className="animate-confetti-particle absolute top-2 left-[64%] size-1.5 rounded-xs bg-emerald-600/70"
          style={{ animationDelay: "500ms" }}
        />
        <span
          className="animate-confetti-particle absolute top-1 left-[82%] size-2 rounded-full bg-amber-300/80"
          style={{ animationDelay: "250ms" }}
        />
        <span
          className="animate-confetti-particle absolute top-3 left-[92%] size-1.5 rounded-xs bg-emerald-500/70"
          style={{ animationDelay: "600ms" }}
        />
      </div>

      <CardContent className="relative p-5 sm:p-6">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-start gap-4">
            {/* Trofeo flotante con microanimación y resplandor */}
            <div className="relative flex size-14 shrink-0 items-center justify-center rounded-2xl bg-emerald-500/15 text-emerald-600 ring-4 ring-emerald-500/20 dark:text-emerald-400 dark:ring-emerald-500/25">
              <Trophy className="animate-subtle-float animate-pulse-glow size-7" aria-hidden="true" />
              <Sparkles
                className="absolute -top-1 -right-1 size-4 text-amber-500 animate-pulse"
                aria-hidden="true"
              />
            </div>

            <div className="space-y-1.5">
              <div className="flex items-center gap-2">
                <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  <Sparkles className="size-3" />
                  ¡Torneo listo!
                </span>
                <span className="text-xs text-muted-foreground font-medium">Asistente completado</span>
              </div>

              <h2 className="text-lg sm:text-xl font-extrabold tracking-tight text-foreground">
                ¡{tournamentName} ya está en marcha!
              </h2>

              <p className="text-xs sm:text-sm text-muted-foreground max-w-xl leading-relaxed">
                Completaste con éxito todos los pasos de preparación. La inscripción está oficialmente abierta y podés
                empezar a recibir parejas o cargarlas directamente.
              </p>

              {/* Métricas destacadas */}
              <div className="flex flex-wrap items-center gap-2 pt-1 text-xs">
                {categoryCount > 0 ? (
                  <span className="rounded-md border border-border/80 bg-background/80 px-2 py-0.5 font-medium text-foreground">
                    ✓ {categoryCount} categoría{categoryCount === 1 ? "" : "s"}
                  </span>
                ) : null}
                {slotCount > 0 ? (
                  <span className="rounded-md border border-border/80 bg-background/80 px-2 py-0.5 font-medium text-foreground">
                    ✓ {slotCount} franja{slotCount === 1 ? "" : "s"} horaria{slotCount === 1 ? "" : "s"}
                  </span>
                ) : null}
                <span className="rounded-md border border-emerald-500/30 bg-emerald-500/10 px-2 py-0.5 font-semibold text-emerald-700 dark:text-emerald-300">
                  ● Inscripción abierta
                </span>
              </div>
            </div>
          </div>

          <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
            {inviteUrl ? (
              <Button
                type="button"
                size="sm"
                onClick={handleCopy}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs hover:shadow-md hover:shadow-emerald-600/20 active:scale-[0.98] transition-all duration-150 h-9"
              >
                {copied ? <Check className="size-3.5 stroke-[2.5]" /> : <Copy className="size-3.5" />}
                <span>{copied ? "¡Enlace copiado!" : "Copiar enlace de invitación"}</span>
              </Button>
            ) : null}

            <Button
              type="button"
              variant="ghost"
              size="icon-sm"
              onClick={handleClose}
              className="text-muted-foreground hover:text-foreground"
              aria-label="Cerrar felicitaciones"
            >
              <X className="size-4" />
            </Button>
          </div>
        </div>
      </CardContent>
    </Card>
  );
}
