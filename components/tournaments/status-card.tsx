"use client";

import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { changeTournamentStatus } from "@/app/(app)/torneos/[id]/actions";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import {
  STATUS_LABELS,
  TRANSITION_ACTION_LABELS,
  type TournamentStatus,
} from "@/lib/domain/tournament-status";
import { StatusBadge } from "./status-badge";

export type TransitionOption = { to: TournamentStatus; ok: boolean; reason?: string };

/** Qué pasa al entrar en cada estado (texto del diálogo de confirmación). */
const CONSEQUENCES: Record<TournamentStatus, string> = {
  draft: "El torneo deja de ser visible públicamente y no acepta inscripciones.",
  registration_open:
    "El torneo pasa a ser público y las parejas o equipos se pueden inscribir con el link o el código.",
  group_stage:
    "Se cierra la inscripción: los planteles y la disponibilidad quedan fijos y solo juegan las inscripciones aprobadas.",
  playoffs: "Se cierra la fase de grupos y se arma el cuadro eliminatorio con los clasificados.",
  finished: "El torneo queda finalizado y ya no se cargan resultados.",
};

const NEXT_STEP: Record<TournamentStatus, string> = {
  draft: "Configurá canchas y franjas horarias, y abrí la inscripción cuando esté todo listo.",
  registration_open: "Aprobá las inscripciones. Cuando cierres la inscripción, armás los grupos.",
  group_stage: "Armá los grupos, programá los partidos y cargá los resultados.",
  playoffs: "Generá el cuadro y cargá los resultados hasta la final.",
  finished: "El torneo terminó.",
};

/** Estado actual y transiciones posibles, con su motivo cuando están bloqueadas. */
export function StatusCard({
  tournamentId,
  status,
  options,
}: {
  tournamentId: string;
  status: TournamentStatus;
  options: TransitionOption[];
}) {
  const router = useRouter();

  async function changeTo(to: TournamentStatus) {
    const result = await changeTournamentStatus({ tournamentId, status: to });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message ?? "Actualizamos el estado.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="flex flex-wrap items-center gap-2 text-base font-semibold">
            Estado <StatusBadge status={status} />
          </h2>
        </CardTitle>
        <CardDescription>{NEXT_STEP[status]}</CardDescription>
      </CardHeader>
      {options.length > 0 ? (
        <CardContent className="space-y-3">
          {options.map((option) => (
            <div key={option.to} className="space-y-1">
              <ConfirmActionButton
                variant={option.to === "draft" ? "outline" : "default"}
                disabled={!option.ok}
                className="w-full sm:w-auto"
                title={`${TRANSITION_ACTION_LABELS[option.to]}?`}
                description={<p>{CONSEQUENCES[option.to]}</p>}
                confirmLabel={`Pasar a "${STATUS_LABELS[option.to]}"`}
                onConfirm={() => changeTo(option.to)}
              >
                {TRANSITION_ACTION_LABELS[option.to]}
              </ConfirmActionButton>
              {!option.ok && option.reason ? (
                <p className="text-sm text-muted-foreground">{option.reason}</p>
              ) : null}
            </div>
          ))}
        </CardContent>
      ) : null}
    </Card>
  );
}
