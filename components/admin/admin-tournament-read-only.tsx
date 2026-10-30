"use client";

import { useMemo, useState } from "react";
import Link from "next/link";
import {
  ArrowLeft,
  Shield,
  ShieldAlert,
  Users,
  Trophy,
  LayoutGrid,
  Calendar,
  Settings,
  ExternalLink,
  CheckCircle2,
  Clock,
} from "lucide-react";
import type { Competition } from "@/lib/data/competition";
import type { Tables } from "@/lib/supabase/database.types";
import { StatusBadge, TeamStatusBadge, getSportEmoji } from "@/components/tournaments/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { formatDateRange } from "@/lib/dates";

type AdminTab = "teams" | "matches" | "standings" | "playoffs" | "config";

export function AdminTournamentReadOnly({
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tournament,
  competition,
  courts,
  timeSlots,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  tournament: any;
  competition: Competition;
  courts: Tables<"courts">[];
  timeSlots: Tables<"time_slots">[];
}) {
  const [activeTab, setActiveTab] = useState<AdminTab>("teams");
  const [selectedCatId, setSelectedCatId] = useState<string>("all");

  const categories = competition.categories;
  const organizer = tournament.profiles;
  const sport = tournament.sports;

  // Mapa de equipos para resolver nombres rápidamente
  const teamMap = useMemo(() => {
    const map = new Map<string, { name: string; status: string; categoryId: string | null }>();
    for (const t of competition.teams) {
      map.set(t.id, {
        name: t.name,
        status: t.status,
        categoryId: t.categoryId ?? null,
      });
    }
    return map;
  }, [competition.teams]);

  // Mapa de canchas
  const courtMap = useMemo(() => {
    const map = new Map<string, string>();
    for (const c of courts) {
      map.set(c.id, c.name);
    }
    return map;
  }, [courts]);

  // Mapa de turnos
  const slotMap = useMemo(() => {
    const map = new Map<string, { start: string; end: string }>();
    for (const s of timeSlots) {
      map.set(s.id, { start: s.starts_at, end: s.ends_at });
    }
    return map;
  }, [timeSlots]);

  // Filtrar equipos por categoría
  const filteredTeams = useMemo(() => {
    if (selectedCatId === "all") return competition.teams;
    return competition.teams.filter((t) => t.categoryId === selectedCatId);
  }, [competition.teams, selectedCatId]);

  // Filtrar partidos por categoría
  const filteredMatches = useMemo(() => {
    if (selectedCatId === "all") return competition.matches;
    return competition.matches.filter((m) => m.categoryId === selectedCatId);
  }, [competition.matches, selectedCatId]);

  return (
    <div className="space-y-6">
      {/* 1. Header con botón de volver y estado */}
      <div className="space-y-3">
        <Button
          asChild
          variant="ghost"
          size="sm"
          className="h-8 gap-1.5 text-xs text-muted-foreground hover:text-foreground -ml-2"
        >
          <Link href="/admin">
            <ArrowLeft className="size-3.5" />
            <span>Volver al Panel Administrador</span>
          </Link>
        </Button>

        <div className="flex flex-col gap-3 sm:flex-row sm:items-start sm:justify-between">
          <div className="space-y-1">
            <div className="flex flex-wrap items-center gap-2">
              <span className="text-xl" title={sport?.name}>
                {getSportEmoji(sport?.name ?? "Pádel")}
              </span>
              <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
                {tournament.name}
              </h1>
              <StatusBadge status={tournament.status} />
              {tournament.is_test && (
                <Badge variant="outline" className="text-[10px] bg-muted/60 text-muted-foreground">
                  Prueba
                </Badge>
              )}
            </div>

            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground">
              <span>
                Organizado por:{" "}
                <strong className="font-semibold text-foreground">
                  {organizer?.full_name ?? "Organizador"}
                </strong>
              </span>
              <span className="flex items-center gap-1">
                <Calendar className="size-3.5" />
                {formatDateRange(tournament.starts_on, tournament.ends_on)}
              </span>
              <span>· {sport?.name ?? "Pádel"}</span>
            </div>
          </div>

          {tournament.status !== "draft" && (
            <Button
              asChild
              variant="outline"
              size="sm"
              className="h-8 gap-1.5 text-xs shrink-0"
            >
              <Link href={`/t/${tournament.slug}`} target="_blank" rel="noopener noreferrer">
                <span>Ver web pública</span>
                <ExternalLink className="size-3" />
              </Link>
            </Button>
          )}
        </div>
      </div>

      {/* 2. Banner de Modo Auditoría (Superadmin) */}
      <div className="flex items-start gap-3 rounded-xl border border-amber-500/30 bg-amber-500/10 p-4 text-xs text-amber-900 dark:text-amber-200">
        <ShieldAlert className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
        <div className="space-y-0.5">
          <p className="font-semibold">Modo Auditoría Superadmin (Solo Lectura)</p>
          <p className="text-[11px] opacity-90">
            Tenés acceso de lectura total a todos los datos, parejas, resultados y cruces de este torneo.
            Los controles de edición y modificación están desactivados para garantizar la integridad deportiva.
          </p>
        </div>
      </div>

      {/* 3. Pestañas de Navegación del Torneo */}
      <div className="border-b border-border/80">
        <div className="flex flex-wrap items-center gap-2">
          <button
            type="button"
            onClick={() => setActiveTab("teams")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-all ${
              activeTab === "teams"
                ? "border-amber-500 text-amber-600 dark:text-amber-400 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Users className="size-3.5" />
            <span>Parejas ({competition.teams.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("matches")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-all ${
              activeTab === "matches"
                ? "border-amber-500 text-amber-600 dark:text-amber-400 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Calendar className="size-3.5" />
            <span>Partidos ({competition.matches.length})</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("standings")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-all ${
              activeTab === "standings"
                ? "border-amber-500 text-amber-600 dark:text-amber-400 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <LayoutGrid className="size-3.5" />
            <span>Posiciones ({competition.groups.length} grupos)</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("playoffs")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-all ${
              activeTab === "playoffs"
                ? "border-amber-500 text-amber-600 dark:text-amber-400 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Trophy className="size-3.5" />
            <span>Playoffs</span>
          </button>

          <button
            type="button"
            onClick={() => setActiveTab("config")}
            className={`flex items-center gap-1.5 border-b-2 px-3 py-2 text-xs font-medium transition-all ${
              activeTab === "config"
                ? "border-amber-500 text-amber-600 dark:text-amber-400 font-semibold"
                : "border-transparent text-muted-foreground hover:text-foreground"
            }`}
          >
            <Settings className="size-3.5" />
            <span>Canchas & Config</span>
          </button>
        </div>
      </div>

      {/* 4. Selector de categoría (si hay más de 1) */}
      {categories.length > 1 && activeTab !== "config" && (
        <div className="flex flex-wrap items-center gap-1.5">
          <span className="text-xs text-muted-foreground mr-1">Filtrar categoría:</span>
          <Button
            type="button"
            variant={selectedCatId === "all" ? "secondary" : "ghost"}
            size="sm"
            onClick={() => setSelectedCatId("all")}
            className="h-7 text-xs px-2.5"
          >
            Todas ({competition.teams.length})
          </Button>
          {categories.map((c) => {
            const count = competition.teams.filter((t) => t.categoryId === c.id).length;
            return (
              <Button
                key={c.id}
                type="button"
                variant={selectedCatId === c.id ? "secondary" : "ghost"}
                size="sm"
                onClick={() => setSelectedCatId(c.id)}
                className="h-7 text-xs px-2.5"
              >
                {c.name} ({count})
              </Button>
            );
          })}
        </div>
      )}

      {/* 5. Contenido de la pestaña activa */}

      {/* PESTAÑA: PAREJAS / INSCRIPCIONES */}
      {activeTab === "teams" && (
        <div className="space-y-3">
          {filteredTeams.length === 0 ? (
            <Card className="border-dashed p-8 text-center text-xs text-muted-foreground">
              No hay parejas inscriptas en esta categoría.
            </Card>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {filteredTeams.map((team) => {
                const cat = categories.find((c) => c.id === team.categoryId);

                return (
                  <Card key={team.id} className="border-border/70 shadow-xs">
                    <CardContent className="p-3.5 space-y-2">
                      <div className="flex items-start justify-between gap-2">
                        <div className="min-w-0">
                          <h4 className="text-xs font-bold text-foreground truncate">
                            {team.name}
                          </h4>
                          {cat && (
                            <span className="text-[10px] text-muted-foreground block truncate">
                              Categoría: {cat.name}
                            </span>
                          )}
                        </div>
                        <TeamStatusBadge status={team.status as "pending" | "approved" | "rejected"} />
                      </div>

                      {/* Integrantes */}
                      <div className="space-y-1 border-t pt-2 border-border/50">
                        {(team.members ?? []).map((m, idx) => (
                          <div
                            key={m.id}
                            className="flex items-center justify-between text-[11px] text-muted-foreground"
                          >
                            <span className="truncate text-foreground font-medium">
                              {m.name}
                            </span>
                            <span className="text-[10px] text-muted-foreground/80 shrink-0 ml-1">
                              {idx === 0 ? "Capitán" : "Compañero"}
                            </span>
                          </div>
                        ))}
                      </div>
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA: PARTIDOS / FIXTURE */}
      {activeTab === "matches" && (
        <div className="space-y-3">
          {filteredMatches.length === 0 ? (
            <Card className="border-dashed p-8 text-center text-xs text-muted-foreground">
              No hay partidos generados en esta categoría todavía.
            </Card>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2">
              {filteredMatches.map((m) => {
                const home = teamMap.get(m.homeTeamId ?? "");
                const away = teamMap.get(m.awayTeamId ?? "");
                const courtName = m.courtId ? courtMap.get(m.courtId) : null;
                const slot = m.slotId ? slotMap.get(m.slotId) : null;
                const isFinished = m.resultStatus === "confirmed";

                return (
                  <Card key={m.id} className="border-border/70 shadow-xs">
                    <CardContent className="p-3.5 space-y-2">
                      <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b pb-1.5 border-border/50">
                        <Badge variant="outline" className="text-[10px] py-0 px-1.5">
                          {m.stage === "group" ? `Grupo` : `Playoff`}
                        </Badge>
                        <span>
                          {courtName ? courtName : "Sin cancha"}{" "}
                          {slot ? `· ${slot.start.slice(0, 5)}` : ""}
                        </span>
                      </div>

                      {/* Rivales y Marcador */}
                      <div className="space-y-1.5 py-1">
                        <div className="flex items-center justify-between text-xs">
                          <span className={`truncate font-medium ${isFinished && m.result ? "text-foreground" : "text-foreground"}`}>
                            {home?.name ?? "Por definir"}
                          </span>
                        </div>
                        <div className="flex items-center justify-between text-xs">
                          <span className={`truncate font-medium ${isFinished && m.result ? "text-foreground" : "text-foreground"}`}>
                            {away?.name ?? "Por definir"}
                          </span>
                        </div>
                      </div>

                      {/* Resultado */}
                      {isFinished && m.result && typeof m.result === "object" ? (
                        <div className="border-t pt-1.5 text-right text-xs font-bold text-amber-600 dark:text-amber-400">
                          {/* eslint-disable-next-line @typescript-eslint/no-explicit-any */}
                          {(m.result as any).sets
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            ? (m.result as any).sets.map((s: any) => `${s.home}-${s.away}`).join("  |  ")
                            // eslint-disable-next-line @typescript-eslint/no-explicit-any
                            : `${(m.result as any).homeGoals ?? 0} - ${(m.result as any).awayGoals ?? 0}`}
                        </div>
                      ) : (
                        <div className="border-t pt-1.5 flex items-center gap-1 text-[11px] text-muted-foreground">
                          <Clock className="size-3" />
                          <span>Pendiente de juego</span>
                        </div>
                      )}
                    </CardContent>
                  </Card>
                );
              })}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA: POSICIONES */}
      {activeTab === "standings" && (
        <div className="space-y-4">
          {competition.groups.length === 0 ? (
            <Card className="border-dashed p-8 text-center text-xs text-muted-foreground">
              Aún no se han sorteado o armado los grupos de este torneo.
            </Card>
          ) : (
            <div className="grid gap-4 sm:grid-cols-2">
              {competition.groups
                .filter((g) => selectedCatId === "all" || g.categoryId === selectedCatId)
                .map((g) => {
                  const cat = categories.find((c) => c.id === g.categoryId);

                  return (
                    <Card key={g.id} className="border-border/70 shadow-xs">
                      <CardContent className="p-4 space-y-2">
                        <div className="flex items-center justify-between border-b pb-2">
                          <h4 className="text-xs font-bold text-foreground">{g.name}</h4>
                          {cat && (
                            <Badge variant="secondary" className="text-[10px]">
                              {cat.name}
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-1.5 pt-1">
                          {g.teamIds.length === 0 ? (
                            <p className="text-[11px] text-muted-foreground">Sin parejas asignadas</p>
                          ) : (
                            g.teamIds.map((tid, idx) => {
                              const team = teamMap.get(tid);
                              return (
                                <div
                                  key={tid}
                                  className="flex items-center justify-between text-xs py-1 px-2 rounded bg-muted/40"
                                >
                                  <span className="font-medium truncate">
                                    {idx + 1}. {team?.name ?? "Pareja"}
                                  </span>
                                </div>
                              );
                            })
                          )}
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA: PLAYOFFS */}
      {activeTab === "playoffs" && (
        <div className="space-y-3">
          {competition.matches.filter((m) => m.stage === "playoff").length === 0 ? (
            <Card className="border-dashed p-8 text-center text-xs text-muted-foreground">
              Aún no se ha generado el cuadro de cruces eliminatorios para este torneo.
            </Card>
          ) : (
            <div className="grid gap-2 sm:grid-cols-2 lg:grid-cols-3">
              {competition.matches
                .filter((m) => m.stage === "playoff")
                .map((m) => {
                  const home = teamMap.get(m.homeTeamId ?? "");
                  const away = teamMap.get(m.awayTeamId ?? "");
                  const isFinished = m.resultStatus === "confirmed";

                  return (
                    <Card key={m.id} className="border-border/70 shadow-xs">
                      <CardContent className="p-3 space-y-2">
                        <div className="flex items-center justify-between text-[11px] text-muted-foreground border-b pb-1">
                          <span className="font-semibold text-amber-600 dark:text-amber-400">
                            Ronda {m.round} · Cruce #{m.position}
                          </span>
                          {isFinished ? (
                            <Badge variant="outline" className="text-[10px] text-emerald-600 border-emerald-500/30">
                              Finalizado
                            </Badge>
                          ) : (
                            <Badge variant="outline" className="text-[10px]">
                              Pendiente
                            </Badge>
                          )}
                        </div>

                        <div className="space-y-1 py-1 text-xs">
                          <p className="font-medium truncate">{home?.name ?? "Clasificado"}</p>
                          <p className="font-medium truncate">{away?.name ?? "Clasificado"}</p>
                        </div>
                      </CardContent>
                    </Card>
                  );
                })}
            </div>
          )}
        </div>
      )}

      {/* PESTAÑA: CANCHAS Y CONFIGURACIÓN */}
      {activeTab === "config" && (
        <div className="grid gap-4 sm:grid-cols-2">
          {/* Canchas */}
          <Card className="border-border/70 shadow-xs">
            <CardContent className="p-4 space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Canchas Asignadas ({courts.length})
              </h4>
              {courts.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay canchas registradas.</p>
              ) : (
                <div className="space-y-1.5">
                  {courts.map((c) => (
                    <div
                      key={c.id}
                      className="flex items-center justify-between rounded-lg border bg-muted/30 p-2 text-xs"
                    >
                      <span className="font-medium text-foreground">{c.name}</span>
                      <span className="text-muted-foreground text-[11px]">{c.venue ?? "Sede principal"}</span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>

          {/* Franjas Horarias */}
          <Card className="border-border/70 shadow-xs">
            <CardContent className="p-4 space-y-3">
              <h4 className="text-xs font-bold text-foreground uppercase tracking-wider">
                Franjas Horarias ({timeSlots.length})
              </h4>
              {timeSlots.length === 0 ? (
                <p className="text-xs text-muted-foreground">No hay franjas horarias cargadas.</p>
              ) : (
                <div className="max-h-60 overflow-y-auto space-y-1.5 pr-1">
                  {timeSlots.map((s) => (
                    <div
                      key={s.id}
                      className="flex items-center justify-between rounded-lg border bg-muted/30 p-2 text-xs"
                    >
                      <span className="font-medium text-foreground">
                        {s.starts_at.slice(0, 10)}
                      </span>
                      <span className="text-muted-foreground text-[11px]">
                        {s.starts_at.slice(11, 16)} a {s.ends_at.slice(11, 16)} hs ({s.stage === "playoff" ? "Playoff" : "Grupos"})
                      </span>
                    </div>
                  ))}
                </div>
              )}
            </CardContent>
          </Card>
        </div>
      )}
    </div>
  );
}

