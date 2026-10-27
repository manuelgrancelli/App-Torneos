import { Calendar, Clock, MapPin, Trophy } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { type CategoryColorTheme, getCategoryColorByName } from "@/lib/category-colors";
import { type DayGroup, formatDayHeading, formatTimeRange } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type FixtureItem = {
  id: string;
  categoryName?: string | null;
  categoryColor?: CategoryColorTheme | null;
  section: string;
  homeName: string;
  awayName: string;
  homeWon: boolean;
  awayWon: boolean;
  startsAt: string | null;
  endsAt: string | null;
  courtLabel: string | null;
  courtName?: string | null;
  resultText: string | null;
};

/** Fixture público por día con tarjetas compactas y datos clave destacados. */
export function PublicFixture({
  days,
  timezone,
}: {
  days: DayGroup<FixtureItem>[];
  timezone: string;
  tournamentName?: string;
  sportName?: string;
}) {
  return (
    <div className="space-y-4">
      {days.map((group) => {
        const headingId = `dia-${group.day ?? "sin-horario"}`;
        return (
          <section key={group.day ?? "sin-horario"} aria-labelledby={headingId} className="space-y-2">
            {/* Cabecera del día compacta */}
            <div className="flex items-center gap-2 border-b border-border/50 pb-1.5">
              <div className="flex size-6 items-center justify-center rounded-md bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30">
                <Calendar className="size-3.5" aria-hidden="true" />
              </div>
              <h3 id={headingId} className="text-sm sm:text-base font-bold text-foreground capitalize tracking-tight">
                {group.day ? formatDayHeading(group.day) : "Sin horario asignado"}
              </h3>
              <Badge variant="outline" className="text-[11px] font-medium text-muted-foreground ml-auto px-2 py-0">
                {group.items.length} {group.items.length === 1 ? "partido" : "partidos"}
              </Badge>
            </div>

            {/* Lista de tarjetas compactas de partidos */}
            <div className="grid grid-cols-1 gap-2">
              {group.items.map((match) => (
                <PublicFixtureCard key={match.id} match={match} timezone={timezone} />
              ))}
            </div>
          </section>
        );
      })}
    </div>
  );
}

function PublicFixtureCard({ match, timezone }: { match: FixtureItem; timezone: string }) {
  const hasSchedule = Boolean(match.startsAt && match.endsAt);
  const isHomeUndefined = match.homeName.trim().toLowerCase() === "a definir";
  const isAwayUndefined = match.awayName.trim().toLowerCase() === "a definir";
  const color = match.categoryColor ?? (match.categoryName ? getCategoryColorByName(match.categoryName) : null);

  return (
    <article
      className={cn(
        "rounded-xl border border-border/70 bg-card p-2.5 sm:p-3 shadow-2xs hover:border-border transition-all space-y-2",
        color ? `border-l-4 ${color.borderLeft}` : "",
      )}
    >
      {/* Fila superior: Categoría y Etapa a la izquierda, Horario a la derecha */}
      <div className="flex items-center justify-between gap-2">
        <div className="flex items-center gap-1.5 min-w-0">
          {match.categoryName ? (
            <Badge
              variant="outline"
              className={cn(
                "font-bold text-[10px] px-2 py-0.5 rounded-full shrink-0 border",
                color?.badge ?? "border-primary/40 bg-primary/10 text-primary",
              )}
            >
              {match.categoryName}
            </Badge>
          ) : null}
          <span className="text-xs font-medium text-muted-foreground truncate">{match.section}</span>
        </div>

        {/* Horario destacado */}
        {hasSchedule ? (
          <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-400 dark:text-emerald-300 tabular-nums shrink-0">
            <Clock className="size-3 text-emerald-400" aria-hidden="true" />
            <span>{formatTimeRange(match.startsAt!, match.endsAt!, timezone)}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-[11px] font-medium text-amber-400 shrink-0">
            <Clock className="size-3 text-amber-400" aria-hidden="true" />
            <span>A confirmar</span>
          </div>
        )}
      </div>

      {/* Enfrentamiento deportivo: nombres centrados con separador sutil vs */}
      <div className="rounded-lg bg-muted/20 border border-border/40 px-3 py-2 space-y-1.5">
        {/* Equipo Local */}
        <div className="flex items-center justify-center gap-1.5 min-w-0 w-full text-center">
          {match.homeWon ? (
            <Trophy className="size-3.5 shrink-0 text-amber-400" aria-label="Ganador" />
          ) : null}
          <span
            className={cn(
              "text-xs sm:text-sm truncate text-center",
              match.homeWon
                ? "font-extrabold text-emerald-400 dark:text-emerald-300"
                : "font-semibold text-foreground",
              isHomeUndefined && "text-muted-foreground italic font-normal",
            )}
            title={match.homeName}
          >
            {match.homeName}
          </span>
          {match.homeWon ? (
            <Trophy className="size-3.5 shrink-0 text-amber-400 opacity-0 pointer-events-none" aria-hidden="true" />
          ) : null}
        </div>

        {/* Separador sutil con VS en gris claro, en flujo normal para evitar cualquier superposición */}
        <div className="flex items-center justify-center gap-2.5 px-2 my-0.5" aria-hidden="true">
          <div className="h-px flex-1 bg-border/40" />
          <span className="text-[10px] font-semibold uppercase tracking-widest text-muted-foreground/80 shrink-0 select-none">
            vs
          </span>
          <div className="h-px flex-1 bg-border/40" />
        </div>

        {/* Equipo Visitante */}
        <div className="flex items-center justify-center gap-1.5 min-w-0 w-full text-center">
          {match.awayWon ? (
            <Trophy className="size-3.5 shrink-0 text-amber-400" aria-label="Ganador" />
          ) : null}
          <span
            className={cn(
              "text-xs sm:text-sm truncate text-center",
              match.awayWon
                ? "font-extrabold text-emerald-400 dark:text-emerald-300"
                : "font-semibold text-foreground",
              isAwayUndefined && "text-muted-foreground italic font-normal",
            )}
            title={match.awayName}
          >
            {match.awayName}
          </span>
          {match.awayWon ? (
            <Trophy className="size-3.5 shrink-0 text-amber-400 opacity-0 pointer-events-none" aria-hidden="true" />
          ) : null}
        </div>
      </div>

      {/* Fila inferior: Cancha y Estado / Resultado */}
      <div className="flex items-center justify-between gap-2 text-[11px] text-muted-foreground px-0.5">
        <div className="flex items-center gap-1 min-w-0">
          <MapPin
            className={cn("size-3 shrink-0", match.courtLabel ? "text-emerald-400" : "text-muted-foreground")}
            aria-hidden="true"
          />
          <span className={cn("truncate font-medium", match.courtLabel && "text-emerald-300/90")}>
            {match.courtLabel ?? "Cancha a confirmar"}
          </span>
        </div>

        <div className="flex items-center gap-1.5 shrink-0">
          {match.resultText ? (
            <>
              <span className="inline-flex items-center justify-center rounded bg-emerald-500/15 border border-emerald-500/30 px-2 py-0.5 text-xs font-mono font-bold text-emerald-400 dark:text-emerald-300 tabular-nums">
                {match.resultText}
              </span>
              <span className="text-emerald-400 font-medium">Finalizado</span>
            </>
          ) : (
            <span className="text-muted-foreground font-medium">Por jugar</span>
          )}
        </div>
      </div>
    </article>
  );
}
