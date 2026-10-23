"use client";

import {
  ChevronRight,
  Search,
  Trophy,
  Users,
  X,
} from "lucide-react";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ParticipationItem, TournamentListItem } from "@/lib/data/tournaments";
import { cn } from "@/lib/utils";
import { OrganizedTournamentCard, ParticipationCard } from "./tournament-card";

export type TabKey = "all" | "organized" | "participating";

interface TournamentDashboardProps {
  organized: TournamentListItem[];
  participations: ParticipationItem[];
  defaultTab?: TabKey;
  /** Cuenta de jugador sin torneos que co-administre: solo muestra "Participo" (D-122). */
  hideOrganized?: boolean;
}

export function TournamentDashboard({
  organized,
  participations,
  defaultTab = "all",
  hideOrganized = false,
}: TournamentDashboardProps) {
  const [selectedTab, setActiveTab] = useState<TabKey>(defaultTab);
  const activeTab: TabKey = hideOrganized ? "participating" : selectedTab;
  const [searchQuery, setSearchQuery] = useState("");
  const [isOrganizedOpen, setIsOrganizedOpen] = useState(true);
  const [isParticipatingOpen, setIsParticipatingOpen] = useState(true);

  // Con búsqueda de texto forzar la visualización desplegada para ver los resultados
  const effectiveOrganizedOpen = searchQuery ? true : isOrganizedOpen;
  const effectiveParticipatingOpen = searchQuery ? true : isParticipatingOpen;

  // Torneos activos (no finalizados)
  const activeOrganized = useMemo(
    () => organized.filter((t) => t.status !== "finished"),
    [organized]
  );

  // Filtrado reactivo por texto de búsqueda
  const filteredActiveOrganized = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return activeOrganized;
    return activeOrganized.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.sportName.toLowerCase().includes(q)
    );
  }, [activeOrganized, searchQuery]);

  const filteredParticipations = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return participations;
    return participations.filter(
      (p) =>
        p.tournament.name.toLowerCase().includes(q) ||
        p.tournament.sportName.toLowerCase().includes(q) ||
        p.teamName.toLowerCase().includes(q)
    );
  }, [participations, searchQuery]);

  const showActiveOrganized = activeTab === "all" || activeTab === "organized";
  const showParticipations = activeTab === "all" || activeTab === "participating";

  const totalResults =
    (showActiveOrganized ? filteredActiveOrganized.length : 0) +
    (showParticipations ? filteredParticipations.length : 0);

  return (
    <div className="space-y-6">
      {/* Barra de Herramientas: Segmented Control + Buscador Instantáneo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Segmented Control / Tabs */}
        {hideOrganized ? (
          <h2 className="text-lg font-semibold tracking-tight text-foreground">
            Todos mis torneos
          </h2>
        ) : (
          <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border/50 text-xs font-medium overflow-x-auto max-w-full">
            <button
              type="button"
              onClick={() => setActiveTab("all")}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all whitespace-nowrap",
                activeTab === "all"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Todos</span>
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] tabular-nums font-mono">
                {activeOrganized.length + participations.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("organized");
                setIsOrganizedOpen(true);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all whitespace-nowrap",
                activeTab === "organized"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Organizo</span>
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] tabular-nums font-mono">
                {activeOrganized.length}
              </span>
            </button>

            <button
              type="button"
              onClick={() => {
                setActiveTab("participating");
                setIsParticipatingOpen(true);
              }}
              className={cn(
                "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all whitespace-nowrap",
                activeTab === "participating"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              )}
            >
              <span>Participo</span>
              <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] tabular-nums font-mono">
                {participations.length}
              </span>
            </button>
          </div>
        )}

        {/* Buscador reactivo */}
        <div className="relative w-full sm:w-64">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar torneo o equipo..."
            className="h-9 pl-9 pr-8 text-xs bg-muted/30 focus:bg-background rounded-xl border-border/70"
          />
          {searchQuery ? (
            <button
              type="button"
              onClick={() => setSearchQuery("")}
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Limpiar búsqueda"
            >
              <X className="size-3.5" />
            </button>
          ) : null}
        </div>
      </div>

      {/* Empty state si el filtro por texto no encontró coincidencias */}
      {searchQuery && totalResults === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            No se encontraron torneos con &quot;{searchQuery}&quot;
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Revisá la ortografía o probá con otro nombre de deporte o torneo.
          </p>
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={() => setSearchQuery("")}
            className="mt-4"
          >
            Restablecer búsqueda
          </Button>
        </div>
      ) : null}

      {/* 1. Sección: Torneos activos que organizo */}
      {showActiveOrganized && (!searchQuery || filteredActiveOrganized.length > 0) ? (
        <section
          aria-labelledby="organizo"
          className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs transition-colors"
        >
          <button
            type="button"
            onClick={() => setIsOrganizedOpen((prev) => !prev)}
            aria-expanded={effectiveOrganizedOpen}
            aria-controls="organizo-panel"
            className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200",
                  effectiveOrganizedOpen
                    ? "rotate-90 border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 bg-muted/50 text-muted-foreground",
                )}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="organizo" className="text-base font-semibold text-foreground leading-tight">
                    Organizo
                  </h2>
                  <Badge variant="secondary" className="text-xs font-medium">
                    {filteredActiveOrganized.length} {filteredActiveOrganized.length === 1 ? "torneo" : "torneos"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Torneos activos bajo tu administración
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {effectiveOrganizedOpen ? "Plegar torneos" : "Ver torneos"}
              </span>
              <div
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  effectiveOrganizedOpen
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                {effectiveOrganizedOpen ? "Abierto" : "Cerrado"}
              </div>
            </div>
          </button>

          {effectiveOrganizedOpen && (
            <div
              id="organizo-panel"
              className="border-t border-border/60 bg-muted/20 p-3.5 sm:p-4"
            >
              {filteredActiveOrganized.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  title="No organizás torneos"
                  description="Todavía no tenés torneos creados. Cuando crees uno aparecerá acá."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredActiveOrganized.map((tournament) => (
                    <OrganizedTournamentCard
                      key={tournament.id}
                      tournament={tournament}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      ) : null}

      {/* 2. Sección: Torneos donde participo */}
      {showParticipations && (!searchQuery || filteredParticipations.length > 0) ? (
        <section
          aria-labelledby="participo"
          className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs transition-colors"
        >
          <button
            type="button"
            onClick={() => setIsParticipatingOpen((prev) => !prev)}
            aria-expanded={effectiveParticipatingOpen}
            aria-controls="participo-panel"
            className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200",
                  effectiveParticipatingOpen
                    ? "rotate-90 border-primary/40 bg-primary/10 text-primary"
                    : "border-border/60 bg-muted/50 text-muted-foreground",
                )}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2 id="participo" className="text-base font-semibold text-foreground leading-tight">
                    Participo
                  </h2>
                  <Badge variant="secondary" className="text-xs font-medium">
                    {filteredParticipations.length} {filteredParticipations.length === 1 ? "torneo" : "torneos"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Torneos donde estás inscripto con tu pareja o equipo
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {effectiveParticipatingOpen ? "Plegar torneos" : "Ver torneos"}
              </span>
              <div
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  effectiveParticipatingOpen
                    ? "border-primary/30 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground",
                )}
              >
                {effectiveParticipatingOpen ? "Abierto" : "Cerrado"}
              </div>
            </div>
          </button>

          {effectiveParticipatingOpen && (
            <div
              id="participo-panel"
              className="border-t border-border/60 bg-muted/20 p-3.5 sm:p-4"
            >
              {filteredParticipations.length === 0 ? (
                <EmptyState
                  icon={Users}
                  title="Todavía no jugás en ningún torneo"
                  description="Cuando te inscribas con el link o el código de un torneo, lo vas a ver acá con el fixture de tus partidos."
                />
              ) : (
                <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
                  {filteredParticipations.map((participation) => (
                    <ParticipationCard
                      key={participation.teamId}
                      participation={participation}
                    />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
