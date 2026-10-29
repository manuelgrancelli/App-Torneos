"use client";

import { DragDropProvider, useDraggable, useDroppable } from "@dnd-kit/react";
import { ArrowLeftRight, CalendarClock, GripVertical, Shuffle, Sparkles, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useCallback, useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveGroups } from "@/app/(app)/torneos/[id]/grupos/actions";
import {
  initializeTournamentTeamsAvailability,
  setTeamAvailabilityByOrganizer,
} from "@/app/(app)/torneos/[id]/inscripciones/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import {
  drawGroups,
  getGroupAvailabilityConflicts,
  groupCountOptions,
  groupName,
  validateGroups,
} from "@/lib/domain/groups";
import { randomSeed } from "@/lib/domain/random";
import { roundRobinMatchCount } from "@/lib/domain/round-robin";
import { cn } from "@/lib/utils";
import { SlotMatchesModal } from "./slot-matches-modal";
import { SwapTeamsModal } from "./swap-teams-modal";

type Team = { id: string; name: string };

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  courtId: string | null;
};

type Court = {
  id: string;
  name: string;
  venue: string | null;
};

type GroupBuilderProps = {
  tournamentId: string;
  tournamentName?: string;
  categoryName?: string;
  sportName?: string;
  categoryId?: string;
  teams: Team[];
  /** Grupos ya guardados (para editarlos mientras no haya resultados). */
  initialGroups: string[][];
  /** Disponibilidad por equipo: teamId → slotIds */
  availability?: Record<string, string[]>;
  slots?: Slot[];
  courts?: Court[];
  timezone?: string;
};

function TeamChip({
  team,
  groupIndex,
  groupCount,
  onMove,
  onSwap,
  onOpenDetails,
  hasConflict,
  hasAvailability,
}: {
  team: Team;
  groupIndex: number;
  groupCount: number;
  onMove: (teamId: string, toGroup: number) => void;
  onSwap?: (teamId: string) => void;
  onOpenDetails?: (teamId: string) => void;
  hasConflict?: boolean;
  hasAvailability?: boolean;
}) {
  const { ref, handleRef, isDragging } = useDraggable({ id: team.id, data: { groupIndex } });
  return (
    <li
      ref={ref}
      className={cn(
        "rounded-xl border bg-card p-2.5 text-sm transition-all shadow-xs hover:border-foreground/30 space-y-2",
        isDragging && "opacity-60 shadow-md ring-2 ring-primary/40",
        hasConflict && "border-amber-400/80 bg-amber-50/70 dark:border-amber-800 dark:bg-amber-950/30",
      )}
    >
      {/* Fila 1: Agarre + Nombre completo y visible de la pareja */}
      <div className="flex items-center gap-2 min-w-0">
        <button
          ref={handleRef}
          type="button"
          className="cursor-grab touch-none rounded p-1 text-muted-foreground hover:text-foreground shrink-0 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
          aria-label={`Arrastrar ${team.name}`}
          title="Arrastrar para mover de grupo"
        >
          <GripVertical className="size-4" aria-hidden="true" />
        </button>

        <span
          className="font-semibold text-foreground text-sm leading-snug line-clamp-2 select-text"
          title={team.name}
        >
          {team.name}
        </span>
      </div>

      {/* Fila 2: Botón de horarios a la izquierda y acciones (swap + mover) a la derecha */}
      <div className="flex items-center justify-between gap-1.5 pt-1.5 border-t border-border/40">
        {/* Badges de horarios / coincidencia */}
        {hasConflict ? (
          <button
            type="button"
            onClick={() => onOpenDetails?.(team.id)}
            className="inline-flex items-center gap-1 rounded-md bg-amber-100 hover:bg-amber-200/90 px-2 py-1 text-[11px] font-semibold text-amber-900 dark:bg-amber-900/60 dark:hover:bg-amber-900/80 dark:text-amber-200 transition-colors cursor-pointer shrink-0 shadow-2xs"
            title={`Atención: ver conflicto horario de ${team.name}`}
          >
            <TriangleAlert className="size-3 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span>Sin coincidencia</span>
          </button>
        ) : hasAvailability ? (
          <button
            type="button"
            onClick={() => onOpenDetails?.(team.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 px-2 py-1 text-[11px] font-medium text-emerald-700 dark:text-emerald-300 transition-colors cursor-pointer shrink-0 shadow-2xs"
            title={`Ver franjas y coincidencias de ${team.name} con sus rivales`}
          >
            <CalendarClock className="size-3.5 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>Ver horarios</span>
          </button>
        ) : (
          <button
            type="button"
            onClick={() => onOpenDetails?.(team.id)}
            className="inline-flex items-center gap-1.5 rounded-md border border-dashed border-muted-foreground/40 bg-muted/40 hover:bg-muted px-2 py-1 text-[11px] font-medium text-muted-foreground hover:text-foreground transition-colors cursor-pointer shrink-0"
            title={`Sin horarios cargados para ${team.name}. Clic para ver o habilitar todos los turnos.`}
          >
            <CalendarClock className="size-3.5 shrink-0 text-muted-foreground" aria-hidden="true" />
            <span>Sin horarios</span>
          </button>
        )}

        {/* Acciones: Swap e intercambio rápido */}
        <div className="flex items-center gap-1 shrink-0">
          {groupCount > 1 && onSwap ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => onSwap(team.id)}
              className="h-6.5 w-6.5 p-0 text-muted-foreground hover:text-foreground border-border/60"
              title={`Intercambiar ${team.name} con pareja de otro grupo`}
              aria-label={`Intercambiar ${team.name} con pareja de otro grupo`}
            >
              <ArrowLeftRight className="size-3" />
            </Button>
          ) : null}

          {/* Selector de mover a otro grupo */}
          <NativeSelect
            size="sm"
            aria-label={`Mover ${team.name} a…`}
            value={String(groupIndex)}
            onChange={(e) => onMove(team.id, Number(e.target.value))}
            className="w-20 text-[11px] h-6.5 px-1.5 py-0 bg-background"
          >
            {Array.from({ length: groupCount }, (_, i) => (
              <NativeSelectOption key={i} value={String(i)}>
                {groupName(i)}
              </NativeSelectOption>
            ))}
          </NativeSelect>
        </div>
      </div>
    </li>
  );
}

function GroupColumn({
  index,
  teams,
  groupCount,
  onMove,
  onSwap,
  onOpenDetails,
  conflicts,
  availability,
}: {
  index: number;
  teams: Team[];
  groupCount: number;
  onMove: (teamId: string, toGroup: number) => void;
  onSwap: (teamId: string) => void;
  onOpenDetails: (teamId: string) => void;
  conflicts: Set<string>;
  availability?: Record<string, string[]>;
}) {
  const { ref, isDropTarget } = useDroppable({ id: `group-${index}` });
  return (
    <section
      ref={ref}
      aria-labelledby={`group-title-${index}`}
      className={cn("space-y-2 rounded-xl border p-3 transition-colors", isDropTarget && "border-foreground bg-muted/50")}
    >
      <h3 id={`group-title-${index}`} className="flex items-baseline justify-between text-sm font-semibold">
        {groupName(index)}
        <span className="font-normal text-muted-foreground">
          {teams.length} {teams.length === 1 ? "equipo" : "equipos"} · {teams.length === 4 ? "4 partidos (pasan 3)" : `${roundRobinMatchCount(teams.length)} partidos`}
        </span>
      </h3>
      <ul className="min-h-12 space-y-1.5">
        {teams.map((team) => {
          const hasAvail = Boolean(availability?.[team.id] && availability[team.id]!.length > 0);
          return (
            <TeamChip
              key={team.id}
              team={team}
              groupIndex={index}
              groupCount={groupCount}
              onMove={onMove}
              onSwap={onSwap}
              onOpenDetails={onOpenDetails}
              hasConflict={conflicts.has(team.id)}
              hasAvailability={hasAvail}
            />
          );
        })}
      </ul>
    </section>
  );
}

/**
 * Armado de grupos: sorteo con semilla y ajuste manual (drag and drop, intercambio
 * directo entre parejas o selector "Mover a…").
 */
export function GroupBuilder({
  tournamentId,
  tournamentName,
  categoryName,
  sportName,
  categoryId,
  teams,
  initialGroups,
  availability,
  slots = [],
  courts = [],
  timezone,
}: GroupBuilderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const hasEnoughTeams = teams.length >= 2;
  const options = useMemo(() => groupCountOptions(teams.length), [teams.length]);
  const suggested = useMemo(
    () => options.find((count) => teams.length / count <= 5) ?? options[options.length - 1] ?? 1,
    [options, teams.length],
  );
  const initialValidCount = options.includes(initialGroups.length) ? initialGroups.length : suggested;
  const [groupCount, setGroupCount] = useState(initialValidCount);
  const [groups, setGroups] = useState<string[][]>(initialGroups);
  const byId = useMemo(() => new Map(teams.map((t) => [t.id, t])), [teams]);

  // Modales de swap y detalle de horarios
  const [swapTeamId, setSwapTeamId] = useState<string | null>(null);
  const [detailsTeamId, setDetailsTeamId] = useState<string | null>(null);
  const [isAssigningSlots, setIsAssigningSlots] = useState(false);

  // Franjas horarias exclusivas para fase de grupos (aislando completamente playoffs)
  const groupSlots = useMemo(() => slots.filter((s) => ((s as any).stage ?? "group") === "group"), [slots]);
  const groupSlotIdSet = useMemo(() => new Set(groupSlots.map((s) => s.id)), [groupSlots]);

  // Sanitizar disponibilidad para que en zonas solo se consideren turnos de fase de grupos
  const sanitizeAvailability = useCallback(
    (avail?: Record<string, string[]>) => {
      if (!avail) return undefined;
      const sanitized: Record<string, string[]> = {};
      for (const [tId, sIds] of Object.entries(avail)) {
        sanitized[tId] = sIds.filter((id) => groupSlotIdSet.has(id));
      }
      return sanitized;
    },
    [groupSlotIdSet],
  );

  // Disponibilidad local sincronizada para actualización inmediata en UI
  const [localAvailability, setLocalAvailability] = useState(() => sanitizeAvailability(availability));

  useEffect(() => {
    setLocalAvailability(sanitizeAvailability(availability));
  }, [availability, sanitizeAvailability]);

  const teamsWithoutAvailability = useMemo(() => {
    return teams.filter((t) => !localAvailability?.[t.id] || localAvailability[t.id]!.length === 0);
  }, [teams, localAvailability]);

  async function handleAssignAllSlots(teamId: string) {
    if (groupSlots.length === 0) {
      toast.error("El torneo aún no tiene franjas horarias de grupos configuradas.");
      return;
    }
    setIsAssigningSlots(true);
    try {
      const allGroupSlotIds = groupSlots.map((s) => s.id);
      const res = await setTeamAvailabilityByOrganizer({
        tournamentId,
        teamId,
        slotIds: allGroupSlotIds,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setLocalAvailability((prev) => ({
        ...(prev ?? {}),
        [teamId]: allGroupSlotIds,
      }));
      toast.success(res.message ?? "Se asignaron todos los horarios de grupos a la pareja.");
      router.refresh();
    } finally {
      setIsAssigningSlots(false);
    }
  }

  async function handleInitializeAllSlots() {
    setIsAssigningSlots(true);
    try {
      const res = await initializeTournamentTeamsAvailability({ tournamentId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      const allGroupSlotIds = groupSlots.map((s) => s.id);
      setLocalAvailability((prev) => {
        const next = { ...(prev ?? {}) };
        for (const t of teams) {
          const existing = next[t.id];
          if (!existing || existing.length === 0) {
            next[t.id] = allGroupSlotIds;
          }
        }
        return next;
      });
      toast.success(res.message);
      router.refresh();
    } finally {
      setIsAssigningSlots(false);
    }
  }

  const safeGroupCount = options.includes(groupCount) ? groupCount : suggested;

  useEffect(() => {
    if (options.length > 0 && !options.includes(groupCount)) {
      setGroupCount(suggested);
    }
  }, [options, groupCount, suggested]);

  const draw = (count?: number) => {
    if (!hasEnoughTeams || options.length === 0) return;
    const targetCount = count !== undefined && options.includes(count) ? count : safeGroupCount;
    setGroups(drawGroups(teams.map((t) => t.id), targetCount, randomSeed(), localAvailability));
  };

  function move(teamId: string, toGroup: number) {
    setGroups((prev) => {
      const next = prev.map((group) => group.filter((id) => id !== teamId));
      next[toGroup]?.push(teamId);
      return next;
    });
  }

  function swap(teamAId: string, teamBId: string) {
    setGroups((prev) => {
      let gA = -1;
      let iA = -1;
      let gB = -1;
      let iB = -1;
      prev.forEach((grp, gIdx) => {
        grp.forEach((tId, tIdx) => {
          if (tId === teamAId) {
            gA = gIdx;
            iA = tIdx;
          }
          if (tId === teamBId) {
            gB = gIdx;
            iB = tIdx;
          }
        });
      });
      if (gA === -1 || gB === -1) return prev;
      const next = prev.map((g) => [...g]);
      next[gA]![iA] = teamBId;
      next[gB]![iB] = teamAId;
      return next;
    });

    const nameA = byId.get(teamAId)?.name ?? "Pareja";
    const nameB = byId.get(teamBId)?.name ?? "Pareja";
    toast.success(`Intercambiaste a "${nameA}" con "${nameB}".`);
  }

  const validation = groups.length > 0 ? validateGroups(teams.map((t) => t.id), groups) : null;

  const conflicts = useMemo(
    () => (localAvailability && groups.length > 0 ? getGroupAvailabilityConflicts(groups, localAvailability) : []),
    [groups, localAvailability],
  );

  const groupConflicts = useMemo(() => {
    const map = new Map<number, Set<string>>();
    for (const c of conflicts) {
      if (!map.has(c.groupIndex)) map.set(c.groupIndex, new Set());
      const set = map.get(c.groupIndex)!;
      set.add(c.teamA);
      set.add(c.teamB);
    }
    return map;
  }, [conflicts]);

  // Datos para modal de swap
  const swapSourceTeam = swapTeamId ? byId.get(swapTeamId) ?? null : null;
  const swapSourceGroupIndex = swapTeamId ? groups.findIndex((g) => g.includes(swapTeamId)) : -1;

  // Datos para modal de horarios
  const detailsTeam = detailsTeamId ? byId.get(detailsTeamId) ?? null : null;
  const detailsGroupIndex = detailsTeamId ? groups.findIndex((g) => g.includes(detailsTeamId)) : -1;
  const detailsRivals = useMemo(() => {
    if (!detailsTeamId || detailsGroupIndex < 0) return [];
    const group = groups[detailsGroupIndex] ?? [];
    return group
      .filter((id) => id !== detailsTeamId)
      .map((id) => byId.get(id))
      .filter((t): t is Team => Boolean(t));
  }, [detailsTeamId, detailsGroupIndex, groups, byId]);

  function save() {
    startTransition(async () => {
      const result = await saveGroups({ tournamentId, categoryId, groups });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Guardamos los grupos.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Armar grupos</h2>
        </CardTitle>
        <CardDescription>
          {teams.length === 0 ? (
            "No hay parejas aprobadas en esta categoría para sortear."
          ) : (
            `Sorteá las ${teams.length} parejas aprobadas respetando su disponibilidad horaria. Podés intercambiar parejas directamente entre zonas o moverlas a mano antes de confirmar. En grupos de 4 parejas, se juegan 4 partidos y clasifican los 3 mejores a playoffs.`
          )}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        {!hasEnoughTeams ? (
          <div className="flex items-start gap-2.5 rounded-lg border border-amber-300/60 bg-amber-50/50 p-3 text-sm text-amber-900 dark:border-amber-900/50 dark:bg-amber-950/20 dark:text-amber-200">
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" />
            <div className="space-y-1">
              <p className="font-medium text-foreground">
                {teams.length === 0
                  ? "No hay parejas aprobadas en esta categoría para sortear los grupos."
                  : "Se necesitan al menos 2 parejas aprobadas para poder sortear los grupos (actualmente hay 1)."}
              </p>
              <p className="text-xs text-muted-foreground">
                {teams.length === 0
                  ? "Asegurate de que las inscripciones estén aprobadas y pertenezcan a esta categoría desde la pestaña Inscripciones."
                  : "Inscribí al menos una pareja más para poder generar la fase de grupos."}
              </p>
            </div>
          </div>
        ) : null}

        {teamsWithoutAvailability.length > 0 && slots.length > 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-sky-300/80 bg-sky-50/70 p-3 text-xs text-sky-950 dark:border-sky-800/80 dark:bg-sky-950/30 dark:text-sky-200">
            <div className="flex items-start gap-2">
              <CalendarClock className="size-4 shrink-0 text-sky-600 dark:text-sky-400 mt-0.5" />
              <div>
                <p className="font-semibold text-foreground">
                  {teamsWithoutAvailability.length === 1
                    ? `Hay 1 pareja sin horarios asignados (${teamsWithoutAvailability[0]?.name})`
                    : `Hay ${teamsWithoutAvailability.length} parejas sin horarios asignados`}
                </p>
                <p className="text-muted-foreground dark:text-sky-300/80">
                  Las parejas inscriptas online se registraron sin horarios por defecto. Podés habilitarles todas las franjas horarias del torneo para que se calculen los cruces con las parejas importadas.
                </p>
              </div>
            </div>
            <Button
              type="button"
              size="sm"
              variant="default"
              disabled={isAssigningSlots}
              onClick={handleInitializeAllSlots}
              className="shrink-0 text-xs gap-1.5 font-medium shadow-sm"
            >
              {isAssigningSlots ? <Spinner className="size-3.5" /> : <Sparkles className="size-3.5" />}
              Habilitar horarios a todos
            </Button>
          </div>
        ) : null}

        <div className="flex flex-col gap-3 sm:flex-row sm:items-end sm:justify-between">
          <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
            <Field className="sm:w-48">
              <FieldLabel htmlFor="group-count">Cantidad de grupos</FieldLabel>
              <NativeSelect
                id="group-count"
                className="w-full"
                value={String(safeGroupCount)}
                disabled={!hasEnoughTeams}
                onChange={(e) => {
                  const count = Number(e.target.value);
                  if (options.includes(count)) {
                    setGroupCount(count);
                    if (groups.length > 0) draw(count);
                  }
                }}
              >
                {options.length === 0 ? (
                  <NativeSelectOption value="1">Sin grupos</NativeSelectOption>
                ) : (
                  options.map((count) => (
                    <NativeSelectOption key={count} value={String(count)}>
                      {count} {count === 1 ? "grupo" : "grupos"} (~{Math.round(teams.length / count)} por grupo)
                    </NativeSelectOption>
                  ))
                )}
              </NativeSelect>
            </Field>
            <Button type="button" variant="outline" onClick={() => draw()} disabled={!hasEnoughTeams || isPending}>
              <Shuffle aria-hidden="true" />
              {groups.length > 0 ? "Volver a sortear" : "Sortear"}
            </Button>
          </div>
        </div>

        {groups.length > 0 ? (
          <DragDropProvider
            onDragEnd={(event) => {
              if (event.canceled) return;
              const { source, target } = event.operation;
              const toGroup = typeof target?.id === "string" ? Number(target.id.replace("group-", "")) : NaN;
              if (source && Number.isInteger(toGroup)) move(String(source.id), toGroup);
            }}
          >
            <div className="grid gap-3.5 sm:grid-cols-2 lg:grid-cols-3">
              {groups.map((group, index) => (
                <GroupColumn
                  key={index}
                  index={index}
                  groupCount={groups.length}
                  onMove={move}
                  onSwap={(id) => setSwapTeamId(id)}
                  onOpenDetails={(id) => setDetailsTeamId(id)}
                  teams={group.map((id) => byId.get(id)).filter((t): t is Team => Boolean(t))}
                  conflicts={groupConflicts.get(index) ?? new Set()}
                  availability={localAvailability}
                />
              ))}
            </div>
          </DragDropProvider>
        ) : null}

        {conflicts.length > 0 ? (
          <div
            className="flex items-start gap-2.5 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200"
            role="alert"
          >
            <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <div className="space-y-1">
              <p className="font-medium">
                {conflicts.length === 1
                  ? "Atención: hay 1 cruce en el mismo grupo sin horarios en común"
                  : `Atención: hay ${conflicts.length} cruces en el mismo grupo sin horarios en común`}
              </p>
              <ul className="list-disc space-y-0.5 pl-4 text-xs">
                {conflicts.map((c, i) => (
                  <li key={i}>
                    <strong>{groupName(c.groupIndex)}:</strong> {byId.get(c.teamA)?.name ?? c.teamA} y{" "}
                    {byId.get(c.teamB)?.name ?? c.teamB} no comparten ninguna franja disponible.
                    <button
                      type="button"
                      onClick={() => setDetailsTeamId(c.teamA)}
                      className="ml-1.5 underline font-medium hover:text-amber-950 dark:hover:text-amber-100"
                    >
                      Ver detalle
                    </button>
                  </li>
                ))}
              </ul>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Podés hacer clic en el botón de intercambio (<ArrowLeftRight className="inline size-3" />) en cualquiera de las parejas o volver a sortear.
              </p>
            </div>
          </div>
        ) : null}

        {validation && !validation.ok ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-destructive" role="alert">
            {validation.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}

        {groups.length > 0 ? (
          <div className="pt-2">
            <Button type="submit" onClick={save} disabled={isPending || !validation?.ok} className="shadow-sm">
              {isPending ? <Spinner /> : null}
              {isPending ? "Guardando grupos y creando fixture…" : "Confirmar grupos y generar partidos"}
            </Button>
          </div>
        ) : null}
      </CardContent>

      {/* Modal para intercambio directo de parejas (Swap) */}
      <SwapTeamsModal
        isOpen={Boolean(swapTeamId)}
        onClose={() => setSwapTeamId(null)}
        sourceTeam={swapSourceTeam}
        sourceGroupIndex={swapSourceGroupIndex}
        groups={groups}
        byId={byId}
        availability={localAvailability}
        onConfirmSwap={swap}
      />

      {/* Modal para ver detalle de horarios y coincidencias con rivales */}
      <SlotMatchesModal
        isOpen={Boolean(detailsTeamId)}
        onClose={() => setDetailsTeamId(null)}
        team={detailsTeam}
        groupIndex={detailsGroupIndex}
        rivals={detailsRivals}
        availability={localAvailability}
        slots={groupSlots}
        courts={courts}
        timezone={timezone}
        onOpenSwap={(tId) => setSwapTeamId(tId)}
        onAssignAllSlots={handleAssignAllSlots}
        isAssigningSlots={isAssigningSlots}
      />
    </Card>
  );
}
