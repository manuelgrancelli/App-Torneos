import { Network, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { BracketView } from "@/components/bracket/bracket-view";
import { CategoryTabs } from "@/components/categories/category-tabs";
import { MatchesBoard } from "@/components/matches/matches-board";
import { SimulateResultsButton } from "@/components/matches/simulate-results-button";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { EmptyState } from "@/components/shared/empty-state";
import { Badge } from "@/components/ui/badge";
import {
  buildBoardMatches,
  buildProjectedBracket,
  buildTeamSeedMap,
  cardsFromMatches,
} from "@/lib/competition-view";
import { getCompetition, getSchedulingData } from "@/lib/data/competition";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { createClient } from "@/lib/supabase/server";
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

  const [competition, scheduling] = await Promise.all([
    getCompetition(tournament.id),
    getSchedulingData(tournament.id),
  ]);

  const hasCategories = competition.categories.length > 0;
  const activeCategory = hasCategories
    ? competition.categories.find((c) => c.id === cat) ?? competition.categories[0]
    : null;

  // Si está en playoffs para esta categoría o el torneo general, asegurar el cuadro
  const isPlayoffs = activeCategory
    ? activeCategory.status === "playoffs" || tournament.status === "playoffs"
    : tournament.status === "playoffs";

  if (isPlayoffs) {
    await ensurePlayoffBracket(
      supabase,
      tournament.id,
      activeCategory ? { categoryId: activeCategory.id } : undefined
    );
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

  const championId = activeCategory?.championTeamId ?? tournament.championTeamId;
  const champion = championId ? teamNames.get(championId) : null;

  // Si no hay grupos creados todavía para esta categoría
  if (groups.length < 2) {
    return (
      <div className="space-y-6">
        {hasCategories ? (
          <div className="space-y-1">
            <div className="flex items-center justify-between gap-4">
              <h2 className="text-sm font-medium text-muted-foreground">Categoría seleccionada:</h2>
              <Link
                href={`/torneos/${tournament.id}/categorias`}
                className="text-xs text-primary hover:underline font-medium"
              >
                Gestionar categorías
              </Link>
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
  const seedMap = buildTeamSeedMap(
    groups,
    categoryMatches,
    tournament.scoringConfig,
    tournament.standingsConfig,
    tournament.playoffConfig.qualifiersPerGroup
  );

  const projectedCards = !hasPlayoffMatches
    ? buildProjectedBracket(
        groups,
        categoryMatches,
        tournament.scoringConfig,
        tournament.standingsConfig,
        tournament.playoffConfig,
        teamNames
      )
    : null;

  const cards = hasPlayoffMatches
    ? cardsFromMatches(playoffMatches, teamNames, courtNames, seedMap)
    : projectedCards ?? [];

  const board = hasPlayoffMatches
    ? buildBoardMatches(playoffMatches, groups, teamNames, courtNames, competition.confirmations)
    : [];

  return (
    <div className="space-y-6">
      {hasCategories ? (
        <div className="space-y-1">
          <div className="flex items-center justify-between gap-4">
            <h2 className="text-sm font-medium text-muted-foreground">Categoría seleccionada:</h2>
            <Link
              href={`/torneos/${tournament.id}/categorias`}
              className="text-xs text-primary hover:underline font-medium"
            >
              Gestionar categorías
            </Link>
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

      {champion ? (
        <p className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-medium text-amber-950">
          <Trophy className="size-5 text-amber-600" aria-hidden="true" />
          Campeón {activeCategory ? `(${activeCategory.name})` : ""}: {champion}
        </p>
      ) : null}

      {!hasPlayoffMatches ? (
        <div className="space-y-1.5 rounded-xl border bg-muted/40 p-4">
          <div className="flex items-center justify-between gap-2">
            <h2 className="text-base font-semibold">
              Cuadro de playoffs proyectado {activeCategory ? `— ${activeCategory.name}` : ""}
            </h2>
            <Badge variant="secondary" className="text-xs">
              Fase de grupos
            </Badge>
          </div>
          <p className="text-xs text-muted-foreground">
            Los cruces quedan definidos por las posiciones de grupo (ej. 1°A vs 2°B). Las parejas se actualizan automáticamente en tiempo real a medida que se cargan los resultados de la fase de grupos.
          </p>
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

      <section aria-labelledby="cuadro" className="space-y-3">
        <div className="flex items-center justify-between gap-2">
          <h2 id="cuadro" className="text-lg font-semibold">
            {hasPlayoffMatches ? "Cuadro de playoffs" : "Cruces proyectados"}{" "}
            {activeCategory ? `— ${activeCategory.name}` : ""}
          </h2>
          {hasPlayoffMatches && isPlayoffs ? (
            <p className="hidden text-xs text-muted-foreground sm:block">
              Cargá o editá resultados directamente en cada partido del cuadro.
            </p>
          ) : null}
        </div>
        <BracketView
          cards={cards}
          timezone={tournament.timezone}
          scoring={activeCategory?.scoringConfig ?? tournament.scoringConfig}
          tournamentId={tournament.id}
          canEdit={isPlayoffs}
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
            scoring={tournament.scoringConfig}
            matches={board}
            slots={scheduling.slots}
            courts={scheduling.courts}
            availability={scheduling.availability}
            canEdit={isPlayoffs}
          />
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
