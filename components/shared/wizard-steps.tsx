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
 * Indicador de pasos de un asistente (D-054, D-072). Dice dónde está el usuario, qué ya completó y
 * qué sigue. Diseñado con estética SaaS moderna: acento esmeralda deportivo,
 * microinteracciones táctiles y tipografía de alto contraste.
 */
export function WizardSteps({ steps, current, onSelect }: WizardStepsProps) {
  return (
    <nav aria-label="Pasos para crear el torneo" className="space-y-3">
      <div className="flex items-center justify-between text-xs sm:text-sm text-muted-foreground" aria-live="polite">
        <div className="flex items-center gap-1.5">
          <span className="inline-flex items-center rounded-full bg-emerald-500/10 px-2 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300">
            Paso {current + 1} de {steps.length}
          </span>
          <span className="font-bold text-foreground tracking-tight">{steps[current]}</span>
        </div>
        {steps[current + 1] ? (
          <span className="hidden sm:inline text-xs text-muted-foreground">
            Siguiente: <strong className="font-medium text-foreground">{steps[current + 1]}</strong>
          </span>
        ) : null}
      </div>

      <ol className="flex items-center gap-2">
        {steps.map((label, index) => {
          const done = index < current;
          const isCurrent = index === current;

          const marker = (
            <span
              aria-hidden="true"
              className={cn(
                "grid size-7 shrink-0 place-items-center rounded-full text-xs font-semibold transition-all duration-200",
                isCurrent &&
                  "bg-emerald-600 text-white font-bold ring-4 ring-emerald-500/25 shadow-sm shadow-emerald-600/30 scale-105",
                done &&
                  "bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border border-emerald-500/30 group-hover:bg-emerald-500/25",
                !done && !isCurrent && "border border-border/80 bg-muted/50 text-muted-foreground",
              )}
            >
              {done ? <Check className="size-3.5 stroke-[2.5]" /> : index + 1}
            </span>
          );

          const text = (
            <span
              className={cn(
                "text-xs sm:text-sm transition-colors",
                isCurrent
                  ? "font-bold text-foreground tracking-tight"
                  : "sr-only text-muted-foreground md:not-sr-only group-hover:text-foreground",
              )}
            >
              <span className="sr-only">{done ? "Completado: " : isCurrent ? "Actual: " : "Pendiente: "}</span>
              {label}
            </span>
          );

          return (
            <li
              key={label}
              aria-current={isCurrent ? "step" : undefined}
              className={cn("flex items-center gap-2", index < steps.length - 1 && "flex-1")}
            >
              {done && onSelect ? (
                <button
                  type="button"
                  onClick={() => onSelect(index)}
                  className="group flex items-center gap-1.5 rounded-full p-0.5 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500"
                >
                  {marker}
                  {text}
                </button>
              ) : (
                <div className="flex items-center gap-1.5">
                  {marker}
                  {text}
                </div>
              )}

              {index < steps.length - 1 ? (
                <span
                  aria-hidden="true"
                  className={cn(
                    "h-0.5 min-w-3 flex-1 rounded-full transition-all duration-300",
                    index < current ? "bg-emerald-600 dark:bg-emerald-500" : "bg-border/80",
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

