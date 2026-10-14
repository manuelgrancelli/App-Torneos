"use client";

import {
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
import { OrganizedTournamentCard, ParticipationCard } from "./tournament-card";

type TabKey = "all" | "organized" | "participating";

interface TournamentDashboardProps {
  organized: TournamentListItem[];
  participations: ParticipationItem[];
}

export function TournamentDashboard({
  organized,
  participations,
}: TournamentDashboardProps) {
  const [activeTab, setActiveTab] = useState<TabKey>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Filtrado reactivo por texto de búsqueda
  const filteredOrganized = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return organized;
    return organized.filter(
      (t) =>
        t.name.toLowerCase().includes(q) ||
        t.sportName.toLowerCase().includes(q)
    );
  }, [organized, searchQuery]);

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

  const showOrganized = activeTab === "all" || activeTab === "organized";
  const showParticipations = activeTab === "all" || activeTab === "participating";
  const totalResults =
    (showOrganized ? filteredOrganized.length : 0) +
    (showParticipations ? filteredParticipations.length : 0);

  return (
    <div className="space-y-6">
      {/* Barra de Herramientas: Segmented Control + Buscador Instantáneo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Segmented Control / Tabs */}
        <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border/50 text-xs font-medium">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
              activeTab === "all"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Todos</span>
            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] tabular-nums font-mono">
              {organized.length + participations.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("organized")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
              activeTab === "organized"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <span>Organizo</span>
            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] tabular-nums font-mono">
              {organized.length}
            </span>
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("participating")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3 py-1.5 transition-all",
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

      {/* 3. Empty state si el filtro por texto no encontró coincidencias */}
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

      {/* 4. Sección: Torneos que organizo */}
      {showOrganized && (!searchQuery || filteredOrganized.length > 0) ? (
        <section aria-labelledby="organizo" className="space-y-4">
          <div className="flex items-center justify-between">
            <div className="flex items-center gap-2">
              <h2 id="organizo" className="text-lg font-semibold tracking-tight text-foreground">
                Organizo
              </h2>
              <span className="rounded-full bg-muted/80 px-2 py-0.5 text-xs font-semibold tabular-nums text-muted-foreground font-mono">
                {filteredOrganized.length}
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

          {filteredOrganized.length === 0 ? (
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
          ) : (
            <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
              {filteredOrganized.map((tournament) => (
                <OrganizedTournamentCard
                  key={tournament.id}
                  tournament={tournament}
                />
              ))}
            </div>
          )}
        </section>
      ) : null}

      {/* 5. Sección: Torneos donde participo */}
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
    </div>
  );
}
