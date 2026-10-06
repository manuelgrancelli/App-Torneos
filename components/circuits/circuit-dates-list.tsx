"use client";

import { Calendar, ChevronRight, Plus, Trash2, Trophy, Unlink } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { unlinkTournamentFromCircuit } from "@/app/(app)/circuitos/actions";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/tournaments/status-badge";
import {
  AlertDialog,
  AlertDialogAction,
  AlertDialogCancel,
  AlertDialogContent,
  AlertDialogDescription,
  AlertDialogFooter,
  AlertDialogHeader,
  AlertDialogTitle,
} from "@/components/ui/alert-dialog";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { CircuitDateItem } from "@/lib/data/circuits";
import { formatDateRange } from "@/lib/dates";

type CircuitDatesListProps = {
  circuitId: string;
  dates: CircuitDateItem[];
  onOpenLinkDialog: () => void;
};

export function CircuitDatesList({ circuitId, dates, onOpenLinkDialog }: CircuitDatesListProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [unlinkTournamentId, setUnlinkTournamentId] = useState<string | null>(null);

  function handleUnlink() {
    if (!unlinkTournamentId) return;
    startTransition(async () => {
      const result = await unlinkTournamentFromCircuit({
        circuitId,
        tournamentId: unlinkTournamentId,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Fecha desvinculada.");
      setUnlinkTournamentId(null);
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      <div className="flex flex-wrap items-center justify-between gap-3">
        <div>
          <h2 className="text-base font-semibold">Fechas del circuito</h2>
          <p className="text-sm text-muted-foreground">
            Cada fecha es un torneo con su propia sede, fixture y llaves eliminatorias.
          </p>
        </div>
        <div className="flex flex-wrap gap-2">
          <Button variant="outline" size="sm" onClick={onOpenLinkDialog}>
            <Unlink className="size-4" aria-hidden="true" />
            Vincular torneo existente
          </Button>
          <Button asChild size="sm">
            <Link href="/torneos/nuevo">
              <Plus className="size-4" aria-hidden="true" />
              Crear nueva fecha
            </Link>
          </Button>
        </div>
      </div>

      {dates.length === 0 ? (
        <EmptyState
          icon={Calendar}
          title="No hay fechas cargadas"
          description="Podés vincular un torneo que ya hayas creado o crear uno nuevo para que forme parte del circuito."
          action={
            <Button onClick={onOpenLinkDialog} variant="outline">
              Vincular torneo existente
            </Button>
          }
        />
      ) : (
        <div className="grid gap-3">
          {dates.map((date) => (
            <Card key={date.id} className="transition-all hover:border-foreground/30">
              <CardContent className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                <div className="space-y-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="font-bold text-sm text-primary">
                      Fecha {date.circuitOrder}
                    </span>
                    <span className="text-muted-foreground">•</span>
                    <h3 className="font-semibold text-base">
                      <Link href={`/torneos/${date.id}`} className="hover:underline">
                        {date.name}
                      </Link>
                    </h3>
                    <StatusBadge status={date.status} />
                  </div>
                  <div className="flex flex-wrap items-center gap-4 text-xs text-muted-foreground">
                    <span className="flex items-center gap-1">
                      <Calendar className="size-3.5" aria-hidden="true" />
                      {formatDateRange(date.startsOn, date.endsOn)}
                    </span>
                    <span>
                      {date.approvedTeams} parejas inscriptas
                    </span>
                    {date.championTeamName ? (
                      <span className="flex items-center gap-1 font-medium text-amber-600">
                        <Trophy className="size-3.5" aria-hidden="true" />
                        Campeón: {date.championTeamName}
                      </span>
                    ) : null}
                  </div>
                </div>

                <div className="flex items-center gap-2">
                  <Button asChild variant="outline" size="sm">
                    <Link href={`/torneos/${date.id}`}>
                      Gestionar fecha
                      <ChevronRight className="size-3.5" aria-hidden="true" />
                    </Link>
                  </Button>
                  <Button
                    variant="ghost"
                    size="sm"
                    className="text-muted-foreground hover:text-destructive"
                    onClick={() => setUnlinkTournamentId(date.id)}
                    aria-label={`Desvincular ${date.name} del circuito`}
                  >
                    <Trash2 className="size-4" aria-hidden="true" />
                  </Button>
                </div>
              </CardContent>
            </Card>
          ))}
        </div>
      )}

      <AlertDialog open={Boolean(unlinkTournamentId)} onOpenChange={(open) => !open && setUnlinkTournamentId(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Desvincular fecha del circuito?</AlertDialogTitle>
            <AlertDialogDescription>
              El torneo seguirá existiendo en tu cuenta normalmente, pero dejará de sumar puntos a este circuito y su ranking general.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel disabled={isPending}>Cancelar</AlertDialogCancel>
            <AlertDialogAction onClick={handleUnlink} disabled={isPending}>
              {isPending ? <Spinner /> : null}
              Desvincular
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
    </div>
  );
}
