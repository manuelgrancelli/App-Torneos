"use client";

import { Check, Copy, ExternalLink, MessageCircle, Share2, Trophy } from "lucide-react";
import { useEffect, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Input } from "@/components/ui/input";
import type { TournamentStatus } from "@/lib/domain/tournament-status";
import { cn } from "@/lib/utils";

type ShareFixtureModalProps = {
  slug: string;
  tournamentName: string;
  status: TournamentStatus;
  variant?: "default" | "outline" | "secondary" | "ghost";
  size?: "default" | "sm" | "xs" | "lg";
  className?: string;
  label?: string;
};

/**
 * Modal para que el organizador comparta el fixture con el link de la página pública (D-169).
 */
export function ShareFixtureModal({
  slug,
  tournamentName,
  status,
  variant = "outline",
  size = "sm",
  className,
  label = "Compartir fixture",
}: ShareFixtureModalProps) {
  // Los borradores no tienen página pública
  if (status === "draft") return null;

  const [copied, setCopied] = useState(false);
  const [origin, setOrigin] = useState("");
  const [canShare, setCanShare] = useState(false);

  useEffect(() => {
    if (typeof window !== "undefined") {
      setOrigin(window.location.origin);
      if (typeof navigator.share === "function") {
        setCanShare(true);
      }
    }
  }, []);

  const fixturePath = `/t/${slug}?vista=fixture`;
  const fixtureUrl = origin ? `${origin}${fixturePath}` : fixturePath;

  const whatsappMessage = `🏆 *Fixture oficial - ${tournamentName}*\n\nSeguí las zonas, partidos, horarios y resultados en vivo acá:\n${fixtureUrl}`;
  const whatsappHref = `https://api.whatsapp.com/send?text=${encodeURIComponent(whatsappMessage)}`;

  async function handleCopy() {
    try {
      await navigator.clipboard.writeText(fixtureUrl);
      setCopied(true);
      toast.success("Link del fixture copiado al portapapeles.");
      setTimeout(() => setCopied(false), 2500);
    } catch {
      toast.error("No se pudo copiar automáticamente. Copialo desde el recuadro.");
    }
  }

  async function handleNativeShare() {
    if (typeof navigator === "undefined" || !navigator.share) return;
    try {
      await navigator.share({
        title: `Fixture oficial - ${tournamentName}`,
        text: `Seguí los partidos, horarios y resultados de ${tournamentName} en vivo:\n`,
        url: fixtureUrl,
      });
    } catch (error) {
      if (error instanceof DOMException && error.name === "AbortError") return;
    }
  }

  return (
    <Dialog>
      <DialogTrigger asChild>
        <Button
          type="button"
          variant={variant}
          size={size}
          className={cn(
            "gap-1.5 font-medium shadow-2xs border-emerald-500/30 bg-emerald-500/5 hover:bg-emerald-500/10 text-emerald-700 dark:text-emerald-400 hover:text-emerald-800 dark:hover:text-emerald-300 transition-colors",
            className
          )}
        >
          <Share2 className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>{label}</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="sm:max-w-md">
        <DialogHeader className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Trophy className="size-4.5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">Compartir fixture oficial</DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground">
                {tournamentName}
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        <div className="space-y-4 pt-2">
          <p className="text-xs text-muted-foreground leading-relaxed">
            Compartí este enlace con jugadores, familiares y espectadores para que consulten horarios de partidos, zonas, cruces y resultados en tiempo real sin tener que registrarse.
          </p>

          <div className="space-y-2">
            <label className="text-xs font-semibold uppercase tracking-wider text-muted-foreground" htmlFor="fixture-link-input">
              Link de la página
            </label>
            <div className="flex items-center gap-2">
              <Input
                id="fixture-link-input"
                readOnly
                value={fixtureUrl}
                onFocus={(e) => e.currentTarget.select()}
                className="h-9 font-mono text-xs select-all bg-muted/40"
              />
              <Button
                type="button"
                size="sm"
                variant={copied ? "default" : "outline"}
                onClick={handleCopy}
                className="h-9 shrink-0 gap-1.5 px-3 font-medium"
              >
                {copied ? <Check className="size-3.5" aria-hidden="true" /> : <Copy className="size-3.5" aria-hidden="true" />}
                <span>{copied ? "Copiado" : "Copiar"}</span>
              </Button>
            </div>
          </div>

          <div className="space-y-2 pt-1">
            <Button
              asChild
              className="w-full h-10 gap-2 bg-emerald-600 font-semibold text-white hover:bg-emerald-700 shadow-xs"
            >
              <a href={whatsappHref} target="_blank" rel="noopener noreferrer">
                <MessageCircle className="size-4" aria-hidden="true" />
                Compartir por WhatsApp
              </a>
            </Button>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
              {canShare ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={handleNativeShare}
                  className="h-9 gap-1.5 text-xs font-medium"
                >
                  <Share2 className="size-3.5" aria-hidden="true" />
                  Más aplicaciones
                </Button>
              ) : null}

              <Button
                asChild
                variant="outline"
                className={cn("h-9 gap-1.5 text-xs font-medium", !canShare && "sm:col-span-2")}
              >
                <a href={fixtureUrl} target="_blank" rel="noopener noreferrer">
                  <ExternalLink className="size-3.5" aria-hidden="true" />
                  Ver fixture público
                </a>
              </Button>
            </div>
          </div>
        </div>
      </DialogContent>
    </Dialog>
  );
}
