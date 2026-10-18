"use client";

import {
  History,
  Plus,
  Search,
  Trophy,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { EmptyState } from "@/components/shared/empty-state";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { ParticipationItem, TournamentListItem } from "@/lib/data/tournaments";
import { cn } from "@/lib/utils";
import { FinishedTournamentCard, OrganizedTournamentCard, ParticipationCard } from "./tournament-card";

export type TabKey = "all" | "organized" | "participating" | "history";

interface TournamentDashboardProps {
  organized: TournamentListItem[];
  participations: ParticipationItem[];
  defaultTab?: TabKey;
}

export function TournamentDashboard({
  organized,
  participations,
  defaultTab = "all",
}: TournamentDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>(defaultTab);
  const [searchQuery, setSearchQuery] = useState("");

  // Separación nítida: los torneos finalizados se mueven al historial
  const activeOrganized = useMemo(
    () => organized.filter((t) => t.status !== "finished"),
    [organized]
  );
  const finishedOrganized = useMemo(
    () => organized.filter((t) => t.status === "finished"),
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

  const filteredFinishedOrganized = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return finishedOrganized;
    return finishedOrganized.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.sportName.toLowerCase().includes(q) ||
        (t.championName && t.championName.toLowerCase().includes(q))
    );
  }, [finishedOrganized, searchQuery]);

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
  const showHistory = activeTab === "history";

  const totalResults =
    (showActiveOrganized ? filteredActiveOrganized.length : 0) +
    (showParticipations ? filteredParticipations.length : 0) +
    (showHistory ? filteredFinishedOrganized.length : 0);

  return (
    <div className="space-y-6">
      {/* Barra de Herramientas: Segmented Control + Buscador Instantáneo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Segmented Control / Tabs */}
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
            onClick={() => setActiveTab("organized")}
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
            onClick={() => setActiveTab("participating")}
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

          <button
            type="button"
            onClick={() => setActiveTab("history")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all whitespace-nowrap",
              activeTab === "history"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <History className="size-3.5 text-muted-foreground" aria-hidden="true" />
            <span>Historial</span>
            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] tabular-nums font-mono">
              {finishedOrganized.length}
            </span>
          </button>
        </div>

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
              className="absolute right-2.5 top-1/2 -translate-y-1/2 text-muted-foreground hover:text-foreground"
            >
              <X className="size-3.5" aria-hidden="true" />
              <span className="sr-only">Limpiar búsqueda</span>
            </button>
          ) : null}
        </div>
      </div>

      {/* Empty state si el filtro por texto no encontró coincidencias */}
      {searchQuery && totalResults === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            No se encontraron torneos con "{searchQuery}"
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

      {/* 1. Sección: Torneos activos que organizo (los finalizados van al Historial) */}
      {showActiveOrganized && (!searchQuery || filteredActiveOrganized.length > 0) ? (
        <section aria-labelledby="organizo" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 id="organizo" className="text-lg font-semibold tracking-tight text-foreground">
                Organizo
              </h2>
              <span className="rounded-full bg-muted/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground font-mono">
                {filteredActiveOrganized.length}
              </span>
            </div>
            {organized.length > 0 ? (
              <Button asChild variant="ghost" size="sm" className="h-8 text-xs text-primary font-medium hover:text-primary">
                <Link href="/torneos/nuevo">
                  <Plus className="size-3.5 mr-1" aria-hidden="true" />
                  Nuevo torneo
                </Link>
              </Button>
            ) : null}
          </div>

          {filteredActiveOrganized.length === 0 ? (
            finishedOrganized.length > 0 ? (
              <div className="rounded-2xl border border-border/80 bg-card p-6 text-center space-y-3">
                <p className="text-sm font-medium text-foreground">
                  No tenés torneos activos en curso
                </p>
                <p className="text-xs text-muted-foreground max-w-md mx-auto">
                  Tus torneos anteriores ya concluyeron y están guardados en tu apartado de historial con sus respectivos campeones y estadísticas.
                </p>
                <div className="flex items-center justify-center gap-2 pt-1">
                  <Button
                    type="button"
                    variant="outline"
                    size="sm"
                    onClick={() => setActiveTab("history")}
                    className="text-xs"
                  >
                    <History className="size-3.5 mr-1 text-muted-foreground" aria-hidden="true" />
                    Ver historial ({finishedOrganized.length})
                  </Button>
                  <Button asChild size="sm" className="text-xs">
                    <Link href="/torneos/nuevo">
                      <Plus className="size-3.5 mr-1" aria-hidden="true" />
                      Crear nuevo torneo
                    </Link>
                  </Button>
                </div>
              </div>
            ) : (
              <EmptyState
                icon={Trophy}
                title="No organizás torneos"
                description="Creá uno: configurás el deporte, las canchas y los horarios, y compartís el link de inscripción."
                action={
                  <Button asChild>
                    <Link href="/torneos/nuevo">
                      <Plus className="size-4 mr-1.5" aria-hidden="true" />
                      Crear mi primer torneo
                    </Link>
                  </Button>
                }
              />
            )
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
        </section>
      ) : null}

      {/* 2. Sección: Torneos donde participo */}
      {showParticipations && (!searchQuery || filteredParticipations.length > 0) ? (
        <section aria-labelledby="participo" className="space-y-4 pt-2">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 id="participo" className="text-lg font-semibold tracking-tight text-foreground">
                Participo
              </h2>
              <span className="rounded-full bg-muted/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground font-mono">
                {filteredParticipations.length}
              </span>
            </div>
          </div>

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
        </section>
      ) : null}

      {/* 3. Sección: Historial de torneos organizados (Apartado exclusivo) */}
      {showHistory ? (
        <section aria-labelledby="historial-organizados" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 id="historial-organizados" className="text-lg font-semibold tracking-tight text-foreground flex items-center gap-2">
                <Trophy className="size-5 text-amber-500" aria-hidden="true" />
                <span>Historial de torneos organizados</span>
              </h2>
              <span className="rounded-full bg-muted/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground font-mono">
                {filteredFinishedOrganized.length}
              </span>
            </div>

            {finishedOrganized.length > 0 ? (
              <Button asChild variant="ghost" size="sm" className="h-8 text-xs font-medium text-muted-foreground hover:text-foreground">
                <Link href="/torneos/historial">
                  Ver vista dedicada
                </Link>
              </Button>
            ) : null}
          </div>

          {filteredFinishedOrganized.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No tenés torneos finalizados"
              description="Cuando un torneo que organizás concluya (al registrarse los resultados finales o definir el campeón), se moverá automáticamente a este apartado."
            />
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredFinishedOrganized.map((tournament) => (
                <FinishedTournamentCard
                  key={tournament.id}
                  tournament={tournament}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}
    </div>
  );
}
