"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";

/**
 * Secciones del panel del organizador (D-053): 5 pestañas principales; "Inscripciones" y
 * "Competencia" agrupan sub-secciones. Las rutas no cambian, solo cómo se agrupan.
 */
const GROUPS = [
  { key: "resumen", label: "Resumen", items: [{ segment: "", label: "Resumen" }] },
  { key: "categorias", label: "Categorías", items: [{ segment: "categorias", label: "Categorías" }] },
  { key: "canchas", label: "Canchas y franjas", items: [{ segment: "canchas-franjas", label: "Canchas y franjas" }] },
  {
    key: "inscripciones",
    label: "Inscripciones",
    items: [
      // No se llama igual que el grupo para que no haya dos links con el mismo nombre.
      { segment: "inscripciones", label: "Equipos" },
      { segment: "disponibilidad", label: "Disponibilidad" },
    ],
  },
  {
    key: "competencia",
    label: "Competencia",
    items: [
      { segment: "grupos", label: "Grupos" },
      { segment: "partidos", label: "Partidos" },
      { segment: "cuadro", label: "Cuadro" },
    ],
  },
  { key: "configuracion", label: "Configuración", items: [{ segment: "configuracion", label: "Configuración" }] },
] as const;

export type NavGroupKey = (typeof GROUPS)[number]["key"];

const linkClass =
  "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

/**
 * Pestañas como links (cada sección es una ruta). En mobile se desplazan en horizontal;
 * la activa lleva aria-current. `badges` muestra cuántas cosas esperan al organizador.
 */
export function TournamentNav({
  tournamentId,
  badges = {},
  recommended,
}: {
  tournamentId: string;
  badges?: Partial<Record<NavGroupKey, number>>;
  /** Pestaña donde está el trabajo de la fase actual (D-055). */
  recommended?: NavGroupKey;
}) {
  const pathname = usePathname();
  const base = `/torneos/${tournamentId}`;
  const hrefOf = (segment: string) => (segment ? `${base}/${segment}` : base);
  const isActive = (segment: string) => (segment ? pathname.startsWith(hrefOf(segment)) : pathname === base);

  const activeGroup = GROUPS.find((group) => group.items.some((item) => isActive(item.segment)));

  return (
    <div className="space-y-2">
      <nav aria-label="Secciones del torneo" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul className="flex min-w-max gap-1 border-b">
          {GROUPS.map((group) => {
            const active = group === activeGroup;
            const badge = badges[group.key] ?? 0;
            return (
              <li key={group.key}>
                <Link
                  href={hrefOf(group.items[0].segment)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex h-11 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors",
                    linkClass,
                    active && "border-primary text-foreground",
                  )}
                >
                  {group.label}
                  {badge > 0 ? (
                    <span
                      className={cn(
                        "rounded-full px-1.5 text-xs font-semibold tabular-nums",
                        group.key === "categorias"
                          ? "border bg-muted text-muted-foreground"
                          : "bg-primary text-primary-foreground",
                      )}
                    >
                      <span className="sr-only">
                        {group.key === "categorias" ? "Categorías creadas: " : "Pendientes: "}
                      </span>
                      {badge}
                    </span>
                  ) : group.key === recommended && !active ? (
                    <span className="size-1.5 rounded-full bg-primary" role="img" aria-label="Recomendada para esta fase" />
                  ) : null}
                </Link>
              </li>
            );
          })}
        </ul>
      </nav>

      {activeGroup && activeGroup.items.length > 1 ? (
        <nav aria-label={`Secciones de ${activeGroup.label}`}>
          <ul className="flex gap-1 overflow-x-auto [scrollbar-width:none]">
            {activeGroup.items.map((item) => {
              const active = isActive(item.segment);
              return (
                <li key={item.segment}>
                  <Link
                    href={hrefOf(item.segment)}
                    aria-current={active ? "page" : undefined}
                    className={cn(
                      "inline-flex h-10 items-center rounded-full px-4 text-sm font-medium text-muted-foreground transition-colors md:h-8",
                      "hover:bg-muted",
                      linkClass,
                      active && "bg-muted text-foreground",
                    )}
                  >
                    {item.label}
                  </Link>
                </li>
              );
            })}
          </ul>
        </nav>
      ) : null}
    </div>
  );
}
