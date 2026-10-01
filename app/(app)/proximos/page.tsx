import { CalendarClock, MapPin } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
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
    <>
      <PageHeader title="Mis próximos partidos" description="Día, hora y cancha de lo que viene." />
      {days.length === 0 ? (
        <EmptyState
          icon={CalendarClock}
          title="No tenés partidos programados"
          description="Cuando el organizador programe tus partidos, van a aparecer acá."
        />
      ) : (
        <div className="space-y-6">
          {days.map((group) => {
            const headingId = `dia-${group.day ?? "sin-horario"}`;
            return (
              <section key={group.day ?? "sin-horario"} aria-labelledby={headingId} className="space-y-2">
                <h2 id={headingId} className="text-base font-semibold first-letter:uppercase">
                  {group.day ? formatDayHeading(group.day) : "Sin horario todavía"}
                </h2>
                <ul className="divide-y rounded-lg border">
                  {group.items.map((match) => (
                    <UpcomingItem key={match.matchId} match={match} />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      )}
    </>
  );
}

function UpcomingItem({ match }: { match: MyMatchRow }) {
  return (
    <li className="grid gap-1 px-3 py-3 sm:grid-cols-[9rem_1fr] sm:gap-4">
      <div className="text-sm">
        {match.startsAt && match.endsAt ? (
          <p className="font-medium tabular-nums">{formatTimeRange(match.startsAt, match.endsAt, match.timezone)}</p>
        ) : (
          <p className="text-muted-foreground">A confirmar</p>
        )}
      </div>
      <div className="min-w-0 space-y-1">
        <p className="text-sm font-medium">
          {match.myTeamName} <span className="font-normal text-muted-foreground">vs</span> {match.rivalName}
        </p>
        <p className="text-xs text-muted-foreground">
          <Link href={`/inscripciones/${match.myTeamId}`} className="underline-offset-4 hover:underline">
            {match.tournamentName}
          </Link>{" "}
          · {match.stageLabel}
        </p>
        {match.courtName ? (
          <p className="flex items-center gap-1 text-xs text-muted-foreground">
            <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
            {match.courtVenue ? `${match.courtName} · ${match.courtVenue}` : match.courtName}
          </p>
        ) : null}
      </div>
    </li>
  );
}
