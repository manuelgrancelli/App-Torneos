"use client";

import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { CheckCircle2 } from "lucide-react";
import { toast } from "sonner";
import { acceptTeamInvitation } from "@/app/invitacion/aceptar/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

interface AcceptTeamInvitationButtonProps {
  token: string;
  className?: string;
  size?: "default" | "sm" | "lg";
}

export function AcceptTeamInvitationButton({
  token,
  className = "w-full",
  size = "lg",
}: AcceptTeamInvitationButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function accept() {
    startTransition(async () => {
      const result = await acceptTeamInvitation({ token });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Aceptaste la invitación.");
      router.replace(`/inscripciones/${result.data.teamId}`);
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      size={size}
      className={className}
      disabled={isPending}
      onClick={accept}
    >
      {isPending ? <Spinner /> : <CheckCircle2 className="size-4 shrink-0" aria-hidden="true" />}
      {isPending ? "Aceptando..." : "Aceptar invitación y unirme al equipo"}
    </Button>
  );
}
