"use client";

import { Check, Save } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { saveAvailability } from "@/app/(app)/inscripciones/[teamId]/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { formatDayHeading, formatTimeRange, localDateKey } from "@/lib/dates";
import { groupSlotsByDay, selectionChanged } from "@/lib/domain/availability";
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
 * Selector de franjas disponibles. Mobile: chips grandes por día y barra fija
 * de guardado. Desktop: los días se acomodan en columnas.
 */
export function AvailabilityPicker({ teamId, timezone, slots, courts, selected, readOnly }: AvailabilityPickerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const saved = useMemo(() => new Set(selected), [selected]);
  const [current, setCurrent] = useState<Set<string>>(() => new Set(selected));
  const dirty = selectionChanged(saved, current);
  const courtName = new Map(courts.map((c) => [c.id, c.name]));
  const days = useMemo(() => groupSlotsByDay(slots, (s) => localDateKey(s.startsAt, timezone)), [slots, timezone]);

  // Aviso del navegador si se va con cambios sin guardar.
  useEffect(() => {
    if (!dirty) return;
    const handler = (event: BeforeUnloadEvent) => event.preventDefault();
    window.addEventListener("beforeunload", handler);
    return () => window.removeEventListener("beforeunload", handler);
  }, [dirty]);

  function toggle(slotId: string) {
    setCurrent((prev) => {
      const next = new Set(prev);
      if (next.has(slotId)) next.delete(slotId);
      else next.add(slotId);
      return next;
    });
  }

  function toggleDay(daySlots: PickerSlot[]) {
    setCurrent((prev) => {
      const next = new Set(prev);
      const allSelected = daySlots.every((s) => next.has(s.id));
      for (const slot of daySlots) {
        if (allSelected) next.delete(slot.id);
        else next.add(slot.id);
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

  return (
    <div className="space-y-4">
      <div className="grid gap-5 md:grid-cols-2 xl:grid-cols-3">
        {days.map(({ day, slots: daySlots }) => {
          const allSelected = daySlots.every((s) => current.has(s.id));
          return (
            <section key={day} aria-labelledby={`avail-${day}`} className="space-y-2">
              <div className="flex items-center justify-between gap-2">
                <h3 id={`avail-${day}`} className="text-sm font-semibold first-letter:uppercase">
                  {formatDayHeading(day)}
                </h3>
                {!readOnly ? (
                  <Button type="button" variant="ghost" size="sm" onClick={() => toggleDay(daySlots)}>
                    {allSelected ? "Ninguna" : "Todo el día"}
                  </Button>
                ) : null}
              </div>
              <ul className="grid grid-cols-2 gap-2">
                {daySlots.map((slot) => {
                  const active = current.has(slot.id);
                  const time = formatTimeRange(slot.startsAt, slot.endsAt, timezone);
                  return (
                    <li key={slot.id}>
                      <button
                        type="button"
                        role="checkbox"
                        aria-checked={active}
                        disabled={readOnly}
                        onClick={() => toggle(slot.id)}
                        className={cn(
                          "flex min-h-12 w-full flex-col items-start justify-center rounded-lg border px-3 py-2 text-left text-sm transition-colors",
                          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring disabled:cursor-not-allowed",
                          active ? "border-foreground bg-foreground text-background" : "bg-background hover:bg-muted",
                        )}
                      >
                        <span className="flex items-center gap-1 font-medium tabular-nums">
                          {active ? <Check className="size-4" aria-hidden="true" /> : null}
                          {time}
                        </span>
                        {slot.courtId ? (
                          <span className={cn("text-xs", active ? "text-background/80" : "text-muted-foreground")}>
                            {courtName.get(slot.courtId) ?? "Cancha"}
                          </span>
                        ) : null}
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
            {current.size === 1 ? "1 franja elegida" : `${current.size} franjas elegidas`}
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
