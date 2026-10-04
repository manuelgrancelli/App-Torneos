"use client";

import { CalendarCog } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { autoSchedule } from "@/app/(app)/torneos/[id]/partidos/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { type UnscheduledReason, UNSCHEDULED_REASON_LABELS } from "@/lib/domain/scheduler";
import { cn } from "@/lib/utils";

type Mode = "unscheduled" | "all";

const MODES: { value: Mode; title: string; description: string }[] = [
  {
    value: "unscheduled",
    title: "Solo los que no tienen horario",
    description: "No toca los partidos que ya están programados.",
  },
  {
    value: "all",
    title: "Rehacer toda la programación",
    description: "Reprograma todo lo no jugado, salvo los horarios que fijaste a mano.",
  },
];

/** Programación automática con resumen de los partidos que quedaron sin horario y por qué. */
export function AutoScheduleDialog({
  tournamentId,
  matchLabels,
}: {
  tournamentId: string;
  /** matchId → "Equipo A vs Equipo B" para el resumen. */
  matchLabels: Record<string, string>;
}) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [mode, setMode] = useState<Mode>("unscheduled");
  const [isPending, startTransition] = useTransition();
  const [summary, setSummary] = useState<{ matchId: string; reason: UnscheduledReason }[] | null>(null);

  function run() {
    startTransition(async () => {
      const result = await autoSchedule({ tournamentId, mode });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Listo.");
      setSummary(result.data.unscheduled);
      router.refresh();
      if (result.data.unscheduled.length === 0) setOpen(false);
    });
  }

  return (
    <Dialog
      open={open}
      onOpenChange={(next) => {
        setOpen(next);
        if (!next) setSummary(null);
      }}
    >
      <DialogTrigger asChild>
        <Button>
          <CalendarCog aria-hidden="true" />
          Programar automáticamente
        </Button>
      </DialogTrigger>
      <DialogContent className="max-h-[90dvh] overflow-y-auto">
        <DialogHeader>
          <DialogTitle>Programar partidos</DialogTitle>
          <DialogDescription>
            Se asignan franjas donde los dos equipos pueden jugar, sin que un equipo o una cancha tengan dos partidos a la
            vez.
          </DialogDescription>
        </DialogHeader>

        {summary ? (
          <div className="space-y-2">
            <p className="text-sm font-medium">
              {summary.length === 1 ? "1 partido quedó sin horario:" : `${summary.length} partidos quedaron sin horario:`}
            </p>
            <ul className="divide-y rounded-lg border text-sm">
              {summary.map((item) => (
                <li key={item.matchId} className="px-3 py-2">
                  <p className="font-medium">{matchLabels[item.matchId] ?? "Partido"}</p>
                  <p className="text-muted-foreground">{UNSCHEDULED_REASON_LABELS[item.reason]}</p>
                </li>
              ))}
            </ul>
            <p className="text-sm text-muted-foreground">
              Asignalos a mano desde cada partido, o sumá franjas y volvé a programar.
            </p>
          </div>
        ) : (
          <fieldset className="space-y-2">
            <legend className="sr-only">Qué programar</legend>
            {MODES.map((option) => (
              <label
                key={option.value}
                className={cn(
                  "flex cursor-pointer gap-3 rounded-lg border p-3",
                  mode === option.value && "border-foreground bg-muted/50",
                )}
              >
                <input
                  type="radio"
                  name="schedule-mode"
                  value={option.value}
                  checked={mode === option.value}
                  onChange={() => setMode(option.value)}
                  className="mt-1"
                />
                <span>
                  <span className="block text-sm font-medium">{option.title}</span>
                  <span className="block text-sm text-muted-foreground">{option.description}</span>
                </span>
              </label>
            ))}
          </fieldset>
        )}

        <DialogFooter>
          {summary ? (
            <Button type="button" onClick={() => setOpen(false)}>
              Entendido
            </Button>
          ) : (
            <Button type="button" onClick={run} disabled={isPending}>
              {isPending ? <Spinner /> : null}
              Programar
            </Button>
          )}
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
