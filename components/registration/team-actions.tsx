"use client";

import { LogOut, Pencil, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { toast } from "sonner";
import { leaveTeam, withdrawTeam } from "@/app/(app)/inscripciones/[teamId]/actions";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { Button } from "@/components/ui/button";
import { Dialog, DialogContent, DialogDescription, DialogHeader, DialogTitle, DialogTrigger } from "@/components/ui/dialog";
import { TeamForm } from "./team-form";

type TeamActionsProps = {
  teamId: string;
  teamName: string;
  teamSize: number;
  isCaptain: boolean;
  companionEmails: string[];
};

/** Acciones sobre la inscripción mientras está abierta: editar, dar de baja o salirse. */
export function TeamActions({ teamId, teamName, teamSize, isCaptain, companionEmails }: TeamActionsProps) {
  const router = useRouter();
  const [editing, setEditing] = useState(false);

  async function withdraw() {
    const result = await withdrawTeam({ teamId });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message ?? "Diste de baja la inscripción.");
    router.push("/torneos");
  }

  async function leave() {
    const result = await leaveTeam({ teamId });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message ?? "Saliste del equipo.");
    router.push("/torneos");
  }

  if (!isCaptain) {
    return (
      <ConfirmActionButton
        variant="outline"
        destructive
        title="¿Salir del equipo?"
        description={
          <p>
            Dejás de figurar en &quot;{teamName}&quot; y la inscripción vuelve a quedar pendiente hasta que el capitán
            sume a alguien.
          </p>
        }
        confirmLabel="Salir del equipo"
        onConfirm={leave}
      >
        <LogOut aria-hidden="true" />
        Salir del equipo
      </ConfirmActionButton>
    );
  }

  return (
    <div className="flex flex-col gap-2 sm:flex-row">
      <Dialog open={editing} onOpenChange={setEditing}>
        <DialogTrigger asChild>
          <Button variant="outline">
            <Pencil aria-hidden="true" />
            Editar equipo
          </Button>
        </DialogTrigger>
        <DialogContent className="max-h-[90dvh] overflow-y-auto">
          <DialogHeader>
            <DialogTitle>Editar equipo</DialogTitle>
            <DialogDescription>Si cambiás integrantes, la inscripción vuelve a quedar pendiente de aprobación.</DialogDescription>
          </DialogHeader>
          <TeamForm
            mode="edit"
            teamId={teamId}
            teamSize={teamSize}
            defaultName={teamName}
            defaultEmails={companionEmails}
            onSaved={() => setEditing(false)}
          />
        </DialogContent>
      </Dialog>
      <ConfirmActionButton
        variant="ghost"
        destructive
        className="text-destructive"
        title="¿Dar de baja la inscripción?"
        description={<p>Se borra el equipo y sus integrantes quedan libres para anotarse en otro.</p>}
        confirmLabel="Dar de baja"
        onConfirm={withdraw}
      >
        <Trash2 aria-hidden="true" />
        Dar de baja
      </ConfirmActionButton>
    </div>
  );
}
