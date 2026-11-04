"use client";

import { AlertCircle, Check, CheckCircle2, Clock, Edit2, Play, Trophy, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { updateAmericanMatchScore } from "@/app/(app)/torneos/[id]/americano/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { AmericanMatch } from "@/lib/data/american";
import { validateAmericanScore } from "@/lib/domain/american-scoring";
import { cn } from "@/lib/utils";

export function AmericanMatchesBoard({
  tournamentId,
  matches,
  scoringMode = "fixed_points",
  targetPoints,
  roundDurationMinutes,
  readOnly = false,
}: {
  tournamentId: string;
  matches: AmericanMatch[];
  scoringMode?: "fixed_points" | "timed_round" | "single_set";
  targetPoints?: number;
  roundDurationMinutes?: number;
  readOnly?: boolean;
}) {
  const [selectedRound, setSelectedRound] = useState<number | "all">("all");

  if (matches.length === 0) {
    return (
      <div className="rounded-2xl border border-dashed border-border/80 bg-muted/20 p-8 text-center">
        <Trophy className="mx-auto size-8 text-muted-foreground/60 mb-2" />
        <p className="text-sm font-semibold text-foreground">El fixture aún no fue generado</p>
        <p className="text-xs text-muted-foreground mt-1">
          Completá el cupo de participantes y hacé clic en "Generar Fixture Americano" para comenzar los cruces.
        </p>
      </div>
    );
  }

  // Agrupar por rondas disponibles
  const rounds = Array.from(new Set(matches.map((m) => m.roundNumber))).sort((a, b) => a - b);
  const filteredMatches =
    selectedRound === "all" ? matches : matches.filter((m) => m.roundNumber === selectedRound);

  return (
    <div className="space-y-4">
      {/* Selector de Rondas */}
      <div className="flex items-center gap-1.5 overflow-x-auto pb-1 [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => setSelectedRound("all")}
          className={cn(
            "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border whitespace-nowrap",
            selectedRound === "all"
              ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
              : "bg-card text-muted-foreground hover:text-foreground border-border/80 hover:bg-muted"
          )}
        >
          Todas las rondas ({matches.length})
        </button>
        {rounds.map((r) => {
          const rMatches = matches.filter((m) => m.roundNumber === r);
          const completedCount = rMatches.filter((m) => m.status === "completed").length;
          const isComplete = completedCount === rMatches.length;

          return (
            <button
              key={r}
              type="button"
              onClick={() => setSelectedRound(r)}
              className={cn(
                "rounded-lg px-3 py-1.5 text-xs font-semibold transition-all cursor-pointer border flex items-center gap-1.5 whitespace-nowrap",
                selectedRound === r
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-card text-muted-foreground hover:text-foreground border-border/80 hover:bg-muted"
              )}
            >
              <span>Ronda {r}</span>
              <span
                className={cn(
                  "size-1.5 rounded-full",
                  isComplete ? "bg-emerald-400" : "bg-muted-foreground/60"
                )}
              />
            </button>
          );
        })}
      </div>

      {/* Grilla de partidos */}
      <div className="grid grid-cols-1 md:grid-cols-2 gap-3.5">
        {filteredMatches.map((match) => (
          <MatchScoreCard
            key={match.id}
            tournamentId={tournamentId}
            match={match}
            scoringMode={scoringMode}
            targetPoints={targetPoints}
            readOnly={readOnly}
          />
        ))}
      </div>
    </div>
  );
}

function MatchScoreCard({
  tournamentId,
  match,
  scoringMode,
  targetPoints,
  readOnly = false,
}: {
  tournamentId: string;
  match: AmericanMatch;
  scoringMode?: "fixed_points" | "timed_round" | "single_set";
  targetPoints?: number;
  readOnly?: boolean;
}) {
  const [scoreA, setScoreA] = useState<number | string>(match.scoreSideA ?? "");
  const [scoreB, setScoreB] = useState<number | string>(match.scoreSideB ?? "");
  const [isPending, startTransition] = useTransition();

  const isCompleted = match.status === "completed";
  const numScoreA = typeof scoreA === "number" ? scoreA : Number.parseInt(String(scoreA), 10);
  const numScoreB = typeof scoreB === "number" ? scoreB : Number.parseInt(String(scoreB), 10);

  const hasEnteredAny = scoreA !== "" || scoreB !== "";
  const validation = validateAmericanScore(numScoreA, numScoreB, {
    scoringMode,
    targetPoints,
  });

  const isWinA = isCompleted && match.scoreSideA !== null && match.scoreSideB !== null && match.scoreSideA > match.scoreSideB;
  const isWinB = isCompleted && match.scoreSideA !== null && match.scoreSideB !== null && match.scoreSideB > match.scoreSideA;

  const handleSave = () => {
    if (!validation.valid) {
      toast.error(validation.error || "El marcador no es válido para este formato.");
      return;
    }

    startTransition(async () => {
      const res = await updateAmericanMatchScore({
        tournamentId,
        matchId: match.id,
        scoreSideA: numScoreA,
        scoreSideB: numScoreB,
        status: "completed",
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success("Marcador registrado con éxito.");
    });
  };

  return (
    <div
      className={cn(
        "rounded-2xl border p-4 bg-card transition-all shadow-xs flex flex-col justify-between gap-3",
        isCompleted
          ? "border-border/80"
          : "border-emerald-500/30 bg-emerald-500/[0.02] ring-1 ring-emerald-500/20"
      )}
    >
      {/* Cabecera del partido: Ronda, Cancha, Turno y Estado */}
      <div className="flex items-center justify-between text-xs border-b border-border/60 pb-2.5">
        <div className="flex items-center gap-2">
          <span className="font-extrabold text-foreground">Ronda {match.roundNumber}</span>
          <span className="text-muted-foreground">·</span>
          <span className="rounded-md bg-muted px-2 py-0.5 font-semibold text-foreground">
            Cancha {match.courtNumber}
          </span>
          {match.shiftNumber > 1 && (
            <span className="rounded-md bg-amber-500/10 text-amber-700 dark:text-amber-300 border border-amber-500/20 px-2 py-0.5 font-medium">
              Turno {match.shiftNumber}
            </span>
          )}
        </div>

        <span
          className={cn(
            "inline-flex items-center gap-1 rounded-full px-2 py-0.5 text-[11px] font-semibold",
            isCompleted
              ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
              : "bg-muted text-muted-foreground"
          )}
        >
          {isCompleted ? (
            <>
              <Check className="size-3" />
              Finalizado
            </>
          ) : (
            <>
              <Clock className="size-3" />
              Pendiente
            </>
          )}
        </span>
      </div>

      {/* Lado A vs Lado B con inputs de tanteador */}
      <div className="space-y-2.5 py-1">
        {/* Lado A */}
        <div
          className={cn(
            "flex items-center justify-between rounded-xl p-2.5 transition-colors border",
            isWinA
              ? "bg-emerald-500/[0.08] border-emerald-500/40 text-foreground font-semibold"
              : "bg-muted/30 border-border/60 text-muted-foreground"
          )}
        >
          <div className="min-w-0 flex-1 pr-2">
            <span className={cn("text-xs block truncate", isWinA && "text-emerald-700 dark:text-emerald-300 font-bold")}>
              {match.playerA1Name}
              {match.playerA2Name && ` + ${match.playerA2Name}`}
            </span>
          </div>

          {readOnly ? (
            <span
              className={cn(
                "w-12 text-center font-extrabold text-sm py-1 rounded-md",
                isCompleted
                  ? isWinA
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black"
                    : "text-muted-foreground font-bold"
                  : "text-muted-foreground/40 font-bold"
              )}
            >
              {match.scoreSideA !== null ? match.scoreSideA : "-"}
            </span>
          ) : (
            <Input
              type="number"
              min={0}
              max={200}
              value={scoreA}
              onChange={(e) => setScoreA(e.target.value)}
              disabled={isPending}
              placeholder="0"
              className={cn(
                "w-16 text-center font-extrabold text-sm h-8",
                isWinA && "border-emerald-500 bg-background text-emerald-600 dark:text-emerald-400"
              )}
            />
          )}
        </div>

        {/* Lado B */}
        <div
          className={cn(
            "flex items-center justify-between rounded-xl p-2.5 transition-colors border",
            isWinB
              ? "bg-emerald-500/[0.08] border-emerald-500/40 text-foreground font-semibold"
              : "bg-muted/30 border-border/60 text-muted-foreground"
          )}
        >
          <div className="min-w-0 flex-1 pr-2">
            <span className={cn("text-xs block truncate", isWinB && "text-emerald-700 dark:text-emerald-300 font-bold")}>
              {match.playerB1Name}
              {match.playerB2Name && ` + ${match.playerB2Name}`}
            </span>
          </div>

          {readOnly ? (
            <span
              className={cn(
                "w-12 text-center font-extrabold text-sm py-1 rounded-md",
                isCompleted
                  ? isWinB
                    ? "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400 font-black"
                    : "text-muted-foreground font-bold"
                  : "text-muted-foreground/40 font-bold"
              )}
            >
              {match.scoreSideB !== null ? match.scoreSideB : "-"}
            </span>
          ) : (
            <Input
              type="number"
              min={0}
              max={200}
              value={scoreB}
              onChange={(e) => setScoreB(e.target.value)}
              disabled={isPending}
              placeholder="0"
              className={cn(
                "w-16 text-center font-extrabold text-sm h-8",
                isWinB && "border-emerald-500 bg-background text-emerald-600 dark:text-emerald-400"
              )}
            />
          )}
        </div>

        {/* Validación en tiempo real con sugerencia de autocompletado (solo organizador) */}
        {!readOnly && hasEnteredAny && (
          <div
            className={cn(
              "text-[11px] rounded-lg px-2.5 py-1.5 flex items-start gap-1.5 transition-all mt-0.5",
              validation.valid
                ? "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border border-emerald-500/30"
                : "bg-destructive/10 text-destructive border border-destructive/20 font-medium"
            )}
          >
            {validation.valid ? (
              <CheckCircle2 className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            ) : (
              <AlertCircle className="size-3.5 shrink-0 text-destructive mt-0.5" />
            )}
            <div className="flex-1 min-w-0">
              <span className="block leading-tight">
                {validation.valid ? validation.helper : validation.error}
              </span>
              {scoringMode === "fixed_points" && targetPoints && !validation.valid && !Number.isNaN(numScoreA) && numScoreA >= 0 && numScoreA <= targetPoints && (
                <button
                  type="button"
                  onClick={() => setScoreB(targetPoints - numScoreA)}
                  className="mt-1 text-[11px] font-bold underline text-primary hover:opacity-85 cursor-pointer block text-left"
                >
                  ⚡ Autocompletar a {targetPoints} pts (asignar {targetPoints - numScoreA} al Lado B)
                </button>
              )}
            </div>
          </div>
        )}
      </div>

      {/* Pie con botón de guardado (solo organizador) o estado (modo jugador) */}
      <div className="flex items-center justify-between pt-1 border-t border-border/50 text-[11px] text-muted-foreground">
        <span>
          {scoringMode === "single_set" ? (
            isCompleted ? (
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                Dif: +{Math.abs(numScoreA - numScoreB)} games
              </span>
            ) : (
              "A 1 set clásico"
            )
          ) : targetPoints ? (
            `A ${targetPoints} pts`
          ) : (
            "Tiempo corrido"
          )}
        </span>

        {!readOnly ? (
          <Button
            type="button"
            size="sm"
            onClick={handleSave}
            disabled={isPending || !validation.valid}
            className={cn(
              "h-7 text-xs px-3 font-semibold transition-all cursor-pointer",
              isCompleted
                ? "bg-muted hover:bg-muted/80 text-foreground border border-border"
                : "bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs",
              !validation.valid && "opacity-50 cursor-not-allowed hover:bg-muted"
            )}
          >
            {isPending ? (
              <Spinner />
            ) : isCompleted ? (
              <>
                <Edit2 className="size-3 mr-1" />
                Modificar
              </>
            ) : (
              <>
                <Check className="size-3 mr-1" />
                Guardar resultado
              </>
            )}
          </Button>
        ) : (
          <span className="text-[11px] font-medium text-muted-foreground/80">
            {isCompleted ? "Resultado oficial" : "En espera de juego"}
          </span>
        )}
      </div>
    </div>
  );
}

