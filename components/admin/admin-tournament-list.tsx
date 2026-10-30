"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import { Search, Trophy, ExternalLink, Shield, Users, Calendar, ArrowRight, Activity } from "lucide-react";
import type { AdminTournamentItem } from "@/lib/data/admin";
import { StatusBadge, getSportEmoji } from "@/components/tournaments/status-badge";
import { Input } from "@/components/ui/input";
import { Button } from "@/components/ui/button";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateRange } from "@/lib/dates";

type TabFilter = "all" | "running" | "registration" | "finished" | "draft";

export function AdminTournamentList({
  tournaments,
}: {
  tournaments: AdminTournamentItem[];
}) {
  const [activeTab, setActiveTab] = useState<TabFilter>("all");
  const [searchQuery, setSearchQuery] = useState("");

  // Conteo para las pestañas
  const counts = useMemo(() => {
    return {
      all: tournaments.length,
      running: tournaments.filter((t) => t.status === "group_stage" || t.status === "playoffs").length,
      registration: tournaments.filter((t) => t.status === "registration_open").length,
      finished: tournaments.filter((t) => t.status === "finished").length,
      draft: tournaments.filter((t) => t.status === "draft").length,
    };
  }, [tournaments]);

  // Filtrado reactivo
  const filteredTournaments = useMemo(() => {
    return tournaments.filter((t) => {
      // 1. Filtro por pestaña
      if (activeTab === "running" && !(t.status === "group_stage" || t.status === "playoffs")) {
        return false;
      }
      if (activeTab === "registration" && t.status !== "registration_open") {
        return false;
      }
      if (activeTab === "finished" && t.status !== "finished") {
        return false;
      }
      if (activeTab === "draft" && t.status !== "draft") {
        return false;
      }

      // 2. Filtro por búsqueda de texto
      if (searchQuery.trim()) {
        const query = searchQuery.toLowerCase().trim();
        const matchesName = t.name.toLowerCase().includes(query);
        const matchesOrganizer = t.organizerName.toLowerCase().includes(query);
        const matchesSport = t.sportName.toLowerCase().includes(query);
        const matchesCategory = t.categories.some((c) => c.name.toLowerCase().includes(query));
        return matchesName || matchesOrganizer || matchesSport || matchesCategory;
      }

      return true;
    });
  }, [tournaments, activeTab, searchQuery]);

  return (
    <div className="space-y-4">
      {/* 1. Barra de Búsqueda y Pestañas */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        {/* Pestañas de estado */}
        <div className="flex flex-wrap items-center gap-1.5 p-1 rounded-xl bg-muted/60 border border-border/60">
          <button
            type="button"
            onClick={() => setActiveTab("all")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "all"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Todos ({counts.all})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("running")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "running"
                ? "bg-amber-500/15 text-amber-700 dark:text-amber-300 border border-amber-500/30 font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
            En curso ({counts.running})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("registration")}
            className={`flex items-center gap-1.5 rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "registration"
                ? "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            <span className="size-1.5 rounded-full bg-emerald-500" />
            Inscripciones ({counts.registration})
          </button>
          <button
            type="button"
            onClick={() => setActiveTab("finished")}
            className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
              activeTab === "finished"
                ? "bg-background text-foreground shadow-sm font-semibold"
                : "text-muted-foreground hover:text-foreground"
            }`}
          >
            Finalizados ({counts.finished})
          </button>
          {counts.draft > 0 && (
            <button
              type="button"
              onClick={() => setActiveTab("draft")}
              className={`rounded-lg px-3 py-1.5 text-xs font-medium transition-all ${
                activeTab === "draft"
                  ? "bg-background text-foreground shadow-sm font-semibold"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Borradores ({counts.draft})
            </button>
          )}
        </div>

        {/* Buscador */}
        <div className="relative w-full sm:w-72">
          <Search className="absolute left-3 top-1/2 -translate-y-1/2 size-4 text-muted-foreground" />
          <Input
            type="search"
            placeholder="Buscar por nombre, organizador..."
            value={searchQuery}
            onChange={(e) => setSearchQuery(e.target.value)}
            className="pl-9 h-9 text-xs"
          />
        </div>
      </div>

      {/* 2. Listado de torneos */}
      {filteredTournaments.length === 0 ? (
        <Card className="border-dashed p-8 text-center">
          <Trophy className="mx-auto size-10 text-muted-foreground/40 mb-3" />
          <p className="text-sm font-medium text-foreground">No se encontraron torneos</p>
          <p className="text-xs text-muted-foreground mt-1">
            {searchQuery
              ? "Probá con otros términos de búsqueda."
              : "No hay torneos en esta categoría de estado."}
          </p>
        </Card>
      ) : (
        <div className="grid gap-3">
          {filteredTournaments.map((t) => {
            const isRunning = t.status === "group_stage" || t.status === "playoffs";
            const isFinished = t.status === "finished";
            const matchProgress =
              t.matchesCount > 0 ? Math.round((t.completedMatchesCount / t.matchesCount) * 100) : 0;

            return (
              <Card
                key={t.id}
                className="overflow-hidden border-border/70 hover:border-border transition-all duration-150 shadow-xs"
              >
                <CardContent className="p-4 sm:p-5">
                  <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
                    {/* Bloque Izquierdo: Info del torneo */}
                    <div className="space-y-1.5 min-w-0 flex-1">
                      <div className="flex flex-wrap items-center gap-2">
                        <span className="text-base" title={t.sportName}>
                          {getSportEmoji(t.sportName)}
                        </span>
                        <StatusBadge status={t.status} />
                        {t.isTest && (
                          <Badge variant="outline" className="text-[10px] bg-muted/60 text-muted-foreground">
                            Prueba
                          </Badge>
                        )}
                        <span className="text-xs text-muted-foreground">
                          · {t.sportName}
                        </span>
                      </div>

                      <h3 className="text-base font-bold text-foreground leading-snug truncate">
                        {t.name}
                      </h3>

                      <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
                        <span>
                          Organizador:{" "}
                          <strong className="font-semibold text-foreground">
                            {t.organizerName}
                          </strong>
                        </span>
                        <span className="flex items-center gap-1">
                          <Calendar className="size-3.5" />
                          {formatDateRange(t.startsOn, t.endsOn)}
                        </span>
                      </div>

                      {/* Categorías */}
                      {t.categories.length > 0 && (
                        <div className="flex flex-wrap items-center gap-1 pt-1">
                          <span className="text-[11px] text-muted-foreground">Categorías:</span>
                          {t.categories.map((c) => (
                            <Badge
                              key={c.id}
                              variant="secondary"
                              className="text-[10px] font-medium py-0 px-2"
                            >
                              {c.name}
                            </Badge>
                          ))}
                        </div>
                      )}
                    </div>

                    {/* Bloque Centro / Métricas */}
                    <div className="flex sm:flex-col items-center sm:items-end justify-between sm:justify-center border-t sm:border-t-0 sm:border-l pt-3 sm:pt-0 sm:pl-4 border-border/50 gap-2 shrink-0">
                      <div className="flex items-center gap-2 text-xs">
                        <Users className="size-3.5 text-muted-foreground" />
                        <span>
                          <strong className="font-semibold text-foreground">
                            {t.approvedTeamsCount}
                          </strong>{" "}
                          {t.approvedTeamsCount === 1 ? "pareja" : "parejas"}
                        </span>
                      </div>

                      {t.matchesCount > 0 && (
                        <div className="flex flex-col sm:items-end gap-1">
                          <span className="text-[11px] text-muted-foreground">
                            Partidos: {t.completedMatchesCount} de {t.matchesCount} ({matchProgress}%)
                          </span>
                          {isRunning && (
                            <div className="h-1.5 w-24 overflow-hidden rounded-full bg-muted">
                              <div
                                className="h-full bg-amber-500 transition-all"
                                style={{ width: `${matchProgress}%` }}
                              />
                            </div>
                          )}
                        </div>
                      )}
                    </div>
                  </div>

                  {/* Bloque Inferior: Botones de Acción */}
                  <div className="mt-4 flex flex-wrap items-center justify-between gap-2 border-t pt-3 border-border/60">
                    <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground">
                      <Shield className="size-3.5 text-amber-500" />
                      <span>Modo auditoría protegido (sólo lectura)</span>
                    </div>

                    <div className="flex items-center gap-2">
                      {t.status !== "draft" && (
                        <Button
                          asChild
                          variant="ghost"
                          size="sm"
                          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground"
                        >
                          <Link href={`/t/${t.slug}`} target="_blank" rel="noopener noreferrer">
                            <span>Web pública</span>
                            <ExternalLink className="size-3" />
                          </Link>
                        </Button>
                      )}

                      <Button
                        asChild
                        size="sm"
                        className="h-8 gap-1.5 text-xs bg-amber-600 hover:bg-amber-700 text-white font-medium"
                      >
                        <Link href={`/admin/torneos/${t.id}`}>
                          <span>Auditar Torneo</span>
                          <ArrowRight className="size-3" />
                        </Link>
                      </Button>
                    </div>
                  </div>
                </CardContent>
              </Card>
            );
          })}
        </div>
      )}
    </div>
  );
}

