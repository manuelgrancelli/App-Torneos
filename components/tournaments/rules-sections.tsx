"use client";

import { Controller, useWatch } from "react-hook-form";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { FieldError } from "@/components/ui/field";
import { firstErrorMessage } from "@/lib/forms";
import { PlayoffFields, ScoringFields, StandingsFields } from "./config-fields";
import { playoffSummary, scoringSummary, standingsSummary } from "./config-summary";
import { LockNote, type TournamentFormApi } from "./tournament-fields";

/** Motivo por el que un grupo de campos no se puede editar (D-029). */
export type FormLocks = {
  scoring?: string;
  standings?: string;
  playoff?: string;
  timezone?: string;
};

/**
 * Puntuación, tabla de posiciones y playoffs, plegados con un resumen de una línea
 * (D-052). Los usan el asistente de alta (paso "Reglas") y la edición (D-054).
 */
export function RulesSections({ form, locks = {} }: { form: TournamentFormApi; locks?: FormLocks }) {
  const scoringConfig = useWatch({ control: form.control, name: "scoringConfig" });
  const standingsConfig = useWatch({ control: form.control, name: "standingsConfig" });
  const playoffConfig = useWatch({ control: form.control, name: "playoffConfig" });
  const { errors } = form.formState;

  return (
    <>
      <CollapsibleSection
        title="Puntuación"
        description="Cómo se juega y se valida cada partido."
        summary={scoringSummary(scoringConfig)}
        locked={Boolean(locks.scoring)}
        forceOpen={Boolean(errors.scoringConfig)}
      >
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
      </CollapsibleSection>

      <CollapsibleSection
        title="Tabla de posiciones"
        description="Puntos por partido y cómo se desempata."
        summary={standingsSummary(standingsConfig, scoringConfig.type)}
        locked={Boolean(locks.standings)}
        forceOpen={Boolean(errors.standingsConfig)}
      >
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
      </CollapsibleSection>

      <CollapsibleSection
        title="Playoffs"
        description="Quiénes pasan de los grupos al cuadro eliminatorio."
        summary={playoffSummary(playoffConfig)}
        locked={Boolean(locks.playoff)}
        forceOpen={Boolean(errors.playoffConfig)}
      >
        <LockNote reason={locks.playoff} />
        <Controller
          name="playoffConfig"
          control={form.control}
          render={({ field }) => (
            <PlayoffFields value={field.value} onChange={field.onChange} disabled={Boolean(locks.playoff)} />
          )}
        />
      </CollapsibleSection>
    </>
  );
}
