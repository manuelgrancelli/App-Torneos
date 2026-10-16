"use client";

import {
  Calendar,
  CalendarClock,
  CheckCheck,
  ClipboardEdit,
  Eraser,
  LayoutGrid,
  Lock,
  MoreVertical,
  TriangleAlert,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState } from "react";
import { toast } from "sonner";
import { clearResult, confirmResult } from "@/app/(app)/torneos/[id]/partidos/actions";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  DropdownMenu,
  DropdownMenuContent,
  DropdownMenuItem,
  DropdownMenuTrigger,
} from "@/components/ui/dropdown-menu";
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
import { formatDayHeading, formatInTimeZone, formatTimeRange, groupByLocalDay } from "@/lib/dates";
import type { FixedAssignment } from "@/lib/domain/scheduler";
import { type BoardMatch, compareMatchesChronological, playoffRoundCount } from "@/lib/competition-view";
import type { ScoringConfig } from "@/lib/domain/scoring";
import { cn } from "@/lib/utils";
import { AssignSlotDialog } from "./assign-slot-dialog";
import { ResultDialog } from "./result-dialog";


type Filter = "all" | "unscheduled" | "pending" | "disputed";
type ViewMode = "schedule" | "stage";

type MatchesBoardProps = {
  tournamentId: string;
  timezone: string;
  scoring: ScoringConfig;
  matches: BoardMatch[];
  slots: { id: string; startsAt: string; endsAt: string; courtId: string | null }[];
  courts: { id: string; name: string }[];
  availability: Record<string, string[]>;
  canEdit: boolean;
};

const FILTERS: { value: Filter; label: string }[] = [
  { value: "all", label: "Todos" },
  { value: "unscheduled", label: "Sin horario" },
  { value: "pending", label: "Sin resultado" },
  { value: "disputed", label: "Objetados" },
];

function matchesFilter(match: BoardMatch, filter: Filter): boolean {
  switch (filter) {
    case "unscheduled": return !match.slotId && !match.result;
    case "pending": return !match.result;
    case "disputed": return match.resultStatus === "disputed";
    default: return true;
  }
}

function MatchRow({
  match,
  timezone,
  canEdit,
  onSchedule,
  onResult,
  onClear,
  onRefresh,
  tournamentId,
}: {
  match: BoardMatch;
  timezone: string;
  canEdit: boolean;
  onSchedule: () => void;
  onResult: () => void;
  onClear: () => void;
  onRefresh: () => void;
  tournamentId: string;
}) {
  const ready = Boolean(match.homeTeamId && match.awayTeamId);
  const homeWon = match.winnerTeamId && match.winnerTeamId === match.homeTeamId;
  const awayWon = match.winnerTeamId && match.winnerTeamId === match.awayTeamId;

  async function confirm() {
    const result = await confirmResult({ tournamentId, matchId: match.id });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(result.message ?? "Listo.");
      onRefresh();
    }
  }

  return (
    <li className="flex items-start gap-2.5 sm:gap-3 p-3 sm:px-4" data-testid="match-row">
      <div className="min-w-0 flex-1 space-y-1">
        <div className="flex flex-wrap items-center gap-1.5 pb-0.5">
          {match.categoryName ? (
            <Badge variant="outline" className="border-primary/40 bg-primary/5 text-primary text-[10px] font-medium tracking-wide">
              {match.categoryName}
            </Badge>
          ) : null}
          <span className="text-[11px] font-medium text-muted-foreground">{match.section}</span>
        </div>
        <p className={cn("text-xs sm:text-sm leading-snug line-clamp-1", homeWon && "font-bold text-foreground")}>
          {match.homeName}
        </p>
        <p className={cn("text-xs sm:text-sm leading-snug line-clamp-1", awayWon && "font-bold text-foreground")}>
          {match.awayName}
        </p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
          {match.startsAt && match.endsAt ? (
            <span className="inline-flex flex-wrap items-center gap-x-1.5">
              <CalendarClock className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span className="whitespace-nowrap first-letter:uppercase">
                {formatInTimeZone(match.startsAt, timezone, "EEE d/M")}
              </span>
              <span className="whitespace-nowrap tabular-nums font-semibold text-foreground">{formatTimeRange(match.startsAt, match.endsAt, timezone)}</span>
              {match.courtName ? <span className="whitespace-nowrap font-medium text-foreground">· {match.courtName}</span> : null}
              {match.scheduleLocked ? <Lock className="size-3" aria-label="Horario fijado a mano" /> : null}
            </span>
          ) : ready && !match.result ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-900 dark:bg-amber-950/60 dark:text-amber-200 text-[11px]">
              Sin horario
            </Badge>
          ) : null}
          {match.resultStatus === "provisional" ? <Badge variant="outline" className="text-[11px]">A confirmar</Badge> : null}
          {match.resultStatus === "disputed" ? (
            <Badge variant="secondary" className="bg-red-100 text-red-900 dark:bg-red-950/60 dark:text-red-200 text-[11px]">
              <TriangleAlert className="size-3" aria-hidden="true" />
              Objetado
            </Badge>
          ) : null}
        </div>
        {match.disputes.map((comment, i) => (
          <p key={i} className="rounded bg-red-50 p-2 text-xs text-red-900 dark:bg-red-950/40 dark:text-red-200">&quot;{comment}&quot;</p>
        ))}
      </div>
      <div className="flex shrink-0 items-center gap-1 sm:gap-1.5 self-center">
        {match.resultText ? (
          <button
            type="button"
            onClick={canEdit && ready ? onResult : undefined}
            disabled={!canEdit || !ready}
            title={canEdit && ready ? "Editar resultado" : undefined}
            className={cn(
              "rounded-md px-2 py-1 text-right tabular-nums text-xs sm:text-sm font-bold transition-colors",
              canEdit && ready
                ? "hover:bg-muted text-foreground cursor-pointer"
                : "text-foreground",
            )}
          >
            {match.resultText}
          </button>
        ) : canEdit && ready ? (
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={onResult}
            className="h-8 px-2.5 text-xs font-semibold text-primary border-primary/40 hover:bg-primary/10 hover:text-primary shrink-0 gap-1"
          >
            <ClipboardEdit className="size-3.5" aria-hidden="true" />
            <span>Cargar</span>
          </Button>
        ) : (
          <span className="text-sm text-muted-foreground tabular-nums px-2">—</span>
        )}

        {canEdit && ready ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button
                variant="ghost"
                size="icon"
                className="size-10 md:size-8 shrink-0 text-muted-foreground hover:text-foreground touch-manipulation"
                aria-label={`Acciones: ${match.homeName} vs ${match.awayName}`}
              >
                <MoreVertical className="size-4" aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end" sideOffset={6} collisionPadding={16} className="w-56 p-1.5 shadow-xl border border-border/80">
              <DropdownMenuItem
                onSelect={onResult}
                className="min-h-[44px] py-2.5 px-3 text-sm font-medium gap-3 rounded-lg flex items-center cursor-pointer"
              >
                <ClipboardEdit className="size-4 shrink-0 text-primary" aria-hidden="true" />
                {match.result ? "Editar resultado" : "Cargar resultado"}
              </DropdownMenuItem>
              {!match.result ? (
                <DropdownMenuItem
                  onSelect={onSchedule}
                  className="min-h-[44px] py-2.5 px-3 text-sm font-medium gap-3 rounded-lg flex items-center cursor-pointer"
                >
                  <CalendarClock className="size-4 shrink-0 text-muted-foreground" aria-hidden="true" />
                  {match.slotId ? "Cambiar horario" : "Asignar horario"}
                </DropdownMenuItem>
              ) : null}
              {match.result && match.resultStatus !== "confirmed" ? (
                <DropdownMenuItem
                  onSelect={confirm}
                  className="min-h-[44px] py-2.5 px-3 text-sm font-medium gap-3 rounded-lg flex items-center cursor-pointer"
                >
                  <CheckCheck className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                  Confirmar resultado
                </DropdownMenuItem>
              ) : null}
              {match.result ? (
                <DropdownMenuItem
                  variant="destructive"
                  onSelect={onClear}
                  className="min-h-[44px] py-2.5 px-3 text-sm font-medium gap-3 rounded-lg flex items-center cursor-pointer text-destructive focus:text-destructive"
                >
                  <Eraser className="size-4 shrink-0 text-destructive" aria-hidden="true" />
                  Borrar resultado
                </DropdownMenuItem>
              ) : null}
            </DropdownMenuContent>
          </DropdownMenu>
        ) : null}
      </div>
    </li>
  );
}

/** Fixture del torneo con filtros, programación manual y carga de resultados. */
export function MatchesBoard(props: MatchesBoardProps) {
  const router = useRouter();
  const [filter, setFilter] = useState<Filter>("all");
  const [viewMode, setViewMode] = useState<ViewMode>("schedule");
  const [scheduling, setScheduling] = useState<BoardMatch | null>(null);
  const [editing, setEditing] = useState<BoardMatch | null>(null);
  const [clearing, setClearing] = useState<BoardMatch | null>(null);

  async function clear(match: BoardMatch) {
    const result = await clearResult({ tournamentId: props.tournamentId, matchId: match.id });
    if (!result.ok) toast.error(result.error);
    else {
      toast.success(result.message ?? "Borramos el resultado.");
      router.refresh();
    }
    setClearing(null);
  }

  const availableCategories = Array.from(
    new Set(props.matches.map((m) => m.categoryName).filter((c): c is string => Boolean(c))),
  );
  const [categoryFilter, setCategoryFilter] = useState<string>("all");

  const categoryFiltered = props.matches.filter((m) => {
    if (categoryFilter === "all") return true;
    return m.categoryName === categoryFilter;
  });

  const visible = categoryFiltered.filter((m) => matchesFilter(m, filter));
  const sortedVisible = useMemo(() => {
    return [...visible].sort(compareMatchesChronological);
  }, [visible]);

  const dayGroups = useMemo(() => {
    return groupByLocalDay(sortedVisible, () => props.timezone);
  }, [sortedVisible, props.timezone]);

  const sections = useMemo(() => {
    return [...new Set(sortedVisible.map((m) => m.section))];
  }, [sortedVisible]);

  const counts = Object.fromEntries(
    FILTERS.map((f) => [f.value, categoryFiltered.filter((m) => matchesFilter(m, f.value)).length]),
  );
  const playoffRounds = playoffRoundCount(props.matches);
  const editingPlayoffRounds = useMemo(() => {
    if (!editing || editing.stage !== "playoff") return undefined;
    const catMatches = editing.categoryId
      ? props.matches.filter((m) => m.categoryId === editing.categoryId && m.stage === "playoff")
      : props.matches.filter((m) => !m.categoryId && m.stage === "playoff");
    const count = catMatches.length > 0 ? playoffRoundCount(catMatches) : playoffRounds;
    return count > 0 ? count : undefined;
  }, [editing, props.matches, playoffRounds]);

  const scheduled: FixedAssignment[] = props.matches
    .filter((m) => m.startsAt && m.endsAt)
    .map((m) => ({
      matchId: m.id,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      courtId: m.courtId,
      start: Date.parse(m.startsAt as string),
      end: Date.parse(m.endsAt as string),
    }));

  return (
    <div className="space-y-4">
      {availableCategories.length > 1 ? (
        <div className="space-y-1.5">
          <div className="flex items-center justify-between px-0.5">
            <span className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
              Categorías
            </span>
            {categoryFilter !== "all" ? (
              <button
                type="button"
                onClick={() => setCategoryFilter("all")}
                className="text-xs text-primary hover:underline font-medium"
              >
                Ver todas ({props.matches.length})
              </button>
            ) : null}
          </div>
          <div
            role="region"
            aria-label="Filtrar por categoría"
            tabIndex={0}
            className="flex items-center gap-1.5 overflow-x-auto pb-1.5 pt-0.5 scrollbar-none -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap"
          >
            <button
              type="button"
              onClick={() => setCategoryFilter("all")}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3.5 text-xs font-medium whitespace-nowrap shrink-0 transition-all active:scale-95",
                categoryFilter === "all"
                  ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Todas ({props.matches.length})
            </button>
            {availableCategories.map((cat) => (
              <button
                key={cat}
                type="button"
                onClick={() => setCategoryFilter(cat)}
                className={cn(
                  "inline-flex h-8 items-center rounded-full border px-3.5 text-xs font-medium whitespace-nowrap shrink-0 transition-all active:scale-95",
                  categoryFilter === cat
                    ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                    : "border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {cat} ({props.matches.filter((m) => m.categoryName === cat).length})
              </button>
            ))}
          </div>
        </div>
      ) : null}

      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between">
        <div
          role="tablist"
          aria-label="Filtrar partidos"
          className="flex items-center gap-1.5 overflow-x-auto pb-1 scrollbar-none -mx-1 px-1 sm:mx-0 sm:px-0 sm:flex-wrap"
        >
          {FILTERS.map((f) => (
            <button
              key={f.value}
              type="button"
              role="tab"
              aria-selected={filter === f.value}
              onClick={() => setFilter(f.value)}
              className={cn(
                "inline-flex h-9 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium whitespace-nowrap shrink-0 transition-colors md:h-8",
                filter === f.value
                  ? "border-foreground bg-foreground text-background font-semibold shadow-xs"
                  : "border-border/70 bg-card/60 hover:bg-muted text-muted-foreground hover:text-foreground",
              )}
            >
              {f.label} <span className="tabular-nums opacity-75 font-semibold">({counts[f.value]})</span>
            </button>
          ))}
        </div>

        <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 text-xs self-start sm:self-auto shrink-0">
          <button
            type="button"
            onClick={() => setViewMode("schedule")}
            aria-pressed={viewMode === "schedule"}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 font-medium transition-all",
              viewMode === "schedule"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <CalendarClock className="size-3.5" aria-hidden="true" />
            Cronograma
          </button>
          <button
            type="button"
            onClick={() => setViewMode("stage")}
            aria-pressed={viewMode === "stage"}
            className={cn(
              "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 font-medium transition-all",
              viewMode === "stage"
                ? "bg-background text-foreground shadow-sm"
                : "text-muted-foreground hover:text-foreground",
            )}
          >
            <LayoutGrid className="size-3.5" aria-hidden="true" />
            Por fase
          </button>
        </div>
      </div>

      {sortedVisible.length === 0 ? (
        <EmptyState icon={CheckCheck} title="No hay partidos en esta vista" />
      ) : viewMode === "schedule" ? (
        <div className="space-y-6">
          {dayGroups.map((group) => {
            const headingId = `dia-${group.day ?? "sin-horario"}`;
            return (
              <section key={group.day ?? "sin-horario"} aria-labelledby={headingId} className="space-y-2">
                <div className="flex items-center justify-between px-0.5">
                  <h3 id={headingId} className="text-sm font-semibold first-letter:uppercase flex items-center gap-2">
                    <Calendar className="size-4 text-muted-foreground" aria-hidden="true" />
                    {group.day ? formatDayHeading(group.day) : "Sin horario asignado"}
                  </h3>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {group.items.length} {group.items.length === 1 ? "partido" : "partidos"}
                  </Badge>
                </div>
                <ul className="divide-y rounded-lg border bg-card">
                  {group.items.map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      timezone={props.timezone}
                      canEdit={props.canEdit}
                      tournamentId={props.tournamentId}
                      onSchedule={() => setScheduling(match)}
                      onResult={() => setEditing(match)}
                      onClear={() => setClearing(match)}
                      onRefresh={() => router.refresh()}
                    />
                  ))}
                </ul>
              </section>
            );
          })}
        </div>
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map((section) => (
            <section key={section} aria-labelledby={`sec-${section}`} className="space-y-2">
              <div className="flex items-center justify-between px-0.5">
                <h3 id={`sec-${section}`} className="text-sm font-semibold">
                  {section}
                </h3>
                <Badge variant="secondary" className="text-xs font-normal">
                  {sortedVisible.filter((m) => m.section === section).length}{" "}
                  {sortedVisible.filter((m) => m.section === section).length === 1 ? "partido" : "partidos"}
                </Badge>
              </div>
              <ul className="divide-y rounded-lg border bg-card">
                {sortedVisible
                  .filter((m) => m.section === section)
                  .map((match) => (
                    <MatchRow
                      key={match.id}
                      match={match}
                      timezone={props.timezone}
                      canEdit={props.canEdit}
                      tournamentId={props.tournamentId}
                      onSchedule={() => setScheduling(match)}
                      onResult={() => setEditing(match)}
                      onClear={() => setClearing(match)}
                      onRefresh={() => router.refresh()}
                    />
                  ))}
              </ul>
            </section>
          ))}
        </div>
      )}

      {scheduling ? (
        <AssignSlotDialog
          key={scheduling.id}
          open
          onOpenChange={(open) => !open && setScheduling(null)}
          tournamentId={props.tournamentId}
          timezone={props.timezone}
          match={scheduling}
          title={`${scheduling.homeName} vs ${scheduling.awayName}`}
          slots={props.slots}
          courts={props.courts}
          scheduled={scheduled}
          availability={props.availability}
        />
      ) : null}
      <AlertDialog open={Boolean(clearing)} onOpenChange={(open) => !open && setClearing(null)}>
        <AlertDialogContent>
          <AlertDialogHeader>
            <AlertDialogTitle>¿Borrar el resultado?</AlertDialogTitle>
            <AlertDialogDescription>
              {clearing ? `${clearing.homeName} vs ${clearing.awayName}. ` : ""}
              La tabla se recalcula y, en playoffs, el ganador deja de avanzar.
            </AlertDialogDescription>
          </AlertDialogHeader>
          <AlertDialogFooter>
            <AlertDialogCancel>Cancelar</AlertDialogCancel>
            <AlertDialogAction
              variant="destructive"
              className="!bg-destructive !text-white hover:!bg-destructive/90 shadow-xs"
              onClick={() => clearing && clear(clearing)}
            >
              Borrar resultado
            </AlertDialogAction>
          </AlertDialogFooter>
        </AlertDialogContent>
      </AlertDialog>
      {editing ? (
        <ResultDialog
          key={editing.id}
          open
          onOpenChange={(open) => !open && setEditing(null)}
          tournamentId={props.tournamentId}
          matchId={editing.id}
          stage={editing.stage}
          round={editing.round}
          totalRounds={editingPlayoffRounds}
          isThirdPlace={editing.isThirdPlace}
          scoring={props.scoring}
          homeName={editing.homeName}
          awayName={editing.awayName}
          current={editing.result}
          currentWalkover={editing.isWalkover}
        />
      ) : null}
    </div>
  );
}
