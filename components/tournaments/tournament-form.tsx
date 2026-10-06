"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import type { z } from "zod";
import { updateTournament } from "@/app/(app)/torneos/[id]/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import type { ScoringConfig } from "@/lib/domain/scoring";
import type { StandingsConfig } from "@/lib/domain/standings";
import { applyServerErrors } from "@/lib/forms";
import { type CreateTournamentInput, createTournamentSchema } from "@/lib/validation/tournament";
import { type FormLocks, RulesSections } from "./rules-sections";
import {
  ConfirmationField,
  DateFields,
  DescriptionField,
  MaxTeamsField,
  NameField,
  TimezoneField,
} from "./tournament-fields";

export type { FormLocks };

export type SportOption = {
  id: string;
  name: string;
  minTeamSize: number;
  defaultScoringConfig: ScoringConfig;
  defaultStandingsConfig: StandingsConfig;
};

type TournamentFormProps = {
  tournamentId: string;
  sport: SportOption;
  defaults: Omit<CreateTournamentInput, "sportId" | "courtCount">;
  locks: FormLocks;
};

/**
 * Formulario de edición de un torneo (datos, puntuación, tabla y playoffs). El alta
 * es el asistente de `tournament-wizard.tsx` (D-054). Puntuación, tabla y playoffs van
 * plegados con un resumen (D-052).
 */
export function TournamentForm({ tournamentId, sport, defaults, locks }: TournamentFormProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<CreateTournamentInput, unknown, z.output<typeof createTournamentSchema>>({
    resolver: zodResolver(createTournamentSchema),
    defaultValues: { ...defaults, sportId: sport.id, courtCount: 1 },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      // En edición no se cambian el deporte ni la cantidad inicial de canchas.
      const result = await updateTournament({
        tournamentId,
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
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">Datos del torneo</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <FieldGroup>
            <NameField form={form} />
            <Field>
              <FieldLabel>Deporte</FieldLabel>
              <p className="text-sm">{sport.name}</p>
            </Field>
            <DescriptionField form={form} />
            <DateFields form={form} />
            <TimezoneField form={form} lockReason={locks.timezone} />
            <MaxTeamsField form={form} teamSize={sport.minTeamSize} />
            <ConfirmationField form={form} />
          </FieldGroup>
        </CardContent>
      </Card>

      <RulesSections form={form} locks={locks} />

      <div className="sticky bottom-20 z-10 flex justify-end md:bottom-4">
        <Button type="submit" size="lg" disabled={isPending} className="w-full shadow-sm sm:w-auto">
          {isPending ? <Spinner /> : null}
          Guardar cambios
        </Button>
      </div>
    </form>
  );
}
