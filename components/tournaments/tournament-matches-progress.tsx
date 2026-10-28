import { Trophy, Users, Swords } from "lucide-react";
import { Progress } from "@/components/ui/progress";
import type { TournamentCounts } from "@/lib/data/tournaments";
import type { TournamentStatus } from "@/lib/domain/tournament-status";

interface TournamentMatchesProgressProps {
  status: TournamentStatus;
  counts: TournamentCounts;
  maxTeams?: number;
}

export function TournamentMatchesProgress({
  status,
  counts,
  maxTeams = 0,
}: TournamentMatchesProgressProps) {
  // 1. Inscripciones (registration_open o draft)
  if (status === "draft" || status === "registration_open") {
    if (maxTeams <= 0) return null;
    const current = counts.approvedTeams;
    const pct = Math.min(100, Math.round((current / maxTeams) * 100));

    return (
      <div className="rounded-lg border border-border/60 bg-card/60 p-3 shadow-xs">
        <div className="flex items-center justify-between gap-2 text-xs font-medium mb-1.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Users className="size-3.5 text-primary" aria-hidden="true" />
            Cupos confirmados
          </span>
          <span className="tabular-nums font-semibold">
            {current} / {maxTeams}{" "}
            <span className="text-muted-foreground font-normal">({pct}%)</span>
          </span>
        </div>
        <Progress value={current} max={maxTeams} className="h-1.5" indicatorClassName="bg-blue-500" />
      </div>
    );
  }

  // 2. Fase de grupos
  if (status === "group_stage") {
    if (counts.groupMatches === 0) return null;
    const total = counts.groupMatches;
    const played = total - counts.pendingGroupMatches;
    const pct = Math.min(100, Math.round((played / total) * 100));

    return (
      <div className="rounded-lg border border-border/60 bg-card/60 p-3 shadow-xs">
        <div className="flex items-center justify-between gap-2 text-xs font-medium mb-1.5">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Swords className="size-3.5 text-amber-500" aria-hidden="true" />
            Avance de fase de grupos
          </span>
          <span className="tabular-nums font-semibold">
            {played} de {total} jugados{" "}
            <span className="text-muted-foreground font-normal">({pct}%)</span>
          </span>
        </div>
        <Progress
          value={played}
          max={total}
          className="h-1.5"
          indicatorClassName="bg-amber-500"
        />
      </div>
    );
  }

  // 3. Playoffs o Torneo finalizado
  if (status === "playoffs" || status === "finished") {
    const totalMatches = counts.groupMatches + counts.playoffMatches;
    const playedMatches =
      counts.groupMatches - counts.pendingGroupMatches + (counts.playoffMatches - counts.pendingPlayoffMatches);

    if (totalMatches === 0) return null;

    const playoffTotal = counts.playoffMatches;
    const playoffPlayed = playoffTotal - counts.pendingPlayoffMatches;
    const playoffPct = playoffTotal > 0 ? Math.min(100, Math.round((playoffPlayed / playoffTotal) * 100)) : 100;
    const totalPct = Math.min(100, Math.round((playedMatches / totalMatches) * 100));

    return (
      <div className="rounded-lg border border-border/60 bg-card/60 p-3 shadow-xs space-y-2">
        <div className="flex items-center justify-between gap-2 text-xs font-medium">
          <span className="flex items-center gap-1.5 text-muted-foreground">
            <Trophy className="size-3.5 text-amber-500" aria-hidden="true" />
            {status === "finished" ? "Torneo completado" : "Avance del cuadro eliminatorio"}
          </span>
          <span className="tabular-nums font-semibold">
            {playoffTotal > 0 ? (
              <>
                {playoffPlayed} de {playoffTotal} cruces{" "}
                <span className="text-muted-foreground font-normal">({playoffPct}%)</span>
              </>
            ) : (
              <>
                {playedMatches} de {totalMatches} partidos{" "}
                <span className="text-muted-foreground font-normal">({totalPct}%)</span>
              </>
            )}
          </span>
        </div>
        <Progress
          value={playoffTotal > 0 ? playoffPlayed : playedMatches}
          max={playoffTotal > 0 ? playoffTotal : totalMatches}
          className="h-1.5"
          indicatorClassName="bg-gradient-to-r from-amber-500 via-amber-400 to-yellow-400"
        />
      </div>
    );
  }

  return null;
}

