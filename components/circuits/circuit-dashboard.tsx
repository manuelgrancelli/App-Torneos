"use client";

import {
  ChevronRight,
  Layers,
  Search,
  Trophy,
  X,
} from "lucide-react";
import Link from "next/link";
import { useMemo, useState } from "react";
import { CircuitCard } from "@/components/circuits/circuit-card";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import type { CircuitListItem } from "@/lib/data/circuits";
import { cn } from "@/lib/utils";

export type CircuitTabKey = "all" | "organized" | "participating";

interface CircuitDashboardProps {
  organized: CircuitListItem[];
  participating: CircuitListItem[];
  defaultTab?: CircuitTabKey;
}

export function CircuitDashboard({
  organized,
  participating,
  defaultTab = "all",
}: CircuitDashboardProps) {
  const [activeTab, setActiveTab] = useState<CircuitTabKey>(defaultTab);
  const [searchQuery, setSearchQuery] = useState("");
  const [isOrganizedOpen, setIsOrganizedOpen] = useState(true);
  const [isParticipatingOpen, setIsParticipatingOpen] = useState(true);

  // Con búsqueda de texto, forzar visualización desplegada
  const effectiveOrganizedOpen = searchQuery ? true : isOrganizedOpen;
  const effectiveParticipatingOpen = searchQuery ? true : isParticipatingOpen;

  // Filtrado reactivo por texto de búsqueda
  const filteredOrganized = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return organized;
    return organized.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.sportName.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [organized, searchQuery]);

  const filteredParticipating = useMemo(() => {
    const q = searchQuery.toLowerCase().trim();
    if (!q) return participating;
    return participating.filter(
      (c) =>
        c.name.toLowerCase().includes(q) ||
        c.sportName.toLowerCase().includes(q) ||
        (c.description && c.description.toLowerCase().includes(q))
    );
  }, [participating, searchQuery]);

  const showOrganized = activeTab === "all" || activeTab === "organized";
  const showParticipating = activeTab === "all" || activeTab === "participating";

  const totalResults =
    (showOrganized ? filteredOrganized.length : 0) +
    (showParticipating ? filteredParticipating.length : 0);

  return (
    <div className="space-y-6">
      {/* Barra de herramientas: Segmented Control + Buscador Instantáneo */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Segmented Control / Tabs */}
        <div className="inline-flex rounded-xl bg-muted/60 p-1 border border-border text-xs font-medium overflow-x-auto max-w-full">
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
            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] tabular-nums font-mono border border-border/50">
              {organized.length + participating.length}
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
            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] tabular-nums font-mono border border-border/50">
              {organized.length}
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
            <span className="rounded-full bg-muted px-1.5 py-0.2 text-[10px] tabular-nums font-mono border border-border/50">
              {participating.length}
            </span>
          </button>
        </div>

        {/* Buscador reactivo */}
        <div className="relative w-full sm:w-64">
          <Search
            className="pointer-events-none absolute left-3 top-1/2 size-4 -translate-y-1/2 text-muted-foreground"
            aria-hidden="true"
          />
          <Input
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            placeholder="Buscar circuito o deporte..."
            className="h-9 pl-9 pr-8 text-xs bg-muted/30 focus:bg-background rounded-xl border border-input focus:border-ring"
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
        <div className="rounded-2xl border-2 border-dashed border-border p-8 text-center">
          <p className="text-sm font-medium text-foreground">
            No se encontraron circuitos con &quot;{searchQuery}&quot;
          </p>
          <p className="text-xs text-muted-foreground mt-1">
            Revisá la ortografía o probá con otro nombre de deporte o circuito.
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

      {/* 1. Sección: Circuitos que organizo */}
      {showOrganized && (!searchQuery || filteredOrganized.length > 0) ? (
        <section
          aria-labelledby="circuitos-organizo"
          className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-xs transition-colors"
        >
          <button
            type="button"
            onClick={() => setIsOrganizedOpen((prev) => !prev)}
            aria-expanded={effectiveOrganizedOpen}
            aria-controls="circuitos-organizo-panel"
            className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200",
                  effectiveOrganizedOpen
                    ? "rotate-90 border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground"
                )}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="circuitos-organizo"
                    className="text-base font-semibold text-foreground leading-tight"
                  >
                    Organizo
                  </h2>
                  <Badge
                    variant="secondary"
                    className="text-xs font-medium border border-border/50"
                  >
                    {filteredOrganized.length}{" "}
                    {filteredOrganized.length === 1 ? "circuito" : "circuitos"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Circuitos anuales bajo tu administración
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {effectiveOrganizedOpen ? "Plegar circuitos" : "Ver circuitos"}
              </span>
              <div
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  effectiveOrganizedOpen
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground"
                )}
              >
                {effectiveOrganizedOpen ? "Abierto" : "Cerrado"}
              </div>
            </div>
          </button>

          {effectiveOrganizedOpen && (
            <div
              id="circuitos-organizo-panel"
              className="border-t-2 border-border bg-muted/20 p-3.5 sm:p-4"
            >
              {filteredOrganized.length === 0 ? (
                <EmptyState
                  icon={Layers}
                  title="No creaste circuitos todavía"
                  description="Creá un circuito para agrupar varias fechas de torneo y consolidar una tabla general con puntos por jugador."
                  action={
                    <Button asChild variant="outline" size="sm">
                      <Link href="/circuitos/nuevo">Crear circuito</Link>
                    </Button>
                  }
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredOrganized.map((circuit) => (
                    <CircuitCard key={circuit.id} circuit={circuit} />
                  ))}
                </div>
              )}
            </div>
          )}
        </section>
      ) : null}

      {/* 2. Sección: Circuitos donde participo */}
      {showParticipating && (!searchQuery || filteredParticipating.length > 0) ? (
        <section
          aria-labelledby="circuitos-participo"
          className="overflow-hidden rounded-2xl border-2 border-border bg-card shadow-xs transition-colors"
        >
          <button
            type="button"
            onClick={() => setIsParticipatingOpen((prev) => !prev)}
            aria-expanded={effectiveParticipatingOpen}
            aria-controls="circuitos-participo-panel"
            className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
          >
            <div className="flex min-w-0 items-center gap-3">
              <div
                className={cn(
                  "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200",
                  effectiveParticipatingOpen
                    ? "rotate-90 border-primary bg-primary/10 text-primary"
                    : "border-border bg-muted/50 text-muted-foreground"
                )}
              >
                <ChevronRight className="size-4" aria-hidden="true" />
              </div>
              <div className="min-w-0">
                <div className="flex flex-wrap items-center gap-2">
                  <h2
                    id="circuitos-participo"
                    className="text-base font-semibold text-foreground leading-tight"
                  >
                    Participo
                  </h2>
                  <Badge
                    variant="secondary"
                    className="text-xs font-medium border border-border/50"
                  >
                    {filteredParticipating.length}{" "}
                    {filteredParticipating.length === 1 ? "circuito" : "circuitos"}
                  </Badge>
                </div>
                <p className="mt-0.5 text-xs text-muted-foreground">
                  Circuitos donde jugás al menos una fecha
                </p>
              </div>
            </div>

            <div className="flex shrink-0 items-center gap-2">
              <span className="text-xs font-medium text-muted-foreground">
                {effectiveParticipatingOpen ? "Plegar circuitos" : "Ver circuitos"}
              </span>
              <div
                className={cn(
                  "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                  effectiveParticipatingOpen
                    ? "border-primary/50 bg-primary/10 text-primary"
                    : "border-border bg-background text-muted-foreground"
                )}
              >
                {effectiveParticipatingOpen ? "Abierto" : "Cerrado"}
              </div>
            </div>
          </button>

          {effectiveParticipatingOpen && (
            <div
              id="circuitos-participo-panel"
              className="border-t-2 border-border bg-muted/20 p-3.5 sm:p-4"
            >
              {filteredParticipating.length === 0 ? (
                <EmptyState
                  icon={Trophy}
                  title="Todavía no jugaste en ningún circuito"
                  description="Cuando compitas en al menos una fecha de un circuito con tu pareja, lo vas a ver acá con la tabla general de posiciones y tu puntaje acumulado."
                />
              ) : (
                <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
                  {filteredParticipating.map((circuit) => (
                    <CircuitCard key={circuit.id} circuit={circuit} />
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
