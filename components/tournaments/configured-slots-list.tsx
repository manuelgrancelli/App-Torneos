"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Clock, Flame, Layers, Swords, Trash2, Trophy, Users } from "lucide-react";
import { deleteTimeSlots, updateTimeSlotsStage } from "@/app/(app)/torneos/[id]/canchas-franjas/actions";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import type { CourtRow, SlotRow } from "@/lib/data/tournaments";
import { formatDayHeading, formatTimeRange, localDateKey } from "@/lib/dates";
import { groupSlotsIntoDayWindows, type AvailabilityWindow } from "@/lib/domain/availability";
import { cn } from "@/lib/utils";

interface ConfiguredSlotsListProps {
  tournamentId: string;
  timezone: string;
  courts: CourtRow[];
  slots: SlotRow[];
}

/** Paletas de color por etapa del torneo (D-180, D-181) */
const STAGE_PALETTES = {
  group: {
    card: "border-l-4 border-l-emerald-500 bg-card hover:bg-card/90",
    time: "text-emerald-600 dark:text-emerald-400 font-bold",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-600 dark:text-emerald-300",
  },
  playoff: {
    card: "border-l-4 border-l-violet-500 bg-card hover:bg-card/90",
    time: "text-violet-600 dark:text-violet-400 font-bold",
    badge: "border-violet-500/40 bg-violet-500/10 text-violet-600 dark:text-violet-300",
  },
};

export function ConfiguredSlotsList({
  tournamentId,
  timezone,
  courts,
  slots,
}: ConfiguredSlotsListProps) {
  const router = useRouter();
  const [expandedWindows, setExpandedWindows] = useState<Set<string>>(new Set());
  const [stageFilter, setStageFilter] = useState<"all" | "group" | "playoff">("all");

  const courtName = useMemo(
    () => new Map(courts.map((court) => [court.id, court.name])),
    [courts],
  );

  const groupSlots = useMemo(() => slots.filter((s) => s.stage === "group"), [slots]);
  const playoffSlots = useMemo(() => slots.filter((s) => s.stage === "playoff"), [slots]);

  const displayedSlots = useMemo(() => {
    if (stageFilter === "group") return groupSlots;
    if (stageFilter === "playoff") return playoffSlots;
    return slots;
  }, [slots, stageFilter, groupSlots, playoffSlots]);

  const dayWindows = useMemo(
    () => groupSlotsIntoDayWindows(displayedSlots, (slot) => localDateKey(slot.startsAt, timezone)),
    [displayedSlots, timezone],
  );

  const toggleExpand = (windowId: string) => {
    setExpandedWindows((prev) => {
      const next = new Set(prev);
      if (next.has(windowId)) next.delete(windowId);
      else next.add(windowId);
      return next;
    });
  };

  const removeWindow = async (window: AvailabilityWindow<SlotRow>) => {
    const result = await deleteTimeSlots({ tournamentId, slotIds: window.slotIds });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message ?? "Borramos la franja.");
    router.refresh();
  };

  const removeSingleSlot = async (slot: SlotRow) => {
    const result = await deleteTimeSlots({ tournamentId, slotIds: [slot.id] });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message ?? "Borramos el turno.");
    router.refresh();
  };

  const removeAllSlots = async () => {
    const result = await deleteTimeSlots({
      tournamentId,
      slotIds: slots.map((s) => s.id),
    });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message ?? "Borramos todas las franjas.");
    router.refresh();
  };

  const changeWindowStage = async (window: AvailabilityWindow<SlotRow>, targetStage: "group" | "playoff") => {
    const result = await updateTimeSlotsStage({
      tournamentId,
      slotIds: window.slotIds,
      stage: targetStage,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Etapa actualizada.");
    router.refresh();
  };

  const changeSingleSlotStage = async (slot: SlotRow, targetStage: "group" | "playoff") => {
    const result = await updateTimeSlotsStage({
      tournamentId,
      slotIds: [slot.id],
      stage: targetStage,
    });
    if (!result.ok) {
      toast.error(result.error);
      return;
    }
    toast.success(result.message ?? "Turno actualizado.");
    router.refresh();
  };

  const totalAssignedMatches = slots.reduce((acc, s) => acc + s.assignedMatches, 0);
  const totalGameHours = Math.round(
    displayedSlots.reduce((acc, s) => acc + (Date.parse(s.endsAt) - Date.parse(s.startsAt)) / 3600000, 0),
  );

  return (
    <Card className="overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="pb-3 space-y-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <span>Franjas horarias configuradas</span>
            </CardTitle>
            <CardDescription className="text-xs">
              {slots.length === 0
                ? "Las franjas que generes aparecerán acá organizadas por día."
                : `${displayedSlots.length} ${displayedSlots.length === 1 ? "turno" : "turnos"} ${stageFilter !== "all" ? `(${stageFilter === "group" ? "grupos" : "cuadro"})` : "en total"} · ~${totalGameHours} hs de juego`}
            </CardDescription>
          </div>

          {slots.length > 0 ? (
            <ConfirmActionButton
              variant="outline"
              size="sm"
              destructive
              className="h-7 px-2.5 text-xs text-muted-foreground hover:text-destructive border-border/70"
              aria-label="Borrar todas las franjas del torneo"
              title="¿Borrar todas las franjas del torneo?"
              description={
                totalAssignedMatches > 0 ? (
                  <>
                    <p>Hay {totalAssignedMatches} partidos asignados que quedarán sin horario.</p>
                    <p>Las parejas inscriptas perderán toda su disponibilidad horaria.</p>
                  </>
                ) : (
                  <p>Se eliminarán los {slots.length} turnos configurados.</p>
                )
              }
              confirmLabel="Borrar todas"
              onConfirm={removeAllSlots}
            >
              <Trash2 className="mr-1 size-3" aria-hidden="true" />
              <span>Borrar todas</span>
            </ConfirmActionButton>
          ) : null}
        </div>

        {/* Filtro por etapa: Todos / Fase de Grupos / Cuadro / Playoffs */}
        {slots.length > 0 ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-1">
            <button
              type="button"
              onClick={() => setStageFilter("all")}
              className={cn(
                "px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer",
                stageFilter === "all"
                  ? "bg-foreground text-background border-foreground font-semibold"
                  : "bg-muted/50 text-muted-foreground border-border/60 hover:text-foreground",
              )}
            >
              Todos ({slots.length})
            </button>
            <button
              type="button"
              onClick={() => setStageFilter("group")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer",
                stageFilter === "group"
                  ? "bg-emerald-600 text-white border-emerald-600 font-semibold shadow-xs"
                  : "bg-muted/50 text-muted-foreground border-border/60 hover:text-foreground",
              )}
            >
              <Users className="size-3" />
              <span>Grupos ({groupSlots.length})</span>
            </button>
            <button
              type="button"
              onClick={() => setStageFilter("playoff")}
              className={cn(
                "flex items-center gap-1.5 px-2.5 py-1 text-xs font-medium rounded-lg border transition-all cursor-pointer",
                stageFilter === "playoff"
                  ? "bg-violet-600 text-white border-violet-600 font-semibold shadow-xs"
                  : "bg-muted/50 text-muted-foreground border-border/60 hover:text-foreground",
              )}
            >
              <Trophy className="size-3" />
              <span>Cuadro / Playoffs ({playoffSlots.length})</span>
            </button>
          </div>
        ) : null}

        {/* Resumen de canchas confirmadas en la creación del torneo */}
        <div className="pt-1">
          <div className="flex flex-wrap items-center gap-1.5 text-xs text-muted-foreground bg-muted/30 border border-border/60 rounded-lg px-2.5 py-1.5">
            <div className="flex items-center gap-1 font-semibold text-foreground shrink-0">
              <Layers className="size-3 text-muted-foreground" />
              <span>{courts.length} {courts.length === 1 ? "cancha confirmada:" : "canchas confirmadas:"}</span>
            </div>
            <div className="flex flex-wrap gap-1">
              {courts.length === 0 ? (
                <span className="italic">Sin canchas asignadas</span>
              ) : (
                courts.map((court) => (
                  <span
                    key={court.id}
                    className="inline-block rounded-md bg-background px-1.5 py-0.5 text-[11px] font-medium text-foreground border border-border/60"
                  >
                    {court.name}
                  </span>
                ))
              )}
            </div>
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {slots.length === 0 ? (
          <EmptyState
            icon={Clock}
            title="Todavía no hay franjas"
            description="Completá el formulario para generarlas. Se crearán los turnos correspondientes para tus canchas automáticamente."
          />
        ) : displayedSlots.length === 0 ? (
          <EmptyState
            icon={Clock}
            title={`No hay franjas de ${stageFilter === "group" ? "grupos" : "cuadro"}`}
            description="Cambiá de filtro o generá las franjas correspondientes con el formulario a la derecha."
          />
        ) : (
          dayWindows.map(({ day, windows }) => {
            const dayAllSlots = windows.flatMap((w) => w.slots);

            return (
              <section key={day} aria-labelledby={`day-heading-${day}`} className="space-y-2.5">
                {/* Header del Día */}
                <div className="border-b border-border/50 pb-1.5 pt-1">
                  <h3 id={`day-heading-${day}`} className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <span>{formatDayHeading(day)}</span>
                    <span className="font-normal text-muted-foreground lowercase text-xs">
                      · {windows.length} {windows.length === 1 ? "franja" : "franjas"} ({dayAllSlots.length} turnos)
                    </span>
                  </h3>
                </div>

                {/* Lista de franjas */}
                <div className="space-y-2.5">
                  {windows.map((window, index) => {
                    const time = formatTimeRange(window.startsAt, window.endsAt, timezone);
                    const isExpanded = expandedWindows.has(window.id);

                    const availableTeams = Math.max(...window.slots.map((s) => s.availableTeams), 0);
                    const assignedMatches = window.slots.reduce((acc, s) => acc + s.assignedMatches, 0);
                    const inUse = availableTeams > 0 || assignedMatches > 0;

                    const isPlayoffWindow = window.slots.every((s) => s.stage === "playoff");
                    const isGroupWindow = window.slots.every((s) => s.stage === "group");

                    const courtIds = new Set(window.slots.map((s) => s.courtId));
                    const courtLabel =
                      courtIds.size === 1
                        ? [...courtIds][0]
                          ? (courtName.get([...courtIds][0]!) ?? "Cancha")
                          : "Todas las canchas"
                        : "Múltiples canchas";
                    const palette = isPlayoffWindow ? STAGE_PALETTES.playoff : STAGE_PALETTES.group;

                    return (
                      <div
                        key={window.id}
                        className={cn(
                          "rounded-xl border border-border/70 p-3.5 shadow-2xs transition-all space-y-2.5",
                          palette.card,
                        )}
                      >
                        {/* Fila superior: Horario grande, Etapa, Cancha y Acciones */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2 min-w-0">
                            {/* Horario */}
                            <span className={cn("font-mono text-base sm:text-lg font-bold tabular-nums tracking-tight", palette.time)}>
                              {time}
                            </span>

                            {/* Selector interactivo de Etapa: Grupos vs Cuadro */}
                            {isPlayoffWindow ? (
                              <button
                                type="button"
                                onClick={() => changeWindowStage(window, "group")}
                                className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border border-violet-500/40 text-violet-600 dark:text-violet-300 bg-violet-500/10 hover:bg-violet-500/20 transition-all cursor-pointer"
                                title="Franja de Cuadro. Clic para cambiarla a Fase de Grupos"
                              >
                                <Trophy className="size-3 mr-1 inline" />
                                <span>Cuadro</span>
                              </button>
                            ) : isGroupWindow ? (
                              <button
                                type="button"
                                onClick={() => changeWindowStage(window, "playoff")}
                                className="inline-flex items-center text-[11px] font-semibold px-2 py-0.5 rounded-md border border-emerald-500/40 text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 hover:bg-emerald-500/20 transition-all cursor-pointer"
                                title="Franja de Grupos. Clic para cambiarla a Cuadro / Playoffs"
                              >
                                <Users className="size-3 mr-1 inline" />
                                <span>Grupos</span>
                              </button>
                            ) : null}

                            <Badge variant="outline" className={cn("text-xs font-semibold px-2.5 py-0.5", palette.badge)}>
                              {courtLabel}
                            </Badge>

                            {availableTeams > 0 ? (
                              <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium text-emerald-400 bg-emerald-500/10 border border-emerald-500/20">
                                <Flame className="size-3 mr-1 inline" />
                                {availableTeams} disp.
                              </Badge>
                            ) : null}
                            {assignedMatches > 0 ? (
                              <Badge variant="secondary" className="text-xs px-2 py-0.5 font-medium text-indigo-300 bg-indigo-500/10 border border-indigo-500/20">
                                <Swords className="size-3 mr-1 inline" />
                                {assignedMatches} part.
                              </Badge>
                            ) : null}
                          </div>

                          <div className="flex items-center gap-1.5 shrink-0">
                            {window.slots.length > 1 ? (
                              <Button
                                type="button"
                                variant="ghost"
                                size="sm"
                                onClick={() => toggleExpand(window.id)}
                                className="h-8 px-2 text-xs text-muted-foreground hover:text-foreground cursor-pointer"
                                aria-label={isExpanded ? "Ocultar turnos" : "Ver turnos"}
                              >
                                <span>{isExpanded ? "Ocultar" : `Turnos (${window.slots.length})`}</span>
                                {isExpanded ? (
                                   <ChevronUp className="ml-1 size-3.5" />
                                ) : (
                                  <ChevronDown className="ml-1 size-3.5" />
                                )}
                              </Button>
                            ) : (
                              <span className="text-xs text-muted-foreground font-medium px-1">
                                1 turno
                              </span>
                            )}

                            <ConfirmActionButton
                              variant="ghost"
                              size="icon"
                              destructive
                              className="size-8 shrink-0 text-muted-foreground hover:text-destructive cursor-pointer"
                              aria-label={`Borrar franja ${time}`}
                              title="¿Borrar esta franja completa?"
                              description={
                                inUse ? (
                                  <>
                                    <p>Hay disponibilidad marcada o partidos asignados en este horario.</p>
                                    <p>Se borrarán los {window.slots.length} turnos de la franja.</p>
                                  </>
                                ) : (
                                  <p>Se eliminarán los {window.slots.length} turnos comprendidos en esta franja.</p>
                                )
                              }
                              confirmLabel="Borrar franja"
                              onConfirm={() => removeWindow(window)}
                            >
                              <Trash2 className="size-3.5" aria-hidden="true" />
                            </ConfirmActionButton>
                          </div>
                        </div>

                        {/* Desglose de turnos atómicos internos */}
                        {isExpanded ? (
                          <div className="mt-2 space-y-1.5 rounded-lg bg-background/60 p-2.5 border border-border/50 text-xs">
                            <p className="font-semibold text-muted-foreground text-[11px] uppercase tracking-wider mb-1.5">
                              Turnos de partido ({window.slots.length})
                            </p>
                            <div className="grid grid-cols-1 sm:grid-cols-2 gap-2">
                              {window.slots.map((slot) => {
                                const slotTime = formatTimeRange(slot.startsAt, slot.endsAt, timezone);
                                const court = slot.courtId ? courtName.get(slot.courtId) : "Cualquier cancha";
                                const slotInUse = slot.availableTeams > 0 || slot.assignedMatches > 0;

                                return (
                                  <div
                                    key={slot.id}
                                    className={cn(
                                      "flex items-center justify-between rounded-md bg-card/90 px-2.5 py-1.5 border border-border/40",
                                      isPlayoffWindow && "border-violet-500/25",
                                    )}
                                  >
                                    <div className="flex items-center gap-1.5 min-w-0">
                                      <span
                                        className={cn(
                                          "font-mono font-medium text-xs",
                                          isPlayoffWindow
                                            ? "text-violet-600 dark:text-violet-300 font-semibold"
                                            : "text-foreground",
                                        )}
                                      >
                                        {slotTime}
                                      </span>
                                      <span className="text-muted-foreground text-[11px] truncate">
                                        · {court}
                                      </span>
                                    </div>
                                    <div className="flex items-center gap-1">
                                      {slot.availableTeams > 0 ? (
                                        <span className="text-[10px] text-emerald-400 font-medium">
                                          {slot.availableTeams} disp.
                                        </span>
                                      ) : null}
                                      {slot.assignedMatches > 0 ? (
                                        <span className="text-[10px] text-indigo-300 font-medium ml-1">
                                          {slot.assignedMatches} part.
                                        </span>
                                      ) : null}
                                      <button
                                        type="button"
                                        onClick={() =>
                                          changeSingleSlotStage(
                                            slot,
                                            slot.stage === "playoff" ? "group" : "playoff",
                                          )
                                        }
                                        className="size-6 inline-flex items-center justify-center rounded-md text-muted-foreground hover:text-foreground hover:bg-muted/60 transition-colors cursor-pointer ml-1"
                                        title={
                                          slot.stage === "playoff"
                                            ? "Turno de Cuadro. Clic para pasarlo a Grupos"
                                            : "Turno de Grupos. Clic para pasarlo a Cuadro / Playoffs"
                                        }
                                        aria-label={
                                          slot.stage === "playoff"
                                            ? "Pasar a Grupos"
                                            : "Pasar a Cuadro"
                                        }
                                      >
                                        {slot.stage === "playoff" ? (
                                          <Trophy className="size-3 text-violet-500" />
                                        ) : (
                                          <Users className="size-3 text-emerald-500" />
                                        )}
                                      </button>
                                      <ConfirmActionButton
                                        variant="ghost"
                                        size="icon"
                                        destructive
                                        className="size-6 text-muted-foreground hover:text-destructive cursor-pointer ml-1"
                                        aria-label={`Borrar turno ${slotTime}`}
                                        title="¿Borrar este turno específico?"
                                        description={
                                          slotInUse ? (
                                            <p>Este turno tiene parejas con disponibilidad o partidos asignados.</p>
                                          ) : (
                                            <p>Se eliminará este turno de juego.</p>
                                          )
                                        }
                                        confirmLabel="Borrar turno"
                                        onConfirm={() => removeSingleSlot(slot)}
                                      >
                                        <Trash2 className="size-3" aria-hidden="true" />
                                      </ConfirmActionButton>
                                    </div>
                                  </div>
                                );
                              })}
                            </div>
                          </div>
                        ) : null}
                      </div>
                    );
                  })}
                </div>
              </section>
            );
          })
        )}
      </CardContent>
    </Card>
  );
}
