"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { deleteTournament } from "@/app/(app)/torneos/[id]/actions";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";

/** Borrado del torneo (solo antes de empezar, D-009). */
export function DeleteTournamentButton({ tournamentId, tournamentName }: { tournamentId: string; tournamentName: string }) {
  const router = useRouter();

  async function remove() {
    const result = await deleteTournament({ tournamentId });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message ?? "Eliminamos el torneo.");
    router.push("/torneos");
  }

  return (
    <ConfirmActionButton
      variant="ghost"
      destructive
      className="text-destructive"
      title={`¿Eliminar "${tournamentName}"?`}
      description={
        <p>Se borran el torneo, sus canchas, franjas e inscripciones. Esta acción no se puede deshacer.</p>
      }
      confirmLabel="Eliminar torneo"
      onConfirm={remove}
    >
      <Trash2 aria-hidden="true" />
      Eliminar torneo
    </ConfirmActionButton>
  );
}
