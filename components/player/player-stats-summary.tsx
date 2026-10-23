import { Medal, Swords, Users } from "lucide-react";
import type { PlayerStats } from "@/lib/domain/stats";

/** KPIs de "Mi perfil" para la cuenta de jugador (D-122): torneos, partidos y títulos. */
export function PlayerStatsSummary({ tournaments, stats }: { tournaments: number; stats: PlayerStats }) {
  const items = [
    { label: "Torneos donde juego", value: tournaments, detail: null, icon: Users },
    {
      label: "Partidos jugados",
      value: stats.played,
      detail: stats.played > 0 ? `${stats.won} ganados · ${stats.winRate}%` : "Todavía sin resultados",
      icon: Swords,
    },
    { label: "Títulos", value: stats.titles, detail: stats.titles > 0 ? "¡Campeón!" : null, icon: Medal },
  ];

  return (
    <section aria-labelledby="mis-numeros" className="space-y-4">
      <h2 id="mis-numeros" className="text-xl font-semibold tracking-tight">
        Mis números
      </h2>
      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {items.map((item) => (
          <div key={item.label} className="rounded-2xl border-2 border-border bg-card p-4 shadow-2xs">
            <div className="flex items-center justify-between">
              <span className="text-xs font-medium text-muted-foreground">{item.label}</span>
              <span className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary border border-border/50">
                <item.icon className="size-4" aria-hidden="true" />
              </span>
            </div>
            <p className="mt-2 flex items-baseline gap-2">
              <span className="font-mono text-2xl font-bold tabular-nums">{item.value}</span>
              {item.detail ? <span className="text-xs text-muted-foreground">{item.detail}</span> : null}
            </p>
          </div>
        ))}
      </div>
    </section>
  );
}
