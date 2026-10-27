import { Network } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BracketView } from "@/components/bracket/bracket-view";
import { ExportBracketImageModal } from "@/components/bracket/export-bracket-image-modal";
import { ScheduleBracketModal } from "@/components/bracket/schedule-bracket-modal";
import { CategoryTabs } from "@/components/categories/category-tabs";
import { MatchesBoard } from "@/components/matches/matches-board";
import { SimulateResultsButton } from "@/components/matches/simulate-results-button";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { EmptyState } from "@/components/shared/empty-state";
import {
  buildBoardMatches,
  buildProjectedBracket,
  buildTeamSeedMap,
  cardsFromMatches,
} from "@/lib/competition-view";
import { getCompetition, getSchedulingData } from "@/lib/data/competition";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { createClient } from "@/lib/supabase/server";
import { normalizePlayoffConfig } from "@/lib/domain/bracket";
import type { FixedAssignment } from "@/lib/domain/scheduler";
import { normalizeScoringConfig } from "@/lib/domain/scoring";
import { normalizeStandingsConfig } from "@/lib/domain/standings";
import { ensurePlayoffBracket } from "./actions";

export const metadata: Metadata = { title: "Cuadro" };

/** Cuadro de playoffs: cruces proyectados en grupos, armado automático y carga directa de resultados. */
export default async function BracketPage({
  params,
  searchParams,
}: PageProps<"/torneos/[id]/cuadro">) {
  const { id } = await params;
  const { cat } = await searchParams;
  const tournament = await requireOrganizerTournament(id);
  const supabase = await createClient();

  let [competition, scheduling] = await Promise.all([
    getCompetition(tournament.id),
    getSchedulingData(tournament.id),
  ]);

  const hasCategories = competition.categories.length > 0;
  const activeCategory = hasCategories
    ? competition.categories.find((c) => c.id === cat) ?? competition.categories[0]
    : null;

  const groupMatches = competition.matches.filter(
    (m) => (!activeCategory || m.categoryId === activeCategory.id) && m.stage === "group"
  );
  const allGroupMatchesFinished =
    groupMatches.length > 0 && groupMatches.every((m) => m.resultStatus !== null);
  const isPlayoffs = activeCategory
    ? activeCategory.status === "playoffs" || tournament.status === "playoffs" || allGroupMatchesFinished
    : tournament.status === "playoffs" || allGroupMatchesFinished;

  // Asegurar que el cuadro de playoffs exista en la base de datos siempre que haya grupos armados,
  // permitiendo al organizador programar sus horarios en cualquier momento (D-168).
  if (competition.groups.length > 0) {
    const res = await ensurePlayoffBracket(
      supabase,
      tournament.id,
      { ...(activeCategory ? { categoryId: activeCategory.id } : {}), revalidate: false }
    );
    if (res.ok && (res.count ?? 0) > 0) {
      competition = await getCompetition(tournament.id);
    }
  }

  const teamNames = new Map(competition.teams.map((t) => [t.id, t.name]));
  const courtNames = new Map(scheduling.courts.map((c) => [c.id, c.name]));

  const groups = competition.groups.filter(
    (g) => !activeCategory || g.categoryId === activeCategory.id
  );
  const categoryMatches = competition.matches.filter(
    (m) => !activeCategory || m.categoryId === activeCategory.id
  );
  const playoffMatches = categoryMatches.filter((m) => m.stage === "playoff");
  const playoffRounds = playoffMatches.filter((m) => !m.isThirdPlace).map((m) => m.round);
  const maxPlayoffRound = playoffRounds.length > 0 ? Math.max(...playoffRounds) : 0;
  const finalMatch = maxPlayoffRound > 0
    ? playoffMatches.find((m) => !m.isThirdPlace && m.round === maxPlayoffRound && m.winnerTeamId)
    : null;
  const championId = activeCategory?.championTeamId ?? tournament.championTeamId ?? finalMatch?.winnerTeamId;
  const champion = championId ? teamNames.get(championId) : null;

  const isTournamentStarted =
    tournament.status === "playoffs" ||
    tournament.status === "finished" ||
    competition.matches.some((m) => m.resultStatus !== null) ||
    (tournament.status === "group_stage" && competition.groups.length > 0);

  // Si no hay grupos creados todavía para esta categoría ni partidos de playoff
  if (groups.length === 0 && playoffMatches.length === 0) {
    return (
      <div className="space-y-6">
        {hasCategories ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-medium text-muted-foreground">Categoría seleccionada:</h2>
              {!isTournamentStarted ? (
                <Link
                  href={`/torneos/${tournament.id}/inscripciones`}
                  className="text-xs text-primary hover:underline font-medium"
                >
                  Ver categorías en Inscripciones
                </Link>
              ) : null}
            </div>
            <CategoryTabs
              categories={competition.categories.map((c) => ({
                id: c.id,
                name: c.name,
                status: c.status,
              }))}
              activeId={activeCategory?.id ?? null}
              baseUrl={`/torneos/${tournament.id}/cuadro`}
            />
          </div>
        ) : null}
        <EmptyState
          icon={Network}
          title="El cuadro se define al armar los grupos"
          description={
            hasCategories
              ? `Creá los grupos para la categoría "${activeCategory?.name}" para proyectar sus cruces.`
              : "Creá los grupos en la sección Grupos para ver cómo quedan proyectados los cruces de playoffs."
          }
        />
      </div>
    );
  }

  const hasPlayoffMatches = playoffMatches.length > 0;
  const categoryScoring = normalizeScoringConfig(activeCategory?.scoringConfig ?? tournament.scoringConfig);
  const categoryStandings = normalizeStandingsConfig(activeCategory?.standingsConfig ?? tournament.standingsConfig);
  const categoryPlayoff = normalizePlayoffConfig(activeCategory?.playoffConfig ?? tournament.playoffConfig);

  // Solo se pueden cargar resultados de playoffs cuando la fase de grupos esté concluida
  const canEditPlayoffs = hasPlayoffMatches && (groupMatches.length === 0 || allGroupMatchesFinished);

  const effectiveQualifiers =
    groups.length === 1 && categoryPlayoff.qualifiersPerGroup < 2
      ? 2
      : categoryPlayoff.qualifiersPerGroup;

  const seedMap = buildTeamSeedMap(
    groups,
    categoryMatches,
    categoryScoring,
    categoryStandings,
    effectiveQualifiers
  );

  const projectedCards = buildProjectedBracket(
    groups,
    categoryMatches,
    categoryScoring,
    categoryStandings,
    { ...categoryPlayoff, qualifiersPerGroup: effectiveQualifiers },
    teamNames
  );

  const cards = hasPlayoffMatches
    ? cardsFromMatches(playoffMatches, teamNames, courtNames, seedMap, activeCategory?.id, projectedCards)
    : projectedCards ?? [];

  const board = hasPlayoffMatches
    ? buildBoardMatches(playoffMatches, groups, teamNames, courtNames, competition.confirmations)
    : [];

  const scheduled: FixedAssignment[] = competition.matches
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
    <div className="space-y-6">
      {hasCategories ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">Categoría seleccionada:</h2>
            {!isTournamentStarted ? (
              <Link
                href={`/torneos/${tournament.id}/inscripciones`}
                className="text-xs text-primary hover:underline font-medium"
              >
                Ver categorías en Inscripciones
              </Link>
            ) : null}
          </div>
          <CategoryTabs
            categories={competition.categories.map((c) => ({
              id: c.id,
              name: c.name,
              status: c.status,
            }))}
            activeId={activeCategory?.id ?? null}
            baseUrl={`/torneos/${tournament.id}/cuadro`}
          />
        </div>
      ) : null}


      {tournament.isTest && isPlayoffs && !champion ? (
        <div className="flex flex-wrap items-center justify-between gap-3 rounded-xl border border-dashed border-primary/40 bg-muted/30 p-3.5">
          <p className="text-xs text-muted-foreground">
            <strong className="text-foreground">Modo prueba:</strong> podés simular automáticamente los cruces de playoffs hasta la final para coronar al campeón.
          </p>
          <SimulateResultsButton tournamentId={tournament.id} label="Simular playoffs completos" />
        </div>
      ) : null}

      <section aria-labelledby="cuadro" className="space-y-4">
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
          <div>
            <h2 id="cuadro" className="text-lg font-semibold">
              {hasPlayoffMatches ? "Cuadro de playoffs" : "Cruces proyectados"}{" "}
              {activeCategory ? `— ${activeCategory.name}` : ""}
            </h2>
            {hasPlayoffMatches && canEditPlayoffs ? (
              <p className="hidden text-xs text-muted-foreground sm:block">
                Cargá o editá resultados directamente en cada partido del cuadro.
              </p>
            ) : hasPlayoffMatches && !canEditPlayoffs ? (
              <p className="hidden text-xs text-amber-600 sm:block">
                Completá los resultados de la fase de grupos para habilitar la carga en playoffs.
              </p>
            ) : null}
          </div>
          <div className="flex flex-wrap items-center gap-2">
            {cards.length > 0 ? (
              <ScheduleBracketModal
                tournamentId={tournament.id}
                timezone={tournament.timezone}
                matches={(playoffMatches.length > 0 ? playoffMatches : cards).map((m: any) => {
                  const proj = projectedCards?.find(
                    (p) => p.round === m.round && p.position === m.position && p.isThirdPlace === m.isThirdPlace,
                  );
                  const home = m.homeTeamId
                    ? teamNames.get(m.homeTeamId) ?? "A definir"
                    : m.home?.name ?? proj?.home?.name ?? "A definir";
                  const away = m.awayTeamId
                    ? teamNames.get(m.awayTeamId) ?? "A definir"
                    : m.away?.name ?? proj?.away?.name ?? "A definir";
                  return {
                    id: m.id ?? m.matchId ?? m.key,
                    round: m.round,
                    position: m.position,
                    isThirdPlace: m.isThirdPlace,
                    homeName: home,
                    awayName: away,
                    startsAt: m.startsAt,
                    endsAt: m.endsAt,
                    courtId: m.courtId,
                    categoryName: activeCategory?.name,
                  };
                })}
                courts={scheduling.courts}
                tournamentDates={{
                  startsOn: tournament.startsOn,
                  endsOn: tournament.endsOn,
                }}
              />
            ) : null}
            {cards.length > 0 ? (
              <ExportBracketImageModal
                tournamentName={tournament.name}
                categoryName={activeCategory?.name}
                sportName={tournament.sport.name}
                cards={cards}
                champion={champion}
              />
            ) : null}
          </div>
        </div>
        <BracketView
          cards={cards}
          timezone={tournament.timezone}
          scoring={categoryScoring}
          tournamentId={tournament.id}
          canEdit={canEditPlayoffs}
          slots={scheduling.slots}
          courts={scheduling.courts}
          scheduled={scheduled}
          availability={scheduling.availability}
        />
      </section>

      {hasPlayoffMatches && board.length > 0 ? (
        <CollapsibleSection
          title={`Detalle de partidos y programación (${activeCategory ? activeCategory.name : "playoffs"})`}
          summary="Asigná canchas y horarios específicos para los partidos del cuadro."
          defaultOpen={false}
        >
          <MatchesBoard
            tournamentId={tournament.id}
            timezone={tournament.timezone}
            scoring={categoryScoring}
            matches={board}
            slots={scheduling.slots}
            courts={scheduling.courts}
            availability={scheduling.availability}
            canEdit={canEditPlayoffs}
          />
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
