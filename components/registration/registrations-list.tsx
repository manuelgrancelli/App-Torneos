"use client";

import { AlertCircle, CalendarClock, Check, ChevronRight, Crown, UserRoundX, X, ClipboardList } from "lucide-react";
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
import { TeamAvailabilityDialog, type DialogSlot } from "./team-availability-dialog";

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
  categories?: { id: string; name: string; maxTeams?: number | null }[];
  slots?: DialogSlot[];
  timezone?: string;
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

function TeamCard({
  team,
  tournamentId,
  teamSize,
  maxTeams,
  canReview,
  categories,
  allTeams,
  onOpenAvailability,
}: {
  team: OrganizerTeam;
  tournamentId: string;
  teamSize: number;
  maxTeams: number;
  canReview: boolean;
  categories?: { id: string; name: string; maxTeams?: number | null }[];
  allTeams: OrganizerTeam[];
  onOpenAvailability: (teamId: string) => void;
}) {
  const complete = team.members.length >= teamSize;
  const foundCat = team.categoryId && categories ? categories.find((c) => c.id === team.categoryId) : null;
  const categoryMax = foundCat ? (foundCat.maxTeams ?? null) : maxTeams;
  const categoryApproved = team.categoryId
    ? allTeams.filter((t) => t.categoryId === team.categoryId && t.status === "approved").length
    : allTeams.filter((t) => t.status === "approved").length;
  const isFull = categoryMax !== null && categoryApproved >= categoryMax;
  const approveDisabledReason = !complete
    ? "El plantel está incompleto."
    : isFull
      ? "Se completó el cupo."
      : undefined;

  return (
    <li className="space-y-3 rounded-xl border border-border/80 bg-card p-4 shadow-2xs">
      <div className="flex flex-wrap items-center gap-2">
        <h3 className="font-semibold text-foreground">{team.name}</h3>
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
        <button
          type="button"
          onClick={() => onOpenAvailability(team.id)}
          className={cn(
            "inline-flex items-center gap-1.5 h-7 px-2.5 rounded-full text-xs font-medium border transition-colors cursor-pointer",
            team.availabilityCount === 0
              ? "border-amber-500/50 bg-amber-500/10 text-amber-700 dark:text-amber-300 hover:bg-amber-500/20"
              : "border-border/80 bg-background hover:bg-muted text-foreground hover:border-primary/40",
          )}
          title="Editar franjas horarias de disponibilidad"
          aria-label={`Editar franjas horarias de ${team.name}`}
        >
          <CalendarClock
            className={cn(
              "size-3.5 shrink-0",
              team.availabilityCount === 0 ? "text-amber-600 dark:text-amber-400" : "text-primary",
            )}
            aria-hidden="true"
          />
          <span>
            {team.availabilityCount === 0
              ? "Elegir franjas"
              : `${team.availabilityCount} ${team.availabilityCount === 1 ? "franja" : "franjas"}`}
          </span>
        </button>
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
      <div className="flex flex-wrap items-center justify-between gap-2 pt-2 border-t border-border/40">
        <Button
          type="button"
          variant="outline"
          size="sm"
          onClick={() => onOpenAvailability(team.id)}
          className="h-8 text-xs gap-1.5 border-border/80 hover:border-primary/50"
        >
          <CalendarClock className="size-3.5 text-primary" aria-hidden="true" />
          <span>
            {team.availabilityCount === 0 ? "Asignar franjas" : "Modificar franjas"}
          </span>
        </Button>

        {canReview && !team.testGenerated ? (
          <ReviewButtons tournamentId={tournamentId} team={team} approveDisabledReason={approveDisabledReason} />
        ) : null}
      </div>
    </li>
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
  slots = [],
  timezone = "America/Argentina/Buenos_Aires",
}: RegistrationsListProps) {
  const router = useRouter();
  const [isToolPending, startToolTransition] = useTransition();
  const [selectedCat, setSelectedCat] = useState<string>("all");
  const [availabilityTeamId, setAvailabilityTeamId] = useState<string | null>(null);

  const availabilityTeam = useMemo(
    () => (availabilityTeamId ? teams.find((t) => t.id === availabilityTeamId) ?? null : null),
    [availabilityTeamId, teams],
  );

  const availabilityTeamCategoryName = useMemo(() => {
    if (!availabilityTeam?.categoryId || !categories) return null;
    return categories.find((c) => c.id === availabilityTeam.categoryId)?.name ?? null;
  }, [availabilityTeam, categories]);

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

  type CategoryGroup = {
    id: string;
    name: string;
    maxTeams: number | null;
    teams: OrganizerTeam[];
    filteredTeams: OrganizerTeam[];
  };

  const categoryGroups = useMemo(() => {
    if (!categories || categories.length === 0) return [];

    const groups: CategoryGroup[] = categories.map((cat) => {
      const catTeams = teams.filter((t) => t.categoryId === cat.id);
      const catFiltered = filter === "all" ? catTeams : catTeams.filter((t) => t.status === filter);
      return {
        id: cat.id,
        name: cat.name,
        maxTeams: cat.maxTeams ?? null,
        teams: catTeams,
        filteredTeams: catFiltered,
      };
    });

    const unassigned = teams.filter((t) => !t.categoryId);
    if (unassigned.length > 0) {
      const unassignedFiltered = filter === "all" ? unassigned : unassigned.filter((t) => t.status === filter);
      groups.push({
        id: "__unassigned__",
        name: "Sin categoría asignada",
        maxTeams: null,
        teams: unassigned,
        filteredTeams: unassignedFiltered,
      });
    }

    return groups;
  }, [categories, teams, filter]);

  const displayedGroups = useMemo(() => {
    if (selectedCat === "all") return categoryGroups;
    return categoryGroups.filter((g) => g.id === selectedCat);
  }, [categoryGroups, selectedCat]);

  const [openCategories, setOpenCategories] = useState<Record<string, boolean>>({});

  function isCategoryOpen(catId: string): boolean {
    if (typeof openCategories[catId] === "boolean") {
      return openCategories[catId];
    }
    if ((categories?.length === 1 && !teams.some((t) => !t.categoryId)) || selectedCat === catId) {
      return true;
    }
    return false;
  }

  function toggleCategory(catId: string) {
    setOpenCategories((prev) => ({
      ...prev,
      [catId]: !isCategoryOpen(catId),
    }));
  }

  function setAllCategoriesOpen(open: boolean) {
    const next: Record<string, boolean> = {};
    for (const g of categoryGroups) {
      next[g.id] = open;
    }
    setOpenCategories(next);
  }

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
      ) : displayedGroups.length > 0 ? (
        <div className="space-y-4">
          {displayedGroups.length > 1 ? (
            <div className="flex items-center justify-between px-1 text-xs text-muted-foreground">
              <span>
                {displayedGroups.length} categorías ({visible.length} {visible.length === 1 ? "pareja" : "parejas"})
              </span>
              <div className="flex items-center gap-2">
                <button
                  type="button"
                  onClick={() => setAllCategoriesOpen(true)}
                  className="underline underline-offset-4 hover:text-foreground cursor-pointer"
                >
                  Expandir todas
                </button>
                <span>•</span>
                <button
                  type="button"
                  onClick={() => setAllCategoriesOpen(false)}
                  className="underline underline-offset-4 hover:text-foreground cursor-pointer"
                >
                  Plegar todas
                </button>
              </div>
            </div>
          ) : null}

          <div className="space-y-3">
            {displayedGroups.map((group) => {
              const isOpen = isCategoryOpen(group.id);
              const catApproved = group.teams.filter((t) => t.status === "approved").length;
              const catPending = group.teams.filter((t) => t.status === "pending").length;
              const catRejected = group.teams.filter((t) => t.status === "rejected").length;

              return (
                <div
                  key={group.id}
                  className="overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs transition-colors"
                >
                  <button
                    type="button"
                    onClick={() => toggleCategory(group.id)}
                    aria-expanded={isOpen}
                    aria-controls={`category-panel-${group.id}`}
                    className="flex w-full cursor-pointer flex-wrap items-center justify-between gap-3 p-4 text-left transition-colors hover:bg-muted/40 focus-visible:outline-hidden focus-visible:ring-2 focus-visible:ring-ring"
                  >
                    <div className="flex min-w-0 items-center gap-3">
                      <div
                        className={cn(
                          "flex size-8 shrink-0 items-center justify-center rounded-lg border transition-transform duration-200",
                          isOpen
                            ? "rotate-90 border-primary/40 bg-primary/10 text-primary"
                            : "border-border/60 bg-muted/50 text-muted-foreground",
                        )}
                      >
                        <ChevronRight className="size-4" aria-hidden="true" />
                      </div>
                      <div className="min-w-0">
                        <div className="flex flex-wrap items-center gap-2">
                          <h3 className="text-base font-semibold text-foreground leading-tight">{group.name}</h3>
                          <Badge variant="secondary" className="text-xs font-medium">
                            {group.teams.length} {group.teams.length === 1 ? "pareja" : "parejas"}
                          </Badge>
                          {group.maxTeams !== null ? (
                            <Badge variant="outline" className="text-xs text-muted-foreground">
                              Cupo: {catApproved}/{group.maxTeams}
                            </Badge>
                          ) : null}
                        </div>
                        <p className="mt-0.5 text-xs text-muted-foreground">
                          {catApproved} {catApproved === 1 ? "aprobada" : "aprobadas"}
                          {catPending > 0 ? ` • ${catPending} ${catPending === 1 ? "pendiente" : "pendientes"}` : ""}
                          {catRejected > 0 ? ` • ${catRejected} ${catRejected === 1 ? "rechazada" : "rechazadas"}` : ""}
                        </p>
                      </div>
                    </div>

                    <div className="flex shrink-0 items-center gap-2">
                      <span className="text-xs font-medium text-muted-foreground">
                        {isOpen ? "Plegar parejas" : "Ver parejas"}
                      </span>
                      <div
                        className={cn(
                          "rounded-full border px-2.5 py-0.5 text-xs font-medium transition-colors",
                          isOpen
                            ? "border-primary/30 bg-primary/10 text-primary"
                            : "border-border bg-background text-muted-foreground",
                        )}
                      >
                        {isOpen ? "Abierto" : "Cerrado"}
                      </div>
                    </div>
                  </button>

                  {isOpen && (
                    <div
                      id={`category-panel-${group.id}`}
                      className="border-t border-border/60 bg-muted/20 p-3.5 sm:p-4"
                    >
                      {group.filteredTeams.length === 0 ? (
                        <div className="py-6 text-center text-sm text-muted-foreground">
                          {group.teams.length === 0
                            ? "No hay parejas inscriptas en esta categoría todavía."
                            : `No hay parejas con estado "${FILTERS.find((f) => f.value === filter)?.label.toLowerCase()}" en esta categoría.`}
                        </div>
                      ) : (
                        <ul className="grid gap-3 lg:grid-cols-2">
                          {group.filteredTeams.map((team) => (
                            <TeamCard
                              key={team.id}
                              team={team}
                              tournamentId={tournamentId}
                              teamSize={teamSize}
                              maxTeams={group.maxTeams ?? maxTeams}
                              canReview={canReview}
                              categories={categories}
                              allTeams={teams}
                              onOpenAvailability={setAvailabilityTeamId}
                            />
                          ))}
                        </ul>
                      )}
                    </div>
                  )}
                </div>
              );
            })}
          </div>
        </div>
      ) : (
        <ul className="grid gap-3 lg:grid-cols-2">
          {visible.map((team) => (
            <TeamCard
              key={team.id}
              team={team}
              tournamentId={tournamentId}
              teamSize={teamSize}
              maxTeams={maxTeams}
              canReview={canReview}
              categories={categories}
              allTeams={teams}
              onOpenAvailability={setAvailabilityTeamId}
            />
          ))}
        </ul>
      )}

      <TeamAvailabilityDialog
        tournamentId={tournamentId}
        timezone={timezone}
        slots={slots}
        team={availabilityTeam}
        categoryName={availabilityTeamCategoryName}
        open={Boolean(availabilityTeamId)}
        onOpenChange={(open) => {
          if (!open) setAvailabilityTeamId(null);
        }}
      />
    </div>
  );
}
