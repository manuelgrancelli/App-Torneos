"use client";

import { Wand2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { simulateTournamentResults } from "@/app/(app)/torneos/[id]/partidos/actions";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";

type SimulateResultsButtonProps = {
  tournamentId: string;
  label?: string;
  variant?: "default" | "secondary" | "outline";
  size?: "default" | "sm" | "lg";
};

export function SimulateResultsButton({
  tournamentId,
  label = "Simular resultados",
  variant = "secondary",
  size = "sm",
}: SimulateResultsButtonProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleSimulate() {
    startTransition(async () => {
      const result = await simulateTournamentResults({ tournamentId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Resultados simulados.");
      router.refresh();
    });
  }

  return (
    <Button
      type="button"
      variant={variant}
      size={size}
      onClick={handleSimulate}
      disabled={isPending}
      className="gap-1.5"
    >
      {isPending ? <Spinner /> : <Wand2 className="size-4" aria-hidden="true" />}
      {label}
    </Button>
  );
}
