import { Check } from "lucide-react";
import { cn } from "@/lib/utils";

type WizardStepsProps = {
  steps: readonly string[];
  /** Índice (desde 0) del paso actual. */
  current: number;
  /** Si viene, los pasos ya completados son botones para volver a ellos. */
  onSelect?: (index: number) => void;
};

/**
 * Indicador de pasos de un asistente (D-054). Dice dónde está el usuario, qué ya completó y
 * qué sigue. En 360px solo la etapa actual lleva texto visible; las demás lo conservan
 * para lectores de pantalla.
 */
export function WizardSteps({ steps, current, onSelect }: WizardStepsProps) {
  return (
    <nav aria-label="Pasos para crear el torneo" className="space-y-3">
      <p className="text-sm text-muted-foreground" aria-live="polite">
        Paso {current + 1} de {steps.length}
        <span aria-hidden="true"> · </span>
        <span className="font-medium text-foreground">{steps[current]}</span>
        {steps[current + 1] ? <span className="hidden sm:inline"> · Sigue: {steps[current + 1]}</span> : null}
      </p>
      <ol className="flex items-center gap-1.5">
        {steps.map((label, index) => {
          const done = index < current;
          const isCurrent = index === current;
          const marker = (
            <span
              aria-hidden="true"
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-colors",
                (done || isCurrent) && "bg-primary text-primary-foreground",
                isCurrent && "ring-4 ring-primary/20",
                !done && !isCurrent && "bg-muted text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5" /> : index + 1}
            </span>
          );
          const text = (
            <span className={cn("text-sm", isCurrent ? "font-semibold" : "sr-only text-muted-foreground md:not-sr-only")}>
              <span className="sr-only">{done ? "Completado: " : isCurrent ? "Actual: " : "Pendiente: "}</span>
              {label}
            </span>
          );
          return (
            <li
              key={label}
              aria-current={isCurrent ? "step" : undefined}
              className={cn("flex items-center gap-1.5", index < steps.length - 1 && "flex-1")}
            >
              {done && onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  className="flex items-center gap-1.5 rounded-full focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
                >
                  {marker}
                  {text}
                </button>
              ) : (
                <>
                  {marker}
                  {text}
                </>
              )}
              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn("h-0.5 min-w-3 flex-1 rounded-full", index < current ? "bg-primary" : "bg-border")}
                />
              ) : null}
            </li>
          );
        })}
      </ol>
    </nav>
  );
}
