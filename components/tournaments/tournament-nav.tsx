"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/** Secciones del panel del organizador (se suman pestañas en cada fase). */
const SECTIONS = [
  { segment: "", label: "Resumen" },
  { segment: "configuracion", label: "Configuración" },
  { segment: "canchas-franjas", label: "Canchas y franjas" },
  { segment: "inscripciones", label: "Inscripciones" },
  { segment: "disponibilidad", label: "Disponibilidad" },
  { segment: "grupos", label: "Grupos" },
  { segment: "partidos", label: "Partidos" },
  { segment: "cuadro", label: "Cuadro" },
] as const;

export type PanelSection = (typeof SECTIONS)[number]["segment"];

/**
 * Pestañas como links (cada sección es una ruta). En mobile se desplazan en
 * horizontal; la activa lleva aria-current.
 */
export function TournamentNav({ tournamentId, sections }: { tournamentId: string; sections: readonly PanelSection[] }) {
  const pathname = usePathname();
  const base = `/torneos/${tournamentId}`;

  return (
    <nav aria-label="Secciones del torneo" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex min-w-max gap-1 border-b">
        {SECTIONS.filter((s) => sections.includes(s.segment)).map((section) => {
          const href = section.segment ? `${base}/${section.segment}` : base;
          const active = section.segment ? pathname.startsWith(href) : pathname === base;
          return (
            <li key={section.segment || "resumen"}>
              <Link
                href={href}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors",
                  "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  active && "border-foreground text-foreground",
                )}
              >
                {section.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
