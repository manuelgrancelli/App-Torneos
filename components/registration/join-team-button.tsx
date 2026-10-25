"use client";

import { UserPlus } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { joinTeamByInviteCode } from "@/app/(app)/inscripciones/[teamId]/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type JoinTeamButtonProps = {
  inviteCode: string;
  teamName: string;
};

export function JoinTeamButton({ inviteCode, teamName }: JoinTeamButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleJoin() {
    startTransition(async () => {
      const result = await joinTeamByInviteCode({ inviteCode });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? `¡Te uniste a ${teamName}!`);
      router.push(`/inscripciones/${result.data.teamId}`);
    });
  }

  return (
    <Button
      type="button"
      size="lg"
      disabled={isPending}
      onClick={handleJoin}
      className="w-full sm:w-auto h-10 text-sm font-semibold bg-emerald-600 hover:bg-emerald-700 text-white shadow-xs gap-2"
    >
      {isPending ? <Spinner className="size-4" /> : <UserPlus className="size-4" aria-hidden="true" />}
      <span>Unirme al equipo</span>
    </Button>
  );
}
