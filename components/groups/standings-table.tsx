import { Dices } from "lucide-react";
import type { StandingRow } from "@/lib/domain/standings";
import { cn } from "@/lib/utils";

type StandingsTableProps = {
  title: string;
  rows: StandingRow[];
  teamNames: Map<string, string>;
  scoringType: "sets" | "goals";
  /** Puestos que clasifican (se resaltan). */
  qualifiers?: number;
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

/** Tabla de posiciones de un grupo: columna de equipo fija y scroll horizontal en mobile. */
export function StandingsTable({ title, rows, teamNames, scoringType, qualifiers = 0 }: StandingsTableProps) {
  const columns = COLUMNS[scoringType];
  const lottery = rows.some((r) => r.decidedByLottery && r.played > 0);

  return (
    <section className="space-y-2">
      {/* Región enfocable: con teclado también se puede desplazar en horizontal. */}
      <div
        className="overflow-x-auto rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        role="region"
        aria-label={`Posiciones: ${title}`}
        tabIndex={0}
      >
        <table className="w-full border-collapse text-sm">
          <caption className="px-3 py-2 text-left font-semibold">{title}</caption>
          <thead className="bg-muted/50">
            <tr>
              <th scope="col" className="sticky left-0 z-10 bg-muted px-3 py-2 text-left font-medium">
                Equipo
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
            {rows.map((row) => (
              <tr
                key={row.teamId}
                className={cn(
                  "border-t",
                  row.position <= qualifiers &&
                    "bg-emerald-200 text-emerald-950 dark:bg-emerald-950/50 dark:text-emerald-100",
                )}
              >
                <th
                  scope="row"
                  className={cn(
                    "sticky left-0 z-10 max-w-44 px-3 py-2 text-left font-medium",
                    row.position <= qualifiers
                      ? "bg-emerald-200 dark:bg-emerald-950"
                      : "bg-background",
                  )}
                >
                  <span className="flex items-center gap-2">
                    <span className="w-4 text-muted-foreground tabular-nums">{row.position}</span>
                    <span className="truncate">{teamNames.get(row.teamId) ?? "Equipo"}</span>
                    {row.decidedByLottery && row.played > 0 ? (
                      <Dices className="size-3.5 shrink-0 text-muted-foreground" aria-label="Posición definida por sorteo" />
                    ) : null}
                  </span>
                </th>
                {columns.map((c) => (
                  <td
                    key={c.key}
                    className={cn("px-2 py-2 text-right tabular-nums", c.key === "points" && "font-semibold")}
                  >
                    {signed(c.key, value(row, c.key))}
                  </td>
                ))}
              </tr>
            ))}
          </tbody>
        </table>
      </div>
      {lottery ? (
        <p className="text-xs text-muted-foreground">
          Hay posiciones empatadas en todos los criterios: se definieron por sorteo.
        </p>
      ) : null}
    </section>
  );
}
