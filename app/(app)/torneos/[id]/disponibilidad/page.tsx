import { CalendarX, Check, TriangleAlert } from "lucide-react";
import type { Metadata } from "next";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { getAvailabilityMatrix } from "@/lib/data/teams";
import { formatDayHeading, formatInTimeZone, formatTimeRange, localDateKey } from "@/lib/dates";
import { groupSlotsByDay, summarizeAvailability } from "@/lib/domain/availability";

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
  const days = groupSlotsByDay(slots, (s) => localDateKey(s.startsAt, tz));
  const maxPerSlot = Math.max(1, ...summary.bySlot.values());

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
            <CardDescription>Cuántas inscripciones pueden jugar en cada horario.</CardDescription>
          </CardHeader>
          <CardContent className="space-y-4">
            {days.map(({ day, slots: daySlots }) => (
              <section key={day} className="space-y-2">
                <h3 className="text-sm font-semibold first-letter:uppercase">{formatDayHeading(day)}</h3>
                <ul className="space-y-1.5">
                  {daySlots.map((slot) => {
                    const count = summary.bySlot.get(slot.id) ?? 0;
                    return (
                      <li key={slot.id} className="grid grid-cols-[6.5rem_1fr_2rem] items-center gap-2 text-sm">
                        <span className="tabular-nums">{formatTimeRange(slot.startsAt, slot.endsAt, tz)}</span>
                        <span className="h-2.5 overflow-hidden rounded-full bg-muted" aria-hidden="true">
                          <span
                            className="block h-full rounded-full bg-foreground/80"
                            style={{ width: `${(count / maxPerSlot) * 100}%` }}
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
            <CardDescription>Cuántas franjas marcó cada una (de {slots.length}).</CardDescription>
          </CardHeader>
          <CardContent>
            <ul className="divide-y rounded-lg border">
              {teams.map((team) => {
                const count = summary.byTeam.get(team.id) ?? 0;
                return (
                  <li key={team.id} className="flex items-center justify-between gap-2 px-3 py-2 text-sm">
                    <span className="truncate">
                      {team.name}
                      {team.status === "pending" ? <span className="text-muted-foreground"> · pendiente</span> : null}
                    </span>
                    <span className={count === 0 ? "font-medium text-amber-800" : "tabular-nums"}>
                      {count === 0 ? "Ninguna" : count}
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
          <CardDescription>Inscripciones × franjas. Deslizá para ver todos los horarios.</CardDescription>
        </CardHeader>
        <CardContent>
          {/* Región enfocable: con teclado también se puede desplazar en horizontal. */}
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
                  {slots.map((slot) => (
                    <th key={slot.id} scope="col" className="whitespace-nowrap px-2 py-2 text-center font-normal text-muted-foreground">
                      <span className="block first-letter:uppercase">{formatInTimeZone(slot.startsAt, tz, "EEE d")}</span>
                      <span className="block tabular-nums">{formatInTimeZone(slot.startsAt, tz, "HH:mm")}</span>
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
                    {slots.map((slot) => (
                      <td key={slot.id} className="px-2 py-2 text-center">
                        {summary.has(team.id, slot.id) ? (
                          <Check className="mx-auto size-4 text-emerald-700" aria-label="Disponible" />
                        ) : (
                          <span className="text-muted-foreground" aria-label="No disponible">·</span>
                        )}
                      </td>
                    ))}
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
