"use client";

import {
  CalendarDays,
  Filter,
  Medal,
  Plus,
  Search,
  Sparkles,
  Trophy,
  Users,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { TournamentListItem } from "@/lib/data/tournaments";
import { cn } from "@/lib/utils";
import { FinishedTournamentCard } from "./tournament-card";

interface FinishedTournamentsViewProps {
  tournaments: TournamentListItem[];
}

export function FinishedTournamentsView({ tournaments }: FinishedTournamentsViewProps) {
  const [searchQuery, setSearchQuery] = useState("");
  const [selectedSport, setSelectedSport] = useState<string>("all");

  // Lista única de deportes representados en los torneos finalizados
  const sports = useMemo(() => {
    const set = new Set<string>();
    tournaments.forEach((t) => {
      if (t.sportName) set.add(t.sportName);
    });
    return Array.from(set).sort((a, b) => a.localeCompare(b, "es"));
  }, [tournaments]);

  // Métricas agregadas de los torneos organizados y finalizados
  const metrics = useMemo(() => {
    const totalTournaments = tournaments.length;
    const totalTeams = tournaments.reduce((acc, t) => acc + t.approvedTeams, 0);
    const crownedChampions = tournaments.filter((t) => Boolean(t.championName)).length;
    const uniqueSports = sports.length;
    return {
      totalTournaments,
      totalTeams,
      crownedChampions,
      uniqueSports,
    };
  }, [tournaments, sports]);

  // Filtrado reactivo por texto y deporte
  const filtered = useMemo(() => {
    return tournaments.filter((t) => {
      if (selectedSport !== "all" && t.sportName.toLowerCase() !== selectedSport.toLowerCase()) {
        return false;
      }
      const q = searchQuery.toLowerCase().trim();
      if (!q) return true;
      return (
        t.name.toLowerCase().includes(q) ||
        t.sportName.toLowerCase().includes(q) ||
        (t.championName && t.championName.toLowerCase().includes(q))
      );
    });
  }, [tournaments, searchQuery, selectedSport]);

  if (tournaments.length === 0) {
    return (
      <div className="rounded-3xl border border-dashed border-border/80 bg-card/50 p-8 sm:p-12 text-center max-w-xl mx-auto space-y-4">
        <div className="flex size-14 mx-auto items-center justify-center rounded-2xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20 shadow-xs">
          <Trophy className="size-7" aria-hidden="true" />
        </div>
        <div className="space-y-1.5">
          <h3 className="text-lg font-semibold tracking-tight text-foreground">
            Aún no tenés torneos en el historial
          </h3>
          <p className="text-sm text-muted-foreground leading-relaxed">
            Cuando concluyan los torneos que organizás y definas a sus campeones, saldrán automáticamente del inicio activo y se archivarán de forma permanente acá con todas sus estadísticas y cruces.
          </p>
        </div>
        <div className="pt-2 flex flex-wrap items-center justify-center gap-2">
          <Button asChild variant="outline">
            <Link href="/torneos">Volver a mis torneos</Link>
          </Button>
          <Button asChild>
            <Link href="/torneos/nuevo">
              <Plus className="size-4 mr-1.5" aria-hidden="true" />
              Crear torneo
            </Link>
          </Button>
        </div>
      </div>
    );
  }

  return (
    <div className="space-y-6">
      {/* Resumen de estadísticas acumuladas del organizador */}
      <div className="grid grid-cols-2 sm:grid-cols-4 gap-3 sm:gap-4">
        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <CalendarDays className="size-3.5" aria-hidden="true" />
            <span>Ediciones concluidas</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {metrics.totalTournaments}
          </p>
          <span className="text-[11px] text-muted-foreground">Torneos finalizados</span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Trophy className="size-3.5 text-amber-500" aria-hidden="true" />
            <span>Campeones</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-amber-600 dark:text-amber-400 tabular-nums">
            {metrics.crownedChampions}
          </p>
          <span className="text-[11px] text-muted-foreground">Títulos entregados</span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Users className="size-3.5 text-sky-500" aria-hidden="true" />
            <span>Equipos albergados</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {metrics.totalTeams}
          </p>
          <span className="text-[11px] text-muted-foreground">Participaciones totales</span>
        </div>

        <div className="rounded-2xl border border-border/80 bg-card p-4 shadow-xs">
          <div className="flex items-center gap-2 text-muted-foreground text-xs font-medium">
            <Sparkles className="size-3.5 text-emerald-500" aria-hidden="true" />
            <span>Deportes</span>
          </div>
          <p className="mt-2 text-2xl font-bold tracking-tight text-foreground tabular-nums">
            {metrics.uniqueSports}
          </p>
          <span className="text-[11px] text-muted-foreground">Disciplinas gestionadas</span>
        </div>
      </div>

      {/* Barra de herramientas: Filtros por deporte y buscador */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Chips de filtro por deporte */}
        <div className="flex items-center gap-1.5 overflow-x-auto pb-1 sm:pb-0 max-w-full">
          <button
            type="button"
            onClick={() => setSelectedSport("all")}
            className={cn(
              "rounded-xl px-3 py-1.5 text-xs font-medium transition-all whitespace-nowrap",
              selectedSport === "all"
                ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
            )}
          >
            Todos ({tournaments.length})
          </button>
          {sports.map((sport) => {
            const count = tournaments.filter((t) => t.sportName.toLowerCase() === sport.toLowerCase()).length;
            return (
              <button
                key={sport}
                type="button"
                onClick={() => setSelectedSport(sport)}
                className={cn(
                  "rounded-xl px-3 py-1.5 text-xs font-medium transition-all capitalize whitespace-nowrap",
                  selectedSport.toLowerCase() === sport.toLowerCase()
                    ? "bg-primary text-primary-foreground shadow-xs font-semibold"
                    : "bg-muted/60 text-muted-foreground hover:bg-muted hover:text-foreground border border-border/50"
                )}
              >
                {sport} ({count})
              </button>
            );
          })}
        </div>

        {/* Buscador de torneos en historial */}
        <div className="relative w-full sm:w-72">
          <Search className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground" aria-hidden="true" />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar por nombre o campeón..."
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

      {/* Resultados filtrados o empty state de búsqueda */}
      {filtered.length === 0 ? (
        <div className="rounded-2xl border border-dashed border-border p-8 text-center space-y-2">
          <p className="text-sm font-medium text-foreground">
            No se encontraron torneos en el historial con estos criterios
          </p>
          <p className="text-xs text-muted-foreground">
            Probá limpiando el buscador o seleccionando otro deporte.
          </p>
          <div className="pt-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                setSearchQuery("");
                setSelectedSport("all");
              }}
              className="text-xs"
            >
              Restablecer filtros
            </Button>
          </div>
        </div>
      ) : (
        <div className="grid grid-cols-1 md:grid-cols-2 gap-4">
          {filtered.map((tournament) => (
            <FinishedTournamentCard
              key={tournament.id}
              tournament={tournament}
            />
          ))}
        </div>
      )}
    </div>
  );
}
