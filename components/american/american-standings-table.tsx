"use client";

import { Award, Flame, Trophy } from "lucide-react";
import type { AmericanStandingRow } from "@/lib/data/american";
import { cn } from "@/lib/utils";

export function AmericanStandingsTable({
  standings,
  scoringMode = "fixed_points",
}: {
  standings: AmericanStandingRow[];
  scoringMode?: "fixed_points" | "timed_round" | "single_set";
}) {
  const isSingleSet = scoringMode === "single_set";

  if (standings.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
        <Trophy className="mx-auto size-8 text-muted-foreground/60 mb-2" />
        <p className="text-sm font-semibold text-foreground">Tabla de posiciones aún sin participantes</p>
        <p className="text-xs text-muted-foreground mt-1">
          Inscribí a los jugadores y generá el fixture para ver las posiciones en tiempo real.
        </p>
      </div>
    );
  }

  return (
    <div className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
      <div className="flex items-center justify-between border-b border-border/70 px-4 py-3 bg-muted/30">
        <div className="flex items-center gap-2">
          <Trophy className="size-4 text-emerald-600 dark:text-emerald-400" />
          <h3 className="text-sm font-bold text-foreground">Tabla de Posiciones en Vivo</h3>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground">
          {isSingleSet
            ? "Orden: Diferencia de games (+/-) · Partidos ganados · Games a favor"
            : scoringMode === "fixed_points"
              ? "Orden: Puntos acumulados · Dif (+/-)"
              : "Orden: Puntos por tiempo · Dif (+/-)"}
        </span>
      </div>

      <div className="overflow-x-auto [scrollbar-width:none]">
        <table className="w-full text-left text-xs">
          <thead>
            <tr className="border-b border-border/60 bg-muted/40 text-muted-foreground font-semibold">
              <th className="py-2.5 px-3 w-12 text-center">Pos</th>
              <th className="py-2.5 px-3">Jugador / Dupla</th>
              <th className="py-2.5 px-2 text-center w-12" title="Partidos Jugados">PJ</th>
              <th className="py-2.5 px-2 text-center w-12" title="Partidos Ganados">PG</th>
              <th className="py-2.5 px-2 text-center w-12" title="Partidos Perdidos">PP</th>
              <th
                className={cn(
                  "py-2.5 px-3 text-right w-16",
                  !isSingleSet ? "font-bold text-foreground" : "text-muted-foreground"
                )}
                title={isSingleSet ? "Games a Favor" : "Puntos a Favor"}
              >
                {isSingleSet ? "GF" : "PF"}
              </th>
              <th
                className="py-2.5 px-3 text-right text-muted-foreground w-16"
                title={isSingleSet ? "Games en Contra" : "Puntos en Contra"}
              >
                {isSingleSet ? "GC" : "PC"}
              </th>
              <th
                className={cn(
                  "py-2.5 px-3 text-right w-20",
                  isSingleSet ? "font-extrabold text-foreground" : "font-bold"
                )}
                title={isSingleSet ? "Diferencia de Games (Puntos netos)" : "Diferencia de Puntos"}
              >
                {isSingleSet ? "DIF (PTS)" : "DIF"}
              </th>
            </tr>
          </thead>
          <tbody className="divide-y divide-border/50">
            {standings.map((row, idx) => {
              const pos = idx + 1;
              const isFirst = pos === 1;

              return (
                <tr
                  key={row.participantId}
                  className={cn(
                    "transition-colors hover:bg-muted/40",
                    isFirst && "bg-emerald-500/[0.04] font-medium"
                  )}
                >
                  <td className="py-2.5 px-3 text-center">
                    {pos === 1 ? (
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 font-extrabold text-xs">
                        1°
                      </span>
                    ) : pos === 2 ? (
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-slate-500/15 text-slate-600 dark:text-slate-300 font-extrabold text-xs">
                        2°
                      </span>
                    ) : pos === 3 ? (
                      <span className="inline-flex size-6 items-center justify-center rounded-full bg-amber-700/15 text-amber-700 dark:text-amber-500 font-extrabold text-xs">
                        3°
                      </span>
                    ) : (
                      <span className="text-muted-foreground font-semibold">{pos}°</span>
                    )}
                  </td>
                  <td className="py-2.5 px-3">
                    <div className="flex items-center gap-1.5">
                      {isFirst && <Flame className="size-3.5 text-amber-500 shrink-0" />}
                      <span className="font-semibold text-foreground text-sm">
                        {row.displayName}
                      </span>
                      {row.secondaryDisplayName && (
                        <span className="text-xs text-muted-foreground">
                          / {row.secondaryDisplayName}
                        </span>
                      )}
                    </div>
                  </td>
                  <td className="py-2.5 px-2 text-center text-muted-foreground font-medium">{row.played}</td>
                  <td className="py-2.5 px-2 text-center font-semibold text-emerald-600 dark:text-emerald-400">{row.won}</td>
                  <td className="py-2.5 px-2 text-center text-muted-foreground">{row.lost}</td>
                  <td
                    className={cn(
                      "py-2.5 px-3 text-right text-sm",
                      !isSingleSet ? "font-extrabold text-foreground" : "text-muted-foreground"
                    )}
                  >
                    {row.pointsFor}
                  </td>
                  <td className="py-2.5 px-3 text-right text-muted-foreground">{row.pointsAgainst}</td>
                  <td className="py-2.5 px-3 text-right">
                    <span
                      className={cn(
                        "rounded px-2 py-0.5 text-xs font-bold",
                        row.pointDiff > 0
                          ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 font-extrabold text-sm"
                          : row.pointDiff < 0
                            ? "bg-destructive/15 text-destructive"
                            : "text-muted-foreground"
                      )}
                    >
                      {row.pointDiff > 0 ? `+${row.pointDiff}` : row.pointDiff}
                    </span>
                  </td>
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}

