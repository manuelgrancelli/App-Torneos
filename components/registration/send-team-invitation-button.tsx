"use client";

import { Mail } from "lucide-react";
import { useTransition } from "react";
import { toast } from "sonner";
import { sendTeamInvitation } from "@/app/(app)/inscripciones/[teamId]/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

export function SendTeamInvitationButton({ teamId, memberId }: { teamId: string; memberId: string }) {
  const [isPending, startTransition] = useTransition();

  function send() {
    startTransition(async () => {
      const result = await sendTeamInvitation({ teamId, memberId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Enviamos la invitación.");
    });
  }

  return (
    <Button type="button" size="sm" variant="outline" disabled={isPending} onClick={send}>
      {isPending ? <Spinner /> : <Mail aria-hidden="true" />}
      Enviar / reenviar invitación
    </Button>
  );
}
