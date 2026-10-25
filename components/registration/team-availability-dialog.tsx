"use client";

import { CalendarClock, Check, CheckCheck, Clock, Save, Sparkles, Users, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { setTeamAvailabilityByOrganizer } from "@/app/(app)/torneos/[id]/inscripciones/actions";
import { Badge } from "@/components/ui/badge";
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
import { formatDayHeading, formatTimeRange, localDateKey } from "@/lib/dates";
import {
  type AvailabilityWindow,
  groupSlotsIntoDayWindows,
  selectionChanged,
} from "@/lib/domain/availability";
import type { OrganizerTeam } from "@/lib/data/teams";
import { cn } from "@/lib/utils";

export type DialogSlot = {
  id: string;
  startsAt: string;
  endsAt: string;
  courtId: string | null;
};

type TeamAvailabilityDialogProps = {
  tournamentId: string;
  timezone: string;
  slots: DialogSlot[];
  team: OrganizerTeam | null;
  categoryName?: string | null;
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function TeamAvailabilityDialog({
  tournamentId,
  timezone,
  slots,
  team,
  categoryName,
  open,
  onOpenChange,
}: TeamAvailabilityDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  // Conjunto inicial guardado de la pareja seleccionada
  const initialSlotIds = useMemo(() => team?.availabilitySlotIds ?? [], [team]);
  const savedSet = useMemo(() => new Set(initialSlotIds), [initialSlotIds]);

  // Selección actual en edición (si no tiene ninguna, se preseleccionan todas las del torneo por defecto)
  const [currentSelected, setCurrentSelected] = useState<Set<string>>(() => {
    if (team && team.availabilitySlotIds.length === 0 && slots.length > 0) {
      return new Set(slots.map((s) => s.id));
    }
    return new Set(initialSlotIds);
  });

  // Resetear la selección al abrir el diálogo o cambiar de equipo
  useEffect(() => {
    if (open && team) {
      if (team.availabilitySlotIds.length === 0 && slots.length > 0) {
        setCurrentSelected(new Set(slots.map((s) => s.id)));
      } else {
        setCurrentSelected(new Set(team.availabilitySlotIds));
      }
    }
  }, [open, team, slots]);

  // Agrupación de turnos por día y franjas continuas
  const dayWindows = useMemo(
    () => groupSlotsIntoDayWindows(slots, (s) => localDateKey(s.startsAt, timezone)),
    [slots, timezone],
  );
  const allWindows = useMemo(() => dayWindows.flatMap((d) => d.windows), [dayWindows]);

  const isDirty = selectionChanged(savedSet, currentSelected);

  function isWindowSelected(window: AvailabilityWindow<DialogSlot>): boolean {
    return window.slotIds.length > 0 && window.slotIds.every((id) => currentSelected.has(id));
  }

  function toggleWindow(window: AvailabilityWindow<DialogSlot>) {
    setCurrentSelected((prev) => {
      const next = new Set(prev);
      const isSelected = isWindowSelected(window);
      for (const id of window.slotIds) {
        if (isSelected) {
          next.delete(id);
        } else {
          next.add(id);
        }
      }
      return next;
    });
  }

  function toggleDay(windows: AvailabilityWindow<DialogSlot>[]) {
    setCurrentSelected((prev) => {
      const next = new Set(prev);
      const allSelected = windows.every((w) => isWindowSelected(w));
      for (const w of windows) {
        for (const id of w.slotIds) {
          if (allSelected) {
            next.delete(id);
          } else {
            next.add(id);
          }
        }
      }
      return next;
    });
  }

  function selectAll() {
    setCurrentSelected(new Set(slots.map((s) => s.id)));
  }

  function clearAll() {
    setCurrentSelected(new Set());
  }

  function handleSave() {
    if (!team) return;

    startTransition(async () => {
      const result = await setTeamAvailabilityByOrganizer({
        tournamentId,
        teamId: team.id,
        slotIds: [...currentSelected],
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? "Disponibilidad guardada.");
      onOpenChange(false);
      router.refresh();
    });
  }

  if (!team) return null;

  const selectedWindowsCount = allWindows.filter((w) => isWindowSelected(w)).length;
  const totalWindowsCount = allWindows.length;

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Cabecera */}
        <DialogHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-start justify-between gap-3">
            <div className="flex items-center gap-2.5">
              <div className="flex size-9 items-center justify-center rounded-xl bg-primary/10 text-primary">
                <CalendarClock className="size-5" aria-hidden="true" />
              </div>
              <div>
                <DialogTitle className="text-base font-semibold">
                  Franjas horarias de disponibilidad
                </DialogTitle>
                <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                  Elegí en qué horarios puede jugar esta pareja. Los partidos se programarán respetando esta franja.
                </DialogDescription>
              </div>
            </div>
          </div>

          {/* Cuadro con nombres de la pareja e integrantes */}
          <div className="mt-3.5 rounded-xl border border-border/70 bg-card p-3 shadow-2xs space-y-2">
            <div className="flex flex-wrap items-center justify-between gap-2">
              <div className="flex items-center gap-2 min-w-0">
                <Users className="size-4 shrink-0 text-primary" aria-hidden="true" />
                <span className="font-semibold text-sm text-foreground truncate">
                  {team.name}
                </span>
                {categoryName ? (
                  <Badge variant="outline" className="text-[11px] font-medium shrink-0">
                    {categoryName}
                  </Badge>
                ) : null}
              </div>

              <div className="flex items-center gap-1.5 shrink-0">
                <Badge
                  variant={currentSelected.size === 0 ? "outline" : "secondary"}
                  className={cn(
                    "text-xs font-medium tabular-nums",
                    currentSelected.size === 0
                      ? "border-amber-500/40 text-amber-700 dark:text-amber-300 bg-amber-500/10"
                      : "text-foreground",
                  )}
                >
                  {selectedWindowsCount} de {totalWindowsCount} {totalWindowsCount === 1 ? "franja" : "franjas"}
                </Badge>
              </div>
            </div>

            {team.members.length > 0 ? (
              <div className="text-xs text-muted-foreground border-t border-border/40 pt-2 flex flex-wrap items-center gap-x-3 gap-y-1">
                <span className="font-medium text-foreground/80">Integrantes:</span>
                {team.members.map((member, i) => (
                  <span key={member.id} className="inline-flex items-center gap-1">
                    <span className="text-foreground">
                      {member.fullName ?? member.displayName ?? member.email ?? "Sin nombre"}
                    </span>
                    {i < team.members.length - 1 ? <span className="text-border">·</span> : null}
                  </span>
                ))}
              </div>
            ) : null}

            {team.availabilitySlotIds.length === 0 && slots.length > 0 ? (
              <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 px-3 py-2 text-xs text-emerald-800 dark:text-emerald-200">
                <span className="font-medium">Horarios preseleccionados:</span> Para facilitarte la programación, marcamos todas las franjas horarias del torneo. Podés desmarcar las que no correspondan o guardar directamente.
              </div>
            ) : null}
          </div>
        </DialogHeader>

        {/* Acciones rápidas de franjas */}
        {slots.length > 0 ? (
          <div className="flex flex-wrap items-center justify-between gap-2 px-5 py-2.5 bg-muted/40 border-b border-border/50 text-xs">
            <span className="text-muted-foreground font-medium">Acciones rápidas:</span>
            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={selectAll}
                disabled={isPending || (slots.length > 0 && currentSelected.size === slots.length)}
                className="h-7 px-2.5 text-xs gap-1.5"
              >
                <CheckCheck className="size-3.5 text-primary" aria-hidden="true" />
                <span>Marcar todas</span>
              </Button>
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={clearAll}
                disabled={isPending || currentSelected.size === 0}
                className="h-7 px-2.5 text-xs gap-1.5 text-muted-foreground hover:text-foreground"
              >
                <X className="size-3.5" aria-hidden="true" />
                <span>Desmarcar todas</span>
              </Button>
            </div>
          </div>
        ) : null}

        {/* Listado de días y franjas */}
        <div className="p-5 flex-1 overflow-y-auto max-h-[50vh] space-y-5">
          {slots.length === 0 ? (
            <div className="flex flex-col items-center justify-center p-8 text-center rounded-xl border border-dashed border-border/80">
              <Clock className="size-8 text-muted-foreground mb-2 opacity-60" />
              <p className="text-sm font-semibold text-foreground">El torneo aún no tiene franjas horarias</p>
              <p className="text-xs text-muted-foreground mt-1 max-w-sm">
                Para definir en qué horarios puede jugar la pareja, primero cargá los días y turnos en la sección de Canchas y franjas.
              </p>
            </div>
          ) : (
            dayWindows.map(({ day, windows }) => {
              const allSelected = windows.length > 0 && windows.every((w) => isWindowSelected(w));

              return (
                <section key={day} aria-labelledby={`dia-${day}`} className="space-y-2.5">
                  <div className="flex items-center justify-between gap-2 border-b border-border/40 pb-1.5">
                    <h3 id={`dia-${day}`} className="text-xs font-semibold uppercase tracking-wider text-muted-foreground first-letter:uppercase">
                      {formatDayHeading(day)}
                    </h3>
                    {windows.length > 1 ? (
                      <Button
                        type="button"
                        variant="ghost"
                        size="sm"
                        onClick={() => toggleDay(windows)}
                        className="h-6 px-2 text-[11px] text-primary hover:text-primary hover:bg-primary/10"
                      >
                        {allSelected ? "Desmarcar día" : "Todo el día"}
                      </Button>
                    ) : null}
                  </div>

                  <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                    {windows.map((window, index) => {
                      const active = isWindowSelected(window);
                      const time = formatTimeRange(window.startsAt, window.endsAt, timezone);
                      const label = windows.length > 1 ? `Franja ${index + 1}` : "Franja completa";
                      const slotsCount = window.slots.length;

                      return (
                        <button
                          key={window.id}
                          type="button"
                          role="checkbox"
                          aria-checked={active}
                          disabled={isPending}
                          onClick={() => toggleWindow(window)}
                          className={cn(
                            "flex min-h-[52px] w-full flex-col justify-center rounded-xl border px-3.5 py-2.5 text-left transition-all",
                            "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring cursor-pointer select-none",
                            active
                              ? "border-emerald-600 bg-emerald-600 text-white shadow-xs dark:bg-emerald-600 dark:border-emerald-600"
                              : "border-border/70 bg-card hover:bg-muted/60 text-foreground hover:border-border",
                          )}
                        >
                          <div className="flex items-center justify-between w-full">
                            <span className="flex items-center gap-1.5 font-semibold text-sm tabular-nums">
                              {active ? (
                                <Check className="size-4 shrink-0 stroke-[2.5]" aria-hidden="true" />
                              ) : (
                                <Clock className="size-3.5 shrink-0 opacity-40" aria-hidden="true" />
                              )}
                              <span>{time}</span>
                            </span>
                            <span
                              className={cn(
                                "text-[11px] font-medium px-1.5 py-0.5 rounded",
                                active ? "bg-white/20 text-white" : "bg-muted text-muted-foreground",
                              )}
                            >
                              {active ? "Disponible" : "No disponible"}
                            </span>
                          </div>

                          <span className={cn("text-[11px] mt-0.5", active ? "text-white/85" : "text-muted-foreground")}>
                            {label} {slotsCount > 1 ? `· ${slotsCount} turnos de cancha` : ""}
                          </span>
                        </button>
                      );
                    })}
                  </div>
                </section>
              );
            })
          )}
        </div>

        {/* Pie de modal */}
        <DialogFooter className="p-4 border-t border-border/60 bg-muted/20 flex flex-col-reverse sm:flex-row items-center justify-between gap-2.5">
          <div className="text-xs text-muted-foreground w-full sm:w-auto text-center sm:text-left">
            {isDirty ? (
              <span className="inline-flex items-center gap-1 text-amber-600 dark:text-amber-400 font-medium">
                <Sparkles className="size-3.5" />
                Cambios pendientes sin guardar
              </span>
            ) : (
              <span>Sin cambios</span>
            )}
          </div>

          <div className="flex items-center gap-2 w-full sm:w-auto justify-end">
            <Button
              type="button"
              variant="outline"
              size="default"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>

            <Button
              type="button"
              size="default"
              onClick={handleSave}
              disabled={isPending || (!isDirty && initialSlotIds.length === currentSelected.size)}
              className="gap-2 shrink-0 min-w-[140px]"
            >
              {isPending ? <Spinner className="size-4" /> : <Save className="size-4" />}
              <span>Guardar franjas</span>
            </Button>
          </div>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
