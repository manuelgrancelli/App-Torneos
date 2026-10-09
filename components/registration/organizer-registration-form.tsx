"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { createOrganizerTeam } from "@/app/(app)/torneos/[id]/inscripciones/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { formatDayHeading, formatTimeRange, localDateKey } from "@/lib/dates";
import {
  type AvailabilityWindow,
  groupSlotsIntoDayWindows,
} from "@/lib/domain/availability";
import { applyServerErrors } from "@/lib/forms";
import { organizerCreateTeamSchema, type OrganizerCreateTeamInput } from "@/lib/validation/registration";
import { cn } from "@/lib/utils";

type OrganizerSlot = { id: string; startsAt: string; endsAt: string; courtId: string | null };

type OrganizerRegistrationFormProps = {
  tournamentId: string;
  sportId?: string;
  timezone: string;
  teamSize: number;
  slots: OrganizerSlot[];
  courts: { id: string; name: string }[];
  categories?: { id: string; name: string }[];
};

export function OrganizerRegistrationForm({
  tournamentId,
  sportId,
  timezone,
  teamSize,
  slots,
  courts,
  categories,
}: OrganizerRegistrationFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const isPadel = sportId === "padel";

  const form = useForm<OrganizerCreateTeamInput>({
    resolver: zodResolver(organizerCreateTeamSchema),
    defaultValues: {
      tournamentId,
      categoryId: categories && categories.length > 0 ? categories[0]?.id : undefined,
      teamName: "",
      playerNames: Array(teamSize).fill(""),
      slotIds: [],
    },
  });
  const selectedSlots = useWatch({ control: form.control, name: "slotIds" });
  const selected = useMemo(() => new Set(selectedSlots), [selectedSlots]);
  const dayWindows = useMemo(
    () => groupSlotsIntoDayWindows(slots, (slot) => localDateKey(slot.startsAt, timezone)),
    [slots, timezone],
  );
  const allWindows = useMemo(() => dayWindows.flatMap((d) => d.windows), [dayWindows]);
  const courtNames = useMemo(() => new Map(courts.map((court) => [court.id, court.name])), [courts]);

  function isWindowSelected(window: AvailabilityWindow<OrganizerSlot>): boolean {
    return window.slotIds.length > 0 && window.slotIds.every((id) => selected.has(id));
  }

  function toggleWindow(window: AvailabilityWindow<OrganizerSlot>) {
    const next = new Set(selected);
    const isSelected = isWindowSelected(window);
    for (const id of window.slotIds) {
      if (isSelected) next.delete(id);
      else next.add(id);
    }
    form.setValue("slotIds", [...next], { shouldDirty: true, shouldValidate: true });
  }

  function toggleDay(windows: AvailabilityWindow<OrganizerSlot>[]) {
    const next = new Set(selected);
    const allSelected = windows.every((w) => isWindowSelected(w));
    for (const w of windows) {
      for (const id of w.slotIds) {
        if (allSelected) next.delete(id);
        else next.add(id);
      }
    }
    form.setValue("slotIds", [...next], { shouldDirty: true, shouldValidate: true });
  }

  function toggleAllSlots() {
    const allSelected = allWindows.every((w) => isWindowSelected(w));
    const next = allSelected ? [] : slots.map((s) => s.id);
    form.setValue("slotIds", next, { shouldDirty: true, shouldValidate: true });
  }

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const payload: OrganizerCreateTeamInput = {
        ...values,
        teamName: isPadel
          ? values.playerNames.map((p) => p.trim()).filter(Boolean).join(" / ")
          : values.teamName,
      };
      const result = await createOrganizerTeam(payload);
      if (!result.ok) {
        applyServerErrors(form.setError, result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? (isPadel ? "Inscribimos la pareja." : "Inscribimos el equipo."));
      form.reset({ tournamentId, teamName: "", playerNames: Array(teamSize).fill(""), slotIds: [] });
      router.refresh();
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">
            {isPadel ? "Inscribir pareja manualmente" : "Inscribir desde el panel"}
          </h2>
        </CardTitle>
        <CardDescription>
          {isPadel
            ? "Cargá los nombres de los dos integrantes de la pareja (Jugador 1 y Jugador 2) y las franjas horarias en las que pueden jugar. La inscripción queda aprobada automáticamente sin mails ni cuentas."
            : "Cargá el nombre del equipo, sus integrantes y las franjas en las que pueden jugar. No hace falta ingresar emails. La inscripción queda aprobada automáticamente."}
        </CardDescription>
      </CardHeader>
      <CardContent>
        {slots.length === 0 ? (
          <p className="text-sm text-muted-foreground">Primero cargá franjas en Canchas y franjas.</p>
        ) : (
          <form onSubmit={onSubmit} noValidate className="space-y-5">
            {categories && categories.length > 0 ? (
              <Controller
                name="categoryId"
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor="org-category-select">Categoría del torneo</FieldLabel>
                    <select
                      id="org-category-select"
                      className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                      value={field.value ?? ""}
                      onChange={(e) => field.onChange(e.target.value || undefined)}
                    >
                      {categories.map((c) => (
                        <option key={c.id} value={c.id}>
                          {c.name}
                        </option>
                      ))}
                    </select>
                    {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                  </Field>
                )}
              />
            ) : null}

            {!isPadel ? (
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
            ) : null}

            <fieldset className="space-y-3">
              <legend className="text-sm font-medium">
                {isPadel ? "Integrantes de la pareja" : "Integrantes"}
              </legend>
              <div className="grid gap-3 sm:grid-cols-2">
                {Array.from({ length: teamSize }, (_, index) => {
                  const label = isPadel ? `Jugador ${index + 1}` : `Integrante ${index + 1}`;
                  const placeholder = isPadel ? `Nombre del Jugador ${index + 1}` : undefined;
                  return (
                    <Field key={index} data-invalid={Boolean(form.formState.errors.playerNames?.[index])}>
                      <FieldLabel htmlFor={`organizer-player-${index}`}>{label}</FieldLabel>
                      <Input
                        id={`organizer-player-${index}`}
                        autoComplete="off"
                        placeholder={placeholder}
                        aria-invalid={Boolean(form.formState.errors.playerNames?.[index])}
                        {...form.register(`playerNames.${index}`)}
                      />
                      {form.formState.errors.playerNames?.[index] ? (
                        <FieldError errors={[form.formState.errors.playerNames[index]]} />
                      ) : null}
                    </Field>
                  );
                })}
              </div>
            </fieldset>

            <fieldset className="space-y-3">
              <div className="flex items-center justify-between gap-2">
                <legend className="text-sm font-medium">Franjas en las que pueden jugar</legend>
                {slots.length > 0 ? (
                  <Button type="button" variant="outline" size="sm" onClick={toggleAllSlots}>
                    {slots.every((slot) => selected.has(slot.id)) ? "Deseleccionar todas" : "Seleccionar todas"}
                  </Button>
                ) : null}
              </div>
              {form.formState.errors.slotIds ? (
                <p className="text-sm text-destructive" role="alert">
                  {form.formState.errors.slotIds.message ?? "Elegí al menos una franja disponible."}
                </p>
              ) : null}
              <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
                {dayWindows.map(({ day, windows }) => (
                  <section key={day} aria-labelledby={`organizer-slots-${day}`} className="space-y-2">
                    <div className="flex items-center justify-between gap-2">
                      <h3 id={`organizer-slots-${day}`} className="text-sm font-semibold first-letter:uppercase">
                        {formatDayHeading(day)}
                      </h3>
                      {windows.length > 1 ? (
                        <Button type="button" variant="ghost" size="sm" onClick={() => toggleDay(windows)}>
                          {windows.every((w) => isWindowSelected(w)) ? "Ninguna" : "Todo el día"}
                        </Button>
                      ) : null}
                    </div>
                    <ul className="grid grid-cols-1 gap-2">
                      {windows.map((window, index) => {
                        const active = isWindowSelected(window);
                        const time = formatTimeRange(window.startsAt, window.endsAt, timezone);
                        const label = windows.length > 1 ? `Franja ${index + 1}` : "Franja completa";
                        return (
                          <li key={window.id}>
                            <button
                              type="button"
                              role="checkbox"
                              aria-checked={active}
                              onClick={() => toggleWindow(window)}
                              className={cn(
                                "flex min-h-14 w-full flex-col items-start justify-center rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                                "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
                                active ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
                              )}
                            >
                              <span className="flex items-center gap-1.5 font-medium tabular-nums">
                                {active ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
                                <span className="text-base">{time}</span>
                              </span>
                              <span className={cn("text-xs font-normal", active ? "text-background/80" : "text-muted-foreground")}>
                                {label} {window.slots.length > 1 ? `· ${window.slots.length} turnos posibles` : ""}
                              </span>
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
              {isPadel ? "Inscribir pareja" : "Inscribir y aprobar"}
            </Button>
          </form>
        )}
      </CardContent>
    </Card>
  );
}
