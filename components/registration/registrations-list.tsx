"use client";

import { AlertCircle, Check, Crown, UserRoundX, X, ClipboardList } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import {
  assignAllUnassignedTeams,
  assignTeamCategory,
  fillTestTeamSlots,
  reviewRegistration,
} from "@/app/(app)/torneos/[id]/inscripciones/actions";
import { EmptyState } from "@/components/shared/empty-state";
import { TeamStatusBadge } from "@/components/tournaments/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import type { OrganizerTeam, TeamStatus } from "@/lib/data/teams";
import { cn } from "@/lib/utils";

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
  isTestTournament: boolean;
  /** Solo con la inscripción abierta se aprueba o rechaza (lo valida la RPC). */
  canReview: boolean;
  filter: Filter;
  categories?: { id: string; name: string; maxTeams?: number }[];
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

function TeamCategorySelector({
  tournamentId,
  teamId,
  currentCategoryId,
  categories,
}: {
  tournamentId: string;
  teamId: string;
  currentCategoryId: string | null;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  function handleChange(val: string) {
    const nextCat = val === "" ? null : val;
    startTransition(async () => {
      const result = await assignTeamCategory({
        tournamentId,
        teamId,
        categoryId: nextCat,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Categoría asignada.");
      router.refresh();
    });
  }

  return (
    <div className="flex items-center gap-1.5">
      {isPending ? <Spinner className="size-3" /> : null}
      <NativeSelect
        size="sm"
        value={currentCategoryId ?? ""}
        disabled={isPending}
        onChange={(e) => handleChange(e.target.value)}
        className="h-7 text-xs w-auto min-w-[120px] max-w-[200px]"
        aria-label="Cambiar categoría"
      >
        <NativeSelectOption value="">Sin categoría</NativeSelectOption>
        {categories.map((c) => (
          <NativeSelectOption key={c.id} value={c.id}>
            {c.name}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </div>
  );
}

function BulkAssignBanner({
  tournamentId,
  unassignedCount,
  categories,
}: {
  tournamentId: string;
  unassignedCount: number;
  categories: { id: string; name: string }[];
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [targetCategory, setTargetCategory] = useState<string>(categories[0]?.id ?? "");

  function handleBulkAssign() {
    if (!targetCategory) return;
    startTransition(async () => {
      const result = await assignAllUnassignedTeams({
        tournamentId,
        categoryId: targetCategory,
      });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Parejas asignadas.");
      router.refresh();
    });
  }

  return (
    <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-3 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
      <div className="flex items-center gap-2">
        <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
        <div>
          <p className="font-medium">
            Hay {unassignedCount} {unassignedCount === 1 ? "pareja" : "parejas"} sin categoría asignada.
          </p>
          <p className="text-xs text-amber-800 dark:text-amber-300">
            Podés asignarlas todas juntas a una categoría:
          </p>
        </div>
      </div>
      <div className="flex items-center gap-2">
        <NativeSelect
          size="sm"
          value={targetCategory}
          disabled={isPending}
          onChange={(e) => setTargetCategory(e.target.value)}
          className="h-8 text-xs bg-background"
        >
          {categories.map((c) => (
            <NativeSelectOption key={c.id} value={c.id}>
              {c.name}
            </NativeSelectOption>
          ))}
        </NativeSelect>
        <Button
          size="sm"
          variant="outline"
          disabled={isPending || !targetCategory}
          onClick={handleBulkAssign}
          className="h-8 text-xs shrink-0"
        >
          {isPending ? <Spinner className="size-3" /> : "Asignar todas"}
        </Button>
      </div>
    </div>
  );
}

/** Listado de inscripciones con filtros por estado y aprobación/rechazo. */
export function RegistrationsList({
  tournamentId,
  teams,
  teamSize,
  maxTeams,
  isTestTournament,
  canReview,
  filter,
  categories,
}: RegistrationsListProps) {
  const router = useRouter();
  const [isToolPending, startToolTransition] = useTransition();
  const [selectedCat, setSelectedCat] = useState<string>("all");

  const categoryNames = useMemo(
    () => new Map((categories ?? []).map((c) => [c.id, c.name])),
    [categories],
  );

  const categoryFiltered = useMemo(() => {
    if (selectedCat === "all") return teams;
    return teams.filter((t) => t.categoryId === selectedCat);
  }, [teams, selectedCat]);

  const approved = categoryFiltered.filter((t) => t.status === "approved").length;
  const visible = filter === "all" ? categoryFiltered : categoryFiltered.filter((t) => t.status === filter);
  const counts = {
    all: categoryFiltered.length,
    pending: categoryFiltered.filter((t) => t.status === "pending").length,
    approved,
    rejected: categoryFiltered.filter((t) => t.status === "rejected").length,
  };

  function runRegistrationTool() {
    startToolTransition(async () => {
      const result = await fillTestTeamSlots({ tournamentId });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Listo.");
      router.refresh();
    });
  }

  return (
    <div className="space-y-4">
      {categories && categories.length > 1 ? (
        <div className="flex flex-wrap items-center gap-1.5 pb-1">
          <span className="text-xs font-medium text-muted-foreground mr-1">Categoría:</span>
          <button
            type="button"
            onClick={() => setSelectedCat("all")}
            className={cn(
              "inline-flex h-7 items-center rounded-full border px-3 text-xs transition-colors",
              selectedCat === "all"
                ? "border-primary bg-primary text-primary-foreground font-medium shadow-sm"
                : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
            )}
          >
            Todas ({teams.length})
          </button>
          {categories.map((c) => (
            <button
              key={c.id}
              type="button"
              onClick={() => setSelectedCat(c.id)}
              className={cn(
                "inline-flex h-7 items-center rounded-full border px-3 text-xs transition-colors",
                selectedCat === c.id
                  ? "border-primary bg-primary text-primary-foreground font-medium shadow-sm"
                  : "border-border text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              {c.name} ({teams.filter((t) => t.categoryId === c.id).length})
            </button>
          ))}
        </div>
      ) : null}
      {canReview && isTestTournament ? (
        <div className="flex flex-wrap gap-2">
          {approved < maxTeams ? (
            <Button
              variant="secondary"
              onClick={runRegistrationTool}
              disabled={isToolPending}
            >
              {isToolPending ? <Spinner /> : null}
              Completar cupos con parejas ficticias
            </Button>
          ) : null}
          <p className="basis-full text-xs text-muted-foreground">
              Las parejas ficticias solo existen en este torneo privado y quedan aprobadas con disponibilidad completa.
            </p>
        </div>
      ) : null}
      {categories && categories.length > 0 && teams.some((t) => !t.categoryId) ? (
        <BulkAssignBanner
          tournamentId={tournamentId}
          unassignedCount={teams.filter((t) => !t.categoryId).length}
          categories={categories}
        />
      ) : null}

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
            const categoryMax =
              team.categoryId && categories
                ? categories.find((c) => c.id === team.categoryId)?.maxTeams ?? maxTeams
                : maxTeams;
            const categoryApproved = team.categoryId
              ? teams.filter((t) => t.categoryId === team.categoryId && t.status === "approved").length
              : approved;
            const approveDisabledReason = !complete
              ? "El plantel está incompleto."
              : categoryApproved >= categoryMax
                ? "Se completó el cupo."
                : undefined;
            return (
              <li key={team.id} className="space-y-3 rounded-xl border p-4">
                <div className="flex flex-wrap items-center gap-2">
                  <h3 className="font-medium">{team.name}</h3>
                  {categories && categories.length > 0 ? (
                    <TeamCategorySelector
                      tournamentId={tournamentId}
                      teamId={team.id}
                      currentCategoryId={team.categoryId}
                      categories={categories}
                    />
                  ) : null}
                  <TeamStatusBadge status={team.status} />
                  {team.testGenerated ? <Badge variant="secondary">Ficticia</Badge> : null}
                  {team.organizerRegistered ? <Badge variant="outline">Cargada por organizador</Badge> : null}
                  <Badge variant="outline">
                    {team.availabilityCount === 0 ? "Sin disponibilidad" : `${team.availabilityCount} franjas`}
                  </Badge>
                </div>
                {team.testGenerated ? (
                  <p className="text-sm text-muted-foreground">Integrantes ficticios para probar grupos, fixture y cuadro.</p>
                ) : (
                  <ul className="space-y-1 text-sm">
                    {team.members.map((member) => (
                      <li key={member.id} className="flex items-center gap-2">
                        {member.role === "captain" ? (
                          <Crown className="size-4 text-amber-700" aria-label="Capitán" />
                        ) : member.userId || team.organizerRegistered ? null : (
                          <UserRoundX className="size-4 text-muted-foreground" aria-label="Pendiente de aceptar la invitación" />
                        )}
                        <span className="truncate">
                          {member.fullName ??
                            member.displayName ??
                            (member.userId
                              ? "Sin registrar"
                              : team.organizerRegistered
                                ? "Sin cuenta"
                                : "Invitación pendiente")}
                        </span>
                        {member.email ? <span className="truncate text-muted-foreground">{member.email}</span> : null}
                      </li>
                    ))}
                  </ul>
                )}
                {canReview && !team.testGenerated ? (
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
