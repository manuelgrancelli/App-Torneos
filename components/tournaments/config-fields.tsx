"use client";

import { ArrowDown, ArrowUp, X } from "lucide-react";
import { NumberInput } from "@/components/shared/number-input";
import { Button } from "@/components/ui/button";
import {
  Field,
  FieldContent,
  FieldDescription,
  FieldGroup,
  FieldLabel,
} from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Switch } from "@/components/ui/switch";
import type { PlayoffConfig } from "@/lib/domain/bracket";
import type { ScoringConfig, SetsScoringConfig } from "@/lib/domain/scoring";
import {
  type StandingsConfig,
  TIEBREAKER_LABELS,
  type Tiebreaker,
  tiebreakersFor,
} from "@/lib/domain/standings";

// -----------------------------------------------------------------------------
// Puntuación
// -----------------------------------------------------------------------------

type ScoringFieldsProps = {
  value: ScoringConfig;
  onChange: (value: ScoringConfig) => void;
  disabled?: boolean;
};

/** Configuración de puntuación según el deporte (sets o goles). */
export function ScoringFields({ value, onChange, disabled }: ScoringFieldsProps) {
  if (value.type === "goals") {
    return (
      <p className="text-sm text-muted-foreground">
        Partidos por goles. En la fase de grupos se permiten empates; en playoffs un empate se define por penales.
      </p>
    );
  }

  const set = (patch: Partial<SetsScoringConfig>) => onChange({ ...value, ...patch });
  const showSuperTiebreak = value.bestOf > 1 && value.decidingSet === "super_tiebreak";

  return (
    <FieldGroup className="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="scoring-best-of">Sets por partido</FieldLabel>
        <NativeSelect
          id="scoring-best-of"
          className="w-full"
          value={String(value.bestOf)}
          disabled={disabled}
          onChange={(e) => set({ bestOf: Number(e.target.value) as SetsScoringConfig["bestOf"] })}
        >
          <NativeSelectOption value="1">Un set</NativeSelectOption>
          <NativeSelectOption value="3">Al mejor de 3</NativeSelectOption>
          <NativeSelectOption value="5">Al mejor de 5</NativeSelectOption>
        </NativeSelect>
      </Field>
      <Field>
        <FieldLabel htmlFor="scoring-games">Games por set</FieldLabel>
        <NativeSelect
          id="scoring-games"
          className="w-full"
          value={String(value.gamesPerSet)}
          disabled={disabled}
          onChange={(e) => set({ gamesPerSet: Number(e.target.value) })}
        >
          {[4, 5, 6, 7, 8, 9].map((games) => (
            <NativeSelectOption key={games} value={String(games)}>
              {games === 6 ? "6 (set normal)" : games === 4 ? "4 (set corto)" : games === 9 ? "9 (pro set)" : games}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      {value.bestOf > 1 ? (
        <Field>
          <FieldLabel htmlFor="scoring-deciding">Set decisivo</FieldLabel>
          <NativeSelect
            id="scoring-deciding"
            className="w-full"
            value={value.decidingSet}
            disabled={disabled}
            onChange={(e) => set({ decidingSet: e.target.value as SetsScoringConfig["decidingSet"] })}
          >
            <NativeSelectOption value="super_tiebreak">Super tie-break</NativeSelectOption>
            <NativeSelectOption value="full">Set completo</NativeSelectOption>
          </NativeSelect>
        </Field>
      ) : null}
      {showSuperTiebreak ? (
        <Field>
          <FieldLabel htmlFor="scoring-stb">Super tie-break a</FieldLabel>
          <NativeSelect
            id="scoring-stb"
            className="w-full"
            value={String(value.superTiebreakPoints)}
            disabled={disabled}
            onChange={(e) => set({ superTiebreakPoints: Number(e.target.value) as 7 | 10 })}
          >
            <NativeSelectOption value="10">10 puntos</NativeSelectOption>
            <NativeSelectOption value="7">7 puntos</NativeSelectOption>
          </NativeSelect>
        </Field>
      ) : null}
      <Field orientation="horizontal" className="sm:col-span-2">
        <Switch
          id="scoring-tiebreak"
          checked={value.tiebreak}
          disabled={disabled}
          onCheckedChange={(checked) => set({ tiebreak: checked })}
        />
        <FieldContent>
          <FieldLabel htmlFor="scoring-tiebreak">Tie-break en cada set</FieldLabel>
          <FieldDescription>
            Con tie-break el set termina {value.gamesPerSet + 1}-{value.gamesPerSet}; sin tie-break se juega por 2 games
            de diferencia.
          </FieldDescription>
        </FieldContent>
      </Field>
    </FieldGroup>
  );
}

// -----------------------------------------------------------------------------
// Tabla de posiciones
// -----------------------------------------------------------------------------

type StandingsFieldsProps = {
  value: StandingsConfig;
  scoringType: ScoringConfig["type"];
  onChange: (value: StandingsConfig) => void;
  disabled?: boolean;
};

/** Puntos por resultado y criterios de desempate ordenables (sin drag: botones accesibles). */
export function StandingsFields({ value, scoringType, onChange, disabled }: StandingsFieldsProps) {
  const allowed = tiebreakersFor(scoringType);
  const available = allowed.filter((c) => !value.tiebreakers.includes(c));
  const setPoints = (key: keyof StandingsConfig["points"], points: number | undefined) =>
    onChange({ ...value, points: { ...value.points, [key]: points ?? 0 } });

  const move = (index: number, delta: -1 | 1) => {
    const list = [...value.tiebreakers];
    const target = index + delta;
    if (target < 0 || target >= list.length) return;
    [list[index], list[target]] = [list[target] as Tiebreaker, list[index] as Tiebreaker];
    onChange({ ...value, tiebreakers: list });
  };

  return (
    <FieldGroup>
      <div className="grid grid-cols-3 gap-3">
        <Field>
          <FieldLabel htmlFor="points-win">Ganado</FieldLabel>
          <NumberInput id="points-win" min={0} max={10} disabled={disabled} value={value.points.win} onChange={(v) => setPoints("win", v)} />
        </Field>
        {scoringType === "goals" ? (
          <Field>
            <FieldLabel htmlFor="points-draw">Empatado</FieldLabel>
            <NumberInput id="points-draw" min={0} max={10} disabled={disabled} value={value.points.draw} onChange={(v) => setPoints("draw", v)} />
          </Field>
        ) : null}
        <Field>
          <FieldLabel htmlFor="points-loss">Perdido</FieldLabel>
          <NumberInput id="points-loss" min={0} max={10} disabled={disabled} value={value.points.loss} onChange={(v) => setPoints("loss", v)} />
        </Field>
      </div>

      <Field>
        <FieldLabel id="tiebreakers-label">Orden de desempate</FieldLabel>
        <FieldDescription>Se aplican en orden. Si al final siguen empatados, decide un sorteo.</FieldDescription>
        <ol aria-labelledby="tiebreakers-label" className="divide-y rounded-lg border">
          {value.tiebreakers.map((criterion, index) => (
            <li key={criterion} className="flex items-center gap-2 px-3 py-1.5">
              <span className="w-5 text-sm text-muted-foreground">{index + 1}.</span>
              <span className="flex-1 text-sm">{TIEBREAKER_LABELS[criterion]}</span>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || index === 0}
                onClick={() => move(index, -1)}
                aria-label={`Subir ${TIEBREAKER_LABELS[criterion]}`}
              >
                <ArrowUp aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || index === value.tiebreakers.length - 1}
                onClick={() => move(index, 1)}
                aria-label={`Bajar ${TIEBREAKER_LABELS[criterion]}`}
              >
                <ArrowDown aria-hidden="true" />
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="icon"
                disabled={disabled || value.tiebreakers.length === 1}
                onClick={() => onChange({ ...value, tiebreakers: value.tiebreakers.filter((c) => c !== criterion) })}
                aria-label={`Quitar ${TIEBREAKER_LABELS[criterion]}`}
              >
                <X aria-hidden="true" />
              </Button>
            </li>
          ))}
        </ol>
        {available.length > 0 && !disabled ? (
          <div className="flex gap-2">
            <NativeSelect
              aria-label="Criterio para agregar"
              className="flex-1"
              value=""
              onChange={(e) => {
                const criterion = e.target.value as Tiebreaker;
                if (criterion) onChange({ ...value, tiebreakers: [...value.tiebreakers, criterion] });
              }}
            >
              <NativeSelectOption value="">Agregar criterio…</NativeSelectOption>
              {available.map((criterion) => (
                <NativeSelectOption key={criterion} value={criterion}>
                  {TIEBREAKER_LABELS[criterion]}
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </div>
        ) : null}
      </Field>
    </FieldGroup>
  );
}

// -----------------------------------------------------------------------------
// Playoffs
// -----------------------------------------------------------------------------

type PlayoffFieldsProps = {
  value: PlayoffConfig;
  onChange: (value: PlayoffConfig) => void;
  disabled?: boolean;
};

export function PlayoffFields({ value, onChange, disabled }: PlayoffFieldsProps) {
  return (
    <FieldGroup className="grid gap-4 sm:grid-cols-2">
      <Field>
        <FieldLabel htmlFor="playoff-qualifiers">Clasifican por grupo</FieldLabel>
        <NativeSelect
          id="playoff-qualifiers"
          className="w-full"
          value={String(value.qualifiersPerGroup)}
          disabled={disabled}
          onChange={(e) => onChange({ ...value, qualifiersPerGroup: Number(e.target.value) })}
        >
          {[1, 2, 3, 4].map((n) => (
            <NativeSelectOption key={n} value={String(n)}>
              {n === 1 ? "El primero" : `Los ${n} primeros`}
            </NativeSelectOption>
          ))}
        </NativeSelect>
      </Field>
      <Field orientation="horizontal" className="self-end">
        <Switch
          id="playoff-third"
          checked={value.thirdPlace}
          disabled={disabled}
          onCheckedChange={(checked) => onChange({ ...value, thirdPlace: checked })}
        />
        <FieldLabel htmlFor="playoff-third">Partido por el 3er puesto</FieldLabel>
      </Field>
    </FieldGroup>
  );
}
