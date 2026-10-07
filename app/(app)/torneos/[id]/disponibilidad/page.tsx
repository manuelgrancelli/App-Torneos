import { CalendarX, Check, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { getAvailabilityMatrix } from "@/lib/data/teams";
import { formatDayHeading, formatInTimeZone, formatTimeRange, localDateKey } from "@/lib/dates";
import { groupSlotsIntoDayWindows, summarizeAvailability } from "@/lib/domain/availability";

export const metadata: Metadata = { title: "Disponibilidad" };

/** Resumen de disponibilidad: por franja, por equipo y matriz equipos × franjas. */
export default async function AvailabilityPage({ params }: PageProps<"/torneos/[id]/disponibilidad">) {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);
  const { teams, slots, rows } = await getAvailabilityMatrix(tournament.id);
  const tz = tournament.timezone;

  if (teams.length === 0 || slots.length === 0) {
    return (
      <EmptyState
        icon={CalendarX}
        title={slots.length === 0 ? "Todavía no hay franjas" : "Todavía no hay inscripciones"}
        description={
          slots.length === 0
            ? "Cargá franjas horarias en Canchas y franjas."
            : "Cuando se inscriban, acá vas a ver en qué horarios puede jugar cada uno."
        }
      />
    );
  }

  const summary = summarizeAvailability(
    teams.map((t) => t.id),
    slots.map((s) => s.id),
    rows,
  );
  const dayWindows = groupSlotsIntoDayWindows(slots, (s) => localDateKey(s.startsAt, tz));
  const allWindows = dayWindows.flatMap((d) => d.windows);

  const windowCounts = new Map(
    allWindows.map((w) => [
      w.id,
      teams.filter((t) => w.slotIds.some((sId) => summary.has(t.id, sId))).length,
    ]),
  );
  const maxPerWindow = Math.max(1, ...windowCounts.values());

  return (
    <div className="space-y-6">
      {summary.teamsWithoutAvailability.length > 0 ? (
        <p className="flex items-start gap-2 rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
          {summary.teamsWithoutAvailability.length === 1
            ? "1 inscripción no marcó ninguna franja"
            : `${summary.teamsWithoutAvailability.length} inscripciones no marcaron ninguna franja`}
          : {teams.filter((t) => summary.teamsWithoutAvailability.includes(t.id)).map((t) => t.name).join(", ")}.
        </p>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-2">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-base font-semibold">Por franja</h2>
            </CardTitle>
            <CardDescription>Cuántas inscripciones pueden jugar en cada franja horaria.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {dayWindows.map(({ day, windows }) => (
              <section key={day} className="space-y-2">
                <h3 className="text-sm font-semibold first-letter:uppercase">{formatDayHeading(day)}</h3>
                <ul className="space-y-2">
                  {windows.map((window, index) => {
                    const count = windowCounts.get(window.id) ?? 0;
                    const label = windows.length > 1 ? `Franja ${index + 1}` : "Franja completa";
                    return (
                      <li key={window.id} className="grid grid-cols-[10rem_1fr_2rem] items-center gap-2 text-sm">
                        <div className="min-w-0">
                          <span className="block font-medium tabular-nums">{formatTimeRange(window.startsAt, window.endsAt, tz)}</span>
                          <span className="block text-xs text-muted-foreground">{label} {window.slots.length > 1 ? `(${window.slots.length} turnos)` : ""}</span>
                        </div>
                        <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <span
                            className="block h-full rounded-full bg-foreground/80"
                            style={{ width: `${(count / maxPerWindow) * 100}%` }}
                          />
                        </span>
                        <span className="text-right tabular-nums" aria-label={`${count} inscripciones disponibles`}>
                          {count}
                        </span>
                      </li>
                    );
                  })}
                </ul>
              </section>
            ))}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-base font-semibold">Por inscripción</h2>
            </CardTitle>
            <CardDescription>Cuántas franjas marcó cada una (de {allWindows.length}).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-lg border">
              {teams.map((team) => {
                const count = allWindows.filter((w) => w.slotIds.some((sId) => summary.has(team.id, sId))).length;
                return (
                  <li key={team.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="truncate">
                      {team.name}
                      {team.status === "pending" ? <span className="text-muted-foreground"> · pendiente</span> : null}
                    </span>
                    <span className={count === 0 ? "font-medium text-amber-800" : "tabular-nums"}>
                      {count === 0 ? "Ninguna" : `${count} / ${allWindows.length}`}
                    </span>
                  </li>
                );
              })}
            </ul>
          </CardContent>
        </Card>
      </div>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">Detalle</h2>
          </CardTitle>
          <CardDescription>Inscripciones × franjas horarias.</CardDescription>
        </CardHeader>
        <CardContent>
          <div
            className="overflow-x-auto rounded-lg border focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
            role="region"
            aria-label="Detalle de disponibilidad"
            tabIndex={0}
          >
            <table className="w-full border-collapse text-sm">
              <caption className="sr-only">Disponibilidad de cada inscripción por franja horaria</caption>
              <thead>
                <tr>
                  <th scope="col" className="sticky left-0 z-10 bg-background px-3 py-2 text-left font-medium">
                    Inscripción
                  </th>
                  {allWindows.map((window, index) => (
                    <th key={window.id} scope="col" className="whitespace-nowrap px-3 py-2 text-center font-normal text-muted-foreground">
                      <span className="block first-letter:uppercase font-medium text-foreground">{formatInTimeZone(window.startsAt, tz, "EEE d")}</span>
                      <span className="block tabular-nums text-xs">{formatTimeRange(window.startsAt, window.endsAt, tz)}</span>
                    </th>
                  ))}
                </tr>
              </thead>
              <tbody>
                {teams.map((team) => (
                  <tr key={team.id} className="border-t">
                    <th scope="row" className="sticky left-0 z-10 max-w-40 truncate bg-background px-3 py-2 text-left font-medium">
                      {team.name}
                    </th>
                    {allWindows.map((window) => {
                      const available = window.slotIds.some((sId) => summary.has(team.id, sId));
                      return (
                        <td key={window.id} className="px-2 py-2 text-center">
                          {available ? (
                            <Check className="mx-auto size-4 text-emerald-700" aria-label="Disponible" />
                          ) : (
                            <span className="text-muted-foreground" aria-label="No disponible">·</span>
                          )}
                        </td>
                      );
                    })}
                  </tr>
                ))}
              </tbody>
            </table>
          </div>
        </CardContent>
      </Card>
    </div>
  );
}
