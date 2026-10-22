import { Check } from "lucide-react";
import type { TournamentStatus } from "@/lib/domain/tournament-status";
import { cn } from "@/lib/utils";

/**
 * Etapas del torneo vistas por un jugador (D-122). A diferencia del stepper del
 * organizador no muestra "Preparación": el jugador recién lo ve con la inscripción abierta.
 */
const STEPS: { status: TournamentStatus; label: string }[] = [
  { status: "registration_open", label: "Inscripción" },
  { status: "group_stage", label: "Grupos" },
  { status: "playoffs", label: "Playoffs" },
  { status: "finished", label: "Final" },
];

export function PlayerStepper({ status, className }: { status: TournamentStatus; className?: string }) {
  const current = Math.max(
    0,
    STEPS.findIndex((s) => s.status === status),
  );
  const finished = status === "finished";

  return (
    <nav aria-label="Etapas del torneo" className={className}>
      <ol className="flex items-center gap-1.5">
        {STEPS.map((step, index) => {
          const done = index < current || finished;
          const isCurrent = index === current && !finished;
          return (
            <li
              key={step.status}
              aria-current={isCurrent ? "step" : undefined}
              className={cn("flex items-center gap-1.5", index < STEPS.length - 1 && "flex-1")}
            >
              <span
                aria-hidden="true"
                className={cn(
                  "grid size-5 shrink-0 place-items-center rounded-full text-[10px] font-semibold",
                  done && "bg-primary text-primary-foreground",
                  isCurrent && "bg-primary text-primary-foreground ring-4 ring-primary/20",
                  !done && !isCurrent && "bg-muted text-muted-foreground",
                )}
              >
                {done ? <Check className="size-3" /> : index + 1}
              </span>
              <span
                className={cn(
                  "text-xs whitespace-nowrap",
                  isCurrent ? "font-semibold text-foreground" : "sr-only text-muted-foreground sm:not-sr-only",
                )}
              >
                <span className="sr-only">{done ? "Completada: " : isCurrent ? "Actual: " : "Pendiente: "}</span>
                {step.label}
              </span>
              {index < STEPS.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn("h-0.5 min-w-3 flex-1 rounded-full", index < current || finished ? "bg-primary" : "bg-border")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
