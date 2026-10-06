"use client";

import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { linkTournamentToCircuit } from "@/app/(app)/circuitos/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";

type LinkTournamentDialogProps = {
  circuitId: string;
  nextOrder: number;
  availableTournaments: { id: string; name: string; startsOn: string }[];
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function LinkTournamentDialog({
  circuitId,
  nextOrder,
  availableTournaments,
  open,
  onOpenChange,
}: LinkTournamentDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [selectedTournamentId, setSelectedTournamentId] = useState(
    availableTournaments[0]?.id ?? "",
  );
  const [order, setOrder] = useState(nextOrder);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!selectedTournamentId) {
      toast.error("Seleccioná un torneo.");
      return;
    }

    startTransition(async () => {
      const result = await linkTournamentToCircuit({
        circuitId,
        tournamentId: selectedTournamentId,
        circuitOrder: Number(order) || 1,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? "Fecha vinculada.");
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent>
        <DialogHeader>
          <DialogTitle>Vincular torneo como fecha</DialogTitle>
          <DialogDescription>
            Seleccioná un torneo existente de tu cuenta para sumarlo como fecha de este circuito.
          </DialogDescription>
        </DialogHeader>

        {availableTournaments.length === 0 ? (
          <p className="py-4 text-sm text-muted-foreground">
            No tenés torneos del mismo deporte disponibles para vincular. Creá uno nuevo desde la sección Torneos.
          </p>
        ) : (
          <form onSubmit={handleSubmit} className="space-y-4">
            <Field>
              <FieldLabel htmlFor="select-tournament">Torneo a vincular</FieldLabel>
              <select
                id="select-tournament"
                value={selectedTournamentId}
                onChange={(e) => setSelectedTournamentId(e.target.value)}
                className="flex h-10 w-full rounded-md border border-input bg-background px-3 py-2 text-sm ring-offset-background file:border-0 file:bg-transparent file:text-sm file:font-medium placeholder:text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring focus-visible:ring-offset-2 disabled:cursor-not-allowed disabled:opacity-50"
              >
                {availableTournaments.map((t) => (
                  <option key={t.id} value={t.id}>
                    {t.name} ({t.startsOn})
                  </option>
                ))}
              </select>
            </Field>

            <Field>
              <FieldLabel htmlFor="circuit-order">Número de fecha</FieldLabel>
              <Input
                id="circuit-order"
                type="number"
                min={1}
                max={100}
                value={order}
                onChange={(e) => setOrder(Number(e.target.value))}
                required
              />
            </Field>

            <DialogFooter>
              <Button type="button" variant="outline" onClick={() => onOpenChange(false)}>
                Cancelar
              </Button>
              <Button type="submit" disabled={isPending}>
                {isPending ? <Spinner /> : null}
                Vincular fecha
              </Button>
            </DialogFooter>
          </form>
        )}
      </DialogContent>
    </Dialog>
  );
}
