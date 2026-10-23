"use client";

import { useState } from "react";
import { Calendar, CheckCircle2, Dices, Info, Trophy, User, Users, XCircle } from "lucide-react";
import type { MatchView } from "@/lib/data/competition";
import { formatResult } from "@/lib/domain/scoring";
import type { StandingRow } from "@/lib/domain/standings";
import { cn } from "@/lib/utils";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";

type StandingsTableProps = {
  title: string;
  rows: StandingRow[];
  teamNames: Record<string, string> | Map<string, string>;
  teamMembers?: Record<string, string[]> | Map<string, string[]>;
  scoringType: "sets" | "goals";
  /** Puestos que clasifican (se resaltan). */
  qualifiers?: number;
  matches?: MatchView[];
  groupId?: string;
};

const COLUMNS = {
  sets: [
    { key: "played", label: "PJ", title: "Partidos jugados" },
    { key: "won", label: "PG", title: "Partidos ganados" },
    { key: "lost", label: "PP", title: "Partidos perdidos" },
    { key: "setDiff", label: "DS", title: "Diferencia de sets" },
    { key: "gameDiff", label: "DG", title: "Diferencia de games" },
    { key: "points", label: "Pts", title: "Puntos" },
  ],
  goals: [
    { key: "played", label: "PJ", title: "Partidos jugados" },
    { key: "won", label: "G", title: "Ganados" },
    { key: "drawn", label: "E", title: "Empatados" },
    { key: "lost", label: "P", title: "Perdidos" },
    { key: "goalsFor", label: "GF", title: "Goles a favor" },
    { key: "goalsAgainst", label: "GC", title: "Goles en contra" },
    { key: "goalDiff", label: "DG", title: "Diferencia de gol" },
    { key: "points", label: "Pts", title: "Puntos" },
  ],
} as const;

function value(row: StandingRow, key: string): number {
  switch (key) {
    case "setDiff": return row.setsFor - row.setsAgainst;
    case "gameDiff": return row.gamesFor - row.gamesAgainst;
    case "goalDiff": return row.goalsFor - row.goalsAgainst;
    default: return row[key as keyof StandingRow] as number;
  }
}

function signed(key: string, n: number): string {
  return key.endsWith("Diff") && n > 0 ? `+${n}` : String(n);
}

function getTeamName(teamNames: Record<string, string> | Map<string, string>, id: string): string {
  if (teamNames instanceof Map) return teamNames.get(id) ?? "Equipo";
  return teamNames[id] ?? "Equipo";
}

function getTeamMembers(
  teamMembers: Record<string, string[]> | Map<string, string[]> | undefined,
  teamNames: Record<string, string> | Map<string, string>,
  id: string,
): string[] {
  let list: string[] | undefined;
  if (teamMembers instanceof Map) {
    list = teamMembers.get(id);
  } else if (teamMembers) {
    list = teamMembers[id];
  }
  if (list && list.length > 0) return list;

  const name = getTeamName(teamNames, id);
  if (name.includes("/")) {
    return name.split("/").map((s) => s.trim()).filter(Boolean);
  }
  if (name.includes(" - ")) {
    return name.split(" - ").map((s) => s.trim()).filter(Boolean);
  }
  if (/\s+y\s+/i.test(name)) {
    return name.split(/\s+y\s+/i).map((s) => s.trim()).filter(Boolean);
  }
  return [name];
}

/** Tabla de posiciones de un grupo: columna de equipo interactiva con modal de integrantes y estadísticas. */
export function StandingsTable({
  title,
  rows,
  teamNames,
  teamMembers,
  scoringType,
  qualifiers = 0,
  matches,
  groupId,
}: StandingsTableProps) {
  const [selectedRow, setSelectedRow] = useState<StandingRow | null>(null);
  const columns = COLUMNS[scoringType];
  const lottery = rows.some((r) => r.decidedByLottery && r.played > 0);

  const selectedTeamName = selectedRow ? getTeamName(teamNames, selectedRow.teamId) : "";
  const selectedMembers = selectedRow ? getTeamMembers(teamMembers, teamNames, selectedRow.teamId) : [];

  // Partidos del equipo seleccionado en esta zona
  const teamGroupMatches = selectedRow && matches
    ? matches.filter(
        (m) =>
          m.stage === "group" &&
          (!groupId || m.groupId === groupId) &&
          !m.isBye &&
          (m.homeTeamId === selectedRow.teamId || m.awayTeamId === selectedRow.teamId),
      )
    : [];

  return (
    <section className="space-y-2">
      <div className="flex items-center justify-between gap-2 px-1">
        <h3 className="text-sm font-semibold text-foreground">{title}</h3>
        <span className="flex items-center gap-1 text-[11px] text-muted-foreground">
          <Info className="size-3 text-muted-foreground/70" />
          <span>Tocá una pareja para ver detalle</span>
        </span>
      </div>

      {/* Región enfocable: con teclado también se puede desplazar en horizontal. */}
      <div
        className="overflow-x-auto rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        role="region"
        aria-label={`Posiciones: ${title}`}
        tabIndex={0}
      >
        <table className="w-full border-collapse text-sm">
          <caption className="sr-only">{title}</caption>
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium">
                Equipo / Pareja
              </th>
              {columns.map((c) => (
                <th key={c.key} scope="col" className="px-2 py-2 text-right font-medium tabular-nums">
                  <abbr title={c.title} className="no-underline">
                    {c.label}
                  </abbr>
                </th>
              ))}
            </tr>
          </thead>
          <tbody>
            {rows.map((row) => {
              const isQualified = row.position <= qualifiers;
              const name = getTeamName(teamNames, row.teamId);
              return (
                <tr
                  key={row.teamId}
                  className={cn(
                    "border-t transition-colors hover:bg-muted/40 cursor-pointer",
                    isQualified &&
                      "bg-emerald-200/80 text-emerald-950 hover:bg-emerald-200 dark:bg-emerald-950/50 dark:text-emerald-100 dark:hover:bg-emerald-950/70 border-t-emerald-300/60 dark:border-t-emerald-900/40",
                  )}
                  onClick={() => setSelectedRow(row)}
                >
                  <th
                    scope="row"
                    className={cn(
                      "sticky left-0 z-10 max-w-44 px-3 py-2 text-left font-medium",
                      isQualified
                        ? "bg-emerald-200 text-emerald-950 dark:bg-emerald-950 dark:text-emerald-100"
                        : "bg-background",
                    )}
                  >
                    <button
                      type="button"
                      onClick={(e) => {
                        e.stopPropagation();
                        setSelectedRow(row);
                      }}
                      className="flex items-center gap-2 text-left w-full hover:underline focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring rounded py-1 px-1 -mx-1"
                      title="Ver integrantes y estadísticas de la pareja"
                    >
                      <span
                        className={cn(
                          "w-4 tabular-nums shrink-0 font-semibold",
                          isQualified
                            ? "text-emerald-950 dark:text-emerald-300"
                            : "text-muted-foreground",
                        )}
                      >
                        {row.position}
                      </span>
                      <span className="truncate font-medium">{name}</span>
                      {row.decidedByLottery && row.played > 0 ? (
                        <Dices className="size-3.5 shrink-0 text-muted-foreground" aria-label="Posición definida por sorteo" />
                      ) : null}
                    </button>
                  </th>
                  {columns.map((c) => (
                    <td
                      key={c.key}
                      className={cn(
                        "px-2 py-2 text-right tabular-nums",
                        c.key === "points" && "font-semibold",
                        isQualified && "text-emerald-950 dark:text-emerald-100",
                      )}
                    >
                      {signed(c.key, value(row, c.key))}
                    </td>
                  ))}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
      {lottery ? (
        <p className="text-xs text-muted-foreground">
          Hay posiciones empatadas en todos los criterios: se definieron por sorteo.
        </p>
      ) : null}

      {/* Modal interactivo con los nombres completos de ambos integrantes y estadísticas */}
      <Dialog open={selectedRow !== null} onOpenChange={(open) => !open && setSelectedRow(null)}>
        <DialogContent className="max-w-md p-5 sm:p-6 max-h-[90vh] overflow-y-auto">
          {selectedRow ? (
            <div className="space-y-5">
              <DialogHeader className="text-left space-y-1.5">
                <div className="flex items-center gap-2 flex-wrap">
                  <span
                    className={cn(
                      "inline-flex items-center gap-1 px-2 py-0.5 rounded-full text-xs font-semibold",
                      selectedRow.position <= qualifiers
                        ? "bg-emerald-200 text-emerald-950 dark:bg-emerald-950/70 dark:text-emerald-300 border border-emerald-400 dark:border-emerald-800"
                        : "bg-muted text-muted-foreground border",
                    )}
                  >
                    {selectedRow.position <= qualifiers ? (
                      <Trophy className="size-3 text-emerald-700 dark:text-emerald-400" />
                    ) : null}
                    {title} · Puesto #{selectedRow.position}
                  </span>
                  {selectedRow.position <= qualifiers ? (
                    <span className="text-[11px] font-semibold text-emerald-800 dark:text-emerald-400">
                      Zona de clasificación
                    </span>
                  ) : null}
                </div>
                <DialogTitle className="text-xl font-bold tracking-tight text-foreground">
                  {selectedTeamName}
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground">
                  Detalle de integrantes y rendimiento acumulado en la fase de grupos.
                </DialogDescription>
              </DialogHeader>

              {/* Nombres completos de ambos integrantes */}
              <div className="space-y-2 rounded-lg border bg-muted/30 p-3.5">
                <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground">
                  <Users className="size-4 text-primary" />
                  <span>Integrantes de la pareja</span>
                </div>
                <div className="grid gap-2">
                  {selectedMembers.length > 0 ? (
                    selectedMembers.map((member, idx) => (
                      <div
                        key={idx}
                        className="flex items-center gap-2.5 rounded-md bg-background px-3 py-2 border shadow-xs"
                      >
                        <div className="size-7 rounded-full bg-primary/10 text-primary flex items-center justify-center shrink-0">
                          <User className="size-4" />
                        </div>
                        <div className="min-w-0 flex-1">
                          <p className="text-[11px] text-muted-foreground leading-none">
                            Jugador {idx + 1}
                          </p>
                          <p className="text-sm font-medium text-foreground truncate mt-0.5">
                            {member}
                          </p>
                        </div>
                      </div>
                    ))
                  ) : (
                    <p className="text-xs text-muted-foreground">{selectedTeamName}</p>
                  )}
                </div>
              </div>

              {/* Estadísticas de la fase de grupos */}
              <div className="space-y-2">
                <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                  Estadísticas en fase de grupos
                </h4>
                <div className="grid grid-cols-4 gap-2 text-center">
                  <div className="rounded-lg border bg-card p-2.5 shadow-xs">
                    <p className="text-lg font-bold text-primary tabular-nums">{selectedRow.points}</p>
                    <p className="text-[11px] font-medium text-muted-foreground">Puntos</p>
                  </div>
                  <div className="rounded-lg border bg-card p-2.5 shadow-xs">
                    <p className="text-lg font-bold text-foreground tabular-nums">{selectedRow.played}</p>
                    <p className="text-[11px] font-medium text-muted-foreground">Jugados</p>
                  </div>
                  <div className="rounded-lg border bg-card p-2.5 shadow-xs">
                    <p className="text-lg font-bold text-emerald-600 dark:text-emerald-400 tabular-nums">
                      {selectedRow.won}
                    </p>
                    <p className="text-[11px] font-medium text-muted-foreground">Ganados</p>
                  </div>
                  <div className="rounded-lg border bg-card p-2.5 shadow-xs">
                    <p className="text-lg font-bold text-rose-600 dark:text-rose-400 tabular-nums">
                      {selectedRow.lost}
                    </p>
                    <p className="text-[11px] font-medium text-muted-foreground">Perdidos</p>
                  </div>
                </div>

                {scoringType === "sets" ? (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="rounded-lg border bg-card p-2.5 shadow-xs flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Sets (favor - contra)</p>
                        <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">
                          {selectedRow.setsFor} - {selectedRow.setsAgainst}
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-muted tabular-nums">
                        {value(selectedRow, "setDiff") >= 0 ? `+${value(selectedRow, "setDiff")}` : value(selectedRow, "setDiff")} DS
                      </span>
                    </div>

                    <div className="rounded-lg border bg-card p-2.5 shadow-xs flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Games (favor - contra)</p>
                        <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">
                          {selectedRow.gamesFor} - {selectedRow.gamesAgainst}
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-muted tabular-nums">
                        {value(selectedRow, "gameDiff") >= 0 ? `+${value(selectedRow, "gameDiff")}` : value(selectedRow, "gameDiff")} DG
                      </span>
                    </div>
                  </div>
                ) : (
                  <div className="grid grid-cols-2 gap-2 mt-2">
                    <div className="rounded-lg border bg-card p-2.5 shadow-xs flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Empatados</p>
                        <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">
                          {selectedRow.drawn}
                        </p>
                      </div>
                    </div>
                    <div className="rounded-lg border bg-card p-2.5 shadow-xs flex items-center justify-between">
                      <div>
                        <p className="text-xs font-medium text-muted-foreground">Goles (favor - contra)</p>
                        <p className="text-sm font-semibold text-foreground tabular-nums mt-0.5">
                          {selectedRow.goalsFor} - {selectedRow.goalsAgainst}
                        </p>
                      </div>
                      <span className="text-xs font-bold px-2 py-0.5 rounded bg-muted tabular-nums">
                        {value(selectedRow, "goalDiff") >= 0 ? `+${value(selectedRow, "goalDiff")}` : value(selectedRow, "goalDiff")} DG
                      </span>
                    </div>
                  </div>
                )}
              </div>

              {/* Partidos en este grupo */}
              {teamGroupMatches.length > 0 ? (
                <div className="space-y-2">
                  <h4 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider flex items-center gap-1.5">
                    <Calendar className="size-3.5" />
                    <span>Partidos en el grupo</span>
                  </h4>
                  <div className="space-y-1.5">
                    {teamGroupMatches.map((m) => {
                      const isHome = m.homeTeamId === selectedRow.teamId;
                      const rivalId = isHome ? m.awayTeamId : m.homeTeamId;
                      const rivalName = rivalId ? getTeamName(teamNames, rivalId) : "Rival";
                      const isFinished = m.resultStatus !== null;
                      const won = m.winnerTeamId === selectedRow.teamId;
                      const formattedScore = m.result ? formatResult(m.result) : null;

                      return (
                        <div
                          key={m.id}
                          className="flex items-center justify-between gap-2 rounded-md border bg-card p-2 text-xs"
                        >
                          <div className="min-w-0 flex-1">
                            <span className="text-[11px] font-semibold text-muted-foreground">
                              Fecha {m.round} ·{" "}
                            </span>
                            <span className="font-medium text-foreground truncate">
                              vs {rivalName}
                            </span>
                          </div>
                          <div>
                            {isFinished ? (
                              <div className="flex items-center gap-1.5">
                                {formattedScore ? (
                                  <span className="font-mono text-xs tabular-nums text-foreground">
                                    {formattedScore}
                                  </span>
                                ) : null}
                                <span
                                  className={cn(
                                    "inline-flex items-center gap-1 px-1.5 py-0.5 rounded text-[11px] font-semibold",
                                    won
                                      ? "bg-emerald-100 text-emerald-800 dark:bg-emerald-950/70 dark:text-emerald-300"
                                      : "bg-rose-100 text-rose-800 dark:bg-rose-950/70 dark:text-rose-300",
                                  )}
                                >
                                  {won ? (
                                    <>
                                      <CheckCircle2 className="size-3" />
                                      Ganó
                                    </>
                                  ) : (
                                    <>
                                      <XCircle className="size-3" />
                                      Perdió
                                    </>
                                  )}
                                </span>
                              </div>
                            ) : (
                              <span className="text-[11px] text-muted-foreground italic">
                                Pendiente
                              </span>
                            )}
                          </div>
                        </div>
                      );
                    })}
                  </div>
                </div>
              ) : null}

              <div className="pt-2">
                <Button
                  type="button"
                  variant="outline"
                  className="w-full h-10"
                  onClick={() => setSelectedRow(null)}
                >
                  Cerrar
                </Button>
              </div>
            </div>
          ) : null}
        </DialogContent>
      </Dialog>
    </section>
  );
}
