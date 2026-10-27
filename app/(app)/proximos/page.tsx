import { Calendar, CalendarClock, ChevronRight, Clock, MapPin, Swords, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import { type MyMatchRow, getMyMatches } from "@/lib/data/history";
import { formatDayHeading, formatTimeRange, groupByLocalDay } from "@/lib/dates";

export const metadata: Metadata = { title: "Mis próximos partidos" };

/**
 * Partidos sin resultado de torneos en curso, por día (cada uno en la zona
 * de su torneo). Los que todavía no tienen horario van al final.
 */
export default async function UpcomingMatchesPage() {
  const user = await getCurrentUser();
  if (!user) return null; // El layout ya redirige; esto solo acota el tipo.

  const { matches } = await getMyMatches(user.id);
  const upcoming = matches.filter(
    (m) => m.resultText === null && (m.tournamentStatus === "group_stage" || m.tournamentStatus === "playoffs"),
  );
  const days = groupByLocalDay(upcoming, (m) => m.timezone);

  return (
    <div className="space-y-6">
      <PageHeader title="Mis próximos partidos" description="Día, hora y cancha de lo que viene." />
      {days.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No tenés partidos programados"
          description="Cuando el organizador programe tus partidos, van a aparecer acá."
        />
      ) : (
        <div className="space-y-8">
          {days.map((group) => {
            const headingId = `dia-${group.day ?? "sin-horario"}`;
            return (
              <section key={group.day ?? "sin-horario"} aria-labelledby={headingId} className="space-y-3">
                {/* Cabecera del día con estilo moderno y destacado */}
                <div className="flex items-center gap-2.5 border-b border-border/60 pb-2">
                  <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-500 dark:text-emerald-400 border border-emerald-500/30">
                    <Calendar className="size-4" aria-hidden="true" />
                  </div>
                  <h2 id={headingId} className="text-base sm:text-lg font-bold text-foreground capitalize tracking-tight">
                    {group.day ? formatDayHeading(group.day) : "Sin horario todavía"}
                  </h2>
                  <Badge variant="outline" className="text-xs font-medium text-muted-foreground ml-auto">
                    {group.items.length} {group.items.length === 1 ? "partido" : "partidos"}
                  </Badge>
                </div>

                {/* Lista de tarjetas de partidos */}
                <div className="grid grid-cols-1 gap-3.5">
                  {group.items.map((match) => (
                    <UpcomingMatchCard key={match.matchId} match={match} />
                  ))}
                </div>
              </section>
            );
          })}
        </div>
      )}
    </div>
  );
}

function UpcomingMatchCard({ match }: { match: MyMatchRow }) {
  const hasSchedule = Boolean(match.startsAt && match.endsAt);

  return (
    <article className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs hover:border-emerald-500/40 hover:shadow-md transition-all space-y-3.5">
      {/* Fila superior: Torneo/Fase a la izquierda, Horario destacado a la derecha */}
      <div className="flex flex-wrap items-center justify-between gap-2 border-b border-border/50 pb-2.5">
        <div className="flex flex-wrap items-center gap-1.5 min-w-0">
          <Link
            href={`/t/${match.tournamentSlug}`}
            className="inline-flex items-center gap-1.5 text-xs font-bold text-foreground hover:text-emerald-400 transition-colors truncate"
          >
            <Trophy className="size-3.5 text-emerald-400 shrink-0" aria-hidden="true" />
            <span className="truncate">{match.tournamentName}</span>
          </Link>
          <span className="text-muted-foreground/60 text-xs">·</span>
          <span className="text-xs font-medium text-muted-foreground truncate">{match.stageLabel}</span>
        </div>

        {/* Horario destacado con pill de color */}
        {hasSchedule ? (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-3 py-1 text-xs sm:text-sm font-mono font-bold text-emerald-400 dark:text-emerald-300 tabular-nums shadow-2xs">
            <Clock className="size-3.5 text-emerald-400" aria-hidden="true" />
            <span>{formatTimeRange(match.startsAt!, match.endsAt!, match.timezone)}</span>
          </div>
        ) : (
          <div className="inline-flex items-center gap-1.5 rounded-full bg-amber-500/10 border border-amber-500/30 px-2.5 py-1 text-xs font-medium text-amber-400">
            <Clock className="size-3 text-amber-400" aria-hidden="true" />
            <span>Horario a confirmar</span>
          </div>
        )}
      </div>

      {/* Enfrentamiento deportivo: Tu equipo vs Rival con colores e identidad visual */}
      <div className="grid grid-cols-1 md:grid-cols-[1fr_auto_1fr] items-center gap-3 rounded-xl bg-muted/30 border border-border/60 p-3.5">
        {/* Tu Equipo (con acento esmeralda) */}
        <div className="flex items-center gap-3 min-w-0">
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-emerald-500/15 text-emerald-400 border border-emerald-500/30 font-bold">
            <Users className="size-4.5" aria-hidden="true" />
          </div>
          <div className="min-w-0 space-y-0.5">
            <span className="text-[11px] font-bold text-emerald-400 uppercase tracking-wider block">
              Tu equipo
            </span>
            <p className="text-sm sm:text-base font-bold text-foreground truncate" title={match.myTeamName}>
              {match.myTeamName}
            </p>
          </div>
        </div>

        {/* Separador central VS */}
        <div className="flex items-center justify-center py-0.5 md:py-0">
          <span className="inline-flex items-center justify-center size-7 rounded-full bg-background border border-border/80 text-[11px] font-black text-muted-foreground uppercase shadow-2xs">
            VS
          </span>
        </div>

        {/* Rival (con acento azul cielo/sky) */}
        <div className="flex items-center gap-3 min-w-0 md:justify-end md:text-right">
          <div className="min-w-0 space-y-0.5 order-2 md:order-1">
            <span className="text-[11px] font-bold text-sky-400 uppercase tracking-wider block">
              Rival
            </span>
            <p className="text-sm sm:text-base font-bold text-foreground truncate" title={match.rivalName}>
              {match.rivalName || "Rival a definir"}
            </p>
          </div>
          <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-sky-500/15 text-sky-400 border border-sky-500/30 font-bold order-1 md:order-2">
            <Swords className="size-4.5" aria-hidden="true" />
          </div>
        </div>
      </div>

      {/* Fila inferior: Cancha/Sede y Botón para ver el torneo */}
      <div className="flex flex-wrap items-center justify-between gap-2 pt-0.5">
        <div className="flex flex-wrap items-center gap-2">
          {match.courtName ? (
            <Badge
              variant="outline"
              className="text-xs font-semibold text-emerald-300 bg-emerald-500/10 border-emerald-500/30 gap-1.5 px-2.5 py-1"
            >
              <MapPin className="size-3 text-emerald-400 shrink-0" aria-hidden="true" />
              <span>
                {match.courtName}
                {match.courtVenue ? ` · ${match.courtVenue}` : ""}
              </span>
            </Badge>
          ) : (
            <Badge variant="outline" className="text-xs font-medium text-muted-foreground gap-1.5 px-2.5 py-1">
              <MapPin className="size-3 text-muted-foreground shrink-0" aria-hidden="true" />
              <span>Cancha a confirmar</span>
            </Badge>
          )}

          <Badge variant="secondary" className="text-xs font-medium text-muted-foreground px-2.5 py-1">
            {match.sportName}
          </Badge>
        </div>

        <Link
          href={`/t/${match.tournamentSlug}`}
          className="inline-flex items-center gap-1 text-xs font-semibold text-primary hover:text-primary/80 transition-colors group ml-auto cursor-pointer"
        >
          <span>Ver torneo</span>
          <ChevronRight className="size-3.5 transition-transform group-hover:translate-x-0.5" aria-hidden="true" />
        </Link>
      </div>
    </article>
  );
}
