"use client";

import { CircleAlert, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { assignSlot } from "@/app/(app)/torneos/[id]/partidos/actions";
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
import { NativeSelect, NativeSelectOptGroup, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { formatDayHeading, formatTimeRange, localDateKey } from "@/lib/dates";
import { groupSlotsByDay } from "@/lib/domain/availability";
import { type FixedAssignment, checkManualAssignment } from "@/lib/domain/scheduler";

type AssignSlotDialogProps = {
  open: boolean;
  onOpenChange: (open: boolean) => void;
  tournamentId: string;
  timezone: string;
  match: { id: string; homeTeamId: string | null; awayTeamId: string | null; slotId: string | null; courtId: string | null };
  title: string;
  slots: { id: string; startsAt: string; endsAt: string; courtId: string | null }[];
  courts: { id: string; name: string }[];
  /** Partidos ya programados (para detectar choques). */
  scheduled: FixedAssignment[];
  availability: Record<string, string[]>;
};

/**
 * Asignación manual de horario: bloquea choques de cancha o de equipo y
 * advierte si algún equipo no marcó disponibilidad (D-026).
 */
export function AssignSlotDialog(props: AssignSlotDialogProps) {
  const { open, onOpenChange, match, slots, courts, timezone } = props;
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [slotId, setSlotId] = useState(match.slotId ?? "");
  const [courtId, setCourtId] = useState(match.courtId ?? courts[0]?.id ?? "");
  const courtName = new Map(courts.map((c) => [c.id, c.name]));
  const slot = slots.find((s) => s.id === slotId);
  const effectiveCourt = slot?.courtId ?? courtId;
  const days = useMemo(() => groupSlotsByDay(slots, (s) => localDateKey(s.startsAt, timezone)), [slots, timezone]);

  const check = slot
    ? checkManualAssignment({
        match,
        slot: { id: slot.id, start: Date.parse(slot.startsAt), end: Date.parse(slot.endsAt), courtId: slot.courtId },
        courtId: effectiveCourt,
        others: props.scheduled,
        availability: props.availability,
      })
    : { conflicts: [], warnings: [] };

  function run(nextSlot: string | null) {
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
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Horario del partido</DialogTitle>
          <DialogDescription>{props.title}</DialogDescription>
        </DialogHeader>
        <div className="space-y-4">
          <Field>
            <FieldLabel htmlFor="assign-slot">Franja</FieldLabel>
            <NativeSelect id="assign-slot" className="w-full" value={slotId} onChange={(e) => setSlotId(e.target.value)}>
              <NativeSelectOption value="">Elegí una franja…</NativeSelectOption>
              {days.map(({ day, slots: daySlots }) => (
                <NativeSelectOptGroup key={day} label={formatDayHeading(day)}>
                  {daySlots.map((s) => (
                    <NativeSelectOption key={s.id} value={s.id}>
                      {formatTimeRange(s.startsAt, s.endsAt, timezone)}
                      {s.courtId ? ` · ${courtName.get(s.courtId) ?? "cancha"}` : ""}
                    </NativeSelectOption>
                  ))}
                </NativeSelectOptGroup>
              ))}
            </NativeSelect>
          </Field>
          {slot && !slot.courtId ? (
            <Field>
              <FieldLabel htmlFor="assign-court">Cancha</FieldLabel>
              <NativeSelect id="assign-court" className="w-full" value={courtId} onChange={(e) => setCourtId(e.target.value)}>
                {courts.map((c) => (
                  <NativeSelectOption key={c.id} value={c.id}>
                    {c.name}
                  </NativeSelectOption>
                ))}
              </NativeSelect>
            </Field>
          ) : null}
          {check.conflicts.map((conflict) => (
            <p key={conflict} className="flex items-start gap-2 rounded-lg bg-red-50 px-3 py-2 text-sm text-red-900" role="alert">
              <CircleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {conflict}
            </p>
          ))}
          {check.warnings.map((warning) => (
            <p key={warning} className="flex items-start gap-2 rounded-lg bg-amber-50 px-3 py-2 text-sm text-amber-900">
              <TriangleAlert className="mt-0.5 size-4 shrink-0" aria-hidden="true" />
              {warning}
            </p>
          ))}
        </div>
        <DialogFooter className="gap-2">
          {match.slotId ? (
            <Button type="button" variant="ghost" onClick={() => run(null)} disabled={isPending}>
              Quitar horario
            </Button>
          ) : null}
          <Button
            type="button"
            onClick={() => run(slotId)}
            disabled={!slot || check.conflicts.length > 0 || isPending}
          >
            {isPending ? <Spinner /> : null}
            Guardar horario
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
