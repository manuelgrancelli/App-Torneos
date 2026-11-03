"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteTournament } from "@/app/(app)/torneos/[id]/actions";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";

/** Borrado del torneo (D-009, D-195). */
export function DeleteTournamentButton({
  tournamentId,
  tournamentName,
  compact = false,
  redirectUrl = "/torneos",
}: {
  tournamentId: string;
  tournamentName: string;
  compact?: boolean;
  redirectUrl?: string | null;
}) {
  const router = useRouter();

  async function remove() {
    const result = await deleteTournament({ tournamentId });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message ?? "Eliminamos el torneo.");
    if (redirectUrl) {
      router.push(redirectUrl);
    } else {
      router.refresh();
    }
  }

  return (
    <ConfirmActionButton
      variant={compact ? "outline" : "ghost"}
      destructive
      className={
        compact
          ? "h-8 px-2.5 text-xs text-destructive hover:bg-destructive/10 border-destructive/30"
          : "text-destructive"
      }
      title={`¿Eliminar "${tournamentName}"?`}
      description={
        <p>
          Se eliminarán permanentemente el torneo, sus equipos, partidos, grupos y configuraciones.
          Esta acción no se puede deshacer.
        </p>
      }
      confirmLabel="Eliminar torneo"
      onConfirm={remove}
    >
      <Trash2 className="size-3.5" aria-hidden="true" />
      <span>{compact ? "Eliminar" : "Eliminar torneo"}</span>
    </ConfirmActionButton>
  );
}
