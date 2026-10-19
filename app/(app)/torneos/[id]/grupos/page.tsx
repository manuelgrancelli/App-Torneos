import { AlertCircle, LayoutGrid } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CategoryTabs } from "@/components/categories/category-tabs";
import { BulkDrawDialog } from "@/components/groups/bulk-draw-dialog";
import { ExportGroupsImageModal } from "@/components/groups/export-groups-image-modal";
import { GroupBuilder } from "@/components/groups/group-builder";
import { StandingsTable } from "@/components/groups/standings-table";
import { EmptyState } from "@/components/shared/empty-state";
import { groupStandings } from "@/lib/competition-view";
import { getCompetition, getSchedulingData } from "@/lib/data/competition";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { normalizeStandingsConfig } from "@/lib/domain/standings";

export const metadata: Metadata = { title: "Grupos" };

/** Armado de grupos (mientras no haya resultados) y tablas de posiciones. */
export default async function GroupsPage({
  params,
  searchParams,
}: PageProps<"/torneos/[id]/grupos">) {
  const { id } = await params;
  const { cat } = await searchParams;
  const tournament = await requireOrganizerTournament(id);
  const competition = await getCompetition(tournament.id);

  const hasCategories = competition.categories.length > 0;
  const activeCategory = hasCategories
    ? competition.categories.find((c) => c.id === cat) ?? competition.categories[0]
    : null;

  // Si no hay categorías y el torneo está en borrador o inscripción abierta
  if (!hasCategories && (tournament.status === "draft" || tournament.status === "registration_open")) {
    return (
      <EmptyState
        icon={LayoutGrid}
        title="Los grupos se arman al cerrar la inscripción"
        description="Desde el resumen, cerrá la inscripción y empezá la fase de grupos: ahí podés sortearlos."
      />
    );
  }

  // Filtrar según la categoría activa si el torneo tiene categorías.
  // Si el torneo tiene 1 sola categoría, las parejas sin categoría pertenecen a ella.
  const approved = competition.teams.filter(
    (t) =>
      t.status === "approved" &&
      (!activeCategory ||
        t.categoryId === activeCategory.id ||
        (!t.categoryId && competition.categories.length === 1))
  );
  const unassignedTeams = competition.teams.filter(
    (t) => t.status === "approved" && !t.categoryId
  );
  const groups = competition.groups.filter(
    (g) => !activeCategory || g.categoryId === activeCategory.id
  );
  const matches = competition.matches.filter(
    (m) => !activeCategory || m.categoryId === activeCategory.id
  );

  const teamNames = new Map(competition.teams.map((t) => [t.id, t.name]));
  const hasResults = matches.some((m) => m.resultStatus !== null);

  const isCategoryGroupStage = activeCategory
    ? activeCategory.status === "group_stage" || tournament.status === "group_stage"
    : tournament.status === "group_stage";

  const isCategoryOpen = activeCategory
    ? (activeCategory.status === "draft" || activeCategory.status === "registration_open") &&
      tournament.status !== "group_stage"
    : false;

  const canEdit = isCategoryGroupStage && !hasResults;
  const scheduling = canEdit ? await getSchedulingData(tournament.id) : null;
  const categoryScoring = activeCategory?.scoringConfig ?? tournament.scoringConfig;
  const categoryStandings = normalizeStandingsConfig(activeCategory?.standingsConfig ?? tournament.standingsConfig);
  const categoryPlayoff = activeCategory?.playoffConfig ?? tournament.playoffConfig;

  const standings = groupStandings(
    groups,
    matches,
    categoryScoring,
    categoryStandings
  );

  const teamMembersMap: Record<string, string[]> = {};
  for (const t of competition.teams) {
    if (t.members && t.members.length > 0) {
      teamMembersMap[t.id] = t.members.map((m) => m.name);
    }
  }

  return (
    <div className="space-y-6">
      {hasCategories ? (
        <div className="space-y-1">
          <div className="flex flex-wrap items-center justify-between gap-3">
            <h2 className="text-sm font-medium text-muted-foreground">Categoría seleccionada:</h2>
            <div className="flex items-center gap-3">
              <BulkDrawDialog
                tournamentId={tournament.id}
                categories={competition.categories.map((c) => ({
                  id: c.id,
                  name: c.name,
                  approvedCount: competition.teams.filter(
                    (t) =>
                      t.status === "approved" &&
                      (t.categoryId === c.id || (!t.categoryId && competition.categories.length === 1)),
                  ).length,
                  hasResults: competition.matches.some(
                    (m) => m.categoryId === c.id && m.resultStatus !== null,
                  ),
                  existingGroupsCount: competition.groups.filter((g) => g.categoryId === c.id).length,
                  status: c.status,
                }))}
              />
              <Link
                href={`/torneos/${tournament.id}/inscripciones`}
                className="text-xs text-primary hover:underline font-medium"
              >
                Ver categorías en Inscripciones
              </Link>
            </div>
          </div>
          <CategoryTabs
            categories={competition.categories.map((c) => ({
              id: c.id,
              name: c.name,
              count: competition.teams.filter(
                (t) =>
                  t.status === "approved" &&
                  (t.categoryId === c.id || (!t.categoryId && competition.categories.length === 1))
              ).length,
              status: c.status,
            }))}
            activeId={activeCategory?.id ?? null}
            baseUrl={`/torneos/${tournament.id}/grupos`}
          />
        </div>
      ) : null}

      {hasCategories && competition.categories.length > 1 && unassignedTeams.length > 0 ? (
        <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3 rounded-lg border border-amber-300 bg-amber-50 p-4 text-sm text-amber-900 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-200">
          <div className="flex items-center gap-2">
            <AlertCircle className="size-5 shrink-0 text-amber-600 dark:text-amber-400" />
            <div>
              <p className="font-medium">
                Hay {unassignedTeams.length} {unassignedTeams.length === 1 ? "pareja aprobada" : "parejas aprobadas"} sin categoría asignada.
              </p>
              <p className="text-xs text-amber-800 dark:text-amber-300">
                Podés asignarles categoría desde la sección Inscripciones para que aparezcan en el sorteo de su categoría correspondiente.
              </p>
            </div>
          </div>
          <Link
            href={`/torneos/${tournament.id}/inscripciones`}
            className="shrink-0 rounded-md bg-amber-600 px-3 py-1.5 text-xs font-semibold text-white shadow-sm hover:bg-amber-500 dark:bg-amber-700"
          >
            Ir a Inscripciones
          </Link>
        </div>
      ) : null}

      {hasCategories && isCategoryOpen && groups.length === 0 ? (
        <EmptyState
          icon={LayoutGrid}
          title={`La categoría "${activeCategory?.name}" aún está en inscripción`}
          description="Podés pasar la categoría a fase de grupos desde la pestaña 'Categorías' para sortear sus zonas y horarios."
        />
      ) : null}

      {canEdit ? (
        <GroupBuilder
          key={`${activeCategory?.id ?? "global"}-${approved.length}`}
          tournamentId={tournament.id}
          tournamentName={tournament.name}
          categoryName={activeCategory?.name}
          sportName={tournament.sport.name}
          categoryId={activeCategory?.id}
          teams={approved.map((t) => ({ id: t.id, name: t.name }))}
          initialGroups={groups.map((g) => g.teamIds)}
          availability={scheduling?.availability}
          slots={scheduling?.slots}
          courts={scheduling?.courts}
          timezone={tournament.timezone}
        />
      ) : null}

      {standings.length > 0 ? (
        <section aria-labelledby="posiciones" className="space-y-4">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3">
            <div>
              <h2 id="posiciones" className="text-lg font-semibold">
                Posiciones {activeCategory ? `— ${activeCategory.name}` : ""}
              </h2>
              {hasResults && isCategoryGroupStage ? (
                <p className="text-sm text-muted-foreground">
                  Ya hay resultados cargados: los grupos no se pueden rearmar.
                </p>
              ) : null}
            </div>
            <ExportGroupsImageModal
              tournamentName={tournament.name}
              categoryName={activeCategory?.name}
              sportName={tournament.sport.name}
              groups={standings.map(({ group, rows }) => ({
                name: group.name,
                teams: rows.map((r) => teamNames.get(r.teamId) ?? "Equipo"),
              }))}
            />
          </div>
          <div className="grid gap-4 lg:grid-cols-2">
            {standings.map(({ group, rows }) => (
              <StandingsTable
                key={group.id}
                title={group.name}
                rows={rows}
                teamNames={teamNames}
                teamMembers={teamMembersMap}
                scoringType={categoryScoring.type}
                qualifiers={
                  group.teamIds.length === 4
                    ? 3
                    : groups.length === 1 && categoryPlayoff.qualifiersPerGroup < 2
                      ? 2
                      : categoryPlayoff.qualifiersPerGroup
                }
                matches={matches}
                groupId={group.id}
              />
            ))}
          </div>
        </section>
      ) : null}
    </div>
  );
}
