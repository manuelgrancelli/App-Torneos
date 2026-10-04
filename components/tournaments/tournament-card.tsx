import { CalendarDays, ChevronRight, Users } from "lucide-react";
import Link from "next/link";
import type { ParticipationItem, TournamentListItem } from "@/lib/data/tournaments";
import { formatDateRange } from "@/lib/dates";
import { approvedTeamsLabel } from "@/lib/domain/tournament-status";
import { StatusBadge, TeamStatusBadge } from "./status-badge";

const cardClass =
  "group flex items-center gap-3 rounded-xl border bg-card p-4 transition-colors hover:bg-muted/50 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring";

/** Tarjeta de un torneo que organiza el usuario. */
export function OrganizedTournamentCard({ tournament }: { tournament: TournamentListItem }) {
  return (
    <Link href={`/torneos/${tournament.id}`} className={cardClass}>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-medium">{tournament.name}</h3>
          <StatusBadge status={tournament.status} />
        </div>
        <p className="text-sm text-muted-foreground">{tournament.sportName}</p>
        <div className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-4" aria-hidden="true" />
            {formatDateRange(tournament.startsOn, tournament.endsOn)}
          </span>
          <span className="inline-flex items-center gap-1">
            <Users className="size-4" aria-hidden="true" />
            {tournament.approvedTeams} de {tournament.maxTeams} {approvedTeamsLabel(tournament.teamSize)}
            {tournament.pendingTeams > 0 ? ` · ${tournament.pendingTeams} pendientes` : ""}
          </span>
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}

/** Tarjeta de un torneo donde el usuario juega. */
export function ParticipationCard({ participation }: { participation: ParticipationItem }) {
  const { tournament } = participation;
  return (
    <Link href={`/inscripciones/${participation.teamId}`} className={cardClass}>
      <div className="min-w-0 flex-1 space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <h3 className="truncate font-medium">{tournament.name}</h3>
          <StatusBadge status={tournament.status} />
        </div>
        <p className="text-sm text-muted-foreground">
          {tournament.sportName} · {participation.teamName}
        </p>
        <div className="flex flex-wrap items-center gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-4" aria-hidden="true" />
            {formatDateRange(tournament.startsOn, tournament.endsOn)}
          </span>
          <TeamStatusBadge status={participation.teamStatus} />
        </div>
      </div>
      <ChevronRight className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
    </Link>
  );
}
