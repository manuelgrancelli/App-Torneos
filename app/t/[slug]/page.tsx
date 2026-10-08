import { CalendarDays, LayoutGrid, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { BracketView } from "@/components/bracket/bracket-view";
import { StandingsTable } from "@/components/groups/standings-table";
import { type FixtureItem, PublicFixture } from "@/components/public/public-fixture";
import { ViewTabs } from "@/components/public/view-tabs";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge, SportBadge } from "@/components/tournaments/status-badge";
import { TournamentBanner } from "@/components/tournaments/tournament-banner";
import {
  buildProjectedBracket,
  buildTeamSeedMap,
  cardsFromMatches,
  groupStandings,
  matchStageLabel,
  playoffRoundCount,
  resultLabel,
} from "@/lib/competition-view";
import { type PublicTournament, getPublicTournament, getPublicTournamentId } from "@/lib/data/public";
import { formatDateRange, groupByLocalDay } from "@/lib/dates";
import { approvedTeamsLabel, teamNoun } from "@/lib/domain/tournament-status";
import { truncate } from "@/lib/utils/text";

const VIEWS = [
  { value: "grupos", label: "Grupos" },
  { value: "fixture", label: "Fixture" },
  { value: "cuadro", label: "Cuadro" },
] as const;

type View = (typeof VIEWS)[number]["value"];

async function loadTournament(slug: string): Promise<PublicTournament | null> {
  const id = await getPublicTournamentId(slug);
  return id ? getPublicTournament(id) : null;
}

export async function generateMetadata({ params }: PageProps<"/t/[slug]">): Promise<Metadata> {
  const { slug } = await params;
  const tournament = await loadTournament(slug);
  if (!tournament) return { title: "Torneo no encontrado" };

  const description = truncate(
    tournament.description?.trim() ||
      `${tournament.sportName} · ${formatDateRange(tournament.startsOn, tournament.endsOn)}. Grupos, fixture y cuadro.`,
    160,
  );
  return {
    title: tournament.name,
    description,
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
  const teamNames = new Map(competition.teams.map((t) => [t.id, t.name]));
  const courts = new Map(tournament.courts.map((c) => [c.id, c]));
  const courtNames = new Map(tournament.courts.map((c) => [c.id, c.name]));
  const champion = tournament.championTeamId ? teamNames.get(tournament.championTeamId) : null;
  const playoffMatches = competition.matches.filter((m) => m.stage === "playoff");
  const visibleMatches = competition.matches.filter((m) => !m.isBye);

  // Vistas disponibles según lo que ya exista; por defecto, la etapa en curso.
  const available = VIEWS.filter(
    (v) =>
      (v.value === "grupos" && competition.groups.length > 0) ||
      (v.value === "fixture" && visibleMatches.length > 0) ||
      (v.value === "cuadro" && playoffMatches.length > 0),
  );
  const requested = available.find((v) => v.value === query.vista);
  const view: View | null = requested?.value ?? (playoffMatches.length > 0 ? "cuadro" : (available[0]?.value ?? null));
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

      {champion ? (
        <p className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-medium text-amber-950">
          <Trophy className="size-5 text-amber-600" aria-hidden="true" />
          Campeón: {champion}
        </p>
      ) : null}

      {view === null ? (
        <RegistrationView tournament={tournament} />
      ) : (
        <div className="space-y-4">
          <ViewTabs basePath={`/t/${tournament.slug}`} views={available} active={view} />

          {view === "grupos" ? (
            <section aria-label="Grupos y posiciones" className="grid gap-4 lg:grid-cols-2">
              {groupStandings(competition.groups, competition.matches, tournament.scoringConfig, tournament.standingsConfig).map(
                ({ group, rows }) => (
                  <StandingsTable
                    key={group.id}
                    title={group.name}
                    rows={rows}
                    teamNames={teamNames}
                    scoringType={tournament.scoringConfig.type}
                    qualifiers={tournament.playoffConfig.qualifiersPerGroup}
                  />
                ),
              )}
            </section>
          ) : null}

          {view === "fixture" ? (
            <PublicFixture
              timezone={timezone}
              days={groupByLocalDay(fixtureItems(tournament, teamNames, courts), () => timezone)}
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
                    tournament.competition.groups,
                    tournament.competition.matches,
                    tournament.scoringConfig,
                    tournament.standingsConfig,
                    tournament.playoffConfig.qualifiersPerGroup,
                  ),
                )}
                timezone={timezone}
              />
            ) : tournament.competition.groups.length >= 2 ? (
              <div className="space-y-3">
                <p className="text-xs text-muted-foreground">
                  Cuadro proyectado según las posiciones actuales de la fase de grupos.
                </p>
                <BracketView
                  cards={
                    buildProjectedBracket(
                      tournament.competition.groups,
                      tournament.competition.matches,
                      tournament.scoringConfig,
                      tournament.standingsConfig,
                      tournament.playoffConfig,
                      teamNames,
                    ) ?? []
                  }
                  timezone={timezone}
                />
              </div>
            ) : (
              <p className="text-sm text-muted-foreground">El cuadro de playoffs se definirá al armar los grupos.</p>
            )
          ) : null}
        </div>
      )}
    </article>
  );
}

/** Antes de los grupos: estado de la inscripción y equipos aprobados. */
function RegistrationView({ tournament }: { tournament: PublicTournament }) {
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
              <li key={team.id} className="rounded-lg border px-3 py-2 text-sm">
                {team.name}
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
): FixtureItem[] {
  const { matches, groups } = tournament.competition;
  const rounds = playoffRoundCount(matches);
  return matches
    .filter((m) => !m.isBye)
    .map((m) => {
      const court = m.courtId ? courts.get(m.courtId) : undefined;
      return {
        id: m.id,
        section: matchStageLabel(m, groups, rounds),
        homeName: m.homeTeamId ? (teamNames.get(m.homeTeamId) ?? "Equipo") : "A definir",
        awayName: m.awayTeamId ? (teamNames.get(m.awayTeamId) ?? "Equipo") : "A definir",
        homeWon: Boolean(m.winnerTeamId) && m.winnerTeamId === m.homeTeamId,
        awayWon: Boolean(m.winnerTeamId) && m.winnerTeamId === m.awayTeamId,
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        courtLabel: court ? (court.venue ? `${court.name} · ${court.venue}` : court.name) : null,
        resultText: resultLabel(m),
      };
    });
}
