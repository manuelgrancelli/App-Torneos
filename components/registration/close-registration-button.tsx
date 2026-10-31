"use client";

import { useTransition } from "react";
import { useRouter } from "next/navigation";
import { Play } from "lucide-react";
import { toast } from "sonner";
import { changeTournamentStatus } from "@/app/(app)/torneos/[id]/actions";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { Spinner } from "@/components/ui/spinner";
import { cn } from "@/lib/utils";

import { isFootballSport } from "@/lib/domain/roster-parser";

export type CloseRegistrationButtonProps = {
  tournamentId: string;
  approvedCount: number;
  sportId?: string;
  className?: string;
  size?: "default" | "sm" | "lg";
};

export function CloseRegistrationButton({
  tournamentId,
  approvedCount,
  sportId,
  className,
  size = "default",
}: CloseRegistrationButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const isFootball = isFootballSport(sportId);
  const nounApproved = isFootball ? "equipos aprobados" : "parejas aprobadas";
  const canStart = approvedCount >= 2;
  const disabledReason = !canStart
    ? `Necesitás al menos 2 ${nounApproved} para empezar la fase de grupos (actualmente hay ${approvedCount}).`
    : undefined;

  async function handleCloseAndStart() {
    if (!canStart) {
      toast.error(disabledReason);
      return false;
    }

    const res = await changeTournamentStatus({
      tournamentId,
      status: "group_stage",
    });

    if (!res.ok) {
      toast.error(res.error);
      return false;
    }

    toast.success("¡Inscripciones cerradas con éxito! Comenzó la fase de grupos.");
    router.push(`/torneos/${tournamentId}/grupos`);
    router.refresh();
    return true;
  }

  return (
    <div className="flex flex-col items-start sm:items-end gap-1">
      <ConfirmActionButton
        title="¿Cerrar inscripciones?"
        confirmLabel="Confirmar"
        confirmClassName="!bg-emerald-600 hover:!bg-emerald-500 !text-white font-semibold shadow-xs px-4"
        disabled={!canStart || isPending}
        onConfirm={handleCloseAndStart}
        className={cn(
          "font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs hover:shadow-md hover:shadow-emerald-600/25 active:scale-[0.98] transition-all duration-150 cursor-pointer disabled:opacity-50 disabled:cursor-not-allowed",
          size === "sm" ? "h-9 px-3.5 text-xs" : "h-10 px-4 text-sm",
          className,
        )}
      >
        {isPending ? (
          <Spinner className="size-4 mr-1.5" />
        ) : (
          <Play className="size-3.5 mr-1.5 fill-current" aria-hidden="true" />
        )}
        <span>Cerrar inscripciones y empezar fase de grupos</span>
      </ConfirmActionButton>
      {disabledReason ? (
        <p className="text-xs text-muted-foreground">{disabledReason}</p>
      ) : null}
    </div>
  );
}
