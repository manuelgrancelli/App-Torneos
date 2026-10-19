"use client";

import { ClipboardEdit, List, Medal, Network, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { TrophyLogo } from "@/components/brand/trophy-logo";
import { ResultDialog } from "@/components/matches/result-dialog";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import type { BracketCard } from "@/lib/competition-view";
import { formatInTimeZone } from "@/lib/dates";
import { roundName } from "@/lib/domain/bracket";
import type { ScoringConfig } from "@/lib/domain/scoring";
import { cn } from "@/lib/utils";

export type BracketViewProps = {
  cards: BracketCard[];
  timezone: string;
  scoring?: ScoringConfig;
  tournamentId?: string;
  canEdit?: boolean;
};

/**
 * Cuadro eliminatorio con navegación vertical-first:
 * - Vista vertical (por defecto): muestra las rondas en un diseño 100% vertical
 *   y responsive, sin necesidad de realizar movimientos ni desplazamientos laterales.
 * - Vista árbol: diagrama horizontal clásico para quien prefiera visualizar el árbol completo.
 * Permite cargar y editar resultados directamente desde cada cruce del cuadro.
 */
export function BracketView({ cards, timezone, scoring, tournamentId, canEdit = false }: BracketViewProps) {
  const [scoringMatch, setScoringMatch] = useState<BracketCard | null>(null);
  const [viewMode, setViewMode] = useState<"vertical" | "diagram">("vertical");
  const [selectedRound, setSelectedRound] = useState<"all" | number>("all");

  const main = useMemo(() => cards.filter((c) => !c.isThirdPlace), [cards]);
  const third = useMemo(() => cards.find((c) => c.isThirdPlace), [cards]);
  const rounds = useMemo(() => main.reduce((max, c) => Math.max(max, c.round), 0), [main]);

  const columns = useMemo(
    () =>
      Array.from({ length: rounds }, (_, i) =>
        main.filter((c) => c.round === i + 1).sort((a, b) => a.position - b.position),
      ),
    [main, rounds],
  );

  const visibleRounds = useMemo(() => {
    if (selectedRound === "all") {
      return columns.map((colCards, index) => ({
        round: index + 1,
        cards: colCards,
      }));
    }
    const idx = selectedRound - 1;
    return columns[idx] ? [{ round: selectedRound, cards: columns[idx] }] : [];
  }, [columns, selectedRound]);

  return (
    <div className="space-y-4" role="region" aria-label="Cuadro de playoffs">
      {/* Controles superiores: filtro de rondas y selector de vista */}
      {rounds > 0 ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          {/* Pestañas de rondas (envolvemos con flex-wrap para evitar scroll horizontal) */}
          <div
            role="tablist"
            aria-label="Rondas del cuadro"
            className="flex flex-wrap items-center gap-1.5"
          >
            <button
              type="button"
              role="tab"
              aria-selected={selectedRound === "all"}
              onClick={() => setSelectedRound("all")}
              className={cn(
                "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
                selectedRound === "all"
                  ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                  : "border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
              )}
            >
              Todas las rondas ({main.length})
            </button>
            {columns.map((col, index) => {
              const r = index + 1;
              const isSelected = selectedRound === r;
              return (
                <button
                  key={r}
                  type="button"
                  role="tab"
                  aria-selected={isSelected}
                  onClick={() => setSelectedRound(r)}
                  className={cn(
                    "inline-flex h-8 items-center rounded-full border px-3 text-xs font-medium transition-colors",
                    isSelected
                      ? "border-primary bg-primary text-primary-foreground font-semibold shadow-xs"
                      : "border-border/80 bg-card text-muted-foreground hover:bg-muted hover:text-foreground",
                  )}
                >
                  {roundName(r, rounds)} ({col.length})
                </button>
              );
            })}
          </div>

          {/* Selector de modo: Vertical (sin scroll horizontal) vs Árbol */}
          <div className="flex items-center gap-1 rounded-lg border bg-muted/40 p-1 text-xs shrink-0 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => setViewMode("vertical")}
              aria-pressed={viewMode === "vertical"}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 font-medium transition-all",
                viewMode === "vertical"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <List className="size-3.5" aria-hidden="true" />
              Vista vertical
            </button>
            <button
              type="button"
              onClick={() => setViewMode("diagram")}
              aria-pressed={viewMode === "diagram"}
              className={cn(
                "inline-flex h-7 items-center gap-1.5 rounded-md px-2.5 font-medium transition-all",
                viewMode === "diagram"
                  ? "bg-background text-foreground shadow-xs font-semibold"
                  : "text-muted-foreground hover:text-foreground",
              )}
            >
              <Network className="size-3.5" aria-hidden="true" />
              Árbol
            </button>
          </div>
        </div>
      ) : null}

      {/* 1. Vista vertical (por defecto): 100% vertical, sin scroll horizontal */}
      {viewMode === "vertical" ? (
        <div className="space-y-6">
          {visibleRounds.map(({ round, cards: roundCards }) => {
            const isFinalRound = round === rounds;
            return (
              <section key={round} className="space-y-3">
                <div className="flex items-center justify-between border-b border-border/80 pb-2">
                  <h3 className="text-sm font-bold text-foreground flex items-center gap-2">
                    <span className="size-2 rounded-full bg-primary" />
                    {roundName(round, rounds)}
                  </h3>
                  <Badge variant="secondary" className="text-xs font-normal">
                    {roundCards.length} {roundCards.length === 1 ? "partido" : "partidos"}
                  </Badge>
                </div>

                <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                  {roundCards.map((card) => (
                    <MatchCard
                      key={card.key}
                      card={card}
                      timezone={timezone}
                      final={isFinalRound}
                      canEdit={canEdit}
                      onScore={(c) => setScoringMatch(c)}
                    />
                  ))}
                </div>

                {isFinalRound && third && (selectedRound === "all" || selectedRound === rounds) ? (
                  <div className="mt-4 space-y-3 pt-2">
                    <div className="flex items-center justify-between border-b border-border/60 pb-1.5">
                      <h4 className="flex items-center gap-1.5 text-xs font-bold text-muted-foreground">
                        <Medal className="size-4 text-amber-600" aria-hidden="true" />
                        Partido por el 3er puesto
                      </h4>
                    </div>
                    <div className="grid grid-cols-1 md:grid-cols-2 xl:grid-cols-3 gap-3">
                      <MatchCard
                        card={third}
                        timezone={timezone}
                        final={false}
                        canEdit={canEdit}
                        onScore={(c) => setScoringMatch(c)}
                      />
                    </div>
                  </div>
                ) : null}
              </section>
            );
          })}
        </div>
      ) : (
        /* 2. Vista árbol (diagrama horizontal tradicional con conectores) */
        <div
          className="-mx-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scroll-snap-type:x_mandatory]"
          tabIndex={0}
        >
          <ol className="flex min-w-max gap-6">
            {columns.map((column, index) => {
              const round = index + 1;
              return (
                <li key={round} className="flex w-64 shrink-0 snap-start flex-col">
                  <h3 className="mb-3 text-sm font-semibold">{roundName(round, rounds)}</h3>
                  <ol className="flex flex-1 flex-col justify-around gap-4">
                    {column.map((card) => (
                      <li key={card.key} className="relative">
                        <MatchCard
                          card={card}
                          timezone={timezone}
                          final={round === rounds}
                          canEdit={canEdit}
                          onScore={(c) => setScoringMatch(c)}
                        />
                        {/* Conector hacia el partido siguiente. */}
                        {round < rounds ? (
                          <span aria-hidden="true" className="absolute top-1/2 -right-6 h-px w-6 bg-border" />
                        ) : null}
                      </li>
                    ))}
                  </ol>
                  {round === rounds && third ? (
                    <div className="mt-6 space-y-2">
                      <h3 className="flex items-center gap-1 text-sm font-semibold">
                        <Medal className="size-4" aria-hidden="true" />
                        3er puesto
                      </h3>
                      <MatchCard
                        card={third}
                        timezone={timezone}
                        final={false}
                        canEdit={canEdit}
                        onScore={(c) => setScoringMatch(c)}
                      />
                    </div>
                  ) : null}
                </li>
              );
            })}
          </ol>
        </div>
      )}

      {scoringMatch && scoringMatch.matchId && scoring && tournamentId ? (
        <ResultDialog
          open={Boolean(scoringMatch)}
          onOpenChange={(open) => {
            if (!open) setScoringMatch(null);
          }}
          tournamentId={tournamentId}
          matchId={scoringMatch.matchId}
          stage="playoff"
          round={scoringMatch.round}
          totalRounds={rounds}
          isThirdPlace={scoringMatch.isThirdPlace}
          scoring={scoring}
          homeName={scoringMatch.home?.name ?? "Local"}
          awayName={scoringMatch.away?.name ?? "Visitante"}
          current={scoringMatch.result ?? null}
          currentWalkover={Boolean(scoringMatch.isWalkover)}
        />
      ) : null}
    </div>
  );
}

function TeamLine({
  team,
  placeholder,
  isFinal,
}: {
  team: BracketCard["home"];
  placeholder: string;
  isFinal?: boolean;
}) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-2 text-sm", team?.winner && "font-semibold")}>
      {team?.winner ? (
        <Trophy
          className={cn("size-3.5 shrink-0", isFinal ? "text-amber-500 fill-amber-500" : "text-amber-600")}
          aria-label={isFinal ? "Campeón" : "Ganador"}
        />
      ) : null}
      {team?.seedBadge ? (
        <span className="shrink-0 rounded bg-muted/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {team.seedBadge}
        </span>
      ) : null}
      <span
        className={cn(
          "truncate min-w-0 flex-1",
          !team && "text-muted-foreground italic",
          team?.isProvisional && "text-muted-foreground",
          isFinal && team?.winner && "text-amber-600 dark:text-amber-400 font-bold",
        )}
      >
        {team?.name ?? placeholder}
      </span>
      {isFinal && team?.winner ? (
        <span className="shrink-0 rounded-full bg-amber-500/15 text-amber-600 dark:text-amber-400 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider">
          Campeón
        </span>
      ) : team?.isProvisional ? (
        <span className="ml-auto shrink-0 text-[10px] italic text-muted-foreground">prov.</span>
      ) : null}
    </div>
  );
}

function MatchCard({
  card,
  timezone,
  final,
  canEdit,
  onScore,
}: {
  card: BracketCard;
  timezone: string;
  final: boolean;
  canEdit?: boolean;
  onScore?: (card: BracketCard) => void;
}) {
  const hasResult = Boolean(card.resultText);
  const canScore = Boolean(canEdit && card.canScore && onScore && card.matchId);
  const isFinalMatch = final && !card.isThirdPlace;

  return (
    <div
      className={cn(
        "overflow-hidden rounded-xl border bg-card transition-all shadow-xs",
        isFinalMatch
          ? "border-amber-500/50 ring-1 ring-amber-500/30 shadow-md shadow-amber-500/10"
          : final
            ? "border-foreground/50 ring-1 ring-foreground/20"
            : "",
      )}
    >
      <div
        className={cn(
          "flex items-center justify-between px-3 py-1 border-b text-[10px] font-medium",
          isFinalMatch
            ? "bg-amber-500/10 border-amber-500/20 text-amber-700 dark:text-amber-300"
            : "bg-muted/20 border-b text-muted-foreground",
        )}
      >
        <span className={cn(isFinalMatch && "font-semibold text-foreground")}>
          {card.isThirdPlace ? "3er puesto" : `Cruce ${card.position + 1}`}
        </span>
        {isFinalMatch ? (
          <span className="flex items-center gap-1 font-bold text-amber-600 dark:text-amber-400">
            ★ Final
          </span>
        ) : null}
      </div>

      <div className="relative flex items-center">
        <div className="min-w-0 flex-1">
          <TeamLine team={card.home} placeholder={card.isBye ? "Libre" : "A definir"} isFinal={isFinalMatch} />
          <div className="border-t" />
          <TeamLine team={card.away} placeholder={card.isBye ? "Libre" : "A definir"} isFinal={isFinalMatch} />
        </div>

        {isFinalMatch ? (
          <div
            className="flex shrink-0 items-center justify-center pr-3 pl-1"
            title="Trofeo de Campeón"
            aria-label="Trofeo de Campeón"
          >
            <TrophyLogo
              size="lg"
              rounded="full"
              className="size-11 shadow-md shadow-amber-500/35 ring-2 ring-amber-400/80 dark:ring-amber-300/70 hover:scale-110 transition-transform duration-300"
            />
          </div>
        ) : null}
      </div>

      <div className="flex min-h-8 items-center justify-between gap-2 border-t bg-muted/30 px-3 py-1.5 text-xs">
        {card.isBye ? (
          <span className="text-muted-foreground italic text-xs">Pasa directo (bye)</span>
        ) : (
          <>
            <div className="min-w-0 flex-1 truncate text-muted-foreground">
              {hasResult ? (
                <span className="font-semibold tabular-nums text-foreground">{card.resultText}</span>
              ) : card.startsAt ? (
                <span className="tabular-nums font-medium text-foreground">
                  {formatInTimeZone(card.startsAt, timezone, "EEE d/M HH:mm")}
                  {card.courtName ? ` · ${card.courtName}` : ""}
                </span>
              ) : (
                <span className="text-[11px] text-muted-foreground">Sin horario</span>
              )}
            </div>

            {canScore ? (
              <Button
                type="button"
                variant={hasResult ? "ghost" : "default"}
                size="sm"
                onClick={() => onScore?.(card)}
                className={cn(
                  "h-7 shrink-0 px-2.5 text-xs font-semibold",
                  hasResult && "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {hasResult ? (
                  <>
                    <ClipboardEdit className="mr-1 size-3.5" aria-hidden="true" />
                    Editar
                  </>
                ) : (
                  "Cargar resultado"
                )}
              </Button>
            ) : null}
          </>
        )}
      </div>
    </div>
  );
}
