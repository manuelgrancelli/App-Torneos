"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { CalendarPlus, Check } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { generateTimeSlots } from "@/app/(app)/torneos/[id]/canchas-franjas/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldGroup, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import type { CourtRow, SlotRow } from "@/lib/data/tournaments";
import { formatInTimeZone } from "@/lib/dates";
import { generateSlots } from "@/lib/domain/slots";
import { applyServerErrors } from "@/lib/forms";
import { cn } from "@/lib/utils";
import { generateSlotsSchema } from "@/lib/validation/tournament";

type SlotsManagerProps = {
  tournamentId: string;
  timezone: string;
  /** Días del torneo ("YYYY-MM-DD"). */
  days: string[];
  courts: CourtRow[];
  slots?: SlotRow[];
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
      <NativeSelectOption value={ANY_COURT}>
        {courts.length > 0 ? `Todas las canchas (${courts.length})` : "Cualquier cancha"}
      </NativeSelectOption>
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

/** Formulario directo para generar franjas horarias para el torneo. */
export function SlotsManager({
  tournamentId,
  days,
  courts,
}: SlotsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(generateSlotsSchema),
    defaultValues: {
      tournamentId,
      dates: days,
      from: "09:00",
      to: "22:00",
      durationMinutes: 60,
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
    <Card className="overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="pb-3">
        <CardTitle className="text-base font-semibold">Generar franjas horarias</CardTitle>
        <CardDescription className="text-xs">
          Definí los días, horarios y duración de los partidos para armar la grilla de juego.
        </CardDescription>
      </CardHeader>
      <CardContent className="pt-1">
        <form onSubmit={onSubmit} noValidate>
          <FieldGroup>
            <Controller
              name="dates"
              control={form.control}
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <FieldLegend variant="label">Días</FieldLegend>
                    {days.length > 1 ? (
                      <button
                        type="button"
                        onClick={() => {
                          const allSelected = (field.value ?? []).length === days.length;
                          field.onChange(allSelected ? [] : [...days]);
                        }}
                        className="text-xs font-medium text-muted-foreground hover:text-foreground underline-offset-2 hover:underline transition-colors cursor-pointer"
                      >
                        {(field.value ?? []).length === days.length ? "Deseleccionar todos" : "Seleccionar todos"}
                      </button>
                    ) : null}
                  </div>
                  <ToggleGroup
                    type="multiple"
                    variant="outline"
                    value={field.value}
                    onValueChange={field.onChange}
                    className="flex w-full flex-wrap items-center justify-start gap-2"
                    aria-label="Días del torneo"
                  >
                    {days.map((day) => {
                      const isSelected = field.value?.includes(day);
                      return (
                        <ToggleGroupItem
                          key={day}
                          value={day}
                          className={cn(
                            "capitalize font-medium transition-all duration-150 border px-3 py-1.5 h-9 rounded-lg text-sm",
                            "data-[state=on]:bg-emerald-600 data-[state=on]:text-white data-[state=on]:border-emerald-600",
                            "data-[state=on]:hover:bg-emerald-700 data-[state=on]:hover:text-white data-[state=on]:shadow-xs",
                            "dark:data-[state=on]:bg-emerald-600 dark:data-[state=on]:text-white dark:data-[state=on]:border-emerald-600 dark:data-[state=on]:hover:bg-emerald-700",
                            !isSelected && "border-input bg-background/70 text-muted-foreground hover:bg-muted hover:text-foreground",
                          )}
                        >
                          {isSelected ? (
                            <Check className="mr-1.5 size-3.5 shrink-0 stroke-[2.5]" aria-hidden="true" />
                          ) : null}
                          <span>{dayChipLabel(day)}</span>
                        </ToggleGroupItem>
                      );
                    })}
                  </ToggleGroup>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </FieldSet>
              )}
            />
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              {(["from", "to"] as const).map((name) => (
                <Controller
                  key={name}
                  name={name}
                  control={form.control}
                  render={({ field, fieldState }) => (
                    <Field data-invalid={fieldState.invalid} className="min-w-0">
                      <FieldLabel htmlFor={`gen-${name}`}>{name === "from" ? "Desde" : "Hasta"}</FieldLabel>
                      <Input {...field} id={`gen-${name}`} type="time" step={300} aria-invalid={fieldState.invalid} className="w-full" />
                      {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                    </Field>
                  )}
                />
              ))}
            </div>
            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
              <Controller
                name="durationMinutes"
                control={form.control}
                render={({ field }) => (
                  <Field className="min-w-0">
                    <FieldLabel htmlFor="gen-duration" className="truncate">Duración de cada partido</FieldLabel>
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
                  <Field className="min-w-0">
                    <FieldLabel htmlFor="gen-break" className="truncate">Pausa entre partidos</FieldLabel>
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
                <Field className="min-w-0">
                  <FieldLabel htmlFor="gen-court">Cancha</FieldLabel>
                  <CourtSelect id="gen-court" courts={courts} value={field.value} onChange={field.onChange} />
                  <FieldDescription>
                    &quot;Todas las canchas&quot; habilita todas las canchas confirmadas del torneo en este horario.
                  </FieldDescription>
                </Field>
              )}
            />
            <Button type="submit" disabled={isPending || preview === 0} className="w-full sm:w-auto">
              {isPending ? <Spinner /> : <CalendarPlus aria-hidden="true" />}
              {preview === 0 ? "Revisá el horario" : `Generar franja (${preview} ${preview === 1 ? "turno" : "turnos"})`}
            </Button>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
