import { Trophy } from "lucide-react";
import { type DayGroup, formatDayHeading, formatTimeRange } from "@/lib/dates";
import { cn } from "@/lib/utils";

export type FixtureItem = {
  id: string;
  section: string;
  homeName: string;
  awayName: string;
  homeWon: boolean;
  awayWon: boolean;
  startsAt: string | null;
  endsAt: string | null;
  courtLabel: string | null;
  resultText: string | null;
};

/** Fixture público por día (en la zona del torneo); los partidos sin horario van al final. */
export function PublicFixture({ days, timezone }: { days: DayGroup<FixtureItem>[]; timezone: string }) {
  return (
    <div className="space-y-6">
      {days.map((group) => {
        const headingId = `dia-${group.day ?? "sin-horario"}`;
        return (
          <section key={group.day ?? "sin-horario"} aria-labelledby={headingId} className="space-y-2">
            <h3 id={headingId} className="text-sm font-semibold first-letter:uppercase">
              {group.day ? formatDayHeading(group.day) : "Sin horario"}
            </h3>
            <ul className="divide-y rounded-lg border">
              {group.items.map((match) => (
                <li key={match.id} className="grid gap-1 px-3 py-2.5 sm:grid-cols-[8rem_1fr_auto] sm:items-center sm:gap-4">
                  <div className="text-xs text-muted-foreground">
                    {match.startsAt && match.endsAt ? (
                      <span className="font-medium text-foreground tabular-nums">
                        {formatTimeRange(match.startsAt, match.endsAt, timezone)}
                      </span>
                    ) : null}
                    {match.courtLabel ? <span className="block">{match.courtLabel}</span> : null}
                  </div>
                  <div className="min-w-0 space-y-0.5">
                    <p className="text-xs text-muted-foreground">{match.section}</p>
                    <p className="text-sm">
                      <TeamName name={match.homeName} won={match.homeWon} />
                      <span className="px-1.5 text-muted-foreground">vs</span>
                      <TeamName name={match.awayName} won={match.awayWon} />
                    </p>
                  </div>
                  <p className={cn("text-sm tabular-nums", match.resultText ? "font-medium" : "text-muted-foreground")}>
                    {match.resultText ?? "Por jugar"}
                  </p>
                </li>
              ))}
            </ul>
          </section>
        );
      })}
    </div>
  );
}

function TeamName({ name, won }: { name: string; won: boolean }) {
  return (
    <span className={cn(won && "font-semibold")}>
      {won ? <Trophy className="mr-1 inline size-3.5 align-[-2px] text-amber-600" aria-label="Ganador" /> : null}
      {name}
    </span>
  );
}
