"use client";

import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { recordResult } from "@/app/(app)/torneos/[id]/partidos/actions";
import { NumberInput } from "@/components/shared/number-input";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel, FieldLegend, FieldSet } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { ToggleGroup, ToggleGroupItem } from "@/components/ui/toggle-group";
import {
  type MatchResult,
  type ScoringConfig,
  evaluateResult,
  isSuperTiebreakSet,
} from "@/lib/domain/scoring";

type ResultDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  matchId: string;
  stage: "group" | "playoff";
  round?: number;
  totalRounds?: number;
  isThirdPlace?: boolean;
  scoring: ScoringConfig;
  homeName: string;
  awayName: string;
  current: MatchResult | null;
  currentWalkover: boolean;
};

type Score = number | undefined;

/** Construye el resultado a partir de los inputs (los sets vacíos se ignoran). */
function buildResult(scoring: ScoringConfig, sets: [Score, Score][], goals: [Score, Score], penalties: [Score, Score]): MatchResult | null {
  if (scoring.type === "sets") {
    const filled = sets.filter(([h, a]) => h !== undefined && a !== undefined) as [number, number][];
    if (filled.length === 0) return null;
    return { type: "sets", sets: filled.map(([home, away]) => ({ home, away })) };
  }
  const [home, away] = goals;
  if (home === undefined || away === undefined) return null;
  const [ph, pa] = penalties;
  return {
    type: "goals",
    home,
    away,
    ...(home === away && ph !== undefined && pa !== undefined ? { penalties: { home: ph, away: pa } } : {}),
  };
}

/** Carga o corrección del resultado, validado en vivo con la configuración del torneo. */
export function ResultDialog(props: ResultDialogProps) {
  const { open, onOpenChange, scoring, homeName, awayName, stage, current } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const totalSets = scoring.type === "sets" ? scoring.bestOf : 0;

  const [walkover, setWalkover] = useState(props.currentWalkover);
  const [walkoverWinner, setWalkoverWinner] = useState<"home" | "away" | "">("");
  const [sets, setSets] = useState<[Score, Score][]>(() =>
    Array.from({ length: totalSets }, (_, i) =>
      current?.type === "sets" && current.sets[i] ? [current.sets[i].home, current.sets[i].away] : [undefined, undefined],
    ),
  );
  const [goals, setGoals] = useState<[Score, Score]>(
    current?.type === "goals" ? [current.home, current.away] : [undefined, undefined],
  );
  const [penalties, setPenalties] = useState<[Score, Score]>(
    current?.type === "goals" && current.penalties ? [current.penalties.home, current.penalties.away] : [undefined, undefined],
  );

  const matchContext = useMemo(
    () => ({ stage, round: props.round, totalRounds: props.totalRounds, isThirdPlace: props.isThirdPlace }),
    [stage, props.round, props.totalRounds, props.isThirdPlace],
  );

  const result = useMemo(() => buildResult(scoring, sets, goals, penalties), [scoring, sets, goals, penalties]);
  const evaluation = result ? evaluateResult(scoring, result, matchContext) : null;
  const winnerText =
    evaluation?.ok && evaluation.winner
      ? `Gana ${evaluation.winner === "home" ? homeName : awayName}`
      : evaluation?.ok
        ? "Empate"
        : null;

  const canSave = walkover ? walkoverWinner !== "" : Boolean(evaluation?.ok);
  const showPenalties = scoring.type === "goals" && stage === "playoff" && goals[0] !== undefined && goals[0] === goals[1];

  function save() {
    startTransition(async () => {
      const safeTotalRounds =
        props.stage === "playoff" && props.totalRounds && props.totalRounds > 0
          ? props.totalRounds
          : undefined;

      const response = walkover
        ? await recordResult({
            kind: "walkover",
            tournamentId: props.tournamentId,
            matchId: props.matchId,
            winner: walkoverWinner as "home" | "away",
            totalRounds: safeTotalRounds,
          })
        : await recordResult({
            kind: "score",
            tournamentId: props.tournamentId,
            matchId: props.matchId,
            result: result as MatchResult,
            totalRounds: safeTotalRounds,
          });
      if (!response.ok) {
        toast.error(response.error);
        return;
      }
      toast.success(response.message ?? "Guardamos el resultado.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-h-[90dvh] overflow-y-auto sm:max-w-md">
        <DialogHeader>
          <DialogTitle>Resultado</DialogTitle>
          <DialogDescription>
            {homeName} vs {awayName}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          <Field orientation="horizontal">
            <Switch id="result-wo" checked={walkover} onCheckedChange={setWalkover} />
            <FieldLabel htmlFor="result-wo">Ganó por W.O. (el rival no se presentó)</FieldLabel>
          </Field>

          {walkover ? (
            <FieldSet>
              <FieldLegend variant="label">¿Quién gana?</FieldLegend>
              <ToggleGroup
                type="single"
                variant="outline"
                value={walkoverWinner}
                onValueChange={(v) => setWalkoverWinner(v as "home" | "away" | "")}
                className="grid w-full grid-cols-2"
              >
                <ToggleGroupItem value="home" className="truncate">{homeName}</ToggleGroupItem>
                <ToggleGroupItem value="away" className="truncate">{awayName}</ToggleGroupItem>
              </ToggleGroup>
            </FieldSet>
          ) : scoring.type === "sets" ? (
            <div className="space-y-3">
              {sets.map(([home, away], index) => {
                const isStb = isSuperTiebreakSet(scoring, index, matchContext);
                const label = isStb ? "Super tie-break" : `Set ${index + 1}`;
                const subtitle = isStb
                  ? `a ${scoring.superTiebreakPoints} pts (con dif. de 2)`
                  : undefined;
                return (
                  <div
                    key={index}
                    className="rounded-xl border border-border/70 bg-card/60 p-3 sm:p-3.5 space-y-2.5 transition-colors"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                        <span className="inline-block size-1.5 rounded-full bg-primary" />
                        {label}
                      </span>
                      {subtitle && (
                        <span className="text-[11px] font-medium text-amber-500 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          {subtitle}
                        </span>
                      )}
                    </div>

                    <div className="grid grid-cols-2 gap-3 sm:gap-4 items-center">
                      <div className="space-y-1">
                        <span
                          className="text-xs font-medium text-foreground truncate block text-center"
                          title={homeName}
                        >
                          {homeName}
                        </span>
                        <NumberInput
                          aria-label={`${label}: ${homeName}`}
                          min={0}
                          max={99}
                          value={home}
                          onChange={(v) =>
                            setSets((prev) => prev.map((s, i) => (i === index ? [v, s[1]] : s)))
                          }
                          className="text-center font-bold text-base"
                          placeholder="—"
                        />
                      </div>

                      <div className="space-y-1">
                        <span
                          className="text-xs font-medium text-foreground truncate block text-center"
                          title={awayName}
                        >
                          {awayName}
                        </span>
                        <NumberInput
                          aria-label={`${label}: ${awayName}`}
                          min={0}
                          max={99}
                          value={away}
                          onChange={(v) =>
                            setSets((prev) => prev.map((s, i) => (i === index ? [s[0], v] : s)))
                          }
                          className="text-center font-bold text-base"
                          placeholder="—"
                        />
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground px-0.5">
                {scoring.decidingSet === "super_tiebreak" && isSuperTiebreakSet(scoring, totalSets - 1, matchContext)
                  ? `El set decisivo es a super tie-break a ${scoring.superTiebreakPoints} puntos (con 2 de diferencia).`
                  : scoring.decidingSet === "super_tiebreak"
                    ? `En esta fase el partido se juega al mejor de ${scoring.bestOf} sets completos.`
                    : `Al mejor de ${scoring.bestOf} sets completos de ${scoring.gamesPerSet} games.`}
                {" "}Dejá vacíos los sets que no se jugaron.
              </p>
            </div>
          ) : (
            <div className="space-y-3">
              <div className="grid grid-cols-2 gap-3">
                <Field>
                  <FieldLabel htmlFor="goals-home" className="truncate">{homeName}</FieldLabel>
                  <NumberInput id="goals-home" min={0} max={99} value={goals[0]} onChange={(v) => setGoals([v, goals[1]])} />
                </Field>
                <Field>
                  <FieldLabel htmlFor="goals-away" className="truncate">{awayName}</FieldLabel>
                  <NumberInput id="goals-away" min={0} max={99} value={goals[1]} onChange={(v) => setGoals([goals[0], v])} />
                </Field>
              </div>
              {showPenalties ? (
                <FieldSet>
                  <FieldLegend variant="label">Penales</FieldLegend>
                  <div className="grid grid-cols-2 gap-3">
                    <NumberInput aria-label={`Penales: ${homeName}`} min={0} max={99} value={penalties[0]} onChange={(v) => setPenalties([v, penalties[1]])} />
                    <NumberInput aria-label={`Penales: ${awayName}`} min={0} max={99} value={penalties[1]} onChange={(v) => setPenalties([penalties[0], v])} />
                  </div>
                </FieldSet>
              ) : null}
            </div>
          )}

          {!walkover && evaluation ? (
            evaluation.ok ? (
              <div className="rounded-lg border border-emerald-300/40 bg-emerald-50 px-3.5 py-2.5 text-sm font-medium text-emerald-900 dark:border-emerald-800/60 dark:bg-emerald-950/40 dark:text-emerald-200" aria-live="polite">
                {winnerText}
              </div>
            ) : (
              <ul className="list-disc space-y-1 rounded-lg border border-destructive/30 bg-destructive/10 px-3.5 py-2.5 pl-7 text-sm text-destructive dark:border-destructive/40 dark:bg-destructive/20 dark:text-red-300" role="alert">
                {evaluation.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )
          ) : null}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" onClick={() => onOpenChange(false)} disabled={isPending}>
            Cancelar
          </Button>
          <Button type="button" onClick={save} disabled={!canSave || isPending}>
            {isPending ? <Spinner /> : null}
            Guardar resultado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
