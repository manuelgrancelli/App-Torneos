"use client";

import { Calendar, CalendarClock, CheckCircle2, Clock, MapPin, TriangleAlert } from "lucide-react";
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
      <DialogContent className="max-w-xl max-h-[88vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-semibold">
              {groupName(groupIndex)}
            </Badge>
            <DialogTitle className="text-base sm:text-lg truncate">
              {team.name}
            </DialogTitle>
          </div>
          <DialogDescription>
            {teamSlotList.length === 0 ? (
              "Esta pareja no tiene franjas horarias específicas cargadas (está disponible en cualquier horario)."
            ) : (
              <span>
                Tiene <strong>{teamSlotList.length}</strong> {teamSlotList.length === 1 ? "franja horaria declarada" : "franjas horarias declaradas"}.
                A continuación podés ver la coincidencia exacta con cada rival de la zona.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
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
                        {rivalSlotCount === 0
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

        <DialogFooter className="flex flex-row items-center justify-between gap-2 sm:justify-between">
          {onOpenSwap ? (
            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={() => {
                onClose();
                onOpenSwap(team.id);
              }}
              className="text-xs"
            >
              Intercambiar con otra pareja
            </Button>
          ) : <div />}

          <Button type="button" variant="default" size="sm" onClick={onClose} className="text-xs">
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
