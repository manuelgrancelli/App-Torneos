"use client";

import {
  Calendar,
  Check,
  CheckCircle2,
  CircleAlert,
  Clock,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { assignSlot } from "@/app/(app)/torneos/[id]/partidos/actions";
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
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { formatDayHeading, formatTimeRange, localDateKey } from "@/lib/dates";
import { groupSlotsByDay } from "@/lib/domain/availability";
import {
  type FixedAssignment,
  checkManualAssignment,
  getSlotEvaluation,
} from "@/lib/domain/scheduler";
import { cn } from "@/lib/utils";

type AssignSlotDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  timezone: string;
  match: {
    id: string;
    homeTeamId: string | null;
    awayTeamId: string | null;
    slotId: string | null;
    courtId: string | null;
    homeName?: string;
    awayName?: string;
  };
  title: string;
  slots: { id: string; startsAt: string; endsAt: string; courtId: string | null }[];
  courts: { id: string; name: string }[];
  /** Partidos ya programados (para detectar choques). */
  scheduled: FixedAssignment[];
  availability: Record<string, string[]>;
};

/**
 * Asignación manual de horario con identificación por colores:
 * - Verde recuadrado: disponibilidad de alguna cancha y las dos parejas pueden jugar.
 * - Amarillo recuadrado: los horarios en que alguna pareja no puede jugar.
 * - Rojo recuadrado: las franjas en que todas las canchas están ocupadas o ninguna pareja puede jugar.
 */
export function AssignSlotDialog(props: AssignSlotDialogProps) {
  const { open, onOpenChange, match, slots, courts, timezone } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slotId, setSlotId] = useState(match.slotId ?? "");
  const [courtId, setCourtId] = useState(match.courtId ?? courts[0]?.id ?? "");
  const [dayFilter, setDayFilter] = useState<string>("all");

  const courtName = useMemo(() => new Map(courts.map((c) => [c.id, c.name])), [courts]);
  const slot = slots.find((s) => s.id === slotId);
  const effectiveCourt = slot?.courtId ?? courtId;

  // Agrupación por días
  const days = useMemo(
    () => groupSlotsByDay(slots, (s) => localDateKey(s.startsAt, timezone)),
    [slots, timezone],
  );

  // Evaluación de colores (Verde / Amarillo / Rojo) para cada franja
  const slotEvaluations = useMemo(() => {
    const map = new Map<string, ReturnType<typeof getSlotEvaluation>>();
    for (const s of slots) {
      map.set(
        s.id,
        getSlotEvaluation({
          slot: s,
          match,
          courts,
          scheduled: props.scheduled,
          availability: props.availability,
        }),
      );
    }
    return map;
  }, [slots, match, courts, props.scheduled, props.availability]);

  // Validación de conflictos en la asignación actual
  const check = slot
    ? checkManualAssignment({
        match,
        slot: { id: slot.id, start: Date.parse(slot.startsAt), end: Date.parse(slot.endsAt), courtId: slot.courtId },
        courtId: effectiveCourt,
        others: props.scheduled,
        availability: props.availability,
      })
    : { conflicts: [], warnings: [] };

  const selectedSlotEval = slot ? slotEvaluations.get(slot.id) : null;

  // Partidos concurrentes con la franja seleccionada (para saber qué canchas están ocupadas)
  const overlappingWithSelectedSlot = useMemo(() => {
    if (!slot) return [];
    const start = Date.parse(slot.startsAt);
    const end = Date.parse(slot.endsAt);
    return props.scheduled.filter(
      (o) => o.matchId !== match.id && o.start < end && start < o.end,
    );
  }, [slot, props.scheduled, match.id]);

  function run(nextSlot: string | null) {
    if (typeof document !== "undefined" && document.activeElement instanceof HTMLElement) {
      document.activeElement.blur();
    }
    startTransition(async () => {
      const result = await assignSlot({
        tournamentId: props.tournamentId,
        matchId: match.id,
        slotId: nextSlot,
        courtId: nextSlot ? effectiveCourt || null : null,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Listo.");
      onOpenChange(false);
      router.refresh();
      if (typeof window !== "undefined") {
        window.scrollTo({ left: 0, top: window.scrollY });
      }
    });
  }

  const visibleDays = dayFilter === "all" ? days : days.filter((d) => d.day === dayFilter);

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent
        onCloseAutoFocus={(e) => {
          e.preventDefault();
          if (typeof window !== "undefined") {
            window.scrollTo({ left: 0, top: window.scrollY });
          }
        }}
        className="max-h-[92dvh] overflow-y-auto overflow-x-hidden w-full sm:max-w-xl p-4 sm:p-6"
      >
        <DialogHeader className="space-y-1 pb-1">
          <DialogTitle className="text-lg font-bold">Horario del partido</DialogTitle>
          <DialogDescription className="text-xs sm:text-sm font-semibold text-foreground line-clamp-2">
            {props.title}
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4">
          {/* Referencia visual de colores (Boceto del organizador) */}
          <div className="rounded-xl border border-border/70 bg-card p-3 space-y-2 shadow-xs">
            <span className="font-semibold text-foreground/90 tracking-wide uppercase text-[10px] block">
              Referencia de disponibilidad
            </span>
            <div className="grid grid-cols-1 sm:grid-cols-3 gap-2">
              <div className="flex items-center gap-2 rounded-lg border-2 border-emerald-500/70 bg-emerald-500/10 px-2.5 py-1.5 text-emerald-950 dark:text-emerald-100">
                <span className="size-2.5 rounded-full bg-emerald-500 shadow-xs shrink-0" />
                <span className="font-semibold text-[11px] leading-tight">Cancha libre y parejas disponibles</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border-2 border-amber-400 bg-amber-400/15 px-2.5 py-1.5 text-amber-950 dark:text-amber-100">
                <span className="size-2.5 rounded-full bg-amber-400 shadow-xs shrink-0" />
                <span className="font-semibold text-[11px] leading-tight">Alguna pareja no puede jugar</span>
              </div>
              <div className="flex items-center gap-2 rounded-lg border-2 border-rose-500/70 bg-rose-500/10 px-2.5 py-1.5 text-rose-950 dark:text-rose-100">
                <span className="size-2.5 rounded-full bg-rose-500 shadow-xs shrink-0" />
                <span className="font-semibold text-[11px] leading-tight">Canchas ocupadas / Ambas no pueden</span>
              </div>
            </div>
          </div>

          {/* Selector de franja horaria */}
          <div className="space-y-2">
            <div className="flex items-center justify-between">
              <FieldLabel className="text-xs sm:text-sm font-bold text-foreground">
                Elegí una franja horaria
              </FieldLabel>
              {slot ? (
                <button
                  type="button"
                  onClick={() => setSlotId("")}
                  className="text-xs text-muted-foreground hover:text-foreground font-medium underline-offset-2 hover:underline"
                >
                  Limpiar selección
                </button>
              ) : null}
            </div>

            {/* Filtro por día si hay más de 1 día (con flex-wrap para evitar scroll horizontal) */}
            {days.length > 1 ? (
              <div
                role="region"
                aria-label="Filtrar franjas por día"
                className="flex flex-wrap items-center gap-1.5 pb-1"
              >
                <button
                  type="button"
                  onClick={() => setDayFilter("all")}
                  className={cn(
                    "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap shrink-0 transition-colors",
                    dayFilter === "all"
                      ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  Todos los días ({slots.length})
                </button>
                {days.map(({ day, slots: daySlots }) => (
                  <button
                    key={day}
                    type="button"
                    onClick={() => setDayFilter(day)}
                    className={cn(
                      "inline-flex h-7 items-center rounded-full border px-3 text-xs font-medium whitespace-nowrap shrink-0 transition-colors first-letter:uppercase",
                      dayFilter === day
                        ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                        : "border-border/80 bg-muted/40 text-muted-foreground hover:bg-muted hover:text-foreground",
                    )}
                  >
                    {formatDayHeading(day)} ({daySlots.length})
                  </button>
                ))}
              </div>
            ) : null}

            {/* Lista de franjas horarias con recuadros por color */}
            {slots.length === 0 ? (
              <p className="rounded-xl border border-dashed p-6 text-center text-xs text-muted-foreground">
                No hay franjas horarias configuradas en este torneo. Creá franjas en la sección Canchas y Franjas.
              </p>
            ) : (
              <div
                tabIndex={0}
                role="region"
                aria-label="Lista de franjas horarias disponibles"
                className="max-h-[300px] overflow-y-auto space-y-4 pr-1 focus:outline-none"
              >
                {visibleDays.map(({ day, slots: daySlots }) => (
                  <div key={day} className="space-y-2">
                    <div className="flex items-center justify-between px-1">
                      <h4 className="text-xs font-bold text-foreground/90 first-letter:uppercase flex items-center gap-1.5">
                        <Calendar className="size-3.5 text-muted-foreground" aria-hidden="true" />
                        {formatDayHeading(day)}
                      </h4>
                      <span className="text-[11px] text-muted-foreground">
                        {daySlots.filter((s) => slotEvaluations.get(s.id)?.status === "green").length} disponibles
                      </span>
                    </div>

                    <div className="grid grid-cols-1 gap-2">
                      {daySlots.map((s) => {
                        const ev = slotEvaluations.get(s.id);
                        const isSelected = slotId === s.id;
                        const status = ev?.status ?? "green";

                        return (
                          <button
                            key={s.id}
                            type="button"
                            onClick={() => {
                              setSlotId(s.id);
                              if (s.courtId) setCourtId(s.courtId);
                            }}
                            className={cn(
                              "w-full text-left rounded-xl p-3 border-2 transition-all flex items-center justify-between gap-3 relative",
                              // Estilos de recuadro según color solicitado
                              status === "green" &&
                                "border-emerald-500/80 bg-emerald-500/10 text-emerald-950 dark:text-emerald-100 hover:bg-emerald-500/20",
                              status === "yellow" &&
                                "border-amber-400 bg-amber-400/15 text-amber-950 dark:text-amber-100 hover:bg-amber-400/25",
                              status === "red" &&
                                "border-rose-500/80 bg-rose-500/10 text-rose-950 dark:text-rose-100 hover:bg-rose-500/20",
                              // Selección activa
                              isSelected && "ring-2 ring-primary ring-offset-2 ring-offset-background shadow-md",
                            )}
                          >
                            <div className="min-w-0 flex-1 space-y-0.5">
                              <div className="flex flex-wrap items-center gap-2">
                                <span className="font-bold text-sm sm:text-base tabular-nums flex items-center gap-1.5">
                                  <Clock className="size-3.5 opacity-75" aria-hidden="true" />
                                  {formatTimeRange(s.startsAt, s.endsAt, timezone)}
                                </span>
                                {s.courtId ? (
                                  <Badge
                                    variant="outline"
                                    className="border-current/30 text-[10px] font-medium bg-background/50"
                                  >
                                    {courtName.get(s.courtId) ?? "Cancha"}
                                  </Badge>
                                ) : null}
                              </div>

                              <p className="text-xs opacity-90 line-clamp-1 font-medium">
                                {ev?.detail}
                              </p>
                            </div>

                            <div className="flex shrink-0 items-center gap-2">
                              {/* Badge de estado del recuadro */}
                              {status === "green" && (
                                <Badge className="bg-emerald-600 hover:bg-emerald-600 text-white font-semibold text-[11px] shadow-xs">
                                  Disponible
                                </Badge>
                              )}
                              {status === "yellow" && (
                                <Badge className="bg-amber-500 hover:bg-amber-500 text-white font-semibold text-[11px] shadow-xs">
                                  1 no puede
                                </Badge>
                              )}
                              {status === "red" && (
                                <Badge className="bg-rose-600 hover:bg-rose-600 text-white font-semibold text-[11px] shadow-xs">
                                  No disponible
                                </Badge>
                              )}

                              {isSelected ? (
                                <div className="size-6 rounded-full bg-primary text-primary-foreground flex items-center justify-center shrink-0 shadow-xs">
                                  <Check className="size-3.5 stroke-[3]" aria-hidden="true" />
                                </div>
                              ) : null}
                            </div>
                          </button>
                        );
                      })}
                    </div>
                  </div>
                ))}
              </div>
            )}
          </div>

          {/* Selector de cancha (cuando la franja no está prefijada a una cancha específica) */}
          {slot && !slot.courtId && courts.length > 0 ? (
            <Field className="space-y-2">
              <FieldLabel className="text-xs sm:text-sm font-semibold">
                Cancha para el partido
              </FieldLabel>
              <div className="grid grid-cols-2 sm:grid-cols-3 gap-2">
                {courts.map((c) => {
                  const isBusy = overlappingWithSelectedSlot.some((o) => o.courtId === c.id);
                  const isSelected = effectiveCourt === c.id;

                  return (
                    <button
                      key={c.id}
                      type="button"
                      onClick={() => setCourtId(c.id)}
                      className={cn(
                        "rounded-xl border p-2.5 text-left transition-all text-xs flex flex-col justify-between gap-1",
                        isSelected
                          ? "border-primary bg-primary/10 ring-2 ring-primary shadow-xs font-semibold"
                          : "border-border hover:bg-muted bg-card",
                        isBusy && !isSelected && "opacity-75 bg-muted/40",
                      )}
                    >
                      <span className="font-semibold text-foreground text-sm line-clamp-1">{c.name}</span>
                      <span
                        className={cn(
                          "text-[10px] font-semibold",
                          isBusy ? "text-rose-600 dark:text-rose-400" : "text-emerald-600 dark:text-emerald-400",
                        )}
                      >
                        {isBusy ? "● Ocupada a esta hora" : "● Cancha libre"}
                      </span>
                    </button>
                  );
                })}
              </div>
            </Field>
          ) : null}

          {/* Mensajes de validación y avisos */}
          {slot && selectedSlotEval?.status === "green" && check.conflicts.length === 0 ? (
            <p className="flex items-center gap-2 rounded-xl bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs sm:text-sm text-emerald-900 dark:text-emerald-200">
              <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
              <span>Horario disponible: cancha libre y ambas parejas pueden jugar en este horario.</span>
            </p>
          ) : null}

          {check.conflicts.map((conflict) => (
            <p
              key={conflict}
              className="flex items-start gap-2 rounded-xl bg-red-500/10 border border-red-500/30 p-3 text-xs sm:text-sm text-red-900 dark:text-red-200 font-medium"
              role="alert"
            >
              <CircleAlert className="mt-0.5 size-4 shrink-0 text-red-600 dark:text-red-400" aria-hidden="true" />
              <span>{conflict}</span>
            </p>
          ))}

          {check.warnings.map((warning) => (
            <p
              key={warning}
              className="flex items-start gap-2 rounded-xl bg-amber-500/15 border border-amber-500/30 p-3 text-xs sm:text-sm text-amber-950 dark:text-amber-100 font-medium"
            >
              <TriangleAlert className="mt-0.5 size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
              <span>{warning}</span>
            </p>
          ))}
        </div>

        <DialogFooter className="flex-col-reverse sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => onOpenChange(false)}
            disabled={isPending}
            className="w-full sm:w-auto h-11 sm:h-9"
          >
            Cancelar
          </Button>
          {match.slotId ? (
            <Button
              type="button"
              variant="ghost"
              onClick={() => run(null)}
              disabled={isPending}
              className="w-full sm:w-auto h-11 sm:h-9 text-muted-foreground hover:text-destructive"
            >
              Quitar horario
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => run(slotId)}
            disabled={!slot || check.conflicts.length > 0 || isPending}
            className="w-full sm:w-auto h-11 sm:h-9 font-semibold"
          >
            {isPending ? <Spinner /> : null}
            Guardar horario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
