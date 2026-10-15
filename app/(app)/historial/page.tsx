import { ExternalLink, History, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { z } from "zod";
import { HistoryFilters } from "@/components/history/history-filters";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Badge } from "@/components/ui/badge";
import { FinishedTournamentsView } from "@/components/tournaments/finished-tournaments-view";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { type MyMatchRow, getMyMatches } from "@/lib/data/history";
import { listOrganizedTournaments } from "@/lib/data/tournaments";
import { formatInTimeZone } from "@/lib/dates";
import { type Outcome, computePlayerStats, filterHistory } from "@/lib/domain/stats";

export const metadata: Metadata = { title: "Mi historial" };

const OUTCOME_PARAM = { ganados: "win", perdidos: "loss", empates: "draw" } as const satisfies Record<string, Outcome>;

/** Filtros desde la URL: lo inválido se ignora (no rompe la página). */
const filtersSchema = z.object({
  torneo: z.uuid().optional().catch(undefined),
  deporte: z
    .string()
    .regex(/^[a-z0-9]+(-[a-z0-9]+)*$/)
    .max(40)
    .optional()
    .catch(undefined),
  resultado: z.enum(["ganados", "perdidos", "empates"]).optional().catch(undefined),
});

const OUTCOME_BADGE = {
  win: { label: "Ganado", className: "bg-emerald-100 text-emerald-900" },
  loss: { label: "Perdido", className: "bg-red-100 text-red-900" },
  draw: { label: "Empate", className: "bg-muted text-foreground" },
} as const;

/** Historial del participante: estadísticas y partidos con resultado, filtrables. */
export default async function HistoryPage({ searchParams }: PageProps<"/historial">) {
  const user = await getCurrentUser();
  if (!user) return null; // El layout ya redirige; esto solo acota el tipo.

  const filters = filtersSchema.parse(await searchParams);
  const [{ matches, championTournamentIds }, organized] = await Promise.all([
    getMyMatches(user.id),
    listOrganizedTournaments(user.id),
  ]);
  const played = matches.filter((m) => m.resultText !== null);
  const finishedOrganized = organized.filter((t) => t.status === "finished");

  if (played.length === 0) {
    if (finishedOrganized.length > 0) {
      return (
        <div className="space-y-6">
          <PageHeader
            title="Mi historial de torneos"
            description="Historial de competencias que organizaste y concluyeron exitosamente."
            actions={
              <Button asChild variant="outline" size="sm">
                <Link href="/torneos">Mis torneos</Link>
              </Button>
            }
          />
          <FinishedTournamentsView tournaments={finishedOrganized} />
        </div>
      );
    }

    return (
      <>
        <PageHeader title="Mi historial" description="Todos los partidos que jugaste, en cualquier torneo." />
        <EmptyState
          icon={History}
          title="Todavía no jugaste partidos"
          description="Tus resultados y estadísticas se van a ir armando a medida que juegues."
        />
      </>
    );
  }

  // Opciones de los filtros: solo torneos y deportes donde hay partidos jugados.
  const tournamentOptions = uniqueOptions(played.map((m) => ({ id: m.tournamentId, name: m.tournamentName })));
  const sportOptions = uniqueOptions(played.map((m) => ({ id: m.sportId, name: m.sportName })));

  // Las estadísticas respetan torneo y deporte, pero no el filtro de resultado
  // (si no, "Ganados" siempre daría 100 % de efectividad).
  const scope = filterHistory(played, { tournamentId: filters.torneo, sportId: filters.deporte });
  const scopeTournaments = new Set(scope.map((m) => m.tournamentId));
  const stats = computePlayerStats(
    scope,
    championTournamentIds.filter((id) => scopeTournaments.has(id)),
  );
  const list = filterHistory(scope, { outcome: filters.resultado ? OUTCOME_PARAM[filters.resultado] : undefined });
  const byTournament = groupByTournament(list);
  const champions = new Set(championTournamentIds);

  return (
    <>
      <PageHeader title="Mi historial" description="Todos los partidos que jugaste, en cualquier torneo." />
      <div className="space-y-6">
        {finishedOrganized.length > 0 ? (
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-border/80 bg-muted/40 p-4 shadow-xs">
            <div className="flex items-center gap-3">
              <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-amber-500/10 text-amber-600 dark:text-amber-400 border border-amber-500/20">
                <Trophy className="size-4" aria-hidden="true" />
              </div>
              <div>
                <p className="text-sm font-semibold text-foreground">
                  También tenés {finishedOrganized.length} {finishedOrganized.length === 1 ? "torneo organizado finalizado" : "torneos organizados finalizados"}
                </p>
                <p className="text-xs text-muted-foreground">
                  Consultá los campeones y estadísticas de las competencias que organizaste.
                </p>
              </div>
            </div>
            <Button asChild variant="outline" size="sm" className="text-xs shrink-0">
              <Link href="/torneos/historial">
                Ver torneos organizados
              </Link>
            </Button>
          </div>
        ) : null}

        <dl className="grid grid-cols-2 gap-3 sm:grid-cols-4">
          <Stat label="Partidos" value={stats.played} />
          <Stat label="Ganados" value={stats.won} detail={stats.drawn ? `${stats.drawn} empates` : undefined} />
          <Stat label="Perdidos" value={stats.lost} />
          <Stat label="Efectividad" value={`${stats.winRate.toLocaleString("es-AR")} %`} />
          <Stat label="Torneos" value={stats.tournaments} />
          <Stat label="Títulos" value={stats.titles} icon />
        </dl>

        <HistoryFilters
          tournaments={tournamentOptions}
          sports={sportOptions}
          values={{ torneo: filters.torneo, deporte: filters.deporte, resultado: filters.resultado }}
        />

        {byTournament.length === 0 ? (
          <p className="rounded-lg border border-dashed px-4 py-6 text-center text-sm text-muted-foreground" role="status">
            No hay partidos con esos filtros.
          </p>
        ) : (
          byTournament.map(({ first, items }) => (
            <section key={first.tournamentId} aria-labelledby={`torneo-${first.tournamentId}`} className="space-y-2">
              <div className="flex flex-wrap items-baseline justify-between gap-x-4 gap-y-1">
                <h2 id={`torneo-${first.tournamentId}`} className="flex items-center gap-2 text-lg font-semibold">
                  {champions.has(first.tournamentId) ? (
                    <Trophy className="size-4 text-amber-600" aria-label="Campeón" />
                  ) : null}
                  {first.tournamentName}
                </h2>
                {first.tournamentStatus !== "draft" ? (
                  <Link
                    href={`/t/${first.tournamentSlug}`}
                    className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
                  >
                    Ver torneo
                    <ExternalLink className="size-3.5" aria-hidden="true" />
                  </Link>
                ) : null}
              </div>
              <p className="text-sm text-muted-foreground">
                {first.sportName} · {first.myTeamName}
                {first.partners.length > 0 ? ` · con ${partnersLabel(first.partners)}` : null}
              </p>
              <ul className="divide-y rounded-lg border">
                {items.map((match) => (
                  <HistoryItem key={match.matchId} match={match} />
                ))}
              </ul>
            </section>
          ))
        )}
      </div>
    </>
  );
}

function HistoryItem({ match }: { match: MyMatchRow }) {
  const badge = match.outcome ? OUTCOME_BADGE[match.outcome] : null;
  return (
    <li className="flex items-center justify-between gap-3 px-3 py-2.5">
      <div className="min-w-0 space-y-0.5">
        <p className="text-xs text-muted-foreground">
          {match.stageLabel}
          {match.startsAt ? ` · ${formatInTimeZone(match.startsAt, match.timezone, "d/M/yyyy")}` : null}
        </p>
        <p className="truncate text-sm">vs {match.rivalName}</p>
      </div>
      <div className="flex shrink-0 flex-col items-end gap-1">
        <span className="text-sm font-medium tabular-nums">{match.resultText}</span>
        <span className="flex gap-1">
          {match.resultStatus === "provisional" || match.resultStatus === "disputed" ? (
            <Badge variant="outline">{match.resultStatus === "disputed" ? "Objetado" : "Sin confirmar"}</Badge>
          ) : null}
          {badge ? (
            <Badge variant="secondary" className={badge.className}>
              {badge.label}
            </Badge>
          ) : null}
        </span>
      </div>
    </li>
  );
}

function Stat({ label, value, detail, icon }: { label: string; value: number | string; detail?: string; icon?: boolean }) {
  return (
    <div className="rounded-lg border px-3 py-2.5">
      <dt className="text-xs text-muted-foreground">{label}</dt>
      <dd className="flex items-center gap-1.5 text-xl font-semibold tabular-nums">
        {icon ? <Trophy className="size-4 text-amber-600" aria-hidden="true" /> : null}
        {value}
      </dd>
      {detail ? <dd className="text-xs text-muted-foreground">{detail}</dd> : null}
    </div>
  );
}

/** "Juan", "Juan y Ana", "Juan, Ana y 8 más" (fútbol 11). */
function partnersLabel(names: string[]): string {
  if (names.length <= 2) return names.join(" y ");
  if (names.length === 3) return `${names[0]}, ${names[1]} y ${names[2]}`;
  return `${names[0]}, ${names[1]} y ${names.length - 2} más`;
}

function uniqueOptions(options: { id: string; name: string }[]): { id: string; name: string }[] {
  const byId = new Map(options.map((o) => [o.id, o]));
  return [...byId.values()].sort((a, b) => a.name.localeCompare(b.name, "es"));
}

/** Partidos agrupados por torneo; el torneo con el partido más reciente primero. */
function groupByTournament(matches: MyMatchRow[]): { first: MyMatchRow; items: MyMatchRow[] }[] {
  const sorted = [...matches].sort((a, b) => (b.startsAt ?? "").localeCompare(a.startsAt ?? ""));
  const groups = new Map<string, MyMatchRow[]>();
  for (const match of sorted) groups.set(match.tournamentId, [...(groups.get(match.tournamentId) ?? []), match]);
  return [...groups.values()].map((items) => ({ first: items[0] as MyMatchRow, items }));
}
