"use client";

import { CalendarClock, CheckCheck, ClipboardEdit, Eraser, Lock, MoreVertical, TriangleAlert } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
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
import { formatInTimeZone, formatTimeRange } from "@/lib/dates";
import type { FixedAssignment } from "@/lib/domain/scheduler";
import type { BoardMatch } from "@/lib/competition-view";
import type { ScoringConfig } from "@/lib/domain/scoring";
import { cn } from "@/lib/utils";
import { AssignSlotDialog } from "./assign-slot-dialog";
import { ResultDialog } from "./result-dialog";


type Filter = "all" | "unscheduled" | "pending" | "disputed";

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
    <li className="flex items-start gap-3 px-3 py-3" data-testid="match-row">
      <div className="min-w-0 flex-1 space-y-1">
        <p className={cn("truncate text-sm", homeWon && "font-semibold")}>{match.homeName}</p>
        <p className={cn("truncate text-sm", awayWon && "font-semibold")}>{match.awayName}</p>
        <div className="flex flex-wrap items-center gap-x-3 gap-y-1 pt-1 text-xs text-muted-foreground">
          {match.startsAt && match.endsAt ? (
            <span className="inline-flex flex-wrap items-center gap-x-1">
              <CalendarClock className="size-3.5" aria-hidden="true" />
              <span className="whitespace-nowrap first-letter:uppercase">
                {formatInTimeZone(match.startsAt, timezone, "EEE d/M")}
              </span>
              <span className="whitespace-nowrap tabular-nums">{formatTimeRange(match.startsAt, match.endsAt, timezone)}</span>
              {match.courtName ? <span className="whitespace-nowrap">· {match.courtName}</span> : null}
              {match.scheduleLocked ? <Lock className="size-3" aria-label="Horario fijado a mano" /> : null}
            </span>
          ) : ready && !match.result ? (
            <Badge variant="secondary" className="bg-amber-100 text-amber-900">Sin horario</Badge>
          ) : null}
          {match.resultStatus === "provisional" ? <Badge variant="outline">A confirmar</Badge> : null}
          {match.resultStatus === "disputed" ? (
            <Badge variant="secondary" className="bg-red-100 text-red-900">
              <TriangleAlert aria-hidden="true" />
              Objetado
            </Badge>
          ) : null}
        </div>
        {match.disputes.map((comment, i) => (
          <p key={i} className="rounded bg-red-50 px-2 py-1 text-xs text-red-900">&quot;{comment}&quot;</p>
        ))}
      </div>
      <div className="flex shrink-0 items-start gap-1">
        <span className="pt-0.5 text-right text-sm font-medium tabular-nums">{match.resultText ?? "—"}</span>
        {canEdit && ready ? (
          <DropdownMenu>
            <DropdownMenuTrigger asChild>
              <Button variant="ghost" size="icon" aria-label={`Acciones: ${match.homeName} vs ${match.awayName}`}>
                <MoreVertical aria-hidden="true" />
              </Button>
            </DropdownMenuTrigger>
            <DropdownMenuContent align="end">
              <DropdownMenuItem onSelect={onResult}>
                <ClipboardEdit aria-hidden="true" />
                {match.result ? "Editar resultado" : "Cargar resultado"}
              </DropdownMenuItem>
              {!match.result ? (
                <DropdownMenuItem onSelect={onSchedule}>
                  <CalendarClock aria-hidden="true" />
                  {match.slotId ? "Cambiar horario" : "Asignar horario"}
                </DropdownMenuItem>
              ) : null}
              {match.result && match.resultStatus !== "confirmed" ? (
                <DropdownMenuItem onSelect={confirm}>
                  <CheckCheck aria-hidden="true" />
                  Confirmar resultado
                </DropdownMenuItem>
              ) : null}
              {match.result ? (
                <DropdownMenuItem variant="destructive" onSelect={onClear}>
                  <Eraser aria-hidden="true" />
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

  const visible = props.matches.filter((m) => matchesFilter(m, filter));
  const sections = [...new Set(visible.map((m) => m.section))];
  const counts = Object.fromEntries(FILTERS.map((f) => [f.value, props.matches.filter((m) => matchesFilter(m, f.value)).length]));

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
      <div role="tablist" aria-label="Filtrar partidos" className="flex flex-wrap gap-2">
        {FILTERS.map((f) => (
          <button
            key={f.value}
            type="button"
            role="tab"
            aria-selected={filter === f.value}
            onClick={() => setFilter(f.value)}
            className={cn(
              "inline-flex h-10 items-center gap-1 rounded-full border px-4 text-sm md:h-8",
              filter === f.value ? "border-foreground bg-foreground text-background" : "hover:bg-muted",
            )}
          >
            {f.label} <span className="tabular-nums opacity-70">{counts[f.value]}</span>
          </button>
        ))}
      </div>

      {visible.length === 0 ? (
        <EmptyState icon={CheckCheck} title="No hay partidos en esta vista" />
      ) : (
        <div className="grid gap-4 lg:grid-cols-2">
          {sections.map((section) => (
            <section key={section} aria-labelledby={`sec-${section}`} className="space-y-2">
              <h3 id={`sec-${section}`} className="text-sm font-semibold">
                {section}
              </h3>
              <ul className="divide-y rounded-lg border">
                {visible
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
              className="bg-destructive text-white hover:bg-destructive/90"
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
