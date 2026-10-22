import { CalendarClock, Crown, Flag, LayoutGrid, MapPin, Network, Swords, Trophy } from "lucide-react";
import { BracketView } from "@/components/bracket/bracket-view";
import { StandingsTable } from "@/components/groups/standings-table";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { buildProjectedBracket, buildTeamSeedMap, cardsFromMatches } from "@/lib/competition-view";
import { formatInTimeZone } from "@/lib/dates";
import type { TournamentStatus } from "@/lib/domain/tournament-status";
import type { PlayerProgress } from "@/lib/player-progress";
import { cn } from "@/lib/utils";
import { PlayerStepper } from "./player-stepper";

type Props = {
  progress: PlayerProgress;
  tournamentStatus: TournamentStatus;
  timezone: string;
  teamNames: Map<string, string>;
  teamMembers: Map<string, string[]>;
  courtNames: Map<string, string>;
};

/** Mensaje principal según el momento del equipo en el torneo. */
function headline(progress: PlayerProgress): { title: string; detail: string; tone: "info" | "good" | "bad" | "gold" } {
  const { group, nextMatch } = progress;
  switch (progress.phase) {
    case "champion":
      return { title: "¡Campeones!", detail: "Ganaron el torneo. Queda en tu historial.", tone: "gold" };
    case "eliminated":
      return {
        title: "Quedaron afuera",
        detail: progress.eliminatedAt ? `La eliminación fue en ${progress.eliminatedAt}.` : "El torneo sigue sin ustedes.",
        tone: "bad",
      };
    case "finished":
      return { title: "Torneo terminado", detail: "Revisá los resultados en tu historial.", tone: "info" };
    case "registration":
      return {
        title: "Inscripción en curso",
        detail: "Cuando cierre la inscripción se sortean los grupos y se publican los horarios.",
        tone: "info",
      };
    case "playoffs":
      return {
        title: "Siguen en carrera",
        detail: nextMatch ? `Próximo cruce: ${nextMatch.label}.` : "Esperando el próximo cruce del cuadro.",
        tone: "good",
      };
    case "groups": {
      if (!group || group.position === null) {
        return { title: "Fase de grupos", detail: "Esperando el sorteo de las zonas.", tone: "info" };
      }
      const qualifying = group.position <= group.qualifiers;
      return {
        title: `Van ${group.position}° en ${group.group.name}`,
        detail: qualifying
          ? `Hoy están en zona de clasificación (pasan ${group.qualifiers}).`
          : `Pasan los primeros ${group.qualifiers}: todavía hay partidos para remontar.`,
        tone: qualifying ? "good" : "info",
      };
    }
  }
}

const TONES = {
  info: "border-sky-500/30 bg-sky-500/5 text-sky-900 dark:text-sky-200",
  good: "border-emerald-500/30 bg-emerald-500/5 text-emerald-900 dark:text-emerald-200",
  bad: "border-red-500/30 bg-red-500/5 text-red-900 dark:text-red-200",
  gold: "border-amber-500/40 bg-amber-500/10 text-amber-900 dark:text-amber-200",
} as const;

/**
 * Progreso del torneo para el jugador (D-122): etapa, situación del equipo,
 * récord, próximo partido, su zona y el cuadro (real o proyectado), todo de
 * solo lectura.
 */
export function PlayerProgressPanel({ progress, tournamentStatus, timezone, teamNames, teamMembers, courtNames }: Props) {
  const head = headline(progress);
  const { group, record, nextMatch } = progress;
  const HeadIcon = head.tone === "gold" ? Crown : head.tone === "bad" ? Flag : head.tone === "good" ? Trophy : LayoutGrid;

  const perGroup = progress.playoffConfig.qualifiersPerGroup;
  const hasBracket = progress.playoffMatches.length > 0;
  const projected =
    !hasBracket && progress.categoryGroups.length > 0 && tournamentStatus === "group_stage"
      ? buildProjectedBracket(
          progress.categoryGroups,
          progress.categoryMatches,
          progress.scoring,
          progress.standingsConfig,
          {
            thirdPlace: progress.playoffConfig.thirdPlace,
            qualifiersPerGroup: progress.categoryGroups.length === 1 && perGroup < 2 ? 2 : perGroup,
          },
          teamNames,
        )
      : null;

  return (
    <div className="space-y-6">
      <Card>
        <CardHeader className="space-y-3">
          <CardTitle>
            <h2 className="text-base font-semibold">Progreso del torneo</h2>
          </CardTitle>
          {progress.categoryName ? (
            <CardDescription>Categoría {progress.categoryName}</CardDescription>
          ) : null}
          <PlayerStepper status={tournamentStatus} />
        </CardHeader>
        <CardContent className="space-y-4">
          <div className={cn("flex items-start gap-3 rounded-xl border p-3.5", TONES[head.tone])} role="status">
            <HeadIcon className="mt-0.5 size-5 shrink-0" aria-hidden="true" />
            <div>
              <p className="font-semibold">{head.title}</p>
              <p className="text-sm opacity-90">{head.detail}</p>
            </div>
          </div>

          <dl className="grid gap-3 sm:grid-cols-3">
            <div className="rounded-xl border bg-muted/20 p-3">
              <dt className="text-xs font-medium text-muted-foreground">Zona</dt>
              <dd className="mt-1 text-sm">
                {group ? (
                  <>
                    <span className="font-semibold">{group.group.name}</span>
                    {group.position !== null ? (
                      <span className="text-muted-foreground">
                        {" "}
                        · {group.position}° de {group.rows.length}
                      </span>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">Sin sortear</span>
                )}
              </dd>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <dt className="text-xs font-medium text-muted-foreground">Récord</dt>
              <dd className="mt-1 text-sm tabular-nums">
                <span className="font-semibold">{record.played} PJ</span>
                <span className="text-muted-foreground">
                  {" "}
                  · {record.won} G · {record.lost} P{record.drawn > 0 ? ` · ${record.drawn} E` : ""}
                </span>
              </dd>
            </div>
            <div className="rounded-xl border bg-muted/20 p-3">
              <dt className="text-xs font-medium text-muted-foreground">Próximo partido</dt>
              <dd className="mt-1 space-y-0.5 text-sm">
                {nextMatch ? (
                  <>
                    <p className="flex items-center gap-1.5 font-semibold">
                      <Swords className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
                      vs {nextMatch.rivalName}
                    </p>
                    <p className="flex items-center gap-1 text-xs text-muted-foreground">
                      <CalendarClock className="size-3.5 shrink-0" aria-hidden="true" />
                      {nextMatch.match.startsAt
                        ? formatInTimeZone(nextMatch.match.startsAt, timezone, "EEEE d/M · HH:mm")
                        : "Horario a confirmar"}
                    </p>
                    {nextMatch.match.courtId && courtNames.get(nextMatch.match.courtId) ? (
                      <p className="flex items-center gap-1 text-xs text-muted-foreground">
                        <MapPin className="size-3.5 shrink-0" aria-hidden="true" />
                        {courtNames.get(nextMatch.match.courtId)}
                      </p>
                    ) : null}
                  </>
                ) : (
                  <span className="text-muted-foreground">Nada pendiente</span>
                )}
              </dd>
            </div>
          </dl>
        </CardContent>
      </Card>

      {group ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-base font-semibold">Mi zona</h2>
            </CardTitle>
            <CardDescription>Las filas resaltadas clasifican a playoffs.</CardDescription>
          </CardHeader>
          <CardContent>
            <StandingsTable
              title={group.group.name}
              rows={group.rows}
              teamNames={teamNames}
              teamMembers={teamMembers}
              scoringType={progress.scoring.type}
              qualifiers={group.qualifiers}
              matches={progress.categoryMatches}
              groupId={group.group.id}
            />
          </CardContent>
        </Card>
      ) : null}

      {hasBracket || (projected && projected.length > 0) ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="flex items-center gap-2 text-base font-semibold">
                <Network className="size-4 text-primary" aria-hidden="true" />
                Cuadro
              </h2>
            </CardTitle>
            {!hasBracket ? (
              <CardDescription>Proyectado con las posiciones actuales: puede cambiar hasta que terminen los grupos.</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <BracketView
              cards={
                hasBracket
                  ? cardsFromMatches(
                      progress.playoffMatches,
                      teamNames,
                      courtNames,
                      buildTeamSeedMap(
                        progress.categoryGroups,
                        progress.categoryMatches,
                        progress.scoring,
                        progress.standingsConfig,
                        perGroup,
                      ),
                    )
                  : (projected ?? [])
              }
              timezone={timezone}
            />
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
