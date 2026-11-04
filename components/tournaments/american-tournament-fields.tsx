"use client";

import { AlertCircle, Award, CheckCircle2, Clock, Flame, Sparkles, Target, Trophy, Users } from "lucide-react";
import { Controller } from "react-hook-form";
import { Field, FieldContent, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { cn } from "@/lib/utils";
import type { TournamentFormApi } from "./tournament-fields";

const QUICK_INDIVIDUAL_PARTICIPANTS = [8, 12, 16, 20, 24] as const;
const QUICK_PAIRS_COUNT = [4, 6, 8, 10, 12] as const;
const QUICK_POINTS = [16, 24, 32] as const;
const QUICK_MINUTES = [15, 20, 25, 30] as const;
const QUICK_ROUNDS = [3, 4, 5, 6, 7] as const;

export function AmericanTournamentFields({ form }: { form: TournamentFormApi }) {
  const format = form.watch("americanConfig.format") ?? "INDIVIDUAL_ROTATIVO";
  const scoringMode = form.watch("americanConfig.scoringMode") ?? "fixed_points";
  const participantCount = form.watch("americanConfig.participantCount") ?? 12;
  const targetPoints = form.watch("americanConfig.targetPoints") ?? 24;
  const roundDurationMinutes = form.watch("americanConfig.roundDurationMinutes") ?? 20;
  const roundsCount = form.watch("americanConfig.roundsCount") ?? 5;
  const courtCount = form.watch("courtCount") ?? 2;

  const isIndividual = format === "INDIVIDUAL_ROTATIVO";
  const isValidMultipleOf4 = isIndividual ? participantCount % 4 === 0 && participantCount >= 4 : true;

  // Cálculo de partidos simultáneos por ronda
  const matchesPerRound = isIndividual
    ? Math.floor(participantCount / 4)
    : Math.floor(participantCount / 2);

  // Turnos necesarios según canchas disponibles
  const shiftsNeeded = matchesPerRound > 0 && courtCount > 0
    ? Math.ceil(matchesPerRound / courtCount)
    : 1;

  const { errors } = form.formState;
  const participantError = errors.americanConfig?.participantCount?.message;

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-card p-4 sm:p-5 shadow-xs space-y-6 animate-in fade-in-50 duration-200">
      {/* Cabecera del Módulo Americano */}
      <div className="flex items-start justify-between gap-3 border-b border-border/70 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Trophy className="size-4" />
            </span>
            <h3 className="text-base font-bold text-foreground">Configuración del Torneo Americano</h3>
            <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
              <Sparkles className="size-3" />
              Pádel Express
            </span>
          </div>
          <p className="text-xs text-muted-foreground leading-relaxed">
            Formato ágil con rotación de partidos y tabla de posiciones por puntos acumulados o tiempo.
          </p>
        </div>
      </div>

      {/* 1. Modalidad del Americano: Individual Rotativo vs Parejas Fijas */}
      <div className="space-y-2">
        <FieldLabel className="text-sm font-semibold text-foreground">1. Formato de juego</FieldLabel>
        <div className="grid grid-cols-1 sm:grid-cols-2 gap-3">
          <button
            type="button"
            onClick={() => {
              form.setValue("americanConfig.format", "INDIVIDUAL_ROTATIVO", { shouldValidate: true });
              // Ajustar cantidad si no fuera múltiplo de 4
              if (participantCount % 4 !== 0) {
                const rounded = Math.max(8, Math.round(participantCount / 4) * 4);
                form.setValue("americanConfig.participantCount", rounded, { shouldValidate: true });
                form.setValue("maxTeams", rounded, { shouldValidate: true });
              }
            }}
            className={cn(
              "flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer relative",
              isIndividual
                ? "border-emerald-500 bg-emerald-500/[0.05] ring-2 ring-emerald-500/20 shadow-xs"
                : "border-border/80 bg-muted/30 hover:border-border hover:bg-muted/50"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Users className="size-4 text-emerald-600 dark:text-emerald-400" />
                Individual / Parejas Rotativas
              </span>
              {isIndividual && (
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Cada jugador suma puntos individuales y rota de compañero y rivales en cada ronda. Requiere múltiplo de 4 jugadores.
            </p>
          </button>

          <button
            type="button"
            onClick={() => {
              form.setValue("americanConfig.format", "PAREJAS_FIJAS", { shouldValidate: true });
            }}
            className={cn(
              "flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer relative",
              !isIndividual
                ? "border-emerald-500 bg-emerald-500/[0.05] ring-2 ring-emerald-500/20 shadow-xs"
                : "border-border/80 bg-muted/30 hover:border-border hover:bg-muted/50"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Users className="size-4 text-emerald-600 dark:text-emerald-400" />
                Parejas Fijas
              </span>
              {!isIndividual && (
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Duplas fijas predefinidas que compiten en formato todos contra todos (round-robin) en partidos cortos.
            </p>
          </button>
        </div>
      </div>

      {/* 2. Cantidad de Participantes */}
      <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <FieldLabel htmlFor="american-participants" className="text-sm font-semibold text-foreground">
              {isIndividual ? "2. Cantidad de jugadores individuales" : "2. Cantidad de parejas fijas"}
            </FieldLabel>
            <p className="text-xs text-muted-foreground mt-0.5">
              {isIndividual
                ? "Debe ser múltiplo de 4 para que ningún jugador quede sin jugar o sin compañero."
                : "Total de duplas inscriptas que jugarán el torneo."}
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Controller
              name="americanConfig.participantCount"
              control={form.control}
              render={({ field }) => (
                <Input
                  id="american-participants"
                  type="number"
                  min={isIndividual ? 4 : 2}
                  max={64}
                  step={isIndividual ? 4 : 1}
                  value={field.value}
                  onChange={(e) => {
                    const val = Number.parseInt(e.target.value, 10) || (isIndividual ? 8 : 4);
                    field.onChange(val);
                    form.setValue("maxTeams", val, { shouldValidate: true });
                  }}
                  className={cn(
                    "w-24 text-center font-bold text-base",
                    !isValidMultipleOf4 && "border-destructive focus-visible:ring-destructive"
                  )}
                />
              )}
            />
          </div>
        </div>

        {/* Botones de selección rápida */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs font-medium text-muted-foreground mr-1">Opciones rápidas:</span>
          {(isIndividual ? QUICK_INDIVIDUAL_PARTICIPANTS : QUICK_PAIRS_COUNT).map((num) => (
            <button
              key={num}
              type="button"
              onClick={() => {
                form.setValue("americanConfig.participantCount", num, { shouldValidate: true });
                form.setValue("maxTeams", num, { shouldValidate: true });
              }}
              className={cn(
                "rounded-lg px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer border",
                participantCount === num
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-card text-muted-foreground hover:text-foreground border-border/80 hover:bg-muted"
              )}
            >
              {num} {isIndividual ? "jugadores" : "parejas"}
            </button>
          ))}
        </div>

        {/* Indicador de validación de múltiplo de 4 */}
        {isIndividual && (
          <div className="pt-1">
            {isValidMultipleOf4 ? (
              <div className="flex items-center gap-1.5 text-xs text-emerald-600 dark:text-emerald-400 font-medium">
                <CheckCircle2 className="size-4 shrink-0" />
                <span>
                  ✓ {participantCount} jugadores = {matchesPerRound} {matchesPerRound === 1 ? "partido" : "partidos"} simultáneos por ronda.
                </span>
              </div>
            ) : (
              <div className="flex items-center gap-1.5 text-xs text-destructive font-medium">
                <AlertCircle className="size-4 shrink-0" />
                <span>
                  La cantidad ingresada ({participantCount}) no es múltiplo de 4. Elegí {Math.floor(participantCount / 4) * 4 || 8} o {(Math.floor(participantCount / 4) + 1) * 4} jugadores.
                </span>
              </div>
            )}
            {participantError && (
              <FieldError className="mt-1">{participantError}</FieldError>
            )}
          </div>
        )}
      </div>

      {/* 3. Modo de Puntuación: Puntos Fijos vs Tiempo vs Por Set (Diferencia de games) */}
      <div className="space-y-3">
        <FieldLabel className="text-sm font-semibold text-foreground">3. Sistema de puntuación</FieldLabel>
        
        <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
          <button
            type="button"
            onClick={() => form.setValue("americanConfig.scoringMode", "fixed_points", { shouldValidate: true })}
            className={cn(
              "flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer",
              scoringMode === "fixed_points"
                ? "border-emerald-500 bg-emerald-500/[0.05] ring-2 ring-emerald-500/20 shadow-xs"
                : "border-border/80 bg-muted/30 hover:border-border hover:bg-muted/50"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Target className="size-4 text-emerald-600 dark:text-emerald-400" />
                Por puntos fijos
              </span>
              {scoringMode === "fixed_points" && (
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              El partido termina cuando un lado alcanza los puntos objetivo (ej. a 24 puntos).
            </p>
          </button>

          <button
            type="button"
            onClick={() => form.setValue("americanConfig.scoringMode", "timed_round", { shouldValidate: true })}
            className={cn(
              "flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer",
              scoringMode === "timed_round"
                ? "border-emerald-500 bg-emerald-500/[0.05] ring-2 ring-emerald-500/20 shadow-xs"
                : "border-border/80 bg-muted/30 hover:border-border hover:bg-muted/50"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Clock className="size-4 text-emerald-600 dark:text-emerald-400" />
                Por tiempo fijo
              </span>
              {scoringMode === "timed_round" && (
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Partidos a reloj corrido (ej. 20 min). Al sonar la chicharra se anota el resultado actual.
            </p>
          </button>

          <button
            type="button"
            onClick={() => form.setValue("americanConfig.scoringMode", "single_set", { shouldValidate: true })}
            className={cn(
              "flex flex-col text-left p-3.5 rounded-xl border transition-all cursor-pointer",
              scoringMode === "single_set"
                ? "border-emerald-500 bg-emerald-500/[0.05] ring-2 ring-emerald-500/20 shadow-xs"
                : "border-border/80 bg-muted/30 hover:border-border hover:bg-muted/50"
            )}
          >
            <div className="flex items-center justify-between w-full">
              <span className="font-semibold text-sm text-foreground flex items-center gap-2">
                <Award className="size-4 text-emerald-600 dark:text-emerald-400" />
                A 1 set (Dif. de games)
              </span>
              {scoringMode === "single_set" && (
                <span className="size-2 rounded-full bg-emerald-500 shrink-0" />
              )}
            </div>
            <p className="text-xs text-muted-foreground mt-1.5 leading-relaxed">
              Gana el primer set (ej. 6-3 suma +3 pts; 7-6 suma +1 pto). Clasifica por diferencia de games.
            </p>
          </button>
        </div>

        {/* Detalle del selector de puntuación activa */}
        <div className="rounded-xl border border-border/80 bg-muted/20 p-3.5">
          {scoringMode === "fixed_points" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-foreground">
                  Puntaje objetivo por partido:
                </span>
                <Controller
                  name="americanConfig.targetPoints"
                  control={form.control}
                  render={({ field }) => (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={10}
                        max={60}
                        value={field.value}
                        onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10) || 24)}
                        className="w-20 text-center font-bold text-sm"
                      />
                      <span className="text-xs text-muted-foreground">pts</span>
                    </div>
                  )}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Estándar:</span>
                {QUICK_POINTS.map((pts) => (
                  <button
                    key={pts}
                    type="button"
                    onClick={() => form.setValue("americanConfig.targetPoints", pts, { shouldValidate: true })}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer border",
                      targetPoints === pts
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-card text-muted-foreground hover:text-foreground border-border/80 hover:bg-muted"
                    )}
                  >
                    A {pts} puntos {pts === 24 ? "(recomendado)" : ""}
                  </button>
                ))}
              </div>
            </div>
          ) : scoringMode === "timed_round" ? (
            <div className="space-y-2">
              <div className="flex items-center justify-between gap-3">
                <span className="text-xs font-semibold text-foreground">
                  Duración de cada ronda:
                </span>
                <Controller
                  name="americanConfig.roundDurationMinutes"
                  control={form.control}
                  render={({ field }) => (
                    <div className="flex items-center gap-1.5">
                      <Input
                        type="number"
                        min={5}
                        max={60}
                        value={field.value}
                        onChange={(e) => field.onChange(Number.parseInt(e.target.value, 10) || 20)}
                        className="w-20 text-center font-bold text-sm"
                      />
                      <span className="text-xs text-muted-foreground">min</span>
                    </div>
                  )}
                />
              </div>

              <div className="flex items-center gap-2 pt-1">
                <span className="text-xs text-muted-foreground">Estándar:</span>
                {QUICK_MINUTES.map((mins) => (
                  <button
                    key={mins}
                    type="button"
                    onClick={() => form.setValue("americanConfig.roundDurationMinutes", mins, { shouldValidate: true })}
                    className={cn(
                      "rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer border",
                      roundDurationMinutes === mins
                        ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                        : "bg-card text-muted-foreground hover:text-foreground border-border/80 hover:bg-muted"
                    )}
                  >
                    {mins} min {mins === 20 ? "(recomendado)" : ""}
                  </button>
                ))}
              </div>
            </div>
          ) : (
            <div className="space-y-1.5 text-xs">
              <span className="font-semibold text-foreground flex items-center gap-1.5">
                <Flame className="size-3.5 text-emerald-500" />
                Puntuación por Set (Diferencia de games):
              </span>
              <p className="text-muted-foreground leading-relaxed">
                Cada partido se anota con el tanteador clásico del set (ej. 6-3, 7-6, 6-4). En la tabla de posiciones, la dupla o jugador suma la <strong>diferencia neta de games</strong> de cada partido (quien gana 6-3 suma +3; quien gana 7-6 suma +1).
              </p>
            </div>
          )}
        </div>
      </div>

      {/* 4. Cantidad de Rondas a Disputar */}
      <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <FieldLabel htmlFor="american-rounds-count" className="text-sm font-semibold text-foreground">
              4. Cantidad de rondas a disputar
            </FieldLabel>
            <p className="text-xs text-muted-foreground mt-0.5">
              Cuántos partidos disputará cada jugador. Podés ajustarlo antes de generar el fixture.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Controller
              name="americanConfig.roundsCount"
              control={form.control}
              render={({ field }) => (
                <div className="flex items-center gap-1.5">
                  <Input
                    id="american-rounds-count"
                    type="number"
                    min={1}
                    max={20}
                    value={field.value ?? 5}
                    onChange={(e) => field.onChange(Math.max(1, Number.parseInt(e.target.value, 10) || 5))}
                    className="w-20 text-center font-bold text-sm"
                  />
                  <span className="text-xs text-muted-foreground">rondas</span>
                </div>
              )}
            />
          </div>
        </div>

        {/* Botones de selección rápida de rondas */}
        <div className="flex flex-wrap items-center gap-1.5 pt-1">
          <span className="text-xs font-medium text-muted-foreground mr-1">Rondas sugeridas:</span>
          {QUICK_ROUNDS.map((r) => (
            <button
              key={r}
              type="button"
              onClick={() => form.setValue("americanConfig.roundsCount", r, { shouldValidate: true })}
              className={cn(
                "rounded-md px-2.5 py-1 text-xs font-semibold transition-all cursor-pointer border",
                roundsCount === r
                  ? "bg-emerald-600 text-white border-emerald-600 shadow-xs"
                  : "bg-card text-muted-foreground hover:text-foreground border-border/80 hover:bg-muted"
              )}
            >
              {r} rondas {r === 5 ? "(estándar)" : r === 7 && participantCount === 8 ? "(completo)" : ""}
            </button>
          ))}
        </div>
      </div>

      {/* 5. Cantidad de Canchas y Logística */}
      <div className="space-y-3 rounded-xl border border-border/80 bg-muted/20 p-3.5">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
          <div>
            <FieldLabel htmlFor="american-court-count" className="text-sm font-semibold text-foreground">
              5. Canchas disponibles
            </FieldLabel>
            <p className="text-xs text-muted-foreground mt-0.5">
              Se crearán automáticamente para la asignación de turnos y cruces del torneo.
            </p>
          </div>

          <div className="flex items-center gap-2">
            <Controller
              name="courtCount"
              control={form.control}
              render={({ field }) => {
                const count = field.value ?? 2;
                return (
                  <div className="flex items-center gap-1">
                    <button
                      type="button"
                      onClick={() => field.onChange(Math.max(1, count - 1))}
                      disabled={count <= 1}
                      className="size-8 rounded-lg border border-border/80 bg-card text-foreground font-bold hover:bg-muted disabled:opacity-50 flex items-center justify-center cursor-pointer transition-colors"
                    >
                      -
                    </button>
                    <Input
                      id="american-court-count"
                      type="number"
                      min={1}
                      max={20}
                      value={count}
                      onChange={(e) => field.onChange(Math.max(1, Number.parseInt(e.target.value, 10) || 1))}
                      className="w-16 text-center font-bold text-base"
                    />
                    <button
                      type="button"
                      onClick={() => field.onChange(Math.min(20, count + 1))}
                      className="size-8 rounded-lg border border-border/80 bg-card text-foreground font-bold hover:bg-muted flex items-center justify-center cursor-pointer transition-colors"
                    >
                      +
                    </button>
                  </div>
                );
              }}
            />
          </div>
        </div>

        {/* Indicador logístico interactivo */}
        <div className="rounded-lg border border-border/60 bg-card/60 p-3 text-xs space-y-1">
          <div className="font-semibold text-foreground flex items-center gap-1.5">
            <Sparkles className="size-3.5 text-emerald-500 shrink-0" />
            <span>Logística estimada:</span>
          </div>
          <p className="text-muted-foreground leading-relaxed">
            {matchesPerRound <= courtCount ? (
              <span className="text-emerald-600 dark:text-emerald-400 font-medium">
                ✓ Con {courtCount} {courtCount === 1 ? "cancha" : "canchas"} entran los {matchesPerRound} {matchesPerRound === 1 ? "partido" : "partidos"} en simultáneo (1 solo turno por ronda).
              </span>
            ) : (
              <span>
                Con <strong>{courtCount} {courtCount === 1 ? "cancha" : "canchas"}</strong> para {matchesPerRound} partidos por ronda, se jugarán <strong>{shiftsNeeded} turnos</strong> por fecha (algunos jugadores descansan mientras juegan otros).
              </span>
            )}
          </p>
        </div>
      </div>
    </div>
  );
}

