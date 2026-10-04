"use client";

import { Check, Crown, UserRoundX, X } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { reviewRegistration } from "@/app/(app)/torneos/[id]/inscripciones/actions";
import { EmptyState } from "@/components/shared/empty-state";
import { TeamStatusBadge } from "@/components/tournaments/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import type { OrganizerTeam, TeamStatus } from "@/lib/data/teams";
import { cn } from "@/lib/utils";
import { ClipboardList } from "lucide-react";

type Filter = "all" | TeamStatus;

const FILTERS: { value: Filter; label: string }[] = [
  { value: "pending", label: "Pendientes" },
  { value: "approved", label: "Aprobadas" },
  { value: "rejected", label: "Rechazadas" },
  { value: "all", label: "Todas" },
];

type RegistrationsListProps = {
  tournamentId: string;
  teams: OrganizerTeam[];
  teamSize: number;
  maxTeams: number;
  /** Solo con la inscripción abierta se aprueba o rechaza (lo valida la RPC). */
  canReview: boolean;
  filter: Filter;
};

function ReviewButtons({
  tournamentId,
  team,
  approveDisabledReason,
}: {
  tournamentId: string;
  team: OrganizerTeam;
  approveDisabledReason?: string;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [pendingDecision, setPendingDecision] = useState<"approved" | "rejected" | null>(null);

  function review(decision: "approved" | "rejected") {
    setPendingDecision(decision);
    startTransition(async () => {
      const result = await reviewRegistration({ tournamentId, teamId: team.id, decision });
      if (!result.ok) toast.error(result.error);
      else {
        toast.success(result.message ?? "Listo.");
        router.refresh();
      }
      setPendingDecision(null);
    });
  }

  return (
    <div className="space-y-1">
      <div className="flex gap-2">
        {team.status !== "approved" ? (
          <Button
            size="sm"
            onClick={() => review("approved")}
            disabled={isPending || Boolean(approveDisabledReason)}
            aria-label={`Aprobar ${team.name}`}
          >
            {isPending && pendingDecision === "approved" ? <Spinner /> : <Check aria-hidden="true" />}
            Aprobar
          </Button>
        ) : null}
        {team.status !== "rejected" ? (
          <Button
            size="sm"
            variant="outline"
            onClick={() => review("rejected")}
            disabled={isPending}
            aria-label={`Rechazar ${team.name}`}
          >
            {isPending && pendingDecision === "rejected" ? <Spinner /> : <X aria-hidden="true" />}
            Rechazar
          </Button>
        ) : null}
      </div>
      {team.status !== "approved" && approveDisabledReason ? (
        <p className="text-xs text-muted-foreground">{approveDisabledReason}</p>
      ) : null}
    </div>
  );
}

/** Listado de inscripciones con filtros por estado y aprobación/rechazo. */
export function RegistrationsList({ tournamentId, teams, teamSize, maxTeams, canReview, filter }: RegistrationsListProps) {
  const approved = teams.filter((t) => t.status === "approved").length;
  const visible = filter === "all" ? teams : teams.filter((t) => t.status === filter);
  const counts = {
    all: teams.length,
    pending: teams.filter((t) => t.status === "pending").length,
    approved,
    rejected: teams.filter((t) => t.status === "rejected").length,
  };

  return (
    <div className="space-y-4">
      <nav aria-label="Filtrar inscripciones" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <Link
            key={f.value}
            href={`/torneos/${tournamentId}/inscripciones?estado=${f.value}`}
            aria-current={filter === f.value ? "page" : undefined}
            className={cn(
              "inline-flex h-10 items-center gap-1 rounded-full border px-4 text-sm md:h-8",
              filter === f.value ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            {f.label} <span className="tabular-nums opacity-70">{counts[f.value]}</span>
          </Link>
        ))}
      </nav>

      {visible.length === 0 ? (
        <EmptyState
          icon={ClipboardList}
          title={filter === "pending" ? "No hay inscripciones pendientes" : "No hay inscripciones"}
          description="Compartí el link de inscripción desde el resumen del torneo."
        />
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visible.map((team) => {
            const complete = team.members.length >= teamSize;
            const approveDisabledReason = !complete
              ? "El plantel está incompleto."
              : approved >= maxTeams
                ? "Se completó el cupo."
                : undefined;
            return (
              <li key={team.id} className="space-y-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{team.name}</h3>
                  <TeamStatusBadge status={team.status} />
                  <Badge variant="outline">
                    {team.availabilityCount === 0 ? "Sin disponibilidad" : `${team.availabilityCount} franjas`}
                  </Badge>
                </div>
                <ul className="space-y-1 text-sm">
                  {team.members.map((member) => (
                    <li key={member.id} className="flex items-center gap-2">
                      {member.role === "captain" ? (
                        <Crown className="size-4 text-amber-700" aria-label="Capitán" />
                      ) : member.userId ? null : (
                        <UserRoundX className="size-4 text-muted-foreground" aria-label="Pendiente de registro" />
                      )}
                      <span className="truncate">{member.fullName ?? "Sin registrar"}</span>
                      <span className="truncate text-muted-foreground">{member.email}</span>
                    </li>
                  ))}
                </ul>
                {canReview ? (
                  <ReviewButtons tournamentId={tournamentId} team={team} approveDisabledReason={approveDisabledReason} />
                ) : null}
              </li>
            );
          })}
        </ul>
      )}
    </div>
  );
}
