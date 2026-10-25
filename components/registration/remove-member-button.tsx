"use client";

import { Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { removeTeamMember } from "@/app/(app)/inscripciones/[teamId]/actions";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { Spinner } from "@/components/ui/spinner";

type RemoveMemberButtonProps = {
  teamId: string;
  memberId: string;
  memberName: string;
  disabled?: boolean;
};

export function RemoveMemberButton({ teamId, memberId, memberName, disabled }: RemoveMemberButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleRemove() {
    startTransition(async () => {
      const result = await removeTeamMember({ teamId, memberId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success("Integrante removido del equipo.");
      router.refresh();
    });
  }

  return (
    <ConfirmActionButton
      variant="ghost"
      size="sm"
      destructive
      disabled={disabled || isPending}
      title="¿Remover del equipo?"
      description={`¿Estás seguro de que querés remover a ${memberName} del equipo?`}
      confirmLabel="Remover"
      className="size-7 p-0 text-muted-foreground hover:text-destructive shrink-0"
      onConfirm={handleRemove}
    >
      {isPending ? <Spinner className="size-3.5" /> : <Trash2 className="size-3.5" aria-hidden="true" />}
      <span className="sr-only">Remover a {memberName}</span>
    </ConfirmActionButton>
  );
}
