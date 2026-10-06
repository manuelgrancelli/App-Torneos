"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { createCircuit } from "@/app/(app)/circuitos/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import type { Sport } from "@/lib/data/tournaments";
import {
  circuitSchema,
  DEFAULT_CIRCUIT_POINTS,
  ROUND_LABELS,
  type CircuitInput,
  type CircuitRound,
} from "@/lib/domain/circuits";
import { applyServerErrors } from "@/lib/forms";

const ROUNDS_CONFIG_ORDER: CircuitRound[] = [
  "champion",
  "runner_up",
  "semis",
  "quarters",
  "round_of_16",
  "round_of_32",
  "group_stage",
];

export function CircuitForm({ sports }: { sports: Sport[] }) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const form = useForm<CircuitInput>({
    resolver: zodResolver(circuitSchema),
    defaultValues: {
      name: "",
      sportId: sports.find((s) => s.id === "padel")?.id ?? sports[0]?.id ?? "",
      year: new Date().getFullYear(),
      description: "",
      pointsConfig: DEFAULT_CIRCUIT_POINTS,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await createCircuit(values);
      if (!result.ok) {
        applyServerErrors(form.setError, result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Circuito creado.");
      router.push(`/circuitos/${result.data.circuitId}`);
    });
  });

  function resetDefaultPoints() {
    form.setValue("pointsConfig", DEFAULT_CIRCUIT_POINTS, { shouldDirty: true });
    toast.info("Valores de puntuación restablecidos a los sugeridos.");
  }

  return (
    <form onSubmit={onSubmit} noValidate className="space-y-6">
      <Card>
        <CardHeader>
          <CardTitle>Información general</CardTitle>
          <CardDescription>
            Definí el nombre y el deporte de tu circuito o torneo anual.
          </CardDescription>
        </CardHeader>
        <CardContent className="space-y-4">
          <Field data-invalid={Boolean(form.formState.errors.name)}>
            <FieldLabel htmlFor="circuit-name">Nombre del circuito</FieldLabel>
            <Input
              id="circuit-name"
              placeholder="Ej: Circuito Anual de Pádel 2026"
              autoComplete="off"
              aria-invalid={Boolean(form.formState.errors.name)}
              {...form.register("name")}
            />
            {form.formState.errors.name ? <FieldError errors={[form.formState.errors.name]} /> : null}
          </Field>

          <div className="grid gap-4 sm:grid-cols-2">
            <Field data-invalid={Boolean(form.formState.errors.sportId)}>
              <FieldLabel htmlFor="circuit-sport">Deporte</FieldLabel>
              <select
                id="circuit-sport"
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
                {...form.register("sportId")}
              >
                {sports.map((sport) => (
                  <option key={sport.id} value={sport.id}>
                    {sport.name}
                  </option>
                ))}
              </select>
              {form.formState.errors.sportId ? <FieldError errors={[form.formState.errors.sportId]} /> : null}
            </Field>

            <Field data-invalid={Boolean(form.formState.errors.year)}>
              <FieldLabel htmlFor="circuit-year">Año de la temporada</FieldLabel>
              <Input
                id="circuit-year"
                type="number"
                min={2000}
                max={2100}
                {...form.register("year", { valueAsNumber: true })}
              />
              {form.formState.errors.year ? <FieldError errors={[form.formState.errors.year]} /> : null}
            </Field>
          </div>

          <Field data-invalid={Boolean(form.formState.errors.description)}>
            <FieldLabel htmlFor="circuit-description">Descripción (opcional)</FieldLabel>
            <Textarea
              id="circuit-description"
              placeholder="Información sobre las etapas, fechas y reglamento del circuito..."
              rows={3}
              {...form.register("description")}
            />
            {form.formState.errors.description ? (
              <FieldError errors={[form.formState.errors.description]} />
            ) : null}
          </Field>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <div className="flex flex-wrap items-center justify-between gap-2">
            <div>
              <CardTitle>Puntuación por ronda alcanzada</CardTitle>
              <CardDescription>
                Configurá cuántos puntos sumará cada jugador según la fase alcanzada en cada fecha.
              </CardDescription>
            </div>
            <Button type="button" variant="outline" size="sm" onClick={resetDefaultPoints}>
              Valores sugeridos
            </Button>
          </div>
        </CardHeader>
        <CardContent>
          <div className="grid gap-4 sm:grid-cols-2 md:grid-cols-3 lg:grid-cols-4">
            {ROUNDS_CONFIG_ORDER.map((round) => (
              <Field key={round} data-invalid={Boolean(form.formState.errors.pointsConfig?.[round])}>
                <FieldLabel htmlFor={`points-${round}`}>{ROUND_LABELS[round]}</FieldLabel>
                <div className="flex items-center gap-2">
                  <Input
                    id={`points-${round}`}
                    type="number"
                    min={0}
                    max={10000}
                    className="tabular-nums"
                    {...form.register(`pointsConfig.${round}`, { valueAsNumber: true })}
                  />
                  <span className="text-xs text-muted-foreground">pts</span>
                </div>
                {form.formState.errors.pointsConfig?.[round] ? (
                  <FieldError errors={[form.formState.errors.pointsConfig[round]]} />
                ) : null}
              </Field>
            ))}
          </div>
        </CardContent>
      </Card>

      <div className="flex gap-3">
        <Button type="submit" disabled={isPending}>
          {isPending ? <Spinner /> : null}
          Crear circuito
        </Button>
        <Button type="button" variant="outline" onClick={() => router.back()}>
          Cancelar
        </Button>
      </div>
    </form>
  );
}
