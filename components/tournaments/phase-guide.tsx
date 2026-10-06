"use client";

import { ArrowRight, Check, Circle } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changeTournamentStatus } from "@/app/(app)/torneos/[id]/actions";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { STATUS_LABELS, TRANSITION_ACTION_LABELS, type TournamentStatus } from "@/lib/domain/tournament-status";
import { cn } from "@/lib/utils";
import type { PhaseGuideModel } from "./phase-guide-model";

export type TransitionOption = { to: TournamentStatus; ok: boolean; reason?: string };

/** Qué pasa al entrar en cada estado (texto del diálogo de confirmación). */
const CONSEQUENCES: Record<TournamentStatus, string> = {
  draft: "El torneo deja de ser visible públicamente y no acepta inscripciones.",
  registration_open:
    "El torneo pasa a ser público y las parejas o equipos se pueden inscribir con el link o el código.",
  group_stage:
    "Se cierra la inscripción: los planteles y la disponibilidad quedan fijos y solo juegan las inscripciones aprobadas.",
  playoffs: "Se cierra la fase de grupos y se arma el cuadro eliminatorio con los clasificados.",
  finished: "El torneo queda finalizado y ya no se cargan resultados.",
};

function ProgressBar({ progress }: { progress: PhaseGuideModel["progress"] }) {
  const percent = progress.max > 0 ? Math.round((progress.value / progress.max) * 100) : 0;
  return (
    <div className="space-y-1.5">
      <div
        role="progressbar"
        aria-label="Progreso de la fase"
        aria-valuemin={0}
        aria-valuemax={progress.max}
        aria-valuenow={progress.value}
        aria-valuetext={progress.label}
        className="h-2 overflow-hidden rounded-full bg-muted"
      >
        <div className="h-full rounded-full bg-primary transition-all" style={{ width: `${percent}%` }} />
      </div>
      <p className="text-sm tabular-nums text-muted-foreground">{progress.label}</p>
    </div>
  );
}

/**
 * Guía de la fase actual (D-055): en qué fase está el torneo, qué se completó, qué falta
 * (cada paso lleva a la pantalla donde se hace) y la acción que lo hace avanzar. Las
 * reglas de cada transición las valida `checkTransition` y, al aplicarla, la base.
 */
export function PhaseGuide({
  tournamentId,
  status,
  guide,
  options,
}: {
  tournamentId: string;
  status: TournamentStatus;
  guide: PhaseGuideModel;
  options: TransitionOption[];
}) {
  const router = useRouter();

  async function changeTo(to: TournamentStatus) {
    const result = await changeTournamentStatus({ tournamentId, status: to });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message ?? "Actualizamos el estado.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <p className="text-sm font-medium text-muted-foreground">
          Fase {guide.phaseNumber} de {guide.phaseCount}
        </p>
        <CardTitle>
          <h2 className="text-xl font-semibold">{guide.title}</h2>
        </CardTitle>
        <CardDescription>{guide.intro}</CardDescription>
      </CardHeader>

      <CardContent className="space-y-5">
        {status !== "finished" ? <ProgressBar progress={guide.progress} /> : null}

        {guide.steps.length > 0 ? (
          <ul className="divide-y rounded-lg border" aria-label="Qué falta hacer">
            {guide.steps.map((step) => (
              <li key={step.label} className="flex flex-wrap items-center gap-x-3 gap-y-2 px-3 py-2.5">
                {step.done ? (
                  <Check className="size-5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                ) : (
                  <Circle className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                )}
                <div className="min-w-0 flex-1">
                  <p className={cn("text-sm font-medium", step.done && "text-muted-foreground")}>
                    <span className="sr-only">{step.done ? "Hecho: " : "Pendiente: "}</span>
                    {step.label}
                  </p>
                  {step.detail ? <p className="text-xs text-muted-foreground">{step.detail}</p> : null}
                </div>
                {!step.done && step.href ? (
                  <Button asChild variant="outline" size="sm">
                    <Link href={step.href}>
                      {step.actionLabel}
                      <ArrowRight aria-hidden="true" />
                    </Link>
                  </Button>
                ) : null}
              </li>
            ))}
          </ul>
        ) : null}

        {options.map((option) => (
          <div key={option.to} className="space-y-1.5">
            <ConfirmActionButton
              variant={option.to === "draft" ? "outline" : "default"}
              disabled={!option.ok}
              className="w-full sm:w-auto"
              title={`${TRANSITION_ACTION_LABELS[option.to]}?`}
              description={<p>{CONSEQUENCES[option.to]}</p>}
              confirmLabel={`Pasar a "${STATUS_LABELS[option.to]}"`}
              onConfirm={() => changeTo(option.to)}
            >
              {TRANSITION_ACTION_LABELS[option.to]}
            </ConfirmActionButton>
            {!option.ok && option.reason ? <p className="text-sm text-muted-foreground">{option.reason}</p> : null}
          </div>
        ))}

        {guide.nextPhase ? (
          <p className="text-sm text-muted-foreground">
            Sigue: <span className="font-medium text-foreground">{guide.nextPhase}</span>
          </p>
        ) : null}
      </CardContent>
    </Card>
  );
}
