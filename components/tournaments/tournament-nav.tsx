"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import {
  ChevronDown,
  Clock,
  Layers,
  MoreHorizontal,
  Settings,
  Users,
} from "lucide-react";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
import type { TournamentStatus } from "@/lib/domain/tournament-status";
import { cn } from "@/lib/utils";

export type NavGroupKey =
  | "categorias"
  | "canchas"
  | "inscripciones"
  | "configuracion"
  | "competencia"
  | "grupos"
  | "partidos"
  | "cuadro"
  | "mas";

const linkClass =
  "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring";

const OPEN_NAV_ITEMS = [
  { key: "canchas" as const, segment: "canchas-franjas", label: "Canchas y franjas" },
  { key: "inscripciones" as const, segment: "inscripciones", label: "Inscripciones" },
  { key: "configuracion" as const, segment: "configuracion", label: "Configuración" },
];

const CLOSED_MAIN_ITEMS = [
  { key: "grupos" as const, segment: "grupos", label: "Grupos" },
  { key: "partidos" as const, segment: "partidos", label: "Partidos" },
  { key: "cuadro" as const, segment: "cuadro", label: "Cuadro" },
];

const MORE_ITEMS = [
  { key: "canchas" as const, segment: "canchas-franjas", label: "Canchas y franjas", icon: Clock },
  { key: "inscripciones" as const, segment: "inscripciones", label: "Inscripciones", icon: Users },
  { key: "configuracion" as const, segment: "configuracion", label: "Configuración", icon: Settings },
];

/**
 * Navegación del torneo:
 * - Con inscripción cerrada (fase de grupos, playoffs, finalizado):
 *   Grupos -> Partidos -> Cuadro -> Más (...) [Canchas y franjas, Inscripciones, Configuración, Categorías]
 * - En preparación (borrador o inscripción abierta):
 *   Categorías -> Canchas y franjas -> Inscripciones -> Configuración
 */
export function TournamentNav({
  tournamentId,
  badges = {},
  recommended,
  status,
}: {
  tournamentId: string;
  badges?: Partial<Record<NavGroupKey, number>>;
  /** Pestaña donde está el trabajo de la fase actual (D-055). */
  recommended?: NavGroupKey;
  status?: TournamentStatus;
}) {
  const pathname = usePathname();
  const base = `/torneos/${tournamentId}`;
  const hrefOf = (segment: string) => `${base}/${segment}`;
  const isActive = (segment: string) => pathname.startsWith(hrefOf(segment));

  const isClosed = status === "group_stage" || status === "playoffs" || status === "finished";

  if (isClosed) {
    const isMoreActive = MORE_ITEMS.some((item) => isActive(item.segment));
    const moreBadge = MORE_ITEMS.reduce((sum, item) => sum + (badges[item.key] ?? 0), 0);

    return (
      <nav aria-label="Secciones del torneo" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
        <ul className="flex min-w-max gap-1 border-b">
          {CLOSED_MAIN_ITEMS.map((item) => {
            const active = isActive(item.segment);
            const badge = badges[item.key] ?? 0;
            return (
              <li key={item.key}>
                <Link
                  href={hrefOf(item.segment)}
                  aria-current={active ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex h-11 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors",
                    linkClass,
                    active && "border-amber-500 text-amber-600 dark:text-amber-400 font-semibold",
                  )}
                >
                  {item.label}
                  {badge > 0 ? (
                    <span className="rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
                      {badge}
                    </span>
                  ) : item.key === recommended && !active ? (
                    <span className="size-1.5 rounded-full bg-amber-500" role="img" aria-label="Recomendada para esta fase" />
                  ) : null}
                </Link>
              </li>
            );
          })}

          <li key="mas">
            <DropdownMenu>
              <DropdownMenuTrigger asChild>
                <button
                  type="button"
                  aria-current={isMoreActive ? "page" : undefined}
                  className={cn(
                    "-mb-px inline-flex h-11 items-center gap-1.5 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors cursor-pointer",
                    linkClass,
                    isMoreActive && "border-amber-500 text-amber-600 dark:text-amber-400 font-semibold",
                  )}
                >
                  <MoreHorizontal className="size-4 shrink-0" aria-hidden="true" />
                  <span>Más</span>
                  {moreBadge > 0 ? (
                    <span className="rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
                      {moreBadge}
                    </span>
                  ) : null}
                  <ChevronDown className="size-3.5 opacity-60 ml-0.5" aria-hidden="true" />
                </button>
              </DropdownMenuTrigger>
              <DropdownMenuContent align="end" className="w-52 p-1.5">
                {MORE_ITEMS.map((item) => {
                  const active = isActive(item.segment);
                  const Icon = item.icon;
                  return (
                    <DropdownMenuItem key={item.key} asChild>
                      <Link
                        href={hrefOf(item.segment)}
                        className={cn(
                          "flex w-full items-center gap-2.5 px-3 py-2 text-sm font-medium rounded-md transition-colors cursor-pointer",
                          active && "bg-amber-500/10 text-amber-600 dark:text-amber-400 font-semibold",
                        )}
                      >
                        <Icon className={cn("size-4", active ? "text-amber-500" : "text-muted-foreground")} aria-hidden="true" />
                        <span>{item.label}</span>
                      </Link>
                    </DropdownMenuItem>
                  );
                })}
              </DropdownMenuContent>
            </DropdownMenu>
          </li>
        </ul>
      </nav>
    );
  }

  // Si la inscripción no está cerrada (borrador o inscripción abierta)
  return (
    <nav aria-label="Secciones del torneo" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex min-w-max gap-1 border-b">
        {OPEN_NAV_ITEMS.map((item) => {
          const active = isActive(item.segment);
          const badge = badges[item.key] ?? 0;
          return (
            <li key={item.key}>
              <Link
                href={hrefOf(item.segment)}
                aria-current={active ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-11 items-center gap-2 border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors",
                  linkClass,
                  active && "border-amber-500 text-amber-600 dark:text-amber-400 font-semibold",
                )}
              >
                {item.label}
                {badge > 0 ? (
                  <span className="rounded-full bg-primary px-1.5 text-xs font-semibold tabular-nums text-primary-foreground">
                    <span className="sr-only">Pendientes: </span>
                    {badge}
                  </span>
                ) : item.key === recommended && !active ? (
                  <span className="size-1.5 rounded-full bg-amber-500" role="img" aria-label="Recomendada para esta fase" />
                ) : null}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
