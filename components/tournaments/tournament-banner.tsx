"use client";

import { useState } from "react";
import { ExternalLink, Maximize2 } from "lucide-react";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Button } from "@/components/ui/button";

interface TournamentBannerProps {
  src: string;
  alt?: string;
  tournamentName?: string;
  className?: string;
  priority?: boolean;
}

/**
 * Banner o afiche informativo del torneo.
 * Muestra una portada destacada con diseño adaptable que, al hacer clic,
 * se expande en un visor modal (lightbox) a pantalla completa y alta resolución.
 */
export function TournamentBanner({
  src,
  alt = "Afiche o portada del torneo",
  tournamentName,
  className = "",
}: TournamentBannerProps) {
  const [open, setOpen] = useState(false);

  return (
    <>
      <div
        role="button"
        tabIndex={0}
        aria-label="Abrir afiche del torneo en tamaño completo"
        onClick={() => setOpen(true)}
        onKeyDown={(e) => {
          if (e.key === "Enter" || e.key === " ") {
            e.preventDefault();
            setOpen(true);
          }
        }}
        className={`group relative overflow-hidden rounded-2xl border border-border/80 bg-zinc-950/5 dark:bg-zinc-900/40 shadow-xs cursor-pointer transition-all duration-200 hover:border-primary/40 hover:shadow-md ${className}`}
      >
        {/* Imagen de fondo desenfocada para relleno estético */}
        <div
          aria-hidden="true"
          className="absolute inset-0 scale-110 bg-cover bg-center opacity-25 blur-xl transition-transform duration-300 group-hover:scale-125 dark:opacity-20 pointer-events-none"
          style={{ backgroundImage: `url(${src})` }}
        />

        {/* Imagen principal adaptada sin recorte */}
        <div className="relative flex items-center justify-center p-2 sm:p-3 min-h-48 sm:min-h-56 md:min-h-64 max-h-72 sm:max-h-80 md:max-h-96">
          <img
            src={src}
            alt={alt}
            className="max-h-64 sm:max-h-72 md:max-h-88 w-auto max-w-full rounded-xl object-contain drop-shadow-sm transition-transform duration-300 group-hover:scale-[1.01]"
            loading="lazy"
            decoding="async"
          />
        </div>

        {/* Indicador flotante para ampliar */}
        <div className="absolute bottom-3 right-3 flex items-center gap-1.5 rounded-full bg-background/85 px-3 py-1.5 text-xs font-medium text-foreground backdrop-blur-md shadow-xs border border-border/60 transition-transform duration-200 group-hover:scale-105">
          <Maximize2 className="size-3.5 text-primary" aria-hidden="true" />
          <span>Ver afiche completo</span>
        </div>
      </div>

      {/* Visor modal en pantalla completa */}
      <Dialog open={open} onOpenChange={setOpen}>
        <DialogContent className="max-w-4xl p-4 sm:p-6 sm:max-w-4xl max-h-[92vh] overflow-y-auto">
          <DialogHeader className="space-y-1 text-left pb-2">
            <DialogTitle className="text-lg font-semibold tracking-tight">
              {tournamentName ? `Afiche · ${tournamentName}` : "Afiche oficial del torneo"}
            </DialogTitle>
            <DialogDescription className="text-xs text-muted-foreground">
              Imagen informativa y cronograma del torneo en resolución completa.
            </DialogDescription>
          </DialogHeader>

          <div className="relative flex items-center justify-center rounded-xl bg-zinc-950/5 dark:bg-zinc-900/60 p-2 sm:p-4 border border-border/40">
            <img
              src={src}
              alt={alt}
              className="max-h-[72vh] w-auto max-w-full rounded-lg object-contain shadow-sm"
            />
          </div>

          <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/50">
            <span className="text-xs text-muted-foreground">
              Podés abrir la imagen original o guardarla en tu dispositivo.
            </span>
            <Button
              variant="outline"
              size="sm"
              asChild
              className="gap-1.5 text-xs"
            >
              <a href={src} target="_blank" rel="noopener noreferrer">
                <ExternalLink className="size-3.5" aria-hidden="true" />
                Abrir imagen original
              </a>
            </Button>
          </div>
        </DialogContent>
      </Dialog>
    </>
  );
}
