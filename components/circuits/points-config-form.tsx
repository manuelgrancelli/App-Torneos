"use client";

import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateCircuitPoints } from "@/app/(app)/circuitos/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import {
  DEFAULT_CIRCUIT_POINTS,
  ROUND_LABELS,
  type CircuitPointsConfig,
  type CircuitRound,
} from "@/lib/domain/circuits";

const ROUNDS_CONFIG_ORDER: CircuitRound[] = [
  "champion",
  "runner_up",
  "semis",
  "quarters",
  "round_of_16",
  "round_of_32",
  "group_stage",
];

export function PointsConfigForm({
  circuitId,
  currentPoints,
}: {
  circuitId: string;
  currentPoints: CircuitPointsConfig;
}) {
  const [isPending, startTransition] = useTransition();

  const form = useForm<{ pointsConfig: CircuitPointsConfig }>({
    defaultValues: { pointsConfig: currentPoints },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await updateCircuitPoints({
        circuitId,
        pointsConfig: values.pointsConfig,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? "Puntos actualizados.");
    });
  });

  function resetDefaultPoints() {
    form.setValue("pointsConfig", DEFAULT_CIRCUIT_POINTS, { shouldDirty: true });
    toast.info("Valores restablecidos a los sugeridos. Guardá los cambios para aplicar.");
  }

  return (
    <Card>
      <CardHeader>
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div>
            <CardTitle>Escala de puntos por ronda</CardTitle>
            <CardDescription>
              Modificá la cantidad de puntos que suma cada jugador según la fase máxima alcanzada en cada fecha.
            </CardDescription>
          </div>
          <Button type="button" variant="outline" size="sm" onClick={resetDefaultPoints}>
            Valores sugeridos
          </Button>
        </div>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-6">
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {ROUNDS_CONFIG_ORDER.map((round) => (
              <Field key={round}>
                <FieldLabel htmlFor={`edit-points-${round}`}>{ROUND_LABELS[round]}</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    id={`edit-points-${round}`}
                    type="number"
                    min={0}
                    max={10000}
                    className="tabular-nums"
                    {...form.register(`pointsConfig.${round}`, { valueAsNumber: true })}
                  />
                  <span className="text-xs text-muted-foreground">pts</span>
                </div>
              </Field>
            ))}
          </div>

          <Button type="submit" disabled={isPending}>
            {isPending ? <Spinner /> : null}
            Guardar cambios
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}
