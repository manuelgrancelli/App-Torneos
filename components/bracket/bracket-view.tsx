import { Medal, Trophy } from "lucide-react";
import type { BracketCard } from "@/lib/competition-view";
import { formatInTimeZone } from "@/lib/dates";
import { roundName } from "@/lib/domain/bracket";
import { cn } from "@/lib/utils";

/**
 * Cuadro eliminatorio responsive: una columna por ronda. En mobile se desliza
 * en horizontal (con snap); los partidos de cada ronda se centran entre los
 * dos que los alimentan. Componente de presentación: sirve en servidor y cliente.
 */
export function BracketView({ cards, timezone }: { cards: BracketCard[]; timezone: string }) {
  const main = cards.filter((c) => !c.isThirdPlace);
  const third = cards.find((c) => c.isThirdPlace);
  const rounds = main.reduce((max, c) => Math.max(max, c.round), 0);
  const columns = Array.from({ length: rounds }, (_, i) =>
    main.filter((c) => c.round === i + 1).sort((a, b) => a.position - b.position),
  );

  return (
    <div className="-mx-4 overflow-x-auto scroll-px-4 px-4 pb-2 [scroll-snap-type:x_mandatory]" role="region" aria-label="Cuadro de playoffs" tabIndex={0}>
      <ol className="flex min-w-max gap-6">
        {columns.map((column, index) => {
          const round = index + 1;
          return (
            <li key={round} className="flex w-60 shrink-0 snap-start flex-col">
              <h3 className="mb-3 text-sm font-semibold">{roundName(round, rounds)}</h3>
              <ol className="flex flex-1 flex-col justify-around gap-4">
                {column.map((card) => (
                  <li key={card.key} className="relative">
                    <MatchCard card={card} timezone={timezone} final={round === rounds} />
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
                  <MatchCard card={third} timezone={timezone} final={false} />
                </div>
              ) : null}
            </li>
          );
        })}
      </ol>
    </div>
  );
}

function TeamLine({ team, placeholder }: { team: BracketCard["home"]; placeholder: string }) {
  return (
    <div className={cn("flex items-center gap-2 px-3 py-1.5 text-sm", team?.winner && "font-semibold")}>
      {team?.winner ? <Trophy className="size-3.5 shrink-0 text-amber-600" aria-label="Ganador" /> : null}
      <span className={cn("truncate", !team && "text-muted-foreground italic")}>{team?.name ?? placeholder}</span>
    </div>
  );
}

function MatchCard({ card, timezone, final }: { card: BracketCard; timezone: string; final: boolean }) {
  return (
    <div className={cn("overflow-hidden rounded-lg border bg-card", final && "border-foreground/40 shadow-sm")}>
      <TeamLine team={card.home} placeholder={card.isBye ? "Libre" : "A definir"} />
      <div className="border-t" />
      <TeamLine team={card.away} placeholder={card.isBye ? "Libre" : "A definir"} />
      {card.resultText || card.startsAt || card.isBye ? (
        <p className="border-t bg-muted/40 px-3 py-1 text-xs text-muted-foreground">
          {card.isBye
            ? "Pasa directo"
            : card.resultText
              ? card.resultText
              : card.startsAt
                ? `${formatInTimeZone(card.startsAt, timezone, "EEE d/M HH:mm")}${card.courtName ? ` · ${card.courtName}` : ""}`
                : null}
        </p>
      ) : null}
    </div>
  );
}
