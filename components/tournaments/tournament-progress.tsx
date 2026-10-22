import { Check } from "lucide-react";
import { PHASE_TITLES } from "./phase-guide-model";
import { FinalizeTournamentStepButton } from "./finalize-tournament-step-button";
import { TOURNAMENT_STATUSES, type TournamentStatus } from "@/lib/domain/tournament-status";
import { cn } from "@/lib/utils";

export type TournamentProgressProps = {
  tournamentId?: string;
  tournamentName?: string;
  status: TournamentStatus;
  detail?: string;
  canFinish?: boolean;
};

/**
 * Progreso del torneo en 5 etapas (D-053). Es de presentación: el estado real lo cambia
 * `set_tournament_status`. En 360px solo la etapa actual lleva texto visible; las demás
 * lo conservan para lectores de pantalla. `detail` (por ejemplo "12/24") acompaña a la etapa actual.
 *
 * Cuando todas las categorías y partidos de playoffs han concluido, el paso 5 ("Final")
 * muestra un botón verde interactivo para finalizar el torneo oficialmente.
 */
export function TournamentProgress({
  tournamentId,
  tournamentName,
  status,
  detail,
  canFinish,
}: TournamentProgressProps) {
  const current = TOURNAMENT_STATUSES.indexOf(status);
  const total = TOURNAMENT_STATUSES.length;

  return (
    <nav aria-label="Progreso del torneo">
      <p className="sr-only">
        Etapa {current + 1} de {total}: {PHASE_TITLES[status]}
      </p>
      <ol className="flex items-center gap-1.5">
        {TOURNAMENT_STATUSES.map((step, index) => {
          const done = index < current || status === "finished";
          const isCurrent = index === current && status !== "finished";
          const isFinalStep = step === "finished";

          // En el paso 5 (Final), si todas las categorías/cruces están finalizados
          // y el torneo aún no pasó a 'finished', mostramos el botón verde interactivo.
          if (isFinalStep && canFinish && tournamentId && status !== "finished") {
            return (
              <li
                key={step}
                aria-current="step"
                className="flex items-center gap-1.5"
              >
                <FinalizeTournamentStepButton
                  tournamentId={tournamentId}
                  tournamentName={tournamentName}
                  stepNumber={index + 1}
                />
              </li>
            );
          }

          return (
            <li
              key={step}
              aria-current={isCurrent ? "step" : undefined}
              className={cn("flex items-center gap-1.5", index < total - 1 && "flex-1")}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-6 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors",
                  done && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  !done && !isCurrent && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3.5" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-sm whitespace-nowrap",
                  isCurrent ? "font-semibold" : "sr-only text-muted-foreground md:not-sr-only",
                )}
              >
                <span className="sr-only">{done ? "Completada: " : isCurrent ? "Actual: " : "Pendiente: "}</span>
                {done && isFinalStep ? "Finalizado" : PHASE_TITLES[step]}
                {isCurrent && detail ? (
                  <span className="ml-1.5 font-normal tabular-nums text-muted-foreground">{detail}</span>
                ) : null}
              </span>
              {index < total - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-0.5 min-w-3 flex-1 rounded-full transition-colors",
                    index < current
                      ? "bg-primary"
                      : index === 3 && canFinish
                        ? "bg-emerald-500/80"
                        : "bg-border",
                  )}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
