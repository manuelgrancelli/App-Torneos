"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, Clock, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import {
  createTimeSlot,
  deleteTimeSlots,
  generateTimeSlots,
} from "@/app/(app)/torneos/[id]/canchas-franjas/actions";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CourtRow, SlotRow } from "@/lib/data/tournaments";
import { formatDayHeading, formatInTimeZone, formatTimeRange, localDateKey } from "@/lib/dates";
import { generateSlots } from "@/lib/domain/slots";
import { applyServerErrors } from "@/lib/forms";
import { createSlotSchema, generateSlotsSchema } from "@/lib/validation/tournament";

type SlotsManagerProps = {
  tournamentId: string;
  timezone: string;
  /** Días del torneo ("YYYY-MM-DD"). */
  days: string[];
  courts: CourtRow[];
  slots: SlotRow[];
};

const ANY_COURT = "any";

function CourtSelect({
  id,
  courts,
  value,
  onChange,
}: {
  id: string;
  courts: CourtRow[];
  value: string | null;
  onChange: (value: string | null) => void;
}) {
  return (
    <NativeSelect
      id={id}
      className="w-full"
      value={value ?? ANY_COURT}
      onChange={(e) => onChange(e.target.value === ANY_COURT ? null : e.target.value)}
    >
      <NativeSelectOption value={ANY_COURT}>Cualquier cancha</NativeSelectOption>
      {courts.map((court) => (
        <NativeSelectOption key={court.id} value={court.id}>
          Solo {court.name}
        </NativeSelectOption>
      ))}
    </NativeSelect>
  );
}

/** "lun 10/10" para los chips de días. */
function dayChipLabel(date: string): string {
  const [year, month, day] = date.split("-").map(Number);
  return formatInTimeZone(new Date(Date.UTC(year ?? 1970, (month ?? 1) - 1, day ?? 1, 12)), "UTC", "EEE d/M");
}

function SlotGenerator({ tournamentId, days, courts }: Omit<SlotsManagerProps, "slots" | "timezone">) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(generateSlotsSchema),
    defaultValues: {
      tournamentId,
      dates: days,
      from: "09:00",
      to: "22:00",
      durationMinutes: 90,
      breakMinutes: 0,
      courtId: null as string | null,
    },
  });
  const values = useWatch({ control: form.control });

  // Vista previa: cuántas franjas se crearían con lo cargado.
  const preview = useMemo(() => {
    const result = generateSlots({
      dates: values.dates ?? [],
      from: values.from ?? "",
      to: values.to ?? "",
      durationMinutes: values.durationMinutes ?? 0,
      breakMinutes: values.breakMinutes ?? 0,
    });
    return result.ok ? result.slots.length : 0;
  }, [values.dates, values.from, values.to, values.durationMinutes, values.breakMinutes]);

  const onSubmit = form.handleSubmit((input) => {
    startTransition(async () => {
      const result = await generateTimeSlots(input);
      if (!result.ok) {
        applyServerErrors(form.setError, result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Creamos las franjas.");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Controller
          name="dates"
          control={form.control}
          render={({ field, fieldState }) => (
            <FieldSet data-invalid={fieldState.invalid}>
              <FieldLegend variant="label">Días</FieldLegend>
              <ToggleGroup
                type="multiple"
                variant="outline"
                value={field.value}
                onValueChange={field.onChange}
                className="flex flex-wrap justify-start gap-2"
                aria-label="Días del torneo"
              >
                {days.map((day) => (
                  <ToggleGroupItem key={day} value={day} className="capitalize">
                    {dayChipLabel(day)}
                  </ToggleGroupItem>
                ))}
              </ToggleGroup>
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </FieldSet>
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          {(["from", "to"] as const).map((name) => (
            <Controller
              key={name}
              name={name}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`gen-${name}`}>{name === "from" ? "Desde" : "Hasta"}</FieldLabel>
                  <Input {...field} id={`gen-${name}`} type="time" step={300} aria-invalid={fieldState.invalid} />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          ))}
        </div>
        <div className="grid grid-cols-2 gap-3">
          <Controller
            name="durationMinutes"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="gen-duration">Duración de cada partido</FieldLabel>
                <NativeSelect
                  id="gen-duration"
                  className="w-full"
                  value={String(field.value)}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                >
                  {[45, 60, 75, 90, 105, 120].map((minutes) => (
                    <NativeSelectOption key={minutes} value={String(minutes)}>
                      {minutes} min
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
          />
          <Controller
            name="breakMinutes"
            control={form.control}
            render={({ field }) => (
              <Field>
                <FieldLabel htmlFor="gen-break">Pausa entre franjas</FieldLabel>
                <NativeSelect
                  id="gen-break"
                  className="w-full"
                  value={String(field.value)}
                  onChange={(e) => field.onChange(Number(e.target.value))}
                >
                  {[0, 5, 10, 15, 30].map((minutes) => (
                    <NativeSelectOption key={minutes} value={String(minutes)}>
                      {minutes === 0 ? "Sin pausa" : `${minutes} min`}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              </Field>
            )}
          />
        </div>
        <Controller
          name="courtId"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="gen-court">Cancha</FieldLabel>
              <CourtSelect id="gen-court" courts={courts} value={field.value} onChange={field.onChange} />
              <FieldDescription>
                &quot;Cualquier cancha&quot; permite jugar en todas a la vez en ese horario.
              </FieldDescription>
            </Field>
          )}
        />
        <Button type="submit" disabled={isPending || preview === 0}>
          {isPending ? <Spinner /> : <CalendarPlus aria-hidden="true" />}
          {preview === 0 ? "Revisá el horario" : `Crear ${preview} ${preview === 1 ? "franja" : "franjas"}`}
        </Button>
      </FieldGroup>
    </form>
  );
}

function SingleSlotForm({ tournamentId, days, courts }: Omit<SlotsManagerProps, "slots" | "timezone">) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(createSlotSchema),
    defaultValues: { tournamentId, date: days[0] ?? "", start: "18:00", end: "19:30", courtId: null as string | null },
  });

  const onSubmit = form.handleSubmit((input) => {
    startTransition(async () => {
      const result = await createTimeSlot(input);
      if (!result.ok) {
        applyServerErrors(form.setError, result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Agregamos la franja.");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate>
      <FieldGroup>
        <Controller
          name="date"
          control={form.control}
          render={({ field, fieldState }) => (
            <Field data-invalid={fieldState.invalid}>
              <FieldLabel htmlFor="slot-date">Día</FieldLabel>
              <Input {...field} id="slot-date" type="date" aria-invalid={fieldState.invalid} />
              {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
            </Field>
          )}
        />
        <div className="grid grid-cols-2 gap-3">
          {(["start", "end"] as const).map((name) => (
            <Controller
              key={name}
              name={name}
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor={`slot-${name}`}>{name === "start" ? "Empieza" : "Termina"}</FieldLabel>
                  <Input {...field} id={`slot-${name}`} type="time" step={300} aria-invalid={fieldState.invalid} />
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          ))}
        </div>
        <Controller
          name="courtId"
          control={form.control}
          render={({ field }) => (
            <Field>
              <FieldLabel htmlFor="slot-court">Cancha</FieldLabel>
              <CourtSelect id="slot-court" courts={courts} value={field.value} onChange={field.onChange} />
            </Field>
          )}
        />
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner /> : <Plus aria-hidden="true" />}
          Agregar franja
        </Button>
      </FieldGroup>
    </form>
  );
}

function SlotList({ tournamentId, timezone, courts, slots }: Omit<SlotsManagerProps, "days">) {
  const router = useRouter();
  const courtName = new Map(courts.map((court) => [court.id, court.name]));
  const byDay = new Map<string, SlotRow[]>();
  for (const slot of slots) {
    const key = localDateKey(slot.startsAt, timezone);
    byDay.set(key, [...(byDay.get(key) ?? []), slot]);
  }

  async function remove(slot: SlotRow) {
    const result = await deleteTimeSlots({ tournamentId, slotIds: [slot.id] });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message ?? "Borramos la franja.");
    router.refresh();
  }

  if (slots.length === 0) {
    return (
      <EmptyState
        icon={Clock}
        title="Todavía no hay franjas"
        description="Generalas en lote o agregalas de a una. Las parejas eligen en cuáles pueden jugar."
      />
    );
  }

  return (
    <div className="space-y-5">
      {[...byDay.entries()].map(([day, daySlots]) => (
        <section key={day} aria-labelledby={`day-${day}`} className="space-y-2">
          <h3 id={`day-${day}`} className="text-sm font-semibold first-letter:uppercase">
            {formatDayHeading(day)} <span className="font-normal text-muted-foreground">· {daySlots.length}</span>
          </h3>
          <ul className="divide-y rounded-lg border">
            {daySlots.map((slot) => {
              const time = formatTimeRange(slot.startsAt, slot.endsAt, timezone);
              const inUse = slot.availableTeams > 0 || slot.assignedMatches > 0;
              return (
                <li key={slot.id} className="flex items-center gap-2 px-3 py-2">
                  <div className="min-w-0 flex-1">
                    <p className="font-medium tabular-nums">{time}</p>
                    <p className="text-sm text-muted-foreground">
                      {slot.courtId ? (courtName.get(slot.courtId) ?? "Cancha") : "Cualquier cancha"}
                    </p>
                  </div>
                  <div className="hidden flex-wrap justify-end gap-1 sm:flex">
                    {slot.availableTeams > 0 ? (
                      <Badge variant="secondary">
                        {slot.availableTeams} {slot.availableTeams === 1 ? "disponible" : "disponibles"}
                      </Badge>
                    ) : null}
                    {slot.assignedMatches > 0 ? (
                      <Badge variant="secondary">
                        {slot.assignedMatches} {slot.assignedMatches === 1 ? "partido" : "partidos"}
                      </Badge>
                    ) : null}
                  </div>
                  <ConfirmActionButton
                    variant="ghost"
                    size="icon"
                    destructive
                    aria-label={`Borrar franja ${time}`}
                    title="¿Borrar esta franja?"
                    description={
                      inUse ? (
                        <>
                          <p>
                            {slot.availableTeams > 0
                              ? `${slot.availableTeams} inscripciones la marcaron como disponible y van a perder esa marca.`
                              : null}
                          </p>
                          <p>{slot.assignedMatches > 0 ? "Los partidos asignados quedan sin horario." : null}</p>
                        </>
                      ) : (
                        <p>Nadie la usa todavía.</p>
                      )
                    }
                    confirmLabel="Borrar franja"
                    onConfirm={() => remove(slot)}
                  >
                    <Trash2 aria-hidden="true" />
                  </ConfirmActionButton>
                </li>
              );
            })}
          </ul>
        </section>
      ))}
    </div>
  );
}

/** Alta (en lote o individual) y listado por día de las franjas horarias. */
export function SlotsManager(props: SlotsManagerProps) {
  const [tab, setTab] = useState("lote");
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Franjas horarias</h2>
        </CardTitle>
        <CardDescription>
          Horarios posibles para jugar. Todo se muestra en la zona horaria del torneo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-6">
        <Tabs value={tab} onValueChange={setTab}>
          <TabsList>
            <TabsTrigger value="lote">Generar en lote</TabsTrigger>
            <TabsTrigger value="una">Agregar una</TabsTrigger>
          </TabsList>
          <TabsContent value="lote" className="pt-4">
            <SlotGenerator tournamentId={props.tournamentId} days={props.days} courts={props.courts} />
          </TabsContent>
          <TabsContent value="una" className="pt-4">
            <SingleSlotForm tournamentId={props.tournamentId} days={props.days} courts={props.courts} />
          </TabsContent>
        </Tabs>
        <SlotList tournamentId={props.tournamentId} timezone={props.timezone} courts={props.courts} slots={props.slots} />
      </CardContent>
    </Card>
  );
}
