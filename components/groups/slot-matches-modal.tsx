"use client";

import { AlertCircle, ArrowLeftRight, Calendar, CalendarClock, CheckCircle2, Clock, MapPin, Sparkles, TriangleAlert } from "lucide-react";
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
import { DEFAULT_TIMEZONE, formatInTimeZone, formatTimeRange } from "@/lib/dates";
import { groupName } from "@/lib/domain/groups";

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

export type SlotMatchesModalProps = {
  isOpen: boolean;
  onClose: () => void;
  team: { id: string; name: string } | null;
  groupIndex: number;
  rivals: { id: string; name: string }[];
  availability?: Record<string, string[]>;
  slots?: Slot[];
  courts?: Court[];
  timezone?: string;
  onOpenSwap?: (teamId: string) => void;
  onAssignAllSlots?: (teamId: string) => void;
  isAssigningSlots?: boolean;
};

export function SlotMatchesModal({
  isOpen,
  onClose,
  team,
  groupIndex,
  rivals,
  availability,
  slots = [],
  courts = [],
  timezone = DEFAULT_TIMEZONE,
  onOpenSwap,
  onAssignAllSlots,
  isAssigningSlots = false,
}: SlotMatchesModalProps) {
  if (!team) return null;

  const slotMap = new Map(slots.map((s) => [s.id, s]));
  const courtMap = new Map(courts.map((c) => [c.id, c]));

  const teamSlotIds = availability?.[team.id] ?? [];
  const teamSlotList = teamSlotIds
    .map((id) => slotMap.get(id))
    .filter((s): s is Slot => Boolean(s))
    .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

  // Coincidencias por cada rival en el grupo
  const rivalComparisons = rivals.map((rival) => {
    const rivalSlotIds = availability?.[rival.id] ?? [];
    const rivalSet = new Set(rivalSlotIds);

    // Si ambos tienen disponibilidad declarada
    const hasBothAvailability = teamSlotIds.length > 0 && rivalSlotIds.length > 0;
    const commonSlotIds = teamSlotIds.filter((id) => rivalSet.has(id));
    const commonSlots = commonSlotIds
      .map((id) => slotMap.get(id))
      .filter((s): s is Slot => Boolean(s))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

    const isConflict = hasBothAvailability && commonSlotIds.length === 0;

    return {
      rival,
      hasBothAvailability,
      teamSlotCount: teamSlotIds.length,
      rivalSlotCount: rivalSlotIds.length,
      commonSlots,
      isConflict,
    };
  });

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-[calc(100%-1.5rem)] sm:max-w-lg max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden shadow-xl border">
        {/* Encabezado fijo superior */}
        <DialogHeader className="p-3.5 pr-10 sm:p-4 sm:pr-12 border-b shrink-0 text-left bg-card">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-semibold text-xs">
              {groupName(groupIndex)}
            </Badge>
            <DialogTitle className="text-sm sm:text-base font-semibold truncate">
              {team.name}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1 leading-snug">
            {teamSlotList.length === 0 ? (
              "Esta pareja no tiene franjas horarias cargadas todavía (inscripción online o sin franjas asignadas)."
            ) : (
              <span>
                Tiene <strong>{teamSlotList.length}</strong> {teamSlotList.length === 1 ? "franja horaria declarada" : "franjas horarias declaradas"}.
                A continuación podés ver la coincidencia exacta con cada rival de la zona.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Contenido con scroll vertical únicamente */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-3.5 min-w-0">
          {/* Aviso para asignar horarios si la pareja tiene 0 franjas */}
          {teamSlotList.length === 0 ? (
            <div className="rounded-lg border border-amber-300/80 bg-amber-50/70 p-3 text-xs text-amber-950 dark:border-amber-800/80 dark:bg-amber-950/20 dark:text-amber-200 space-y-2">
              <div className="flex items-start gap-2">
                <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
                <div className="space-y-1">
                  <p className="font-semibold text-foreground">Sin horarios asignados todavía</p>
                  <p className="text-muted-foreground dark:text-amber-300/90 leading-relaxed">
                    Esta pareja se inscribió sin horarios cargados. Para que el sistema cruce automáticamente sus coincidencias con los demás rivales de la zona, podés habilitarle todos los horarios del torneo con un solo clic.
                  </p>
                </div>
              </div>
              {onAssignAllSlots ? (
                <div className="pt-1 pl-6">
                  <Button
                    type="button"
                    size="sm"
                    variant="default"
                    onClick={() => onAssignAllSlots(team.id)}
                    disabled={isAssigningSlots}
                    className="gap-1.5 text-xs font-medium shadow-sm"
                  >
                    {isAssigningSlots ? <Spinner className="size-3.5" /> : <Sparkles className="size-3.5" />}
                    Habilitar todos los horarios del torneo
                  </Button>
                </div>
              ) : null}
            </div>
          ) : null}

          {/* Comparación con cada rival del grupo */}
          <div className="space-y-3">
            <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Cruce contra rivales del {groupName(groupIndex)}
            </h4>

            {rivalComparisons.length === 0 ? (
              <p className="text-xs text-muted-foreground italic">
                No hay otros equipos en este grupo aún.
              </p>
            ) : (
              rivalComparisons.map(
                ({ rival, hasBothAvailability, commonSlots, isConflict, rivalSlotCount }) => (
                  <div
                    key={rival.id}
                    className={`rounded-lg border p-3 space-y-2 transition-colors ${
                      isConflict
                        ? "border-amber-300 bg-amber-50/70 dark:border-amber-900/60 dark:bg-amber-950/20"
                        : "border-border/80 bg-card"
                    }`}
                  >
                    <div className="flex items-center justify-between gap-2">
                      <div className="flex items-center gap-2 min-w-0">
                        {isConflict ? (
                          <TriangleAlert className="size-4 shrink-0 text-amber-600 dark:text-amber-400" />
                        ) : commonSlots.length > 0 ? (
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Clock className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="font-medium text-sm truncate">
                          vs {rival.name}
                        </span>
                      </div>

                      {isConflict ? (
                        <Badge variant="destructive" className="shrink-0 text-[11px] bg-amber-600 hover:bg-amber-600 text-white">
                          Sin coincidencia
                        </Badge>
                      ) : commonSlots.length > 0 ? (
                        <Badge variant="outline" className="shrink-0 text-[11px] border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300">
                          {commonSlots.length} {commonSlots.length === 1 ? "franja en común" : "franjas en común"}
                        </Badge>
                      ) : (
                        <Badge variant="secondary" className="shrink-0 text-[11px]">
                          Cualquier franja
                        </Badge>
                      )}
                    </div>

                    {isConflict ? (
                      <p className="text-xs text-amber-800 dark:text-amber-300">
                        Ambas parejas cargaron restricciones pero no comparten ningún horario. Te sugerimos intercambiarla de grupo o ampliar sus franjas.
                      </p>
                    ) : commonSlots.length > 0 ? (
                      <div className="pt-1">
                        <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">
                          Horarios posibles para este partido:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {commonSlots.map((slot) => {
                            const court = slot.courtId ? courtMap.get(slot.courtId) : null;
                            const dayText = formatInTimeZone(slot.startsAt, timezone, "EEE d/M");
                            const timeText = formatTimeRange(slot.startsAt, slot.endsAt, timezone);
                            return (
                              <span
                                key={slot.id}
                                className="inline-flex items-center gap-1 rounded-md border border-emerald-500/30 bg-emerald-50/70 px-2 py-0.5 text-xs text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200"
                              >
                                <Calendar className="size-3 text-emerald-600" />
                                <span className="capitalize">{dayText}</span>
                                <span className="font-semibold">{timeText}</span>
                                {court ? (
                                  <span className="text-[10px] text-emerald-700 dark:text-emerald-400">
                                    ({court.name})
                                  </span>
                                ) : null}
                              </span>
                            );
                          })}
                        </div>
                      </div>
                    ) : (
                      <p className="text-xs text-muted-foreground">
                        {teamSlotIds.length === 0 && rivalSlotCount > 0
                          ? `"${team.name}" aún no tiene horarios asignados. Habilitale los horarios arriba para calcular cruces con "${rival.name}".`
                          : rivalSlotCount === 0
                            ? `"${rival.name}" no cargó restricciones: pueden jugar en cualquier momento disponible.`
                            : `Pueden programarse en cualquiera de las franjas cargadas.`}
                      </p>
                    )}
                  </div>
                )
              )
            )}
          </div>

          {/* Todas las franjas declaradas por este equipo */}
          {teamSlotList.length > 0 ? (
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                Todas las franjas declaradas por {team.name} ({teamSlotList.length})
              </h4>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                {teamSlotList.map((slot) => {
                  const court = slot.courtId ? courtMap.get(slot.courtId) : null;
                  const dayText = formatInTimeZone(slot.startsAt, timezone, "EEE d/M");
                  const timeText = formatTimeRange(slot.startsAt, slot.endsAt, timezone);
                  return (
                    <span
                      key={slot.id}
                      className="inline-flex items-center gap-1 rounded border bg-background px-2 py-0.5 text-xs text-foreground"
                    >
                      <span className="capitalize text-muted-foreground">{dayText}</span>
                      <span className="font-medium tabular-nums">{timeText}</span>
                      {court ? (
                        <span className="text-[10px] text-muted-foreground flex items-center gap-0.5">
                          <MapPin className="size-2.5" />
                          {court.name}
                        </span>
                      ) : null}
                    </span>
                  );
                })}
              </div>
            </div>
          ) : null}
        </div>

        {/* Pie fijo inferior */}
        <DialogFooter className="p-2.5 sm:p-3 border-t bg-muted/10 shrink-0 flex flex-row items-center justify-between gap-2 sm:justify-between">
          {onOpenSwap ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onOpenSwap(team.id);
              }}
              className="h-7.5 px-3 text-xs gap-1.5"
            >
              <ArrowLeftRight className="size-3" />
              <span>Intercambiar pareja</span>
            </Button>
          ) : <div />}

          <Button type="button" variant="default" size="sm" onClick={onClose} className="h-7.5 px-3 text-xs">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
