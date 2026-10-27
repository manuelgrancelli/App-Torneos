import { CalendarDays, LayoutGrid, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { notFound } from "next/navigation";
import { BracketView } from "@/components/bracket/bracket-view";
import { CategoryTabs } from "@/components/categories/category-tabs";
import { StandingsTable } from "@/components/groups/standings-table";
import { type FixtureItem, PublicFixture } from "@/components/public/public-fixture";
import { ViewTabs } from "@/components/public/view-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, SportBadge } from "@/components/tournaments/status-badge";
import { TournamentBanner } from "@/components/tournaments/tournament-banner";
import { Badge } from "@/components/ui/badge";
import { TeamShield } from "@/components/teams/team-shield";
import {
  buildProjectedBracket,
  buildTeamSeedMap,
  cardsFromMatches,
  compareMatchesChronological,
  groupStandings,
  matchStageLabel,
  playoffRoundCount,
  resultLabel,
} from "@/lib/competition-view";
import { type PublicTournament, getPublicTournament, getPublicTournamentId } from "@/lib/data/public";
import { formatDateRange, groupByLocalDay } from "@/lib/dates";
import { approvedTeamsLabel, teamNoun } from "@/lib/domain/tournament-status";
import { type CategoryColorTheme, getCategoryColorByIndex } from "@/lib/category-colors";
import { truncate } from "@/lib/utils/text";

const VIEWS = [
  { value: "grupos", label: "Grupos" },
  { value: "fixture", label: "Fixture" },
  { value: "cuadro", label: "Cuadro" },
] as const;

type View = (typeof VIEWS)[number]["value"];

async function loadTournament(slug: string): Promise<PublicTournament | null> {
  const tournamentId = await getPublicTournamentId(slug);
  if (!tournamentId) return null;
  return getPublicTournament(tournamentId);
}

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await loadTournament(slug);
  if (!tournament) return { title: "Torneo no encontrado" };

  const description =
    tournament.description?.trim() ||
    `Torneo de ${tournament.sportName}. Consultá grupos, tablas de posiciones, cruces y fixture oficial.`;

  return {
    title: tournament.name,
    description: truncate(description, 160),
    alternates: { canonical: `/t/${tournament.slug}` },
    openGraph: { title: tournament.name, description, type: "website", url: `/t/${tournament.slug}` },
  };
}

/**
 * Página pública del torneo (sin login). Lee con el cliente anónimo, así que
 * RLS solo deja ver torneos publicados y equipos aprobados; los borradores
 * dan 404. Los datos salen de la cache por tag (D-039).
 */
export default async function PublicTournamentPage({ params, searchParams }: PageProps<"/t/[slug]">) {
  const [{ slug }, query] = await Promise.all([params, searchParams]);
  const tournament = await loadTournament(slug);
  if (!tournament) notFound();

  const { competition, timezone } = tournament;
  let categories = competition.categories ?? [];

  // Si por alguna razón categories está vacío pero en los grupos o partidos hay category_id,
  // sintetizamos las categorías para evitar que se mezclen en un solo cuadro.
  if (categories.length === 0) {
    const catIdsInGroups = Array.from(new Set(competition.groups.map((g) => g.categoryId).filter(Boolean))) as string[];
    const catIdsInMatches = Array.from(new Set(competition.matches.map((m) => m.categoryId).filter(Boolean))) as string[];
    const allCatIds = Array.from(new Set([...catIdsInGroups, ...catIdsInMatches]));
    if (allCatIds.length > 0) {
      categories = allCatIds.map((id, index) => ({
        id,
        tournamentId: tournament.id,
        name: `Categoría ${index + 1}`,
        position: index,
        status: tournament.status,
        maxTeams: null,
        scoringConfig: tournament.scoringConfig,
        standingsConfig: tournament.standingsConfig,
        playoffConfig: tournament.playoffConfig,
        championTeamId: null,
        approvedTeamsCount: 0,
        totalTeamsCount: 0,
      }));
    }
  }

  const categoryNames = new Map(categories.map((c) => [c.id, c.name]));
  const categoryColors = new Map(categories.map((c, index) => [c.id, getCategoryColorByIndex(index)]));
  const teamNames = new Map(competition.teams.map((t) => [t.id, t.name]));
  const teamLogos = new Map(competition.teams.map((t) => [t.id, t.logoUrl ?? null]));
  const courts = new Map(tournament.courts.map((c) => [c.id, c]));
  const courtNames = new Map(tournament.courts.map((c) => [c.id, c.name]));
  const groupCategoryMap = new Map(competition.groups.map((g) => [g.id, g.categoryId]));

  const visibleMatches = competition.matches.filter((m) => !m.isBye);
  const anyPlayoffs = competition.matches.some((m) => m.stage === "playoff");

  // Vistas disponibles según lo que ya exista; por defecto, la etapa en curso.
  const available = VIEWS.filter(
    (v) =>
      (v.value === "grupos" && competition.groups.length > 0) ||
      (v.value === "fixture" && visibleMatches.length > 0) ||
      (v.value === "cuadro" && (anyPlayoffs || competition.groups.length > 0)),
  );
  const requested = available.find((v) => v.value === query.vista);
  const view: View | null = requested?.value ?? (anyPlayoffs ? "cuadro" : (available[0]?.value ?? null));

  // En la vista fixture, por defecto mostramos todas las categorías mezcladas (activeCategory = null).
  // Solo se filtra si el usuario selecciona explícitamente una categoría en ?cat=...
  // En las vistas de grupos o cuadro, por defecto seleccionamos la primera categoría.
  const hasCategories = categories.length > 0;
  const activeCategory = hasCategories
    ? query.cat
      ? categories.find((c) => c.id === query.cat) ?? (view === "fixture" ? null : categories[0])
      : view === "fixture"
        ? null
        : categories[0]
    : null;

  const filteredGroups = hasCategories && activeCategory
    ? competition.groups.filter((g) => g.categoryId === activeCategory.id)
    : competition.groups;

  const filteredMatches = hasCategories && activeCategory
    ? competition.matches.filter(
        (m) =>
          m.categoryId === activeCategory.id ||
          (!m.categoryId && m.groupId && groupCategoryMap.get(m.groupId) === activeCategory.id),
      )
    : competition.matches;

  const playoffMatches = filteredMatches.filter((m) => m.stage === "playoff");
  const noun = teamNoun(tournament.teamSize, true);
  const approvedCount = competition.teams.length;

  return (
    <article className="space-y-6">
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SportBadge sport={tournament.sportName} />
          <StatusBadge status={tournament.status} />
        </div>
        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{tournament.name}</h1>
        <ul className="flex flex-wrap gap-x-4 gap-y-1 text-sm text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4" aria-hidden="true" />
            {formatDateRange(tournament.startsOn, tournament.endsOn)}
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Users className="size-4" aria-hidden="true" />
            {approvedCount} {noun}
          </li>
        </ul>
        {tournament.description ? (
          <p className="max-w-prose text-sm whitespace-pre-line">{tournament.description}</p>
        ) : null}
      </header>

      {tournament.circuit ? (
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl border border-amber-500/30 bg-amber-500/10 px-4 py-2.5 text-xs sm:text-sm text-amber-950 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <Trophy className="size-4 shrink-0 text-amber-600 dark:text-amber-400" aria-hidden="true" />
            <span>
              Fecha {tournament.circuitOrder ? `${tournament.circuitOrder} del ` : "del "}
              circuito <strong>{tournament.circuit.name}</strong>
            </span>
          </div>
          <Link
            href={`/circuitos/${tournament.circuit.id}`}
            className="font-semibold text-primary underline underline-offset-2 hover:opacity-85 inline-flex items-center gap-1"
          >
            Ver tabla de posiciones &rarr;
          </Link>
        </div>
      ) : null}

      {tournament.bannerUrl ? (
        <section aria-label="Afiche oficial del torneo">
          <TournamentBanner
            src={tournament.bannerUrl}
            alt={`Afiche de ${tournament.name}`}
            tournamentName={tournament.name}
            priority
          />
        </section>
      ) : null}

      {view === null ? (
        <RegistrationView tournament={tournament} categoryNames={categoryNames} />
      ) : (
        <div className="space-y-4">
          <ViewTabs basePath={`/t/${tournament.slug}`} views={available} active={view} />

          {hasCategories && (view === "grupos" || view === "cuadro" || view === "fixture") ? (
            <div className="space-y-1.5 pt-1">
              <span className="text-xs font-medium text-muted-foreground">Categoría:</span>
              <CategoryTabs
                categories={categories.map((c, index) => ({
                  id: c.id,
                  name: c.name,
                  count: competition.teams.filter((t) => t.categoryId === c.id).length,
                  dotColor: getCategoryColorByIndex(index).dot,
                }))}
                activeId={activeCategory?.id ?? null}
                baseUrl={`/t/${tournament.slug}`}
                extraParams={{ vista: view }}
                allOption={view === "fixture"}
                allLabel="Todas"
              />
            </div>
          ) : null}

          {view === "grupos" ? (
            <section aria-label="Grupos y posiciones" className="space-y-4">
              {filteredGroups.length === 0 ? (
                <EmptyState
                  icon={LayoutGrid}
                  title="Todavía no hay grupos en esta categoría"
                  description="Se publicarán cuando el organizador realice el sorteo."
                />
              ) : (
                <div className="grid gap-4 lg:grid-cols-2">
                  {groupStandings(
                    filteredGroups,
                    filteredMatches,
                    activeCategory?.scoringConfig ?? tournament.scoringConfig,
                    activeCategory?.standingsConfig ?? tournament.standingsConfig
                  ).map(
                    ({ group, rows }) => (
                      <StandingsTable
                        key={group.id}
                        title={group.name}
                        rows={rows}
                        teamNames={teamNames}
                        teamLogos={teamLogos}
                        scoringType={(activeCategory?.scoringConfig ?? tournament.scoringConfig).type}
                        qualifiers={
                          group.teamIds.length === 4
                            ? 3
                            : filteredGroups.length === 1 &&
                              (activeCategory?.playoffConfig?.qualifiersPerGroup ?? tournament.playoffConfig.qualifiersPerGroup) < 2
                              ? 2
                              : (activeCategory?.playoffConfig?.qualifiersPerGroup ?? tournament.playoffConfig.qualifiersPerGroup)
                        }
                        matches={filteredMatches}
                        groupId={group.id}
                      />
                    ),
                  )}
                </div>
              )}
            </section>
          ) : null}

          {view === "fixture" ? (
            <PublicFixture
              timezone={timezone}
              tournamentName={tournament.name}
              sportName={tournament.sportName}
              days={groupByLocalDay(
                fixtureItems(tournament, teamNames, courts, categoryNames, activeCategory?.id, categoryColors),
                () => timezone,
              )}
            />
          ) : null}

          {view === "cuadro" ? (
            playoffMatches.length > 0 ? (
              <BracketView
                cards={cardsFromMatches(
                  playoffMatches,
                  teamNames,
                  courtNames,
                  buildTeamSeedMap(
                    filteredGroups,
                    filteredMatches,
                    activeCategory?.scoringConfig ?? tournament.scoringConfig,
                    activeCategory?.standingsConfig ?? tournament.standingsConfig,
                    filteredGroups.length === 1 &&
                      (activeCategory?.playoffConfig?.qualifiersPerGroup ?? tournament.playoffConfig.qualifiersPerGroup) < 2
                      ? 2
                      : (activeCategory?.playoffConfig?.qualifiersPerGroup ?? tournament.playoffConfig.qualifiersPerGroup),
                  ),
                  activeCategory?.id ?? null,
                )}
                timezone={timezone}
              />
            ) : filteredGroups.length >= 1 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Cuadro proyectado según las posiciones actuales de la fase de grupos {activeCategory ? `(${activeCategory.name})` : ""}.
                </p>
                <BracketView
                  cards={
                    buildProjectedBracket(
                      filteredGroups,
                      filteredMatches,
                      activeCategory?.scoringConfig ?? tournament.scoringConfig,
                      activeCategory?.standingsConfig ?? tournament.standingsConfig,
                      {
                        thirdPlace: activeCategory?.playoffConfig?.thirdPlace ?? tournament.playoffConfig.thirdPlace,
                        qualifiersPerGroup:
                          filteredGroups.length === 1 &&
                          (activeCategory?.playoffConfig?.qualifiersPerGroup ?? tournament.playoffConfig.qualifiersPerGroup) < 2
                            ? 2
                            : (activeCategory?.playoffConfig?.qualifiersPerGroup ?? tournament.playoffConfig.qualifiersPerGroup),
                      },
                      teamNames,
                      activeCategory?.id ?? null,
                    ) ?? []
                  }
                  timezone={timezone}
                />
              </div>
            ) : (
              <EmptyState
                icon={LayoutGrid}
                title="El cuadro aún no está disponible"
                description={hasCategories ? `Se proyectará al armar los grupos de "${activeCategory?.name}".` : "El cuadro de playoffs se definirá al armar los grupos."}
              />
            )
          ) : null}
        </div>
      )}
    </article>
  );
}

/** Antes de los grupos: estado de la inscripción y equipos aprobados. */
function RegistrationView({
  tournament,
  categoryNames,
}: {
  tournament: PublicTournament;
  categoryNames: Map<string, string>;
}) {
  const teams = tournament.competition.teams;
  const heading = approvedTeamsLabel(tournament.teamSize);
  return (
    <div className="space-y-4">
      <EmptyState
        icon={tournament.status === "registration_open" ? Users : LayoutGrid}
        title={tournament.status === "registration_open" ? "Inscripción abierta" : "Todavía no hay grupos"}
        description={
          tournament.status === "registration_open"
            ? "Si te pasaron el código de inscripción, ingresá para anotarte. Los grupos y el fixture se publican al cerrar la inscripción."
            : "Los grupos y el fixture se publican cuando el organizador los arme."
        }
      />
      {teams.length > 0 ? (
        <section aria-labelledby="inscriptos" className="space-y-2">
          <h2 id="inscriptos" className="text-lg font-semibold">
            {heading.charAt(0).toUpperCase() + heading.slice(1)}
          </h2>
          <ul className="grid gap-2 sm:grid-cols-2">
            {teams.map((team) => (
              <li key={team.id} className="flex items-center justify-between gap-2 rounded-lg border px-3 py-2 text-sm">
                <div className="flex items-center gap-2 min-w-0">
                  <TeamShield shieldUrl={team.logoUrl} teamName={team.name} size="sm" />
                  <span className="truncate">{team.name}</span>
                </div>
                {team.categoryId && categoryNames.has(team.categoryId) ? (
                  <Badge variant="outline" className="text-[11px] font-medium border-primary/40 bg-primary/5 text-primary shrink-0">
                    {categoryNames.get(team.categoryId)}
                  </Badge>
                ) : null}
              </li>
            ))}
          </ul>
        </section>
      ) : null}
    </div>
  );
}

function fixtureItems(
  tournament: PublicTournament,
  teamNames: Map<string, string>,
  courts: Map<string, { name: string; venue: string | null }>,
  categoryNames?: Map<string, string>,
  activeCategoryId?: string | null,
  categoryColors?: Map<string, CategoryColorTheme>,
): FixtureItem[] {
  const { matches, groups } = tournament.competition;
  const groupCategoryMap = new Map(groups.map((g) => [g.id, g.categoryId]));
  const targetMatches = activeCategoryId
    ? matches.filter(
        (m) =>
          m.categoryId === activeCategoryId ||
          (!m.categoryId && m.groupId && groupCategoryMap.get(m.groupId) === activeCategoryId),
      )
    : matches;
  const rounds = playoffRoundCount(targetMatches);
  const items = targetMatches
    .filter((m) => !m.isBye)
    .map((m) => {
      const court = m.courtId ? courts.get(m.courtId) : undefined;
      const catId = m.categoryId ?? (m.groupId ? groupCategoryMap.get(m.groupId) : null);
      return {
        id: m.id,
        categoryName: catId && categoryNames ? (categoryNames.get(catId) ?? null) : null,
        categoryColor: catId && categoryColors ? (categoryColors.get(catId) ?? null) : null,
        section: matchStageLabel(m, groups, rounds),
        homeName: m.homeTeamId ? (teamNames.get(m.homeTeamId) ?? "Equipo") : "A definir",
        awayName: m.awayTeamId ? (teamNames.get(m.awayTeamId) ?? "Equipo") : "A definir",
        homeWon: Boolean(m.winnerTeamId) && m.winnerTeamId === m.homeTeamId,
        awayWon: Boolean(m.winnerTeamId) && m.winnerTeamId === m.awayTeamId,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        courtLabel: court ? (court.venue ? `${court.name} · ${court.venue}` : court.name) : null,
        courtName: court?.name ?? null,
        resultText: resultLabel(m),
      };
    });
  return items.sort(compareMatchesChronological);
}
