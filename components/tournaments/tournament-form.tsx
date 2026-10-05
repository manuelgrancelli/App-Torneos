"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Lock } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import { createTournament } from "@/app/(app)/torneos/actions";
import { updateTournament } from "@/app/(app)/torneos/[id]/actions";
import { NumberInput } from "@/components/shared/number-input";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldError,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { DEFAULT_TIMEZONE, TIMEZONE_OPTIONS } from "@/lib/dates";
import type { ScoringConfig } from "@/lib/domain/scoring";
import type { StandingsConfig } from "@/lib/domain/standings";
import { teamNoun } from "@/lib/domain/tournament-status";
import { applyServerErrors, firstErrorMessage } from "@/lib/forms";
import type { z } from "zod";
import { type CreateTournamentInput, createTournamentSchema } from "@/lib/validation/tournament";
import { PlayoffFields, ScoringFields, StandingsFields } from "./config-fields";

export type SportOption = {
  id: string;
  name: string;
  minTeamSize: number;
  defaultScoringConfig: ScoringConfig;
  defaultStandingsConfig: StandingsConfig;
};

/** Motivo por el que un grupo de campos no se puede editar (D-029). */
export type FormLocks = {
  scoring?: string;
  standings?: string;
  playoff?: string;
  timezone?: string;
};

type TournamentFormProps =
  | { mode: "create"; sports: SportOption[] }
  | {
      mode: "edit";
      tournamentId: string;
      sport: SportOption;
      defaults: Omit<CreateTournamentInput, "sportId" | "courtCount">;
      locks: FormLocks;
    };

function LockNote({ reason }: { reason?: string }) {
  if (!reason) return null;
  return (
    <p className="flex items-start gap-2 rounded-lg bg-muted px-3 py-2 text-sm text-muted-foreground">
      <Lock className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
      {reason}
    </p>
  );
}

function Section({ title, description, children }: { title: string; description?: string; children: React.ReactNode }) {
  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">{title}</h2>
        </CardTitle>
        {description ? <CardDescription>{description}</CardDescription> : null}
      </CardHeader>
      <CardContent className="space-y-4">{children}</CardContent>
    </Card>
  );
}

/** Formulario de alta y edición de torneo (datos, puntuación, tabla y playoffs). */
export function TournamentForm(props: TournamentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isTestTournament, setIsTestTournament] = useState(false);
  const locks: FormLocks = props.mode === "edit" ? props.locks : {};
  // La página garantiza al menos un deporte en el catálogo.
  const initialSport = (props.mode === "create" ? props.sports[0] : props.sport) as SportOption;

  const form = useForm<CreateTournamentInput, unknown, z.output<typeof createTournamentSchema>>({
    resolver: zodResolver(createTournamentSchema),
    defaultValues:
      props.mode === "edit"
        ? { ...props.defaults, sportId: props.sport.id, courtCount: 1 }
        : {
            name: "",
            description: "",
            startsOn: "",
            endsOn: "",
            timezone: DEFAULT_TIMEZONE,
            maxTeams: 16,
            courtCount: 2,
            resultsRequireConfirmation: false,
            sportId: initialSport.id,
            scoringConfig: initialSport.defaultScoringConfig,
            standingsConfig: initialSport.defaultStandingsConfig,
            playoffConfig: { qualifiersPerGroup: 2, thirdPlace: false },
          },
  });

  const sportId = useWatch({ control: form.control, name: "sportId" });
  const scoringConfig = useWatch({ control: form.control, name: "scoringConfig" });
  const sport =
    props.mode === "create" ? (props.sports.find((s) => s.id === sportId) ?? initialSport) : props.sport;

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      if (props.mode === "create") {
        const result = await createTournament({ ...values, isTest: isTestTournament });
        if (!result.ok) {
          applyServerErrors(form.setError, result.fieldErrors);
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "Torneo creado.");
        router.push(`/torneos/${result.data.tournamentId}`);
        return;
      }

      // En edición no se cambian el deporte ni la cantidad inicial de canchas.
      const result = await updateTournament({
        tournamentId: props.tournamentId,
        name: values.name,
        description: values.description,
        startsOn: values.startsOn,
        endsOn: values.endsOn,
        timezone: values.timezone,
        maxTeams: values.maxTeams,
        resultsRequireConfirmation: values.resultsRequireConfirmation,
        scoringConfig: values.scoringConfig,
        standingsConfig: values.standingsConfig,
        playoffConfig: values.playoffConfig,
      });
      if (!result.ok) {
        applyServerErrors(form.setError, result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Guardamos los cambios.");
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Section title="Datos del torneo">
        <FieldGroup>
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

          {props.mode === "create" ? (
            <Controller
              name="sportId"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="t-sport">Deporte</FieldLabel>
                  <NativeSelect
                    id="t-sport"
                    className="w-full"
                    value={field.value}
                    onChange={(e) => {
                      const next = props.sports.find((s) => s.id === e.target.value);
                      field.onChange(e.target.value);
                      // Cada deporte trae su puntuación y desempates por defecto.
                      if (next) {
                        form.setValue("scoringConfig", next.defaultScoringConfig);
                        form.setValue("standingsConfig", next.defaultStandingsConfig);
                      }
                    }}
                  >
                    {props.sports.map((s) => (
                      <NativeSelectOption key={s.id} value={s.id}>
                        {s.name} ({s.minTeamSize === 2 ? "parejas" : `equipos de ${s.minTeamSize}`})
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          ) : (
            <Field>
              <FieldLabel>Deporte</FieldLabel>
              <p className="text-sm">{props.sport.name}</p>
            </Field>
          )}

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

          <div className="grid gap-4 sm:grid-cols-2">
            {(["startsOn", "endsOn"] as const).map((name) => (
              <Controller
                key={name}
                name={name}
                control={form.control}
                render={({ field, fieldState }) => (
                  <Field data-invalid={fieldState.invalid}>
                    <FieldLabel htmlFor={`t-${name}`}>{name === "startsOn" ? "Empieza" : "Termina"}</FieldLabel>
                    <Input {...field} id={`t-${name}`} type="date" aria-invalid={fieldState.invalid} />
                    {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                  </Field>
                )}
              />
            ))}
          </div>

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
                  disabled={Boolean(locks.timezone)}
                  onChange={(e) => field.onChange(e.target.value)}
                >
                  {TIMEZONE_OPTIONS.map((tz) => (
                    <NativeSelectOption key={tz.value} value={tz.value}>
                      {tz.label}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
                <LockNote reason={locks.timezone} />
                {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
              </Field>
            )}
          />

          <div className="grid gap-4 sm:grid-cols-2">
            <Controller
              name="maxTeams"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid}>
                  <FieldLabel htmlFor="t-max-teams">
                    Cupo de {teamNoun(sport?.minTeamSize ?? 2, true)}
                  </FieldLabel>
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
            {props.mode === "create" ? (
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
            ) : null}
          </div>

          <Controller
            name="resultsRequireConfirmation"
            control={form.control}
            render={({ field }) => (
              <Field orientation="horizontal">
                <Switch id="t-confirm" checked={field.value} onCheckedChange={field.onChange} />
                <FieldContent>
                  <FieldLabel htmlFor="t-confirm">Los equipos confirman los resultados</FieldLabel>
                  <FieldDescription>
                    Vos cargás el resultado y cada equipo lo confirma u objeta.
                  </FieldDescription>
                </FieldContent>
              </Field>
            )}
          />
          {props.mode === "create" ? (
            <Field orientation="horizontal">
              <Switch
                id="t-test-mode"
                checked={isTestTournament}
                onCheckedChange={setIsTestTournament}
              />
              <FieldContent>
                <FieldLabel htmlFor="t-test-mode">Crear como torneo privado de prueba</FieldLabel>
                <FieldDescription>
                  No se muestra en páginas públicas ni acepta inscripciones reales. Vas a poder completar los cupos con
                  parejas ficticias para probar grupos, fixture y cuadro.
                </FieldDescription>
              </FieldContent>
            </Field>
          ) : null}
        </FieldGroup>
      </Section>

      <Section title="Puntuación" description="Cómo se juega y se valida cada partido.">
        <LockNote reason={locks.scoring} />
        <Controller
          name="scoringConfig"
          control={form.control}
          render={({ field, fieldState }) => (
            <>
              <ScoringFields value={field.value} onChange={field.onChange} disabled={Boolean(locks.scoring)} />
              {fieldState.error ? <FieldError>{firstErrorMessage(fieldState.error)}</FieldError> : null}
            </>
          )}
        />
      </Section>

      <Section title="Tabla de posiciones" description="Puntos por partido y cómo se desempata.">
        <LockNote reason={locks.standings} />
        <Controller
          name="standingsConfig"
          control={form.control}
          render={({ field, fieldState }) => (
            <>
              <StandingsFields
                value={field.value}
                scoringType={scoringConfig.type}
                onChange={field.onChange}
                disabled={Boolean(locks.standings)}
              />
              {fieldState.error ? <FieldError>{firstErrorMessage(fieldState.error)}</FieldError> : null}
            </>
          )}
        />
      </Section>

      <Section title="Playoffs" description="Quiénes pasan de los grupos al cuadro eliminatorio.">
        <LockNote reason={locks.playoff} />
        <Controller
          name="playoffConfig"
          control={form.control}
          render={({ field }) => (
            <PlayoffFields value={field.value} onChange={field.onChange} disabled={Boolean(locks.playoff)} />
          )}
        />
      </Section>

      <div className="sticky bottom-20 z-10 flex justify-end md:bottom-4">
        <Button type="submit" size="lg" disabled={isPending} className="w-full shadow-sm sm:w-auto">
          {isPending ? <Spinner /> : null}
          {props.mode === "create" ? "Crear torneo" : "Guardar cambios"}
        </Button>
      </div>
    </form>
  );
}
