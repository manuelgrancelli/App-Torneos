"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowRight, CalendarPlus, Check, Sparkles, Trophy, Users } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { generateTimeSlots } from "@/app/(app)/torneos/[id]/canchas-franjas/actions";
import { Badge } from "@/components/ui/badge";
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

/** Formulario directo para generar franjas horarias separadas para Grupos y para Cuadro / Playoffs. */
export function SlotsManager({
  tournamentId,
  days,
  courts,
  slots = [],
}: SlotsManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const groupSlotsCount = useMemo(() => slots.filter((s) => s.stage === "group").length, [slots]);
  const playoffSlotsCount = useMemo(() => slots.filter((s) => s.stage === "playoff").length, [slots]);

  // Si ya hay franjas de grupo pero no de cuadro, sugerir directamente iniciar en "playoff"
  const defaultStage = groupSlotsCount > 0 && playoffSlotsCount === 0 ? "playoff" : "group";
  const [activeStage, setActiveStage] = useState<"group" | "playoff">(defaultStage);

  // Sugerencia de días según la etapa:
  // - Grupos: si hay varios días, se sugiere el primer tramo (o todos)
  // - Playoffs: se sugiere el tramo final (ej. el último o los 2 últimos días)
  const suggestedDaysForStage = (stage: "group" | "playoff") => {
    if (days.length <= 1) return days;
    if (stage === "group") {
      return days.length > 2 ? days.slice(0, days.length - 1) : [days[0]!];
    }
    return days.length > 2 ? days.slice(days.length - 2) : [days[days.length - 1]!];
  };

  const form = useForm({
    resolver: zodResolver(generateSlotsSchema),
    defaultValues: {
      tournamentId,
      stage: defaultStage,
      dates: suggestedDaysForStage(defaultStage),
      from: defaultStage === "playoff" ? "14:00" : "09:00",
      to: "22:00",
      durationMinutes: 60,
      breakMinutes: 0,
      courtId: null as string | null,
    },
  });

  const values = useWatch({ control: form.control });

  // Cambiar entre Fase de Grupos y Cuadro / Playoffs
  const handleStageChange = (newStage: "group" | "playoff") => {
    setActiveStage(newStage);
    form.setValue("stage", newStage);
    form.setValue("dates", suggestedDaysForStage(newStage));
    if (newStage === "playoff" && form.getValues("from") === "09:00") {
      form.setValue("from", "13:00");
    } else if (newStage === "group" && form.getValues("from") === "13:00") {
      form.setValue("from", "09:00");
    }
  };

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
      const payload = { ...input, stage: activeStage };
      const result = await generateTimeSlots(payload);
      if (!result.ok) {
        applyServerErrors(form.setError, result.fieldErrors);
        toast.error(result.error);
        return;
      }

      if (payload.stage === "group" && playoffSlotsCount === 0) {
        toast.success(
          result.message
            ? `${result.message} ¡Ahora configurá las franjas para el Cuadro / Playoffs!`
            : "Creamos las franjas de grupos. Ahora definí las franjas para el Cuadro / Playoffs.",
        );
        handleStageChange("playoff");
      } else {
        toast.success(result.message ?? "Creamos las franjas.");
      }
      router.refresh();
    });
  });

  const isPlayoff = activeStage === "playoff";

  return (
    <Card className="overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="pb-3 space-y-3">
        <div>
          <CardTitle className="text-base font-semibold flex items-center gap-2">
            <CalendarPlus className="size-4 text-primary" />
            <span>Generar franjas horarias</span>
          </CardTitle>
          <CardDescription className="text-xs">
            Configurá primero los horarios para la fase de grupos y luego para el cuadro eliminatorio.
          </CardDescription>
        </div>

        {/* Selector de etapa: 1. Fase de Grupos vs 2. Cuadro / Playoffs */}
        <div className="grid grid-cols-2 gap-2 rounded-xl bg-muted/60 p-1.5 border border-border/60">
          <button
            type="button"
            onClick={() => handleStageChange("group")}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all text-center",
              !isPlayoff
                ? "bg-background text-foreground shadow-xs border border-border/60 font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex size-4.5 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                  groupSlotsCount > 0
                    ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                    : "bg-muted text-muted-foreground border border-border",
                )}
              >
                {!isPlayoff && groupSlotsCount > 0 ? (
                  <Check className="size-3 stroke-[2.5]" />
                ) : (
                  "1"
                )}
              </span>
              <span>Fase de Grupos</span>
            </div>
            {groupSlotsCount > 0 ? (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 border-emerald-500/30 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10"
              >
                {groupSlotsCount} {groupSlotsCount === 1 ? "turno" : "turnos"}
              </Badge>
            ) : null}
          </button>

          <button
            type="button"
            onClick={() => handleStageChange("playoff")}
            className={cn(
              "flex flex-col sm:flex-row items-center justify-center gap-1.5 py-2 px-3 rounded-lg text-xs font-medium transition-all text-center",
              isPlayoff
                ? "bg-background text-foreground shadow-xs border border-border/60 font-semibold"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <div className="flex items-center gap-1.5">
              <span
                className={cn(
                  "flex size-4.5 items-center justify-center rounded-full text-[10px] font-bold shrink-0",
                  playoffSlotsCount > 0
                    ? "bg-violet-500/15 text-violet-600 dark:text-violet-400"
                    : "bg-muted text-muted-foreground border border-border",
                )}
              >
                {isPlayoff && playoffSlotsCount > 0 ? (
                  <Check className="size-3 stroke-[2.5]" />
                ) : (
                  "2"
                )}
              </span>
              <span>Cuadro / Playoffs</span>
            </div>
            {playoffSlotsCount > 0 ? (
              <Badge
                variant="outline"
                className="text-[10px] px-1.5 py-0 h-4 border-violet-500/30 text-violet-600 dark:text-violet-400 bg-violet-500/10"
              >
                {playoffSlotsCount} {playoffSlotsCount === 1 ? "turno" : "turnos"}
              </Badge>
            ) : null}
          </button>
        </div>

        {/* Callout contextual según la etapa activa */}
        <div
          className={cn(
            "rounded-xl p-3 text-xs leading-relaxed border transition-colors",
            !isPlayoff
              ? "bg-emerald-500/10 border-emerald-500/25 text-emerald-950 dark:text-emerald-200"
              : "bg-violet-500/10 border-violet-500/25 text-violet-950 dark:text-violet-200",
          )}
        >
          {!isPlayoff ? (
            <div className="flex items-start gap-2">
              <Users className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
              <div>
                <strong className="font-semibold block text-emerald-900 dark:text-emerald-300">
                  Franjas para Fase de Grupos
                </strong>
                Acá se jugarán los partidos de zonas. Las parejas marcarán su disponibilidad en estos turnos al inscribirse.
              </div>
            </div>
          ) : (
            <div className="flex items-start gap-2">
              <Trophy className="size-4 shrink-0 text-violet-600 dark:text-violet-400 mt-0.5" />
              <div>
                <strong className="font-semibold block text-violet-900 dark:text-violet-300">
                  Franjas para Cuadro / Playoffs
                </strong>
                Turnos para los cruces eliminatorios (16avos, 8vos, 4tos, semis y final). Todas las parejas clasificadas pueden jugar en estas franjas y la app armará los horarios automáticamente.
              </div>
            </div>
          )}
        </div>
      </CardHeader>

      <CardContent className="pt-1">
        <form onSubmit={onSubmit} noValidate>
          <input type="hidden" {...form.register("stage")} value={activeStage} />
          <FieldGroup>
            <Controller
              name="dates"
              control={form.control}
              render={({ field, fieldState }) => (
                <FieldSet data-invalid={fieldState.invalid}>
                  <div className="flex flex-wrap items-center justify-between gap-2">
                    <FieldLegend variant="label">Días ({!isPlayoff ? "Grupos" : "Playoffs"})</FieldLegend>
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
                    aria-label="Días para esta franja"
                  >
                    {days.map((day) => {
                      const isSelected = field.value?.includes(day);
                      return (
                        <ToggleGroupItem
                          key={day}
                          value={day}
                          className={cn(
                            "capitalize font-medium transition-all duration-150 border px-3 py-1.5 h-9 rounded-lg text-sm",
                            !isPlayoff
                              ? "data-[state=on]:bg-emerald-600 data-[state=on]:text-white data-[state=on]:border-emerald-600 data-[state=on]:hover:bg-emerald-700"
                              : "data-[state=on]:bg-violet-600 data-[state=on]:text-white data-[state=on]:border-violet-600 data-[state=on]:hover:bg-violet-700",
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
            <div className="flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3 pt-1">
              <Button
                type="submit"
                disabled={isPending || preview === 0}
                className={cn(
                  "w-full sm:w-auto font-semibold transition-all",
                  !isPlayoff
                    ? "bg-emerald-600 hover:bg-emerald-500 text-white"
                    : "bg-violet-600 hover:bg-violet-500 text-white",
                )}
              >
                {isPending ? <Spinner /> : <CalendarPlus aria-hidden="true" />}
                {isPending
                  ? "Creando turnos en la grilla…"
                  : preview === 0
                    ? "Revisá el horario"
                    : `Generar para ${!isPlayoff ? "Grupos" : "Playoffs"} (${preview} ${preview === 1 ? "turno" : "turnos"})`}
              </Button>

              {!isPlayoff && groupSlotsCount > 0 && playoffSlotsCount === 0 ? (
                <Button
                  type="button"
                  variant="outline"
                  onClick={() => handleStageChange("playoff")}
                  className="text-xs text-violet-600 dark:text-violet-400 border-violet-500/40 hover:bg-violet-500/10"
                >
                  <span>Paso 2: Franjas para Cuadro</span>
                  <ArrowRight className="size-3.5 ml-1" />
                </Button>
              ) : null}
            </div>
          </FieldGroup>
        </form>
      </CardContent>
    </Card>
  );
}
