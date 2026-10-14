"use client";

import { ArrowRight, CheckCircle2, Clock, Sparkles } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { toast } from "sonner";
import { changeTournamentStatus } from "@/app/(app)/torneos/[id]/actions";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";

export type OpenRegistrationCardProps = {
  tournamentId: string;
  slotCount: number;
  categoryCount: number;
};

export function OpenRegistrationCard({
  tournamentId,
  slotCount,
  categoryCount,
}: OpenRegistrationCardProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  async function handleOpenRegistration() {
    startTransition(async () => {
      const res = await changeTournamentStatus({
        tournamentId,
        status: "registration_open",
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success("¡Inscripción abierta con éxito! Ya podés compartir el código o link.");
      router.refresh();
    });
  }

  const canOpen = slotCount > 0;

  return (
    <Card className="border-primary/30 bg-linear-to-br from-primary/5 via-card to-background">
      <CardHeader>
        <div className="flex items-center gap-2 text-xs font-semibold uppercase tracking-wider text-primary">
          <Sparkles className="size-4" />
          <span>Paso final de preparación</span>
        </div>
        <CardTitle>
          <h2 className="text-lg font-semibold tracking-tight">Abrí la inscripción de tu torneo</h2>
        </CardTitle>
        <CardDescription>
          Tu torneo ya cuenta con {categoryCount > 0 ? `${categoryCount} categorías y ` : ""}{slotCount} franjas horarias configuradas.
          Al abrir la inscripción, podrás compartir el link y código de acceso con los jugadores o cargar tus primeros equipos manualmente.
        </CardDescription>
      </CardHeader>

      <CardContent className="space-y-4">
        {!canOpen ? (
          <div className="flex items-start gap-3 rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-sm text-amber-900 dark:text-amber-200">
            <Clock className="size-5 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
            <div className="space-y-1">
              <p className="font-medium">Falta cargar franjas horarias</p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                El sistema requiere que cargues al menos una franja horaria antes de abrir la inscripción para que los participantes puedan indicar su disponibilidad.
              </p>
              <div className="pt-1">
                <Button asChild size="sm" variant="outline" className="border-amber-500/40 hover:bg-amber-500/20">
                  <Link href={`/torneos/${tournamentId}/canchas-franjas`}>
                    Ir a franjas horarias
                    <ArrowRight className="size-3.5 ml-1" />
                  </Link>
                </Button>
              </div>
            </div>
          </div>
        ) : (
          <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between rounded-xl border border-border/80 bg-card p-4 shadow-xs">
            <div className="flex items-center gap-2 text-sm text-muted-foreground font-medium">
              <CheckCircle2 className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
              <span>Condiciones listas: franjas y canchas cargadas.</span>
            </div>

            <ConfirmActionButton
              title="¿Abrir la inscripción al público?"
              description="El torneo pasará a ser público y las parejas o equipos se podrán inscribir con el link o el código."
              confirmLabel="Abrir inscripción"
              variant="default"
              disabled={isPending}
              onConfirm={handleOpenRegistration}
              className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs hover:shadow-md hover:shadow-emerald-600/20 active:scale-[0.98] transition-all duration-150"
            >
              Abrir inscripciones ahora
            </ConfirmActionButton>
          </div>
        )}
      </CardContent>
    </Card>
  );
}
