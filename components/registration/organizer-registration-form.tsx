"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { createOrganizerTeam } from "@/app/(app)/torneos/[id]/inscripciones/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatDayHeading, formatTimeRange, localDateKey } from "@/lib/dates";
import { groupSlotsByDay } from "@/lib/domain/availability";
import { applyServerErrors } from "@/lib/forms";
import { organizerCreateTeamSchema, type OrganizerCreateTeamInput } from "@/lib/validation/registration";
import { cn } from "@/lib/utils";

type OrganizerSlot = { id: string; startsAt: string; endsAt: string; courtId: string | null };

type OrganizerRegistrationFormProps = {
  tournamentId: string;
  timezone: string;
  teamSize: number;
  slots: OrganizerSlot[];
  courts: { id: string; name: string }[];
};

export function OrganizerRegistrationForm({
  tournamentId,
  timezone,
  teamSize,
  slots,
  courts,
}: OrganizerRegistrationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm<OrganizerCreateTeamInput>({
    resolver: zodResolver(organizerCreateTeamSchema),
    defaultValues: { tournamentId, teamName: "", playerNames: Array(teamSize).fill(""), slotIds: [] },
  });
  const selectedSlots = useWatch({ control: form.control, name: "slotIds" });
  const selected = useMemo(() => new Set(selectedSlots), [selectedSlots]);
  const days = useMemo(
    () => groupSlotsByDay(slots, (slot) => localDateKey(slot.startsAt, timezone)),
    [slots, timezone],
  );
  const courtNames = useMemo(() => new Map(courts.map((court) => [court.id, court.name])), [courts]);

  function toggleSlot(slotId: string) {
    const next = new Set(selected);
    if (next.has(slotId)) next.delete(slotId);
    else next.add(slotId);
    form.setValue("slotIds", [...next], { shouldDirty: true, shouldValidate: true });
  }

  function toggleDay(daySlots: OrganizerSlot[]) {
    const next = new Set(selected);
    const allSelected = daySlots.every((slot) => next.has(slot.id));
    for (const slot of daySlots) {
      if (allSelected) next.delete(slot.id);
      else next.add(slot.id);
    }
    form.setValue("slotIds", [...next], { shouldDirty: true, shouldValidate: true });
  }

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await createOrganizerTeam(values);
      if (!result.ok) {
        applyServerErrors(form.setError, result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Inscribimos el equipo.");
      form.reset({ tournamentId, teamName: "", playerNames: Array(teamSize).fill(""), slotIds: [] });
      router.refresh();
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Inscribir desde el panel</h2>
        </CardTitle>
        <CardDescription>
          Cargá el nombre del equipo, sus integrantes y las franjas en las que pueden jugar. No hace falta ingresar emails.
          La inscripción queda aprobada automáticamente.
        </CardDescription>
      </CardHeader>
      <CardContent>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Primero cargá franjas en Canchas y franjas.</p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            <Field data-invalid={Boolean(form.formState.errors.teamName)}>
              <FieldLabel htmlFor="organizer-team-name">Nombre del equipo o la pareja</FieldLabel>
              <Input
                id="organizer-team-name"
                autoComplete="off"
                aria-invalid={Boolean(form.formState.errors.teamName)}
                {...form.register("teamName")}
              />
              {form.formState.errors.teamName ? <FieldError errors={[form.formState.errors.teamName]} /> : null}
            </Field>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Integrantes</legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: teamSize }, (_, index) => (
                  <Field key={index} data-invalid={Boolean(form.formState.errors.playerNames?.[index])}>
                    <FieldLabel htmlFor={`organizer-player-${index}`}>Integrante {index + 1}</FieldLabel>
                    <Input
                      id={`organizer-player-${index}`}
                      autoComplete="off"
                      aria-invalid={Boolean(form.formState.errors.playerNames?.[index])}
                      {...form.register(`playerNames.${index}`)}
                    />
                    {form.formState.errors.playerNames?.[index] ? (
                      <FieldError errors={[form.formState.errors.playerNames[index]]} />
                    ) : null}
                  </Field>
                ))}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">Franjas en las que pueden jugar</legend>
              {form.formState.errors.slotIds ? (
                <p className="text-sm text-destructive" role="alert">
                  {form.formState.errors.slotIds.message ?? "Elegí al menos una franja disponible."}
                </p>
              ) : null}
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {days.map(({ day, slots: daySlots }) => (
                  <section key={day} aria-labelledby={`organizer-slots-${day}`} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 id={`organizer-slots-${day}`} className="text-sm font-semibold first-letter:uppercase">
                        {formatDayHeading(day)}
                      </h3>
                      <Button type="button" variant="ghost" size="sm" onClick={() => toggleDay(daySlots)}>
                        {daySlots.every((slot) => selected.has(slot.id)) ? "Ninguna" : "Todo el día"}
                      </Button>
                    </div>
                    <ul className="grid grid-cols-2 gap-2">
                      {daySlots.map((slot) => {
                        const active = selected.has(slot.id);
                        return (
                          <li key={slot.id}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={active}
                              onClick={() => toggleSlot(slot.id)}
                              className={cn(
                                "flex min-h-12 w-full flex-col items-start justify-center rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                active ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
                              )}
                            >
                              <span className="flex items-center gap-1 font-medium tabular-nums">
                                {active ? <Check className="size-4" aria-hidden="true" /> : null}
                                {formatTimeRange(slot.startsAt, slot.endsAt, timezone)}
                              </span>
                              {slot.courtId ? (
                                <span className={cn("text-xs", active ? "text-background/80" : "text-muted-foreground")}>
                                  {courtNames.get(slot.courtId) ?? "Cancha"}
                                </span>
                              ) : null}
                            </button>
                          </li>
                        );
                      })}
                    </ul>
                  </section>
                ))}
              </div>
            </fieldset>

            <Button type="submit" disabled={isPending}>
              {isPending ? <Spinner /> : null}
              Inscribir y aprobar
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
