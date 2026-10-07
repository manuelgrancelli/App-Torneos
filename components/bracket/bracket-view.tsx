"use client";

import { ClipboardEdit, Medal, Trophy } from "lucide-react";
import { useState } from "react";
import { ResultDialog } from "@/components/matches/result-dialog";
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
 * Cuadro eliminatorio responsive: una columna por ronda. En mobile se desliza
 * en horizontal (con snap); los partidos de cada ronda se centran entre los
 * dos que los alimentan.
 * Permite cargar y editar resultados directamente desde cada cruce del cuadro.
 */
export function BracketView({ cards, timezone, scoring, tournamentId, canEdit = false }: BracketViewProps) {
  const [scoringMatch, setScoringMatch] = useState<BracketCard | null>(null);

  const main = cards.filter((c) => !c.isThirdPlace);
  const third = cards.find((c) => c.isThirdPlace);
  const rounds = main.reduce((max, c) => Math.max(max, c.round), 0);
  const columns = Array.from({ length: rounds }, (_, i) =>
    main.filter((c) => c.round === i + 1).sort((a, b) => a.position - b.position),
  );

  return (
    <>
      <div
        className="-mx-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scroll-snap-type:x_mandatory]"
        role="region"
        aria-label="Cuadro de playoffs"
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
    </>
  );
}

function TeamLine({ team, placeholder }: { team: BracketCard["home"]; placeholder: string }) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 text-sm", team?.winner && "font-semibold")}>
      {team?.winner ? <Trophy className="size-3.5 shrink-0 text-amber-600" aria-label="Ganador" /> : null}
      {team?.seedBadge ? (
        <span className="shrink-0 rounded bg-muted/80 px-1.5 py-0.5 text-[10px] font-bold uppercase tracking-wider text-muted-foreground">
          {team.seedBadge}
        </span>
      ) : null}
      <span className={cn("truncate", !team && "text-muted-foreground italic", team?.isProvisional && "text-muted-foreground")}>
        {team?.name ?? placeholder}
      </span>
      {team?.isProvisional ? (
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

  return (
    <div
      className={cn(
        "overflow-hidden rounded-lg border bg-card transition-shadow shadow-2xs",
        final && "border-foreground/40 shadow-xs",
      )}
    >
      <TeamLine team={card.home} placeholder={card.isBye ? "Libre" : "A definir"} />
      <div className="border-t" />
      <TeamLine team={card.away} placeholder={card.isBye ? "Libre" : "A definir"} />

      <div className="flex min-h-8 items-center justify-between gap-2 border-t bg-muted/30 px-3 py-1.5 text-xs">
        {card.isBye ? (
          <span className="text-muted-foreground italic">Pasa directo (bye)</span>
        ) : (
          <>
            <div className="min-w-0 flex-1 truncate text-muted-foreground">
              {hasResult ? (
                <span className="font-semibold tabular-nums text-foreground">{card.resultText}</span>
              ) : card.startsAt ? (
                <span className="tabular-nums">
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
                  "h-6 shrink-0 px-2 text-[11px] font-medium",
                  hasResult && "text-muted-foreground hover:bg-muted hover:text-foreground",
                )}
              >
                {hasResult ? (
                  <>
                    <ClipboardEdit className="mr-1 size-3" aria-hidden="true" />
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
