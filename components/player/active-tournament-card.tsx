import { CalendarClock, ChevronRight, Clock, MapPin, Swords, Users } from "lucide-react";
import Link from "next/link";
import { StatusBadge, TeamStatusBadge, getSportEmoji } from "@/components/tournaments/status-badge";
import type { MyMatchRow } from "@/lib/data/history";
import type { ParticipationItem } from "@/lib/data/tournaments";
import { formatInTimeZone } from "@/lib/dates";

type Props = {
  participation: ParticipationItem;
  /** Próximo partido del equipo (sin resultado), si hay. */
  nextMatch: MyMatchRow | null;
  record?: { played: number; won: number };
};

/**
 * Tarjeta destacada del inicio del jugador (D-122, D-173): un torneo en curso
 * con su información esencial, estado y próximo partido en formato rectangular estilizado.
 */
export function ActiveTournamentCard({ participation, nextMatch }: Props) {
  const { tournament } = participation;
  const playing = tournament.status === "group_stage" || tournament.status === "playoffs";

  return (
    <Link
      href={`/inscripciones/${participation.teamId}`}
      className="group relative block overflow-hidden rounded-2xl border border-border/80 bg-gradient-to-br from-card via-card/95 to-primary/5 p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/60 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/70 bg-background/80 shadow-2xs text-xl">
            <span role="img" aria-label={tournament.sportName}>
              {getSportEmoji(tournament.sportName)}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight text-foreground group-hover:text-primary transition-colors sm:text-lg">
              {tournament.name}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              Tu equipo: <span className="font-medium text-foreground">{participation.teamName}</span>
            </p>
          </div>
        </div>
        <StatusBadge status={tournament.status} className="shrink-0" />
      </div>

      <div className="mt-3.5 rounded-xl border border-border/70 bg-background/60 p-3 text-sm backdrop-blur-xs transition-colors group-hover:border-primary/20">
        {participation.teamStatus === "pending" ? (
          <p className="flex items-start gap-2 text-xs sm:text-sm text-amber-900 dark:text-amber-200">
            <Clock className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span>
              Inscripción pendiente de aprobación. Si tu pareja todavía no aceptó, entrá y mandale la invitación.
            </span>
          </p>
        ) : participation.teamStatus === "rejected" ? (
          <p className="text-xs sm:text-sm text-red-800 dark:text-red-300">
            El organizador rechazó la inscripción. Entrá para revisarla.
          </p>
        ) : !playing ? (
          <p className="flex items-start gap-2 text-xs sm:text-sm text-muted-foreground">
            <Users className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Ya estás adentro. Los grupos y horarios se publican cuando cierre la inscripción.</span>
          </p>
        ) : nextMatch ? (
          <div className="space-y-1.5">
            <div className="flex items-center justify-between gap-2">
              <span className="flex items-center gap-1.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
                <Swords className="size-3.5 text-primary" aria-hidden="true" />
                Próximo partido
              </span>
              {nextMatch.stageLabel ? (
                <span className="text-[11px] font-medium text-muted-foreground/80 truncate">
                  {nextMatch.stageLabel}
                </span>
              ) : null}
            </div>
            <p className="font-semibold text-foreground text-sm sm:text-base truncate">
              vs {nextMatch.rivalName}
            </p>
            <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-xs text-muted-foreground pt-0.5">
              <span className="inline-flex items-center gap-1.5 font-medium">
                <CalendarClock className="size-3.5 text-primary/80" aria-hidden="true" />
                {nextMatch.startsAt
                  ? formatInTimeZone(nextMatch.startsAt, nextMatch.timezone, "EEEE d/M · HH:mm")
                  : "Horario a confirmar"}
              </span>
              {nextMatch.courtName ? (
                <span className="inline-flex items-center gap-1 font-medium">
                  <MapPin className="size-3.5 text-primary/80" aria-hidden="true" />
                  {nextMatch.courtName}
                </span>
              ) : null}
            </div>
          </div>
        ) : (
          <p className="text-xs sm:text-sm text-muted-foreground">No tenés partidos pendientes por ahora.</p>
        )}
      </div>

      <div className="mt-3 flex items-center justify-between gap-2 text-xs text-muted-foreground">
        {participation.teamStatus !== "approved" ? (
          <TeamStatusBadge status={participation.teamStatus} />
        ) : (
          <span />
        )}
        <span className="inline-flex items-center gap-1 font-medium text-foreground group-hover:text-primary transition-colors">
          Ver mi progreso
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
