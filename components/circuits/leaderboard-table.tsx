import { Award, Medal, Trophy, User } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { EmptyState } from "@/components/shared/empty-state";
import { type CircuitDateItem } from "@/lib/data/circuits";
import { ROUND_LABELS, type LeaderboardPlayer } from "@/lib/domain/circuits";

type LeaderboardTableProps = {
  leaderboard: LeaderboardPlayer[];
  dates: CircuitDateItem[];
};

export function LeaderboardTable({ leaderboard, dates }: LeaderboardTableProps) {
  if (leaderboard.length === 0) {
    return (
      <EmptyState
        icon={Trophy}
        title="Todavía no hay puntos en el ranking"
        description="A medida que vincules fechas al circuito y se jueguen los partidos, los jugadores sumarán puntos automáticamente según la fase alcanzada."
      />
    );
  }

  return (
    <div className="space-y-4">
      <div
        tabIndex={0}
        role="region"
        aria-label="Tabla general de posiciones del circuito"
        className="overflow-x-auto rounded-xl border bg-card focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
      >
        <table className="w-full text-left text-sm">
          <thead className="border-b bg-muted/40 text-xs text-muted-foreground uppercase">
            <tr>
              <th scope="col" className="px-4 py-3 text-center font-medium w-16">
                Pos
              </th>
              <th scope="col" className="px-4 py-3 font-medium">
                Jugador
              </th>
              <th scope="col" className="px-4 py-3 text-right font-medium">
                Puntos
              </th>
              <th scope="col" className="px-4 py-3 text-center font-medium">
                Títulos
              </th>
              <th scope="col" className="px-4 py-3 text-center font-medium">
                Fechas
              </th>
              {dates.map((date) => (
                <th key={date.id} scope="col" className="px-4 py-3 text-center font-medium whitespace-nowrap">
                  Fecha {date.circuitOrder}
                </th>
              ))}
            </tr>
          </thead>
          <tbody className="divide-y divide-border">
            {leaderboard.map((player) => {
              const isPodium = player.rank <= 3;
              return (
                <tr
                  key={player.playerId}
                  className="transition-colors hover:bg-muted/50"
                >
                  <td className="px-4 py-3.5 text-center font-bold">
                    {player.rank === 1 ? (
                      <span className="inline-flex size-7 items-center justify-center rounded-full bg-amber-500/15 text-amber-600 font-bold">
                        🥇 1
                      </span>
                    ) : player.rank === 2 ? (
                      <span className="inline-flex size-7 items-center justify-center rounded-full bg-slate-400/20 text-slate-600 font-bold">
                        🥈 2
                      </span>
                    ) : player.rank === 3 ? (
                      <span className="inline-flex size-7 items-center justify-center rounded-full bg-amber-700/15 text-amber-800 font-bold">
                        🥉 3
                      </span>
                    ) : (
                      <span className="text-muted-foreground">#{player.rank}</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 font-medium">
                    <div className="flex items-center gap-2">
                      <div className="flex size-7 items-center justify-center rounded-full bg-muted text-muted-foreground">
                        <User className="size-3.5" aria-hidden="true" />
                      </div>
                      <span className="font-semibold text-foreground">{player.playerName}</span>
                    </div>
                  </td>
                  <td className="px-4 py-3.5 text-right font-bold text-base tabular-nums text-primary">
                    {player.totalPoints}
                  </td>
                  <td className="px-4 py-3.5 text-center">
                    {player.titles > 0 ? (
                      <Badge variant="secondary" className="gap-1 font-bold">
                        <Trophy className="size-3 text-amber-500" aria-hidden="true" />
                        {player.titles}
                      </Badge>
                    ) : (
                      <span className="text-muted-foreground">-</span>
                    )}
                  </td>
                  <td className="px-4 py-3.5 text-center tabular-nums text-muted-foreground">
                    {player.tournamentsPlayed}
                  </td>
                  {dates.map((date) => {
                    const perf = player.performances.find((p) => p.tournamentId === date.id);
                    if (!perf) {
                      return (
                        <td key={date.id} className="px-4 py-3.5 text-center text-muted-foreground text-xs">
                          -
                        </td>
                      );
                    }
                    return (
                      <td key={date.id} className="px-4 py-3.5 text-center whitespace-nowrap">
                        <div className="flex flex-col items-center">
                          <span className="font-bold tabular-nums text-foreground">
                            {perf.points} pts
                          </span>
                          <span className="text-[11px] text-muted-foreground">
                            {ROUND_LABELS[perf.round] ?? perf.round}
                          </span>
                        </div>
                      </td>
                    );
                  })}
                </tr>
              );
            })}
          </tbody>
        </table>
      </div>
    </div>
  );
}
