"use client";

import { Lock } from "lucide-react";
import { Controller, type UseFormReturn, useWatch } from "react-hook-form";
import type { z } from "zod";
import { NumberInput } from "@/components/shared/number-input";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { TIMEZONE_OPTIONS } from "@/lib/dates";
import { teamNoun } from "@/lib/domain/tournament-status";
import type { CreateTournamentInput, createTournamentSchema } from "@/lib/validation/tournament";

/**
 * Campos de datos del torneo compartidos por el asistente de alta y el formulario de
 * edición (D-054). Cada uno recibe el `form` de React Hook Form.
 */
export type TournamentFormApi = UseFormReturn<CreateTournamentInput, unknown, z.output<typeof createTournamentSchema>>;

/** Motivo por el que un campo no se puede editar (D-029). */
export function LockNote({ reason }: { reason?: string }) {
  if (!reason) return null;
  return (
    <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {reason}
    </p>
  );
}

export function NameField({ form }: { form: TournamentFormApi }) {
  return (
    <Controller
      name="name"
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="t-name">Nombre</FieldLabel>
          <Input {...field} id="t-name" placeholder="Copa de Primavera" aria-invalid={fieldState.invalid} />
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
        </Field>
      )}
    />
  );
}

export function DescriptionField({ form }: { form: TournamentFormApi }) {
  return (
    <Controller
      name="description"
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="t-description">Descripción (opcional)</FieldLabel>
          <Textarea {...field} id="t-description" rows={3} aria-invalid={fieldState.invalid} />
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
        </Field>
      )}
    />
  );
}

export function DateFields({ form }: { form: TournamentFormApi }) {
  const startsOn = useWatch({ control: form.control, name: "startsOn" });
  const endsOn = useWatch({ control: form.control, name: "endsOn" });

  return (
    <div className="grid gap-4 sm:grid-cols-2">
      <Controller
        name="startsOn"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="t-startsOn">Empieza</FieldLabel>
            <Input
              {...field}
              id="t-startsOn"
              type="date"
              max={endsOn || undefined}
              aria-invalid={fieldState.invalid}
              onChange={(e) => {
                field.onChange(e);
                const newStartsOn = e.target.value;
                if (endsOn && newStartsOn && newStartsOn > endsOn) {
                  form.setValue("endsOn", newStartsOn, { shouldValidate: true });
                }
                form.trigger(["startsOn", "endsOn"]);
              }}
            />
            {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
          </Field>
        )}
      />

      <Controller
        name="endsOn"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor="t-endsOn">Termina</FieldLabel>
            <Input
              {...field}
              id="t-endsOn"
              type="date"
              min={startsOn || undefined}
              aria-invalid={fieldState.invalid}
              onChange={(e) => {
                field.onChange(e);
                form.trigger(["startsOn", "endsOn"]);
              }}
            />
            {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
          </Field>
        )}
      />
    </div>
  );
}

export function TimezoneField({ form, lockReason }: { form: TournamentFormApi; lockReason?: string }) {
  return (
    <Controller
      name="timezone"
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="t-timezone">Zona horaria</FieldLabel>
          <NativeSelect
            id="t-timezone"
            className="w-full"
            value={field.value}
            disabled={Boolean(lockReason)}
            onChange={(e) => field.onChange(e.target.value)}
          >
            {TIMEZONE_OPTIONS.map((tz) => (
              <NativeSelectOption key={tz.value} value={tz.value}>
                {tz.label}
              </NativeSelectOption>
            ))}
          </NativeSelect>
          <LockNote reason={lockReason} />
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
        </Field>
      )}
    />
  );
}

export function MaxTeamsField({ form, teamSize }: { form: TournamentFormApi; teamSize: number }) {
  return (
    <Controller
      name="maxTeams"
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="t-max-teams">Cupo de {teamNoun(teamSize, true)}</FieldLabel>
          <NumberInput
            id="t-max-teams"
            min={2}
            max={128}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            aria-invalid={fieldState.invalid}
          />
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
        </Field>
      )}
    />
  );
}

export function CourtCountField({ form }: { form: TournamentFormApi }) {
  return (
    <Controller
      name="courtCount"
      control={form.control}
      render={({ field, fieldState }) => (
        <Field data-invalid={fieldState.invalid}>
          <FieldLabel htmlFor="t-courts">Canchas / sedes</FieldLabel>
          <NumberInput
            id="t-courts"
            min={1}
            max={50}
            value={field.value}
            onChange={field.onChange}
            onBlur={field.onBlur}
            aria-invalid={fieldState.invalid}
          />
          <FieldDescription>Después les podés poner nombre y sede.</FieldDescription>
          {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
        </Field>
      )}
    />
  );
}

export function ConfirmationField({ form }: { form: TournamentFormApi }) {
  return (
    <Controller
      name="resultsRequireConfirmation"
      control={form.control}
      render={({ field }) => (
        <Field orientation="horizontal">
          <Switch id="t-confirm" checked={field.value} onCheckedChange={field.onChange} />
          <FieldContent>
            <FieldLabel htmlFor="t-confirm">Los equipos confirman los resultados</FieldLabel>
            <FieldDescription>Vos cargás el resultado y cada equipo lo confirma u objeta.</FieldDescription>
          </FieldContent>
        </Field>
      )}
    />
  );
}
