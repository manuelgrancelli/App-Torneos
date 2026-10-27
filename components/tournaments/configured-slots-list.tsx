"use client";

import { useMemo, useState } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { ChevronDown, ChevronUp, Clock, Flame, Layers, Swords, Trash2 } from "lucide-react";
import { deleteTimeSlots } from "@/app/(app)/torneos/[id]/canchas-franjas/actions";
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

/** Paletas de color para diferenciar visualmente cada franja */
const FRANGE_PALETTES = [
  {
    card: "border-l-4 border-l-emerald-500 bg-card hover:bg-card/90",
    time: "text-emerald-400 dark:text-emerald-300",
    badge: "border-emerald-500/40 bg-emerald-500/10 text-emerald-300",
  },
  {
    card: "border-l-4 border-l-sky-500 bg-card hover:bg-card/90",
    time: "text-sky-400 dark:text-sky-300",
    badge: "border-sky-500/40 bg-sky-500/10 text-sky-300",
  },
  {
    card: "border-l-4 border-l-violet-500 bg-card hover:bg-card/90",
    time: "text-violet-400 dark:text-violet-300",
    badge: "border-violet-500/40 bg-violet-500/10 text-violet-300",
  },
  {
    card: "border-l-4 border-l-amber-500 bg-card hover:bg-card/90",
    time: "text-amber-400 dark:text-amber-300",
    badge: "border-amber-500/40 bg-amber-500/10 text-amber-300",
  },
  {
    card: "border-l-4 border-l-rose-500 bg-card hover:bg-card/90",
    time: "text-rose-400 dark:text-rose-300",
    badge: "border-rose-500/40 bg-rose-500/10 text-rose-300",
  },
  {
    card: "border-l-4 border-l-teal-500 bg-card hover:bg-card/90",
    time: "text-teal-400 dark:text-teal-300",
    badge: "border-teal-500/40 bg-teal-500/10 text-teal-300",
  },
];

export function ConfiguredSlotsList({
  tournamentId,
  timezone,
  courts,
  slots,
}: ConfiguredSlotsListProps) {
  const router = useRouter();
  const [expandedWindows, setExpandedWindows] = useState<Set<string>>(new Set());

  const courtName = useMemo(
    () => new Map(courts.map((court) => [court.id, court.name])),
    [courts],
  );

  const dayWindows = useMemo(
    () => groupSlotsIntoDayWindows(slots, (slot) => localDateKey(slot.startsAt, timezone)),
    [slots, timezone],
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

  const totalAssignedMatches = slots.reduce((acc, s) => acc + s.assignedMatches, 0);
  const totalGameHours = Math.round(
    slots.reduce((acc, s) => acc + (Date.parse(s.endsAt) - Date.parse(s.startsAt)) / 3600000, 0),
  );

  return (
    <Card className="overflow-hidden border-border/80 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="space-y-0.5">
            <CardTitle className="text-base font-semibold flex items-center gap-2">
              <Clock className="size-4 text-primary" />
              <span>Franjas horarias configuradas</span>
            </CardTitle>
            <CardDescription className="text-xs">
              {slots.length === 0
                ? "Las franjas que generes aparecerán acá organizadas por día."
                : `${slots.length} ${slots.length === 1 ? "turno" : "turnos"} en total · ~${totalGameHours} hs de juego`}
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

        {/* Resumen de canchas confirmadas en la creación del torneo */}
        <div className="pt-2">
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
        ) : (
          dayWindows.map(({ day, windows }) => {
            const dayAllSlots = windows.flatMap((w) => w.slots);

            return (
              <section key={day} aria-labelledby={`day-heading-${day}`} className="space-y-2.5">
                {/* Header del Día: limpio sin botón redundante */}
                <div className="border-b border-border/50 pb-1.5 pt-1">
                  <h3 id={`day-heading-${day}`} className="text-xs sm:text-sm font-bold text-foreground uppercase tracking-wider flex items-center gap-2">
                    <span>{formatDayHeading(day)}</span>
                    <span className="font-normal text-muted-foreground lowercase text-xs">
                      · {windows.length} {windows.length === 1 ? "franja" : "franjas"} ({dayAllSlots.length} turnos)
                    </span>
                  </h3>
                </div>

                {/* Lista de franjas con distinción por color y tipografía mejorada */}
                <div className="space-y-2.5">
                  {windows.map((window, index) => {
                    const time = formatTimeRange(window.startsAt, window.endsAt, timezone);
                    const isExpanded = expandedWindows.has(window.id);

                    const availableTeams = Math.max(...window.slots.map((s) => s.availableTeams), 0);
                    const assignedMatches = window.slots.reduce((acc, s) => acc + s.assignedMatches, 0);
                    const inUse = availableTeams > 0 || assignedMatches > 0;

                    const courtIds = new Set(window.slots.map((s) => s.courtId));
                    const courtLabel =
                      courtIds.size === 1
                        ? [...courtIds][0]
                          ? (courtName.get([...courtIds][0]!) ?? "Cancha")
                          : "Todas las canchas"
                        : "Múltiples canchas";
                    const palette = FRANGE_PALETTES[index % FRANGE_PALETTES.length] ?? FRANGE_PALETTES[0]!;

                    return (
                      <div
                        key={window.id}
                        className={cn(
                          "rounded-xl border border-border/70 p-3.5 shadow-2xs transition-all space-y-2.5",
                          palette.card,
                        )}
                      >
                        {/* Fila superior: Horario grande, Cancha y Acciones */}
                        <div className="flex items-center justify-between gap-2">
                          <div className="flex flex-wrap items-center gap-2.5 min-w-0">
                            {/* Horario más grande y visible */}
                            <span className={cn("font-mono text-base sm:text-lg font-bold tabular-nums tracking-tight", palette.time)}>
                              {time}
                            </span>
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
                                    <p>
                                      {availableTeams > 0
                                        ? `${availableTeams} inscripciones la marcaron como disponible y perderán esa marca.`
                                        : null}
                                    </p>
                                    <p>{assignedMatches > 0 ? "Los partidos asignados quedan sin horario." : null}</p>
                                  </>
                                ) : (
                                  <p>Se borrarán los {window.slots.length} turnos de este intervalo.</p>
                                )
                              }
                              confirmLabel="Borrar franja"
                              onConfirm={() => removeWindow(window)}
                            >
                              <Trash2 className="size-4" aria-hidden="true" />
                            </ConfirmActionButton>
                          </div>
                        </div>

                        {/* Detalle desplegable de turnos individuales */}
                        {isExpanded && window.slots.length > 1 ? (
                          <div className="rounded-lg border border-border/60 bg-muted/20 p-2.5 space-y-2 pt-2.5">
                            <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block">
                              Turnos dentro del intervalo:
                            </span>
                            <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                              {window.slots.map((slot) => {
                                const slotTime = formatTimeRange(slot.startsAt, slot.endsAt, timezone);
                                const slotInUse = slot.availableTeams > 0 || slot.assignedMatches > 0;
                                return (
                                  <div
                                    key={slot.id}
                                    className="flex items-center justify-between rounded-md border border-border/70 bg-background px-2.5 py-1.5 text-xs shadow-2xs"
                                  >
                                    <span className="font-mono text-xs font-semibold text-foreground">
                                      {slotTime}
                                    </span>
                                    <ConfirmActionButton
                                      variant="ghost"
                                      size="icon"
                                      destructive
                                      className="size-5 shrink-0 text-muted-foreground/60 hover:text-destructive cursor-pointer"
                                      aria-label={`Borrar turno ${slotTime}`}
                                      title="¿Borrar este turno puntual?"
                                      description={
                                        slotInUse
                                          ? "Puede afectar partidos asignados en este horario específico."
                                          : "Se eliminará únicamente este turno."
                                      }
                                      confirmLabel="Borrar"
                                      onConfirm={() => removeSingleSlot(slot)}
                                    >
                                      <Trash2 className="size-3" aria-hidden="true" />
                                    </ConfirmActionButton>
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
