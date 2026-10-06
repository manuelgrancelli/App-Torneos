"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { createTournament } from "@/app/(app)/torneos/actions";
import { WizardSteps } from "@/components/shared/wizard-steps";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldError, FieldGroup, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { applyServerErrors } from "@/lib/forms";
import { type CreateTournamentInput, createTournamentSchema } from "@/lib/validation/tournament";
import { RulesSections } from "./rules-sections";
import {
  ConfirmationField,
  CourtCountField,
  DateFields,
  DescriptionField,
  MaxTeamsField,
  NameField,
  TimezoneField,
} from "./tournament-fields";
import type { SportOption } from "./tournament-form";
import { TournamentReview } from "./tournament-review";

const STEPS = ["Lo básico", "Fechas y cupo", "Reglas", "Revisar y crear"] as const;
const LAST_STEP = STEPS.length - 1;

const STEP_TITLES = [
  { title: "Lo básico", description: "Cómo se llama el torneo y qué deporte se juega." },
  { title: "Fechas y cupo", description: "Cuándo se juega y cuántos equipos entran." },
  {
    title: "Reglas del juego",
    description: "Dejamos los valores recomendados para el deporte. Cambialos solo si lo necesitás.",
  },
  { title: "Revisá y creá el torneo", description: "Chequeá los datos. Podés cambiar todo después, mientras el torneo no empiece." },
] as const;

/** Campos que se validan en cada paso (el último solo revisa). */
const STEP_FIELDS = [
  ["name", "sportId", "description"],
  ["startsOn", "endsOn", "timezone", "maxTeams", "courtCount"],
  ["resultsRequireConfirmation", "scoringConfig", "standingsConfig", "playoffConfig"],
] as const satisfies readonly (readonly (keyof CreateTournamentInput)[])[];

/** Primer paso que contiene alguno de los campos con error. */
function stepOfFirstError(names: readonly string[]): number {
  const index = STEP_FIELDS.findIndex((fields) => (fields as readonly string[]).some((f) => names.includes(f)));
  return index === -1 ? 0 : index;
}

/**
 * Asistente de alta de torneo en 4 pasos (D-054): básico → fechas y cupo → reglas → revisión.
 * Un solo formulario de React Hook Form: los valores se conservan al ir y volver, y cada
 * paso valida solo sus campos. El esquema y la Server Action son los de siempre.
 */
export function TournamentWizard({ sports }: { sports: SportOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [isTestTournament, setIsTestTournament] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const skipFocus = useRef(true);

  // La página garantiza al menos un deporte en el catálogo.
  const initialSport = sports[0] as SportOption;

  const form = useForm<CreateTournamentInput, unknown, z.output<typeof createTournamentSchema>>({
    resolver: zodResolver(createTournamentSchema),
    defaultValues: {
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
  const sport = sports.find((s) => s.id === sportId) ?? initialSport;
  const values = useWatch({ control: form.control }) as CreateTournamentInput;

  // Al cambiar de paso el foco va al título, para que lectores de pantalla y teclado sigan el flujo.
  useEffect(() => {
    if (skipFocus.current) {
      skipFocus.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  async function goNext() {
    const fields = STEP_FIELDS[step];
    if (!fields) return;
    const valid = await form.trigger([...fields]);
    if (!valid) {
      const first = fields.find((name) => form.getFieldState(name).error);
      if (first) form.setFocus(first);
      toast.error("Revisá los campos marcados para continuar.");
      return;
    }
    setStep((current) => Math.min(current + 1, LAST_STEP));
  }

  const submit = form.handleSubmit(
    (data) => {
      startTransition(async () => {
        const result = await createTournament({ ...data, isTest: isTestTournament });
        if (!result.ok) {
          applyServerErrors(form.setError, result.fieldErrors);
          if (result.fieldErrors) setStep(stepOfFirstError(Object.keys(result.fieldErrors)));
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "Torneo creado.");
        router.push(`/torneos/${result.data.tournamentId}`);
      });
    },
    // Si algo de un paso anterior quedó inválido, se vuelve a ese paso.
    (errors) => {
      setStep(stepOfFirstError(Object.keys(errors)));
      toast.error("Hay datos para corregir antes de crear el torneo.");
    },
  );

  // Enter en un paso intermedio equivale a "Continuar"; recién en el último se crea.
  const onSubmit = (event: React.FormEvent<HTMLFormElement>) => {
    event.preventDefault();
    if (step < LAST_STEP) void goNext();
    else void submit();
  };

  const header = STEP_TITLES[step] as (typeof STEP_TITLES)[number];

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <WizardSteps steps={STEPS} current={step} onSelect={setStep} />

      <section aria-labelledby="wizard-step-title" className="space-y-5">
        <div className="space-y-1">
          <h2 id="wizard-step-title" ref={headingRef} tabIndex={-1} className="text-xl font-semibold outline-none">
            {header.title}
          </h2>
          <p className="text-sm text-muted-foreground">{header.description}</p>
        </div>

        {step === 0 ? (
          <FieldGroup>
            <NameField form={form} />
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
                      const next = sports.find((s) => s.id === e.target.value);
                      field.onChange(e.target.value);
                      // Cada deporte trae su puntuación y desempates por defecto.
                      if (next) {
                        form.setValue("scoringConfig", next.defaultScoringConfig);
                        form.setValue("standingsConfig", next.defaultStandingsConfig);
                      }
                    }}
                  >
                    {sports.map((s) => (
                      <NativeSelectOption key={s.id} value={s.id}>
                        {s.name} ({s.minTeamSize === 2 ? "parejas" : `equipos de ${s.minTeamSize}`})
                      </NativeSelectOption>
                    ))}
                  </NativeSelect>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
            <DescriptionField form={form} />
          </FieldGroup>
        ) : null}

        {step === 1 ? (
          <FieldGroup>
            <DateFields form={form} />
            <TimezoneField form={form} />
            <div className="grid gap-4 sm:grid-cols-2">
              <MaxTeamsField form={form} teamSize={sport.minTeamSize} />
              <CourtCountField form={form} />
            </div>
          </FieldGroup>
        ) : null}

        {step === 2 ? (
          <div className="space-y-4">
            <ConfirmationField form={form} />
            <div className="space-y-3">
              <RulesSections form={form} />
            </div>
          </div>
        ) : null}

        {step === 3 ? (
          <div className="space-y-5">
            <TournamentReview
              values={values}
              sportName={sport.name}
              teamSize={sport.minTeamSize}
              onEdit={setStep}
            />
            <Field orientation="horizontal">
              <Switch id="t-test-mode" checked={isTestTournament} onCheckedChange={setIsTestTournament} />
              <FieldContent>
                <FieldLabel htmlFor="t-test-mode">Crear como torneo privado de prueba</FieldLabel>
                <FieldDescription>
                  No se muestra en páginas públicas ni acepta inscripciones reales. Vas a poder completar los cupos con
                  parejas ficticias para probar grupos, fixture y cuadro.
                </FieldDescription>
              </FieldContent>
            </Field>
          </div>
        ) : null}
      </section>

      <div className="sticky bottom-20 z-10 flex items-center justify-between gap-2 rounded-xl border bg-background/95 p-2 shadow-sm backdrop-blur md:bottom-4">
        {step === 0 ? (
          <Button asChild variant="ghost" size="lg">
            <Link href="/torneos">Cancelar</Link>
          </Button>
        ) : (
          <Button type="button" variant="outline" size="lg" onClick={() => setStep(step - 1)} disabled={isPending}>
            <ArrowLeft aria-hidden="true" />
            Volver
          </Button>
        )}

        {step < LAST_STEP ? (
          <Button type="submit" size="lg">
            Continuar
            <ArrowRight aria-hidden="true" />
          </Button>
        ) : (
          <Button type="submit" size="lg" disabled={isPending}>
            {isPending ? <Spinner /> : <Check aria-hidden="true" />}
            Crear torneo
          </Button>
        )}
      </div>
    </form>
  );
}
