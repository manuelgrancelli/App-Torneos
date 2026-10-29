"use client";

import { CalendarClock, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { autoSchedule } from "@/app/(app)/torneos/[id]/partidos/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type AutoScheduleBracketButtonProps = {
  tournamentId: string;
  categoryId?: string;
  hasUnscheduledMatches: boolean;
};

export function AutoScheduleBracketButton({
  tournamentId,
  categoryId,
  hasUnscheduledMatches,
}: AutoScheduleBracketButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const handleAutoSchedule = () => {
    startTransition(async () => {
      const result = await autoSchedule({
        tournamentId,
        categoryId,
        mode: hasUnscheduledMatches ? "unscheduled" : "all",
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      const assigned = result.data?.assigned ?? 0;
      const unscheduled = result.data?.unscheduled.length ?? 0;

      if (assigned > 0) {
        toast.success(
          unscheduled === 0
            ? `¡Listo! Se programaron ${assigned} ${assigned === 1 ? "partido" : "partidos"} del cuadro en las franjas horarias.`
            : `Se programaron ${assigned} partidos. ${unscheduled} quedaron sin turno por falta de franjas disponibles.`,
        );
      } else if (unscheduled > 0) {
        toast.info("No se encontraron franjas de playoff libres para asignar.");
      } else {
        toast.info("Todos los cruces ya tienen su horario asignado.");
      }

      router.refresh();
    });
  };

  return (
    <Button
      type="button"
      variant="outline"
      size="sm"
      disabled={isPending}
      onClick={handleAutoSchedule}
      className="text-xs h-9 font-medium border-violet-500/40 hover:bg-violet-500/10 text-violet-700 dark:text-violet-300 transition-all cursor-pointer"
      title="Programar horarios automáticamente en las franjas de playoff"
    >
      {isPending ? <Spinner className="size-3.5 mr-1.5" /> : <Sparkles className="size-3.5 mr-1.5 text-violet-500" />}
      <span>
        {isPending
          ? "Programando cruces del cuadro…"
          : hasUnscheduledMatches
            ? "Auto-programar cuadro"
            : "Reprogramar cuadro"}
      </span>
    </Button>
  );
}

