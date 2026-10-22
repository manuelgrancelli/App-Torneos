import { CalendarClock, ChevronRight, Clock, MapPin, Swords, Users } from "lucide-react";
import Link from "next/link";
import { StatusBadge, TeamStatusBadge, getSportEmoji } from "@/components/tournaments/status-badge";
import type { MyMatchRow } from "@/lib/data/history";
import type { ParticipationItem } from "@/lib/data/tournaments";
import { formatInTimeZone } from "@/lib/dates";
import { PlayerStepper } from "./player-stepper";

type Props = {
  participation: ParticipationItem;
  /** Próximo partido del equipo (sin resultado), si hay. */
  nextMatch: MyMatchRow | null;
  record: { played: number; won: number };
};

/**
 * Tarjeta destacada del inicio del jugador (D-122): un torneo en curso con su
 * etapa, el estado de la inscripción y el próximo partido. Lleva a la vista
 * de progreso completa (/inscripciones/[teamId]).
 */
export function ActiveTournamentCard({ participation, nextMatch, record }: Props) {
  const { tournament } = participation;
  const playing = tournament.status === "group_stage" || tournament.status === "playoffs";

  return (
    <Link
      href={`/inscripciones/${participation.teamId}`}
      className="group block space-y-4 rounded-2xl border border-primary/25 bg-gradient-to-br from-primary/5 via-card to-card p-4 shadow-xs transition-all hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring sm:p-5"
    >
      <div className="flex items-start justify-between gap-3">
        <div className="flex min-w-0 items-center gap-3">
          <div className="flex size-11 shrink-0 items-center justify-center rounded-xl border border-border/60 bg-background text-xl">
            <span role="img" aria-label={tournament.sportName}>
              {getSportEmoji(tournament.sportName)}
            </span>
          </div>
          <div className="min-w-0">
            <h3 className="truncate text-base font-semibold tracking-tight group-hover:text-primary sm:text-lg">
              {tournament.name}
            </h3>
            <p className="truncate text-xs text-muted-foreground">
              Tu equipo: <span className="font-medium text-foreground">{participation.teamName}</span>
            </p>
          </div>
        </div>
        <StatusBadge status={tournament.status} className="shrink-0" />
      </div>

      <PlayerStepper status={tournament.status} />

      <div className="rounded-xl border border-border/60 bg-background/70 p-3 text-sm">
        {participation.teamStatus === "pending" ? (
          <p className="flex items-start gap-2 text-amber-900 dark:text-amber-200">
            <Clock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>
              Inscripción pendiente de aprobación. Si tu pareja todavía no aceptó, entrá y mandale la invitación.
            </span>
          </p>
        ) : participation.teamStatus === "rejected" ? (
          <p className="text-red-800 dark:text-red-300">El organizador rechazó la inscripción. Entrá para revisarla.</p>
        ) : !playing ? (
          <p className="flex items-start gap-2 text-muted-foreground">
            <Users className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
            <span>Ya estás adentro. Los grupos y horarios se publican cuando cierre la inscripción.</span>
          </p>
        ) : nextMatch ? (
          <div className="space-y-1">
            <p className="text-[11px] font-semibold uppercase tracking-wide text-muted-foreground">Próximo partido</p>
            <p className="flex items-center gap-1.5 font-medium">
              <Swords className="size-4 shrink-0 text-primary" aria-hidden="true" />
              vs {nextMatch.rivalName}
              <span className="font-normal text-muted-foreground">· {nextMatch.stageLabel}</span>
            </p>
            <p className="flex flex-wrap items-center gap-x-3 gap-y-0.5 text-xs text-muted-foreground">
              <span className="inline-flex items-center gap-1">
                <CalendarClock className="size-3.5" aria-hidden="true" />
                {nextMatch.startsAt
                  ? formatInTimeZone(nextMatch.startsAt, nextMatch.timezone, "EEEE d/M · HH:mm")
                  : "Horario a confirmar"}
              </span>
              {nextMatch.courtName ? (
                <span className="inline-flex items-center gap-1">
                  <MapPin className="size-3.5" aria-hidden="true" />
                  {nextMatch.courtName}
                </span>
              ) : null}
            </p>
          </div>
        ) : (
          <p className="text-muted-foreground">No tenés partidos pendientes por ahora.</p>
        )}
      </div>

      <div className="flex items-center justify-between gap-2 text-xs text-muted-foreground">
        <span className="flex items-center gap-2">
          <TeamStatusBadge status={participation.teamStatus} />
          {record.played > 0 ? (
            <span className="tabular-nums">
              {record.played} PJ · {record.won} G
            </span>
          ) : null}
        </span>
        <span className="inline-flex items-center gap-1 font-medium text-foreground group-hover:text-primary">
          Ver mi progreso
          <ChevronRight className="size-4 transition-transform group-hover:translate-x-1" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}
