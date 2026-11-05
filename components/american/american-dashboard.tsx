"use client";

import { Award, CalendarDays, CheckCircle2, Clock, Flame, Sparkles, Target, Trophy, Users } from "lucide-react";
import { useState } from "react";
import type { AmericanMatch, AmericanParticipant, AmericanStandingRow } from "@/lib/data/american";
import type { PaymentConfig } from "@/lib/domain/payment";
import type { AmericanConfig } from "@/lib/validation/tournament";
import { cn } from "@/lib/utils";
import { AmericanMatchesBoard } from "./american-matches-board";
import { AmericanParticipantsManager } from "./american-participants-manager";
import { AmericanStandingsTable } from "./american-standings-table";

type TabKey = "matches" | "standings" | "participants";

export function AmericanDashboard({
  tournamentId,
  tournamentName,
  inviteCode,
  config,
  participants,
  matches,
  standings,
  readOnly = false,
  paymentConfig,
}: {
  tournamentId: string;
  tournamentName: string;
  inviteCode?: string | null;
  config: AmericanConfig | null;
  participants: AmericanParticipant[];
  matches: AmericanMatch[];
  standings: AmericanStandingRow[];
  readOnly?: boolean;
  paymentConfig?: PaymentConfig | null;
}) {
  const isIndividual = (config?.format ?? "INDIVIDUAL_ROTATIVO") === "INDIVIDUAL_ROTATIVO";
  const scoringMode = config?.scoringMode ?? "fixed_points";
  const targetPoints = config?.targetPoints ?? 24;
  const roundDurationMinutes = config?.roundDurationMinutes ?? 20;

  // Si ya hay partidos generados, la pestaña por defecto es partidos; si no, participantes.
  const [activeTab, setActiveTab] = useState<TabKey>(matches.length > 0 ? "matches" : "participants");

  const completedMatches = matches.filter((m) => m.status === "completed").length;
  const progressPct = matches.length > 0 ? Math.round((completedMatches / matches.length) * 100) : 0;

  return (
    <div className="space-y-6">
      {/* Banner Resumen del Torneo Americano */}
      <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4 sm:p-5 shadow-xs space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
                <Trophy className="size-4" />
              </span>
              <h2 className="text-lg font-extrabold tracking-tight text-foreground">
                {readOnly ? "Torneo Americano de Pádel" : "Panel del Torneo Americano"}
              </h2>
              <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/15 px-2.5 py-0.5 text-xs font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/30">
                <Sparkles className="size-3" />
                {isIndividual ? "Individual Rotativo" : "Parejas Fijas"}
              </span>
            </div>
            <p className="text-xs text-muted-foreground leading-relaxed">
              {readOnly
                ? isIndividual
                  ? "Formato individual rotativo: en cada ronda cambiás de compañero y sumás tus puntos en la tabla en vivo."
                  : "Formato parejas fijas: compiten las duplas entre sí acumulando puntos."
                : isIndividual
                  ? "Cada jugador suma puntos individuales y rota de compañero y rivales en cada ronda."
                  : "Duplas fijas predefinidas que compiten en formato todos contra todos."}
            </p>
          </div>

          <div className="flex items-center gap-3 text-xs shrink-0">
            <div className="rounded-xl border border-border/80 bg-card px-3 py-1.5 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Puntuación</span>
              <span className="font-semibold text-foreground">
                {scoringMode === "fixed_points"
                  ? `A ${targetPoints} pts`
                  : scoringMode === "timed_round"
                    ? `${roundDurationMinutes} min / ronda`
                    : "A 1 set (Dif. games)"}
              </span>
            </div>

            <div className="rounded-xl border border-border/80 bg-card px-3 py-1.5 text-center">
              <span className="text-[10px] uppercase font-bold text-muted-foreground block">Progreso</span>
              <span className="font-semibold text-emerald-600 dark:text-emerald-400">
                {completedMatches} / {matches.length} jugados
              </span>
            </div>
          </div>
        </div>

        {/* Barra de progreso de partidos */}
        {matches.length > 0 && (
          <div className="space-y-1.5 pt-1 border-t border-emerald-500/20">
            <div className="flex items-center justify-between text-xs text-muted-foreground">
              <span>Partidos de la jornada</span>
              <span className="font-semibold text-foreground">{progressPct}% completado</span>
            </div>
            <div className="h-2 w-full overflow-hidden rounded-full bg-muted">
              <div
                className="h-full bg-emerald-500 transition-all duration-300 ease-out"
                style={{ width: `${progressPct}%` }}
              />
            </div>
          </div>
        )}
      </div>

      {/* Navegación por pestañas */}
      <div className="flex items-center gap-1.5 border-b border-border/80 overflow-x-auto [scrollbar-width:none]">
        <button
          type="button"
          onClick={() => setActiveTab("matches")}
          className={cn(
            "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors cursor-pointer",
            activeTab === "matches"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Trophy className="size-4" />
          <span>Partidos y Marcadores</span>
          {matches.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground">
              {matches.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("standings")}
          className={cn(
            "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors cursor-pointer",
            activeTab === "standings"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Award className="size-4" />
          <span>Tabla de Posiciones</span>
          {standings.length > 0 && (
            <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground">
              {standings.length}
            </span>
          )}
        </button>

        <button
          type="button"
          onClick={() => setActiveTab("participants")}
          className={cn(
            "-mb-px inline-flex items-center gap-2 border-b-2 px-4 py-3 text-sm font-semibold transition-colors cursor-pointer",
            activeTab === "participants"
              ? "border-emerald-600 text-emerald-600 dark:text-emerald-400"
              : "border-transparent text-muted-foreground hover:text-foreground"
          )}
        >
          <Users className="size-4" />
          <span>Participantes</span>
          <span className="rounded-full bg-muted px-2 py-0.5 text-xs font-bold text-foreground">
            {participants.length}
          </span>
        </button>
      </div>

      {/* Contenido según pestaña activa */}
      {activeTab === "matches" && (
        <AmericanMatchesBoard
          tournamentId={tournamentId}
          matches={matches}
          scoringMode={scoringMode}
          targetPoints={scoringMode === "fixed_points" ? targetPoints : undefined}
          roundDurationMinutes={scoringMode === "timed_round" ? roundDurationMinutes : undefined}
          readOnly={readOnly}
        />
      )}

      {activeTab === "standings" && (
        <AmericanStandingsTable
          standings={standings}
          scoringMode={scoringMode}
        />
      )}

      {activeTab === "participants" && (
        <AmericanParticipantsManager
          tournamentId={tournamentId}
          inviteCode={inviteCode}
          participants={participants}
          isIndividual={isIndividual}
          targetCount={config?.participantCount || 12}
          targetRounds={config?.roundsCount || 5}
          hasMatches={matches.length > 0}
          readOnly={readOnly}
          paymentConfig={paymentConfig}
        />
      )}
    </div>
  );
}

