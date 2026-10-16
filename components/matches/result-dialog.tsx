"use client";

import { Check, Trophy } from "lucide-react";
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
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import {
  type MatchResult,
  type ScoringConfig,
  evaluateResult,
  isSuperTiebreakSet,
} from "@/lib/domain/scoring";
import { cn } from "@/lib/utils";

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
      <DialogContent className="max-h-[92dvh] overflow-y-auto w-full sm:max-w-lg p-4 sm:p-6">
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="text-lg font-bold">
            {current ? "Editar resultado" : "Cargar resultado"}
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            {stage === "playoff" ? "Playoffs" : "Fase de grupos"} · {scoring.type === "sets" ? `Al mejor de ${scoring.bestOf} sets` : "Por goles"}
          </DialogDescription>
        </DialogHeader>

        {/* VS Card con nombres legibles */}
        <div className="rounded-xl border border-border/80 bg-muted/40 p-3 sm:p-3.5">
          <div className="flex items-center justify-between gap-3 text-sm">
            <div className="min-w-0 flex-1 text-left">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block pb-0.5">
                Equipo / Pareja 1
              </span>
              <p className="font-semibold text-foreground text-xs sm:text-sm leading-snug break-words">
                {homeName}
              </p>
            </div>
            <span className="shrink-0 rounded-full bg-muted-foreground/10 px-2 py-0.5 text-[10px] font-bold text-muted-foreground">
              VS
            </span>
            <div className="min-w-0 flex-1 text-right">
              <span className="text-[10px] font-semibold uppercase tracking-wider text-muted-foreground block pb-0.5">
                Equipo / Pareja 2
              </span>
              <p className="font-semibold text-foreground text-xs sm:text-sm leading-snug break-words">
                {awayName}
              </p>
            </div>
          </div>
        </div>

        <div className="space-y-4">
          <div className="flex items-center justify-between rounded-xl border border-border/70 bg-card/60 p-3">
            <div className="space-y-0.5 pr-2">
              <label htmlFor="result-wo" className="text-xs sm:text-sm font-medium cursor-pointer block">
                Victoria por W.O. (el rival no se presentó)
              </label>
              <p className="text-[11px] sm:text-xs text-muted-foreground">
                Se computará victoria al equipo que sí estuvo presente
              </p>
            </div>
            <Switch id="result-wo" checked={walkover} onCheckedChange={setWalkover} />
          </div>

          {walkover ? (
            <div className="space-y-2">
              <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider px-0.5">
                ¿Quién se lleva la victoria?
              </p>
              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                <button
                  type="button"
                  onClick={() => setWalkoverWinner("home")}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border text-left text-sm transition-all min-h-[48px]",
                    walkoverWinner === "home"
                      ? "border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary/30"
                      : "border-border bg-card text-foreground hover:bg-muted/60",
                  )}
                >
                  <span className="line-clamp-2 leading-snug">{homeName}</span>
                  {walkoverWinner === "home" ? <Check className="size-4 shrink-0 text-primary ml-2" /> : null}
                </button>
                <button
                  type="button"
                  onClick={() => setWalkoverWinner("away")}
                  className={cn(
                    "flex items-center justify-between p-3 rounded-xl border text-left text-sm transition-all min-h-[48px]",
                    walkoverWinner === "away"
                      ? "border-primary bg-primary/10 text-primary font-semibold ring-2 ring-primary/30"
                      : "border-border bg-card text-foreground hover:bg-muted/60",
                  )}
                >
                  <span className="line-clamp-2 leading-snug">{awayName}</span>
                  {walkoverWinner === "away" ? <Check className="size-4 shrink-0 text-primary ml-2" /> : null}
                </button>
              </div>
            </div>
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
                    className="rounded-xl border border-border/80 bg-card/70 p-3 sm:p-3.5 space-y-2.5 transition-colors shadow-xs"
                  >
                    <div className="flex items-center justify-between text-xs">
                      <span className="font-bold uppercase tracking-wider text-foreground flex items-center gap-1.5">
                        <span className="inline-block size-2 rounded-full bg-primary" />
                        {label}
                      </span>
                      {subtitle && (
                        <span className="text-[11px] font-semibold text-amber-600 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full">
                          {subtitle}
                        </span>
                      )}
                    </div>

                    <div className="space-y-2">
                      {/* Fila Equipo 1 */}
                      <div className="flex items-center justify-between gap-2.5 rounded-lg bg-muted/40 p-2 sm:px-3">
                        <span
                          className="text-xs sm:text-sm font-medium text-foreground line-clamp-2 flex-1"
                          title={homeName}
                        >
                          {homeName}
                        </span>
                        <div className="shrink-0">
                          <NumberInput
                            aria-label={`${label}: ${homeName}`}
                            min={0}
                            max={99}
                            value={home}
                            onChange={(v) =>
                              setSets((prev) => prev.map((s, i) => (i === index ? [v, s[1]] : s)))
                            }
                            className="w-12 sm:w-14 text-center font-bold text-base sm:text-lg"
                            placeholder="—"
                          />
                        </div>
                      </div>

                      {/* Fila Equipo 2 */}
                      <div className="flex items-center justify-between gap-2.5 rounded-lg bg-muted/40 p-2 sm:px-3">
                        <span
                          className="text-xs sm:text-sm font-medium text-foreground line-clamp-2 flex-1"
                          title={awayName}
                        >
                          {awayName}
                        </span>
                        <div className="shrink-0">
                          <NumberInput
                            aria-label={`${label}: ${awayName}`}
                            min={0}
                            max={99}
                            value={away}
                            onChange={(v) =>
                              setSets((prev) => prev.map((s, i) => (i === index ? [s[0], v] : s)))
                            }
                            className="w-12 sm:w-14 text-center font-bold text-base sm:text-lg"
                            placeholder="—"
                          />
                        </div>
                      </div>
                    </div>
                  </div>
                );
              })}
              <p className="text-xs text-muted-foreground px-0.5 leading-relaxed">
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
              <div className="rounded-xl border border-border/80 bg-card/70 p-3 sm:p-3.5 space-y-2.5 transition-colors shadow-xs">
                <span className="font-bold uppercase tracking-wider text-xs text-foreground flex items-center gap-1.5">
                  <span className="inline-block size-2 rounded-full bg-primary" />
                  Goles del partido
                </span>
                <div className="space-y-2">
                  <div className="flex items-center justify-between gap-2.5 rounded-lg bg-muted/40 p-2 sm:px-3">
                    <span className="text-xs sm:text-sm font-medium text-foreground line-clamp-2 flex-1" title={homeName}>
                      {homeName}
                    </span>
                    <div className="shrink-0">
                      <NumberInput
                        id="goals-home"
                        aria-label={`Goles: ${homeName}`}
                        min={0}
                        max={99}
                        value={goals[0]}
                        onChange={(v) => setGoals([v, goals[1]])}
                        className="w-12 sm:w-14 text-center font-bold text-base sm:text-lg"
                      />
                    </div>
                  </div>
                  <div className="flex items-center justify-between gap-2.5 rounded-lg bg-muted/40 p-2 sm:px-3">
                    <span className="text-xs sm:text-sm font-medium text-foreground line-clamp-2 flex-1" title={awayName}>
                      {awayName}
                    </span>
                    <div className="shrink-0">
                      <NumberInput
                        id="goals-away"
                        aria-label={`Goles: ${awayName}`}
                        min={0}
                        max={99}
                        value={goals[1]}
                        onChange={(v) => setGoals([goals[0], v])}
                        className="w-12 sm:w-14 text-center font-bold text-base sm:text-lg"
                      />
                    </div>
                  </div>
                </div>
              </div>

              {showPenalties ? (
                <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3 sm:p-3.5 space-y-2.5 shadow-xs">
                  <span className="font-bold uppercase tracking-wider text-xs text-amber-600 dark:text-amber-400 flex items-center gap-1.5">
                    <span className="inline-block size-2 rounded-full bg-amber-500" />
                    Definición por penales (empate)
                  </span>
                  <div className="space-y-2">
                    <div className="flex items-center justify-between gap-2.5 rounded-lg bg-background/80 p-2 sm:px-3">
                      <span className="text-xs sm:text-sm font-medium text-foreground line-clamp-2 flex-1" title={homeName}>
                        {homeName}
                      </span>
                      <div className="shrink-0">
                        <NumberInput
                          aria-label={`Penales: ${homeName}`}
                          min={0}
                          max={99}
                          value={penalties[0]}
                          onChange={(v) => setPenalties([v, penalties[1]])}
                          className="w-12 sm:w-14 text-center font-bold text-base sm:text-lg"
                        />
                      </div>
                    </div>
                    <div className="flex items-center justify-between gap-2.5 rounded-lg bg-background/80 p-2 sm:px-3">
                      <span className="text-xs sm:text-sm font-medium text-foreground line-clamp-2 flex-1" title={awayName}>
                        {awayName}
                      </span>
                      <div className="shrink-0">
                        <NumberInput
                          aria-label={`Penales: ${awayName}`}
                          min={0}
                          max={99}
                          value={penalties[1]}
                          onChange={(v) => setPenalties([penalties[0], v])}
                          className="w-12 sm:w-14 text-center font-bold text-base sm:text-lg"
                        />
                      </div>
                    </div>
                  </div>
                </div>
              ) : null}
            </div>
          )}

          {!walkover && evaluation ? (
            evaluation.ok ? (
              <div
                className="flex items-center gap-2 rounded-xl border border-emerald-500/30 bg-emerald-500/10 p-3 text-xs sm:text-sm font-semibold text-emerald-900 dark:text-emerald-200"
                aria-live="polite"
              >
                <Trophy className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                <span>{winnerText}</span>
              </div>
            ) : (
              <ul
                className="list-disc space-y-1 rounded-xl border border-destructive/30 bg-destructive/10 p-3 pl-7 text-xs sm:text-sm text-destructive dark:border-destructive/40 dark:bg-destructive/20 dark:text-red-300"
                role="alert"
              >
                {evaluation.errors.map((error) => (
                  <li key={error}>{error}</li>
                ))}
              </ul>
            )
          ) : null}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="w-full sm:w-auto h-11 sm:h-9"
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={save}
            disabled={!canSave || isPending}
            className="w-full sm:w-auto h-11 sm:h-9 font-semibold"
          >
            {isPending ? <Spinner /> : null}
            Guardar resultado
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
