"use client";

import { Loader2, Trophy } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { changeTournamentStatus } from "@/app/(app)/torneos/[id]/actions";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
  AlertDialogTrigger,
} from "@/components/ui/alert-dialog";
import { cn } from "@/lib/utils";

export type FinalizeTournamentStepButtonProps = {
  tournamentId: string;
  tournamentName?: string;
  stepNumber?: number;
  className?: string;
};

/**
 * Botón interactivo verde que aparece en el paso 5 (Final) del stepper
 * cuando todas las categorías y cruces eliminatorios del torneo están finalizados.
 */
export function FinalizeTournamentStepButton({
  tournamentId,
  tournamentName,
  stepNumber = 5,
  className,
}: FinalizeTournamentStepButtonProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  function handleFinalize() {
    startTransition(async () => {
      const res = await changeTournamentStatus({
        tournamentId,
        status: "finished",
      });

      if (!res.ok) {
        toast.error(res.error || "No se pudo finalizar el torneo.");
        return;
      }

      toast.success("¡Torneo finalizado con éxito! Los campeones y resultados han sido archivados.");
      setOpen(false);
      router.refresh();
    });
  }

  return (
    <AlertDialog open={open} onOpenChange={setOpen}>
      <AlertDialogTrigger asChild>
        <button
          type="button"
          title="Finalizar torneo"
          aria-label="Finalizar torneo"
          className={cn(
            "group inline-flex items-center gap-1.5 px-3 py-1 rounded-full",
            "bg-emerald-600 hover:bg-emerald-500 active:bg-emerald-700",
            "text-white text-xs sm:text-sm font-semibold",
            "shadow-md shadow-emerald-600/30 ring-2 ring-emerald-500/40",
            "transition-all duration-150 transform hover:scale-105 active:scale-95 cursor-pointer animate-pulse hover:animate-none",
            className,
          )}
        >
          <span
            aria-hidden="true"
            className="grid size-5 shrink-0 place-items-center rounded-full bg-emerald-700/80 text-[11px] font-bold text-white shadow-inner"
          >
            {stepNumber}
          </span>
          <span className="hidden sm:inline whitespace-nowrap">Finalizar torneo</span>
          <span className="sm:hidden whitespace-nowrap">Finalizar</span>
          <Trophy className="size-3.5 shrink-0 text-amber-200 group-hover:rotate-12 transition-transform" aria-hidden="true" />
        </button>
      </AlertDialogTrigger>
      <AlertDialogContent>
        <AlertDialogHeader>
          <AlertDialogTitle className="flex items-center gap-2">
            <Trophy className="size-5 text-amber-500" />
            ¿Finalizar el torneo {tournamentName ? `"${tournamentName}"` : ""}?
          </AlertDialogTitle>
          <AlertDialogDescription className="space-y-2 text-left">
            <span>
              Todas las categorías han completado sus partidos y cuentan con campeones definidos.
            </span>
            <span className="block text-xs text-muted-foreground">
              Al finalizar, el torneo quedará en estado oficial <strong>Finalizado</strong>, sus resultados y cruces quedarán archivados y se consolidarán los títulos y puntos en el ranking general.
            </span>
          </AlertDialogDescription>
        </AlertDialogHeader>
        <AlertDialogFooter>
          <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
          <AlertDialogAction
            onClick={(e) => {
              e.preventDefault();
              handleFinalize();
            }}
            disabled={isPending}
            className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
          >
            {isPending ? (
              <>
                <Loader2 className="size-4 animate-spin mr-2" />
                Finalizando...
              </>
            ) : (
              <>
                <Trophy className="size-4 mr-2" />
                Finalizar torneo
              </>
            )}
          </AlertDialogAction>
        </AlertDialogFooter>
      </AlertDialogContent>
    </AlertDialog>
  );
}
