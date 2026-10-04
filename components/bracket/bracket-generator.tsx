"use client";

import { Network } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { generateBracket } from "@/app/(app)/torneos/[id]/cuadro/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { cardsFromPlan } from "@/lib/competition-view";
import { type Qualifier, buildBracket } from "@/lib/domain/bracket";
import { BracketView } from "./bracket-view";

type BracketGeneratorProps = {
  tournamentId: string;
  timezone: string;
  /** Todos los equipos de cada grupo, en orden de la tabla (con su rating). */
  candidates: Qualifier[];
  groupCount: number;
  teamNames: Record<string, string>;
  defaultQualifiers: number;
  defaultThirdPlace: boolean;
  hasBracket: boolean;
};

/** Configuración y vista previa del cuadro antes de generarlo. */
export function BracketGenerator(props: BracketGeneratorProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const maxPerGroup = Math.max(1, ...Array.from({ length: props.groupCount }, (_, g) => props.candidates.filter((c) => c.group === g).length));
  const [perGroup, setPerGroup] = useState(Math.min(props.defaultQualifiers, maxPerGroup));
  const [thirdPlace, setThirdPlace] = useState(props.defaultThirdPlace);
  const names = useMemo(() => new Map(Object.entries(props.teamNames)), [props.teamNames]);

  const preview = useMemo(() => {
    const qualifiers = props.candidates.filter((c) => c.place <= perGroup);
    if (qualifiers.length < 2 || qualifiers.length > 32) return null;
    return buildBracket(qualifiers, { thirdPlace });
  }, [props.candidates, perGroup, thirdPlace]);

  function generate() {
    startTransition(async () => {
      const result = await generateBracket({ tournamentId: props.tournamentId, qualifiersPerGroup: perGroup, thirdPlace });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Generamos el cuadro.");
      for (const warning of result.data.warnings) toast.warning(warning);
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">{props.hasBracket ? "Rearmar el cuadro" : "Armar el cuadro"}</h2>
        </CardTitle>
        <CardDescription>
          Cruces tipo 1° de un grupo contra 2° de otro, evitando que equipos del mismo grupo se crucen en la primera
          ronda. Si los clasificados no completan el cuadro, los mejores pasan directo (bye).
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-4 sm:flex-row sm:items-end">
          <Field className="sm:w-56">
            <FieldLabel htmlFor="bracket-qualifiers">Clasifican por grupo</FieldLabel>
            <NativeSelect
              id="bracket-qualifiers"
              className="w-full"
              value={String(perGroup)}
              onChange={(e) => setPerGroup(Number(e.target.value))}
            >
              {Array.from({ length: maxPerGroup }, (_, i) => i + 1).map((n) => (
                <NativeSelectOption key={n} value={String(n)}>
                  {n === 1 ? "El primero" : `Los ${n} primeros`} ({n * props.groupCount} equipos)
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Field orientation="horizontal">
            <Switch id="bracket-third" checked={thirdPlace} onCheckedChange={setThirdPlace} />
            <FieldLabel htmlFor="bracket-third">Partido por el 3er puesto</FieldLabel>
          </Field>
        </div>

        {preview ? (
          <>
            {preview.warnings.map((warning) => (
              <p key={warning} className="rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
                {warning}
              </p>
            ))}
            <BracketView cards={cardsFromPlan(preview, names)} timezone={props.timezone} />
          </>
        ) : (
          <p className="text-sm text-muted-foreground">Con esa configuración no se puede armar un cuadro (2 a 32 equipos).</p>
        )}

        <Button type="button" onClick={generate} disabled={!preview || isPending}>
          {isPending ? <Spinner /> : <Network aria-hidden="true" />}
          {props.hasBracket ? "Rearmar cuadro" : "Generar cuadro"}
        </Button>
      </CardContent>
    </Card>
  );
}
