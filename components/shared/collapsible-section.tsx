"use client";

import { ChevronDown, Lock } from "lucide-react";
import { type ReactNode, useState } from "react";
import { cn } from "@/lib/utils";

type CollapsibleSectionProps = {
  title: string;
  /** Resumen de una línea que se ve mientras la sección está plegada. */
  summary?: ReactNode;
  /** Texto de ayuda que va arriba del contenido, ya desplegado. */
  description?: string;
  defaultOpen?: boolean;
  /** Obliga a mostrarla abierta (por ejemplo, si un campo de adentro tiene un error). */
  forceOpen?: boolean;
  /** Marca que hay campos bloqueados adentro (D-029). */
  locked?: boolean;
  /** Versión compacta con menor altura y relleno */
  compact?: boolean;
  className?: string;
  children: ReactNode;
};

/**
 * Sección plegable (D-052). Usa `<details>` nativo: funciona con teclado, lo anuncian
 * los lectores de pantalla y no suma dependencias. El contenido sigue montado cuando está
 * plegado, así que los formularios (React Hook Form) no pierden valores.
 * Quien la use debe tener en cuenta que un campo plegado no es visible: los tests
 * tienen que abrir la sección antes de interactuar.
 */
export function CollapsibleSection({
  title,
  summary,
  description,
  defaultOpen = false,
  forceOpen = false,
  locked = false,
  compact = false,
  className,
  children,
}: CollapsibleSectionProps) {
  const [open, setOpen] = useState(defaultOpen);

  return (
    <details
      open={open || forceOpen}
      onToggle={(event) => setOpen(event.currentTarget.open)}
      className={cn("group/section overflow-hidden rounded-xl bg-card text-sm text-card-foreground ring-1 ring-foreground/10", className)}
    >
      <summary
        className={cn(
          "flex cursor-pointer list-none items-center gap-3 px-4 py-2 [&::-webkit-details-marker]:hidden",
          compact ? "min-h-11 py-1.5 px-3.5" : "min-h-14",
          "hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
        )}
      >
        <span className="min-w-0 flex-1">
          <h2 className={cn("flex items-center gap-2 font-semibold", compact ? "text-sm" : "text-base")}>
            {title}
            {locked ? <Lock className="size-3.5 text-muted-foreground" aria-label="Con campos bloqueados" /> : null}
          </h2>
          {summary ? (
            <span className={cn("block truncate text-muted-foreground group-open/section:hidden", compact ? "text-xs" : "text-sm")}>
              {summary}
            </span>
          ) : null}
        </span>
        <ChevronDown
          className="size-4 shrink-0 text-muted-foreground transition-transform group-open/section:rotate-180"
          aria-hidden="true"
        />
      </summary>
      <div className={cn("border-t", compact ? "space-y-3 px-3.5 py-3" : "space-y-4 px-4 py-4")}>
        {description ? <p className="text-sm text-muted-foreground">{description}</p> : null}
        {children}
      </div>
    </details>
  );
}
