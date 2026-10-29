"use client";

import { useMemo } from "react";
import { AlertCircle, ArrowLeftRight, Calendar, CalendarClock, CheckCircle2, Clock, Sparkles, TriangleAlert } from "lucide-react";
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
import { DEFAULT_TIMEZONE, formatInTimeZone, formatTimeRange, localDateKey } from "@/lib/dates";
import { groupSlotsIntoDayWindows } from "@/lib/domain/availability";
import { groupName } from "@/lib/domain/groups";

type Slot = {
  id: string;
  startsAt: string;
  endsAt: string;
  courtId: string | null;
  stage?: "group" | "playoff" | string;
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

  // En fase de grupos solo se evalúan franjas de grupo (se excluyen 100% las de playoff)
  const groupSlots = useMemo(() => slots.filter((s) => (s.stage ?? "group") === "group"), [slots]);
  const slotMap = useMemo(() => new Map(groupSlots.map((s) => [s.id, s])), [groupSlots]);
  const courtMap = useMemo(() => new Map(courts.map((c) => [c.id, c])), [courts]);

  const teamSlotIds = useMemo(() => {
    return (availability?.[team.id] ?? []).filter((id) => slotMap.has(id));
  }, [availability, team.id, slotMap]);

  const teamSlotList = useMemo(() => {
    return teamSlotIds
      .map((id) => slotMap.get(id))
      .filter((s): s is Slot => Boolean(s))
      .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());
  }, [teamSlotIds, slotMap]);

  // Agrupar los turnos continuos de la pareja en franjas completas de grupo (ej. 13:00 a 22:00)
  const teamWindows = useMemo(() => {
    return groupSlotsIntoDayWindows(teamSlotList, (s) => localDateKey(s.startsAt, timezone)).flatMap((d) => d.windows);
  }, [teamSlotList, timezone]);

  // Coincidencias por cada rival en el grupo agrupadas por franjas completas de grupo
  const rivalComparisons = useMemo(() => {
    return rivals.map((rival) => {
      const rivalSlotIds = (availability?.[rival.id] ?? []).filter((id) => slotMap.has(id));
      const rivalSet = new Set(rivalSlotIds);

      // Si ambos tienen disponibilidad declarada
      const hasBothAvailability = teamSlotIds.length > 0 && rivalSlotIds.length > 0;
      const commonSlotIds = teamSlotIds.filter((id) => rivalSet.has(id));
      const commonSlots = commonSlotIds
        .map((id) => slotMap.get(id))
        .filter((s): s is Slot => Boolean(s))
        .sort((a, b) => new Date(a.startsAt).getTime() - new Date(b.startsAt).getTime());

      // Agrupar los turnos comunes continuos en franjas completas
      const commonWindows = groupSlotsIntoDayWindows(commonSlots, (s) => localDateKey(s.startsAt, timezone)).flatMap((d) => d.windows);

      const isConflict = hasBothAvailability && commonSlotIds.length === 0;

      return {
        rival,
        hasBothAvailability,
        teamSlotCount: teamSlotIds.length,
        rivalSlotCount: rivalSlotIds.length,
        commonSlots,
        commonWindows,
        isConflict,
      };
    });
  }, [rivals, availability, teamSlotIds, slotMap, timezone]);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-[calc(100%-1.5rem)] sm:max-w-lg max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden shadow-xl border">
        {/* Encabezado fijo superior */}
        <DialogHeader className="p-3.5 pr-10 sm:p-4 sm:pr-12 border-b shrink-0 text-left bg-card">
          <div className="flex items-center gap-2">
            <Badge variant="outline" className="font-semibold text-xs">
              {groupName(groupIndex)}
            </Badge>
            <DialogTitle className="text-sm sm:text-base font-semibold truncate" title={team.name}>
              {team.name}
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1 leading-snug">
            {teamWindows.length === 0 ? (
              "Esta pareja no tiene franjas horarias cargadas todavía (inscripción online o sin franjas asignadas)."
            ) : (
              <span>
                Tiene <strong>{teamWindows.length}</strong> {teamWindows.length === 1 ? "franja horaria declarada" : "franjas horarias declaradas"}.
                A continuación podés ver la coincidencia exacta con cada rival de la zona.
              </span>
            )}
          </DialogDescription>
        </DialogHeader>

        {/* Contenido con scroll vertical únicamente */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-4 space-y-3.5 min-w-0">
          {/* Aviso para asignar horarios si la pareja tiene 0 franjas */}
          {teamWindows.length === 0 ? (
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
                ({ rival, commonWindows, isConflict, rivalSlotCount }) => (
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
                        ) : commonWindows.length > 0 ? (
                          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" />
                        ) : (
                          <Clock className="size-4 shrink-0 text-muted-foreground" />
                        )}
                        <span className="font-semibold text-sm truncate" title={rival.name}>
                          vs {rival.name}
                        </span>
                      </div>

                      {isConflict ? (
                        <Badge variant="destructive" className="shrink-0 text-[11px] bg-amber-600 hover:bg-amber-600 text-white font-semibold">
                          Sin coincidencia
                        </Badge>
                      ) : commonWindows.length > 0 ? (
                        <Badge variant="outline" className="shrink-0 text-[11px] border-emerald-500/50 bg-emerald-500/10 text-emerald-700 dark:text-emerald-300 font-semibold">
                          {commonWindows.length} {commonWindows.length === 1 ? "franja en común" : "franjas en común"}
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
                    ) : commonWindows.length > 0 ? (
                      <div className="pt-1">
                        <p className="text-[11px] text-muted-foreground mb-1.5 font-medium">
                          Horarios posibles para este partido:
                        </p>
                        <div className="flex flex-wrap gap-1.5">
                          {commonWindows.map((win) => {
                            const dayText = formatInTimeZone(win.startsAt, timezone, "EEE d/M");
                            const timeText = formatTimeRange(win.startsAt, win.endsAt, timezone);
                            return (
                              <span
                                key={win.id}
                                className="inline-flex items-center gap-1.5 rounded-md border border-emerald-500/35 bg-emerald-50/80 dark:bg-emerald-950/40 px-2.5 py-1 text-xs text-emerald-900 dark:text-emerald-200"
                              >
                                <Calendar className="size-3 text-emerald-600 dark:text-emerald-400 shrink-0" />
                                <span className="capitalize font-medium">{dayText}</span>
                                <span className="font-semibold">{timeText}</span>
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
          {teamWindows.length > 0 ? (
            <div className="space-y-2 pt-2 border-t">
              <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground flex items-center gap-1.5">
                <CalendarClock className="size-3.5" />
                Todas las franjas declaradas por {team.name} ({teamWindows.length})
              </h4>
              <div className="flex flex-wrap gap-1.5 max-h-36 overflow-y-auto p-1">
                {teamWindows.map((win) => {
                  const dayText = formatInTimeZone(win.startsAt, timezone, "EEE d/M");
                  const timeText = formatTimeRange(win.startsAt, win.endsAt, timezone);
                  return (
                    <span
                      key={win.id}
                      className="inline-flex items-center gap-1.5 rounded-md border bg-muted/40 px-2.5 py-1 text-xs text-foreground"
                    >
                      <Calendar className="size-3 text-muted-foreground shrink-0" />
                      <span className="capitalize text-muted-foreground">{dayText}</span>
                      <span className="font-semibold tabular-nums">{timeText}</span>
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
