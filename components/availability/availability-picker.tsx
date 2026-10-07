"use client";

import { Check, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAvailability } from "@/app/(app)/inscripciones/[teamId]/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDayHeading, formatTimeRange, localDateKey } from "@/lib/dates";
import {
  type AvailabilityWindow,
  groupSlotsIntoDayWindows,
  selectionChanged,
} from "@/lib/domain/availability";
import { cn } from "@/lib/utils";

type PickerSlot = { id: string; startsAt: string; endsAt: string; courtId: string | null };

type AvailabilityPickerProps = {
  teamId: string;
  timezone: string;
  slots: PickerSlot[];
  courts: { id: string; name: string }[];
  selected: string[];
  /** Fuera de la inscripción la disponibilidad queda congelada. */
  readOnly: boolean;
};

/**
 * Selector de franjas disponibles.
 * Muestra las franjas completas (ej. de 9 a 15) en lugar de intervalos específicos de 1 hora.
 * Marcar una franja habilita la disponibilidad en todo ese intervalo para programar partidos.
 */
export function AvailabilityPicker({ teamId, timezone, slots, courts, selected, readOnly }: AvailabilityPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const saved = useMemo(() => new Set(selected), [selected]);
  const [current, setCurrent] = useState<Set<string>>(() => new Set(selected));
  const dirty = selectionChanged(saved, current);

  // Agrupa turnos continuos en franjas completas por día
  const dayWindows = useMemo(
    () => groupSlotsIntoDayWindows(slots, (s) => localDateKey(s.startsAt, timezone)),
    [slots, timezone],
  );
  const allWindows = useMemo(() => dayWindows.flatMap((d) => d.windows), [dayWindows]);

  // Aviso del navegador si se va con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function isWindowSelected(window: AvailabilityWindow<PickerSlot>): boolean {
    return window.slotIds.length > 0 && window.slotIds.every((id) => current.has(id));
  }

  function toggleWindow(window: AvailabilityWindow<PickerSlot>) {
    setCurrent((prev) => {
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

  function toggleDay(windows: AvailabilityWindow<PickerSlot>[]) {
    setCurrent((prev) => {
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

  function save() {
    startTransition(async () => {
      const result = await saveAvailability({ teamId, slotIds: [...current] });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Guardamos tu disponibilidad.");
      router.refresh();
    });
  }

  if (slots.length === 0) {
    return <p className="text-sm text-muted-foreground">El organizador todavía no cargó franjas horarias.</p>;
  }

  const selectedWindowsCount = allWindows.filter((w) => isWindowSelected(w)).length;

  return (
    <div className="space-y-4">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {dayWindows.map(({ day, windows }) => {
          const allSelected = windows.length > 0 && windows.every((w) => isWindowSelected(w));
          return (
            <section key={day} aria-labelledby={`avail-${day}`} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 id={`avail-${day}`} className="text-sm font-semibold first-letter:uppercase">
                  {formatDayHeading(day)}
                </h3>
                {!readOnly && windows.length > 1 ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => toggleDay(windows)}>
                    {allSelected ? "Ninguna" : "Todo el día"}
                  </Button>
                ) : null}
              </div>
              <ul className="grid grid-cols-1 gap-2">
                {windows.map((window, index) => {
                  const active = isWindowSelected(window);
                  const time = formatTimeRange(window.startsAt, window.endsAt, timezone);
                  const label = windows.length > 1 ? `Franja ${index + 1}` : "Franja completa";
                  const slotsCount = window.slots.length;
                  return (
                    <li key={window.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={active}
                        disabled={readOnly}
                        onClick={() => toggleWindow(window)}
                        className={cn(
                          "flex min-h-14 w-full flex-col items-start justify-center rounded-lg border px-3 py-2.5 text-left text-sm transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
                          active ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
                        )}
                      >
                        <span className="flex items-center gap-1.5 font-medium tabular-nums">
                          {active ? <Check className="size-4 shrink-0" aria-hidden="true" /> : null}
                          <span className="text-base">{time}</span>
                        </span>
                        <span className={cn("text-xs font-normal", active ? "text-background/80" : "text-muted-foreground")}>
                          {label} {slotsCount > 1 ? `· ${slotsCount} turnos posibles` : ""}
                        </span>
                      </button>
                    </li>
                  );
                })}
              </ul>
            </section>
          );
        })}
      </div>

      {!readOnly ? (
        <div className="sticky bottom-20 z-10 flex items-center justify-between gap-3 rounded-xl border bg-background/95 p-3 shadow-sm backdrop-blur md:bottom-4">
          <p className="text-sm" aria-live="polite">
            {selectedWindowsCount === 1 ? "1 franja elegida" : `${selectedWindowsCount} franjas elegidas`}
            {dirty ? <span className="text-muted-foreground"> · sin guardar</span> : null}
          </p>
          <Button type="button" onClick={save} disabled={!dirty || isPending}>
            {isPending ? <Spinner /> : <Save aria-hidden="true" />}
            Guardar
          </Button>
        </div>
      ) : null}
    </div>
  );
}
