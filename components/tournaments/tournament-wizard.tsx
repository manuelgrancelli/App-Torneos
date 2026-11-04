"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { ArrowLeft, ArrowRight, Check, FileEdit } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useEffect, useRef, useState, useTransition } from "react";
import { Controller, useForm, useWatch } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { createTournament } from "@/app/(app)/torneos/actions";
import { WizardSteps } from "@/components/shared/wizard-steps";
import { Button } from "@/components/ui/button";
import { Field, FieldContent, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { DEFAULT_TIMEZONE } from "@/lib/dates";
import { applyServerErrors } from "@/lib/forms";
import {
  clearTournamentDraft,
  getTournamentDraft,
  saveTournamentDraft,
} from "@/lib/storage/tournament-draft";
import { type CreateTournamentInput, createTournamentSchema } from "@/lib/validation/tournament";
import { RulesSections } from "./rules-sections";
import { SportSelector } from "./sport-selector";
import { AmericanTournamentFields } from "./american-tournament-fields";
import { TournamentFlyerField } from "./tournament-flyer-field";
import {
  ConfirmationField,
  DateFields,
  DescriptionField,
  NameField,
} from "./tournament-fields";
import type { SportOption } from "./tournament-form";
import { TournamentReview } from "./tournament-review";
import { VenuesAndCourtsField } from "./venues-and-courts-field";

const STEPS = ["Lo básico", "Fechas y canchas", "Reglas", "Revisar y crear"] as const;
const LAST_STEP = STEPS.length - 1;

const STEP_TITLES = [
  { title: "Lo básico", description: "Cómo se llama el torneo y qué deporte se juega." },
  { title: "Fechas y canchas", description: "Cuándo se juega y con cuántas canchas contás." },
  {
    title: "Reglas del juego",
    description: "Dejamos los valores recomendados para el deporte. Cambialos solo si lo necesitás.",
  },
  { title: "Revisá y creá el torneo", description: "Chequeá los datos. Podés cambiar todo después, mientras el torneo no empiece." },
] as const;

/** Campos que se validan en cada paso (el último solo revisa). */
const STEP_FIELDS = [
  ["name", "sportId", "description", "scoringConfig", "isAmerican", "americanConfig", "courtCount"],
  ["startsOn", "endsOn", "courtCount", "hasMultipleVenues", "venueName", "venues"],
  ["resultsRequireConfirmation", "scoringConfig", "standingsConfig", "playoffConfig", "bannerUrl"],
] as const satisfies readonly (readonly (keyof CreateTournamentInput)[])[];

/** Primer paso que contiene alguno de los campos con error. */
function stepOfFirstError(names: readonly string[]): number {
  const index = STEP_FIELDS.findIndex((fields) => (fields as readonly string[]).some((f) => names.includes(f)));
  return index === -1 ? 0 : index;
}

/**
 * Asistente de alta de torneo en 4 pasos (D-054, D-072, D-196): básico → fechas y cupo → reglas → revisión.
 * Con auto-guardado de borrador en localStorage y sincronización con el historial del navegador.
 */
export function TournamentWizard({ sports }: { sports: SportOption[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [step, setStep] = useState(0);
  const [isTestTournament, setIsTestTournament] = useState(false);
  const [hasRestoredDraft, setHasRestoredDraft] = useState(false);
  const headingRef = useRef<HTMLHeadingElement>(null);
  const skipFocus = useRef(true);
  const isLoadedRef = useRef(false);

  // La página garantiza al menos un deporte en el catálogo.
  const initialSport = sports[0] as SportOption;

  const defaultFormValues: CreateTournamentInput = {
    name: "",
    description: "",
    startsOn: "",
    endsOn: "",
    timezone: DEFAULT_TIMEZONE,
    maxTeams: 128,
    courtCount: 2,
    resultsRequireConfirmation: false,
    sportId: initialSport.id,
    scoringConfig: initialSport.defaultScoringConfig,
    standingsConfig: initialSport.defaultStandingsConfig,
    playoffConfig: { qualifiersPerGroup: 2, thirdPlace: false },
    bannerUrl: null,
    hasMultipleVenues: false,
    venueName: "",
    venues: [],
    isTest: false,
    isAmerican: false,
    americanConfig: {
      enabled: false,
      format: "INDIVIDUAL_ROTATIVO",
      scoringMode: "fixed_points",
      targetPoints: 24,
      roundDurationMinutes: 20,
      participantCount: 12,
      roundsCount: 5,
    },
  };

  const form = useForm<CreateTournamentInput, unknown, z.output<typeof createTournamentSchema>>({
    resolver: zodResolver(createTournamentSchema),
    defaultValues: defaultFormValues,
  });

  const sportId = useWatch({ control: form.control, name: "sportId" });
  const sport = sports.find((s) => s.id === sportId) ?? initialSport;
  const values = useWatch({ control: form.control }) as CreateTournamentInput;

  // 1. Cargar borrador persistido desde localStorage al montar
  useEffect(() => {
    if (isLoadedRef.current) return;
    isLoadedRef.current = true;

    const draft = getTournamentDraft();
    if (draft && draft.values) {
      const hasContent =
        Boolean(draft.values.name?.trim()) ||
        Boolean(draft.values.startsOn) ||
        (draft.values.venues && draft.values.venues.length > 0) ||
        draft.step > 0;

      if (hasContent) {
        form.reset({
          ...defaultFormValues,
          ...draft.values,
        });

        if (typeof draft.step === "number" && draft.step >= 0 && draft.step <= LAST_STEP) {
          setStep(draft.step);
          window.history.replaceState({ step: draft.step }, "");
        } else {
          window.history.replaceState({ step: 0 }, "");
        }

        if (typeof draft.isTestTournament === "boolean") {
          setIsTestTournament(draft.isTestTournament);
        }

        setHasRestoredDraft(true);
      } else {
        window.history.replaceState({ step: 0 }, "");
      }
    } else {
      window.history.replaceState({ step: 0 }, "");
    }
  }, [form]);

  // 2. Sincronizar botón "Atrás" del navegador (popstate) con los pasos del wizard
  useEffect(() => {
    const onPopState = (e: PopStateEvent) => {
      if (e.state && typeof e.state.step === "number") {
        setStep(e.state.step);
      } else {
        setStep(0);
      }
    };

    window.addEventListener("popstate", onPopState);
    return () => window.removeEventListener("popstate", onPopState);
  }, []);

  // 3. Auto-guardar borrador ante cualquier cambio en el formulario (debounced)
  useEffect(() => {
    const subscription = form.watch((currValues) => {
      if (!isLoadedRef.current) return;

      const hasContent =
        Boolean(currValues.name?.trim()) ||
        Boolean(currValues.startsOn) ||
        (currValues.venues && currValues.venues.length > 0) ||
        step > 0;

      if (!hasContent) return;

      const timer = setTimeout(() => {
        saveTournamentDraft({
          values: currValues as Partial<CreateTournamentInput>,
          step,
          isTestTournament,
          updatedAt: new Date().toISOString(),
        });
      }, 350);

      return () => clearTimeout(timer);
    });

    return () => subscription.unsubscribe();
  }, [form, step, isTestTournament]);

  // 4. Guardar paso e isTestTournament cuando cambian
  useEffect(() => {
    if (!isLoadedRef.current) return;
    const currentValues = form.getValues();
    const hasContent =
      Boolean(currentValues.name?.trim()) ||
      Boolean(currentValues.startsOn) ||
      (currentValues.venues && currentValues.venues.length > 0) ||
      step > 0;

    if (hasContent) {
      saveTournamentDraft({
        values: currentValues,
        step,
        isTestTournament,
        updatedAt: new Date().toISOString(),
      });
    }
  }, [step, isTestTournament, form]);

  // Al cambiar de paso el foco va al título, para que lectores de pantalla y teclado sigan el flujo.
  useEffect(() => {
    if (skipFocus.current) {
      skipFocus.current = false;
      return;
    }
    headingRef.current?.focus();
  }, [step]);

  const goToStep = (nextStep: number) => {
    if (nextStep === step) return;
    window.history.pushState({ step: nextStep }, "");
    setStep(nextStep);
  };

  const handleBack = () => {
    if (step > 0) {
      if (window.history.state && typeof window.history.state.step === "number" && window.history.state.step > 0) {
        window.history.back();
      } else {
        const prev = step - 1;
        window.history.replaceState({ step: prev }, "");
        setStep(prev);
      }
    }
  };

  const handleDiscardDraft = () => {
    clearTournamentDraft();
    form.reset(defaultFormValues);
    setStep(0);
    setIsTestTournament(false);
    setHasRestoredDraft(false);
    window.history.replaceState({ step: 0 }, "");
    toast.info("Borrador descartado. Comenzando nuevo torneo.");
  };

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
    const nextStep = Math.min(step + 1, LAST_STEP);
    goToStep(nextStep);
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
        // Limpiar el borrador local al crearse exitosamente
        clearTournamentDraft();
        if (data.isAmerican) {
          toast.success(
            result.message
              ? `${result.message} ¡Bienvenido al panel del Torneo Americano!`
              : "Torneo Americano creado con éxito."
          );
          router.push(`/torneos/${result.data.tournamentId}/americano`);
        } else {
          toast.success(
            result.message
              ? `${result.message} Ahora configurá las canchas y franjas horarias.`
              : "Torneo creado. Ahora configurá las canchas y franjas horarias."
          );
          router.push(`/torneos/${result.data.tournamentId}/canchas-franjas?asistente=1`);
        }
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
      {hasRestoredDraft && (
        <div className="flex items-center justify-between rounded-xl bg-amber-500/10 border border-amber-500/30 px-3.5 py-2.5 text-xs text-foreground animate-in fade-in-50 duration-200">
          <div className="flex items-center gap-2">
            <span className="flex size-2 rounded-full bg-amber-500" />
            <span>
              Recuperamos tu borrador en progreso de <strong>{values.name || "Torneo sin título"}</strong>.
            </span>
          </div>
          <button
            type="button"
            onClick={handleDiscardDraft}
            className="text-xs font-semibold text-muted-foreground hover:text-destructive underline cursor-pointer"
          >
            Empezar de cero
          </button>
        </div>
      )}

      <WizardSteps steps={STEPS} current={step} onSelect={goToStep} />

      <section aria-labelledby="wizard-step-title" className="space-y-6">
        <div key={step} className="space-y-6 animate-in fade-in-50 slide-in-from-right-3 duration-200">
          <div className="space-y-1">
            <h2
              id="wizard-step-title"
              ref={headingRef}
              tabIndex={-1}
              className="text-2xl font-extrabold tracking-tight text-foreground outline-none"
            >
              {header.title}
            </h2>
            <p className="text-sm text-muted-foreground leading-relaxed">{header.description}</p>
          </div>

          {step === 0 ? (
            <FieldGroup>
              <NameField form={form} />
              <Controller
                name="sportId"
                control={form.control}
                render={({ field }) => (
                  <SportSelector
                    sports={sports}
                    value={field.value}
                    isAmerican={values.isAmerican}
                    onAmericanChange={(isAmerican) => {
                      form.setValue("isAmerican", isAmerican, { shouldValidate: true });
                      form.setValue("americanConfig.enabled", isAmerican, { shouldValidate: true });
                      if (isAmerican) {
                        const count = form.getValues("americanConfig.participantCount") ?? 12;
                        form.setValue("maxTeams", count, { shouldValidate: true });
                      }
                    }}
                    onChange={(newSportId) => {
                      field.onChange(newSportId);
                      if (newSportId !== "padel") {
                        form.setValue("isAmerican", false, { shouldValidate: true });
                        form.setValue("americanConfig.enabled", false, { shouldValidate: true });
                      }
                      const s = sports.find((item) => item.id === newSportId);
                      if (s) {
                        form.setValue("scoringConfig", s.defaultScoringConfig, { shouldValidate: true });
                        form.setValue("standingsConfig", s.defaultStandingsConfig, { shouldValidate: true });
                      }
                    }}
                  />
                )}
              />

              {values.isAmerican && values.sportId === "padel" ? (
                <AmericanTournamentFields form={form} />
              ) : null}

              <DescriptionField form={form} />
            </FieldGroup>
          ) : null}

          {step === 1 ? (
            <FieldGroup>
              <DateFields form={form} />
              <VenuesAndCourtsField form={form} />
            </FieldGroup>
          ) : null}

          {step === 2 ? (
            <div className="space-y-4">
              <Controller
                name="bannerUrl"
                control={form.control}
                render={({ field }) => (
                  <TournamentFlyerField
                    value={field.value}
                    onChange={field.onChange}
                    disabled={isPending}
                    sportName={sport.name}
                  />
                )}
              />
              <ConfirmationField form={form} />
              {values.isAmerican && values.sportId === "padel" ? (
                <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/5 p-4 sm:p-5 space-y-3">
                  <div className="flex items-center gap-2">
                    <span className="flex size-2 rounded-full bg-emerald-500" />
                    <h3 className="text-sm font-bold text-foreground">Reglas del Torneo Americano</h3>
                  </div>
                  <p className="text-xs text-muted-foreground leading-relaxed">
                    {values.americanConfig?.format === "INDIVIDUAL_ROTATIVO"
                      ? "Modalidad Individual con Parejas Rotativas: cada jugador suma puntos individuales, cambiando de compañero y rivales en cada ronda."
                      : "Modalidad Parejas Fijas: las duplas compiten en formato todos contra todos (round-robin)."}
                  </p>
                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5 pt-1 text-xs">
                    <div className="rounded-xl border border-border/70 bg-card p-3">
                      <span className="font-semibold text-foreground block">Puntuación de los partidos:</span>
                      <span className="text-muted-foreground">
                        {values.americanConfig?.scoringMode === "fixed_points"
                          ? `A ${values.americanConfig?.targetPoints ?? 24} puntos corridos`
                          : `A tiempo corrido (${values.americanConfig?.roundDurationMinutes ?? 20} minutos por ronda)`}
                      </span>
                    </div>
                    <div className="rounded-xl border border-border/70 bg-card p-3">
                      <span className="font-semibold text-foreground block">Tabla de posiciones:</span>
                      <span className="text-muted-foreground">
                        1° Puntos acumulados · 2° Diferencia (+/-) · 3° Puntos a favor · 4° Duelo directo
                      </span>
                    </div>
                  </div>
                </div>
              ) : (
                <div className="space-y-3">
                  <RulesSections form={form} />
                </div>
              )}
            </div>
          ) : null}

          {step === 3 ? (
            <div className="space-y-5">
              <TournamentReview
                values={values}
                sportName={sport.name}
                teamSize={sport.minTeamSize}
                onEdit={goToStep}
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
        </div>
      </section>

      <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-2xl border border-border/80 bg-background/95 p-3 shadow-md backdrop-blur-md md:bottom-4">
        {step === 0 ? (
          <Button asChild variant="ghost" size="lg" className="hover:bg-muted font-medium">
            <Link href="/torneos">Cancelar</Link>
          </Button>
        ) : (
          <Button
            type="button"
            variant="outline"
            size="lg"
            onClick={handleBack}
            disabled={isPending}
            className="border-border/80 hover:bg-muted font-medium transition-all"
          >
            <ArrowLeft aria-hidden="true" />
            Volver
          </Button>
        )}

        {step < LAST_STEP ? (
          <Button
            type="submit"
            size="lg"
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs hover:shadow-md hover:shadow-emerald-600/20 active:scale-[0.98] transition-all duration-150"
          >
            Continuar
            <ArrowRight aria-hidden="true" />
          </Button>
        ) : (
          <Button
            type="submit"
            size="lg"
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs hover:shadow-md hover:shadow-emerald-600/20 active:scale-[0.98] transition-all duration-150"
          >
            {isPending ? <Spinner /> : <Check aria-hidden="true" />}
            Crear torneo
          </Button>
        )}
      </div>
    </form>
  );
}
