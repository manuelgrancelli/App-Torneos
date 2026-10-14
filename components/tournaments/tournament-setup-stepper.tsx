"use client";

import { ArrowLeft, ArrowRight, Check, Clock, Layers, Sparkles, Trophy, Users } from "lucide-react";
import Link from "next/link";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { cn } from "@/lib/utils";

export type SetupStepKey = "torneo" | "categorias" | "franjas" | "inscripciones";

type SetupStepInfo = {
  key: SetupStepKey;
  number: number;
  label: string;
  shortLabel: string;
  icon: typeof Trophy;
  path: string;
  description: string;
};

const STEPS: readonly SetupStepInfo[] = [
  {
    key: "torneo",
    number: 1,
    label: "Datos del torneo",
    shortLabel: "Torneo",
    icon: Trophy,
    path: "",
    description: "Información básica, deporte, fechas y cupo de participantes.",
  },
  {
    key: "categorias",
    number: 2,
    label: "Categorías",
    shortLabel: "Categorías",
    icon: Layers,
    path: "categorias",
    description: "Niveles y divisiones del torneo (ej. 6ta Caballeros, 8va Damas).",
  },
  {
    key: "franjas",
    number: 3,
    label: "Franjas horarias",
    shortLabel: "Franjas",
    icon: Clock,
    path: "canchas-franjas",
    description: "Canchas disponibles y turnos de juego para la programación.",
  },
  {
    key: "inscripciones",
    number: 4,
    label: "Inscripciones",
    shortLabel: "Inscripciones",
    icon: Users,
    path: "inscripciones",
    description: "Apertura de inscripciones, link de invitación y parejas anotadas.",
  },
] as const;

export type TournamentSetupStepperProps = {
  tournamentId: string;
  currentStep: SetupStepKey;
  counts?: {
    categories?: number;
    slots?: number;
    courts?: number;
    approvedTeams?: number;
  };
  isRegistrationOpen?: boolean;
  /** Permite ocultar el banner contextual explicativo y mostrar solo la barra de pasos */
  compact?: boolean;
};

export function TournamentSetupStepper({
  tournamentId,
  currentStep,
  counts = {},
  isRegistrationOpen = false,
  compact = false,
}: TournamentSetupStepperProps) {
  const foundIndex = STEPS.findIndex((s) => s.key === currentStep);
  const currentIndex = foundIndex === -1 ? 0 : foundIndex;
  const currentStepInfo: SetupStepInfo = STEPS[currentIndex] ?? (STEPS[0] as SetupStepInfo);
  const base = `/torneos/${tournamentId}`;

  // Determinamos el siguiente paso lógico
  const nextStep = currentIndex < STEPS.length - 1 ? STEPS[currentIndex + 1] : null;
  const prevStep = currentIndex > 1 ? STEPS[currentIndex - 1] : null;

  const nextHref = nextStep ? (nextStep.path ? `${base}/${nextStep.path}` : base) : base;
  const prevHref = prevStep ? (prevStep.path ? `${base}/${prevStep.path}` : base) : base;

  return (
    <div className="space-y-4">
      {/* Barra de progreso / Stepper */}
      <Card className="border-border/80 bg-card shadow-xs">
        <CardContent className="p-3 sm:p-4">
          <nav aria-label="Asistente de configuración del torneo" className="space-y-3">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span className="flex items-center gap-1.5 font-semibold text-foreground">
                <Sparkles className="size-3.5 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                Asistente de preparación · Paso {currentStepInfo.number} de {STEPS.length}
              </span>
              <span className="hidden sm:inline-block font-medium">Divulgación progresiva: configurá paso a paso</span>
            </div>

            <ol className="flex items-center gap-1.5 sm:gap-2">
              {STEPS.map((step, index) => {
                const isCurrent = step.key === currentStep;
                // Un paso se considera completado si es anterior al actual,
                // o si tiene métricas de haber sido completado
                let isDone = index < currentIndex;
                if (step.key === "torneo") isDone = true;
                if (step.key === "categorias" && (counts.categories ?? 0) > 0) isDone = true;
                if (step.key === "franjas" && (counts.slots ?? 0) > 0) isDone = true;
                if (step.key === "inscripciones" && isRegistrationOpen) isDone = true;

                const stepHref = step.path ? `${base}/${step.path}` : base;

                const indicator = (
                  <span
                    aria-hidden="true"
                    className={cn(
                      "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-all duration-200",
                      isCurrent &&
                        "bg-emerald-600 text-white font-bold ring-4 ring-emerald-500/25 shadow-sm shadow-emerald-600/30 scale-105",
                      isDone && !isCurrent &&
                        "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 group-hover:bg-emerald-500/25",
                      !isDone && !isCurrent && "border border-border/80 bg-muted/50 text-muted-foreground",
                    )}
                  >
                    {isDone && !isCurrent ? <Check className="size-3.5 stroke-[2.5]" /> : step.number}
                  </span>
                );

                const labelContent = (
                  <span
                    className={cn(
                      "text-xs sm:text-sm transition-colors",
                      isCurrent ? "font-bold text-foreground tracking-tight" : "text-muted-foreground group-hover:text-foreground font-medium",
                    )}
                  >
                    <span className="sr-only">
                      {isDone ? "Completado: " : isCurrent ? "Actual: " : "Pendiente: "}
                    </span>
                    <span className="hidden md:inline">{step.label}</span>
                    <span className="md:hidden">{step.shortLabel}</span>
                  </span>
                );

                return (
                  <li
                    key={step.key}
                    aria-current={isCurrent ? "step" : undefined}
                    className={cn("flex items-center gap-1.5 sm:gap-2", index < STEPS.length - 1 && "flex-1")}
                  >
                    <Link
                      href={stepHref}
                      className={cn(
                        "group flex items-center gap-1.5 rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
                        !isCurrent && !isDone && "opacity-70 hover:opacity-100",
                      )}
                    >
                      {indicator}
                      {labelContent}
                    </Link>

                    {index < STEPS.length - 1 ? (
                      <span
                        aria-hidden="true"
                        className={cn(
                          "h-0.5 min-w-2 flex-1 rounded-full transition-all duration-300",
                          index < currentIndex || isDone ? "bg-emerald-600 dark:bg-emerald-500" : "bg-border/80",
                        )}
                      />
                    ) : null}
                  </li>
                );
              })}
            </ol>
          </nav>
        </CardContent>
      </Card>

      {/* Banner contextual de guía y acción de siguiente paso (si no es compact) */}
      {!compact ? (
        <div className="flex flex-col gap-3 rounded-xl border border-border/80 bg-card/60 p-4 sm:flex-row sm:items-center sm:justify-between shadow-xs">
          <div className="space-y-1">
            <h2 className="text-base font-bold tracking-tight text-foreground flex items-center gap-2">
              <span>{currentStepInfo.label}</span>
              {currentStep === "categorias" && (counts.categories ?? 0) > 0 ? (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  {counts.categories} agregada{counts.categories === 1 ? "" : "s"}
                </span>
              ) : null}
              {currentStep === "franjas" && (counts.slots ?? 0) > 0 ? (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  {counts.slots} franja{counts.slots === 1 ? "" : "s"} creada{counts.slots === 1 ? "" : "s"}
                </span>
              ) : null}
              {currentStep === "inscripciones" && isRegistrationOpen ? (
                <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
                  Inscripción abierta
                </span>
              ) : null}
            </h2>
            <p className="text-xs sm:text-sm text-muted-foreground leading-relaxed">{currentStepInfo.description}</p>
          </div>

          <div className="flex flex-wrap items-center gap-2 shrink-0">
            {prevStep ? (
              <Button asChild variant="outline" size="sm" className="h-9 border-border/80 hover:bg-muted font-medium transition-all">
                <Link href={prevHref}>
                  <ArrowLeft className="size-3.5" aria-hidden="true" />
                  <span className="hidden sm:inline">Paso anterior</span>
                  <span className="sm:hidden">Volver</span>
                </Link>
              </Button>
            ) : null}

            {nextStep ? (
              <Button
                asChild
                size="sm"
                className="h-9 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs hover:shadow-md hover:shadow-emerald-600/20 active:scale-[0.98] transition-all duration-150"
              >
                <Link href={nextHref}>
                  <span>Siguiente: {nextStep.shortLabel}</span>
                  <ArrowRight className="size-3.5 ml-1" aria-hidden="true" />
                </Link>
              </Button>
            ) : (
              <Button
                asChild
                size="sm"
                className="h-9 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs hover:shadow-md hover:shadow-emerald-600/20 active:scale-[0.98] transition-all duration-150"
              >
                <Link href={base}>
                  <span>Finalizar y ver resumen</span>
                  <ArrowRight className="size-3.5 ml-1" aria-hidden="true" />
                </Link>
              </Button>
            )}
          </div>
        </div>
      ) : null}
    </div>
  );
}
