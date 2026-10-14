import { CheckCircle2, Clock, Trophy, Users } from "lucide-react";
import type { ParticipationItem, TournamentListItem } from "@/lib/data/tournaments";
import { cn } from "@/lib/utils";

interface TournamentStatsSummaryProps {
  organized: TournamentListItem[];
  participations: ParticipationItem[];
}

/**
 * Resumen de métricas de torneos (KPIs) para "Mi perfil".
 * Muestra el total de torneos organizados (y activos), participaciones y estado de pendientes.
 */
export function TournamentStatsSummary({
  organized,
  participations,
}: TournamentStatsSummaryProps) {
  const activeOrganized = organized.filter((t) =>
    ["registration_open", "group_stage", "playoffs"].includes(t.status)
  ).length;

  const totalPendingReviews = organized.reduce(
    (sum, t) => sum + (t.pendingTeams || 0),
    0
  );

  const approvedParticipations = participations.filter(
    (p) => p.teamStatus === "approved"
  ).length;

  return (
    <div className="space-y-4">
      <div className="space-y-1">
        <h2 className="text-xl font-semibold tracking-tight text-foreground flex items-center gap-2">
          <Trophy className="size-5 text-primary" aria-hidden="true" />
          Mis torneos
        </h2>
        <p className="text-sm text-muted-foreground">
          Tus competencias organizadas y los torneos donde participás como jugador.
        </p>
      </div>

      <div className="grid grid-cols-1 gap-3 sm:grid-cols-3">
        {/* KPI 1: Organizador */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-2xs transition-all hover:border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Torneos que organizo
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-primary/10 text-primary">
              <Trophy className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight font-mono tabular-nums">
              {organized.length}
            </span>
            {activeOrganized > 0 ? (
              <span className="text-xs font-medium text-emerald-600 dark:text-emerald-400">
                {activeOrganized} en juego / abiertas
              </span>
            ) : (
              <span className="text-xs text-muted-foreground">En preparación</span>
            )}
          </div>
        </div>

        {/* KPI 2: Participante */}
        <div className="relative overflow-hidden rounded-2xl border border-border/80 bg-card p-4 shadow-2xs transition-all hover:border-border">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Torneos donde juego
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-sky-500/10 text-sky-600 dark:text-sky-400">
              <Users className="size-4" aria-hidden="true" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight font-mono tabular-nums">
              {participations.length}
            </span>
            <span className="text-xs font-medium text-muted-foreground">
              {approvedParticipations} activas
            </span>
          </div>
        </div>

        {/* KPI 3: Atención Requerida */}
        <div
          className={cn(
            "relative overflow-hidden rounded-2xl border p-4 shadow-2xs transition-all",
            totalPendingReviews > 0
              ? "border-amber-500/30 bg-amber-500/5 text-amber-950 dark:text-amber-200"
              : "border-border/80 bg-card"
          )}
        >
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium text-muted-foreground">
              Atención requerida
            </span>
            <div
              className={cn(
                "flex size-7 items-center justify-center rounded-lg",
                totalPendingReviews > 0
                  ? "bg-amber-500/20 text-amber-700 dark:text-amber-300"
                  : "bg-emerald-500/10 text-emerald-600 dark:text-emerald-400"
              )}
            >
              {totalPendingReviews > 0 ? (
                <Clock className="size-4" aria-hidden="true" />
              ) : (
                <CheckCircle2 className="size-4" aria-hidden="true" />
              )}
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            {totalPendingReviews > 0 ? (
              <>
                <span className="text-2xl font-bold tracking-tight font-mono tabular-nums text-amber-700 dark:text-amber-400">
                  {totalPendingReviews}
                </span>
                <span className="text-xs font-medium text-amber-700 dark:text-amber-400">
                  {totalPendingReviews === 1
                    ? "pareja por aprobar"
                    : "parejas por aprobar"}
                </span>
              </>
            ) : (
              <>
                <span className="text-sm font-semibold text-emerald-700 dark:text-emerald-400">
                  Todo al día
                </span>
                <span className="text-xs text-muted-foreground">Sin pendientes</span>
              </>
            )}
          </div>
        </div>
      </div>
    </div>
  );
}
