import type { Competition, GroupView, MatchView } from "@/lib/data/competition";
import type { PlayoffConfig } from "@/lib/domain/bracket";
import type { ScoringConfig } from "@/lib/domain/scoring";
import type { StandingRow, StandingsConfig } from "@/lib/domain/standings";
import { compareMatchesChronological, groupStandings, matchStageLabel, playoffRoundCount } from "@/lib/competition-view";

/**
 * Progreso de un equipo en su torneo, visto por sus integrantes (D-122).
 * Función pura: recibe la competencia ya leída (con RLS) y arma el resumen
 * que muestra la vista de jugador: zona y posición, récord, próximo partido
 * y si sigue en carrera, quedó eliminado o salió campeón.
 */

export type PlayerPhase = "registration" | "groups" | "playoffs" | "eliminated" | "champion" | "finished";

export type PlayerGroupProgress = {
  group: GroupView;
  rows: StandingRow[];
  /** Posición (1 = primero) o null si el equipo no aparece en la tabla. */
  position: number | null;
  /** Puestos que clasifican a playoffs (los mismos que resalta la tabla pública). */
  qualifiers: number;
};

export type PlayerProgress = {
  phase: PlayerPhase;
  categoryId: string | null;
  categoryName: string | null;
  scoring: ScoringConfig;
  group: PlayerGroupProgress | null;
  record: { played: number; won: number; lost: number; drawn: number };
  nextMatch: { match: MatchView; label: string; rivalName: string } | null;
  /** Ronda en la que quedó eliminado ("Cuartos de final"), si corresponde. */
  eliminatedAt: string | null;
  /** Partidos de playoffs de la categoría del equipo (para dibujar el cuadro). */
  playoffMatches: MatchView[];
  /** Grupos y partidos de la categoría del equipo (para el cuadro proyectado). */
  categoryGroups: GroupView[];
  categoryMatches: MatchView[];
  standingsConfig: StandingsConfig;
  playoffConfig: PlayoffConfig;
};

export type PlayerProgressInput = {
  teamId: string;
  tournamentStatus: "draft" | "registration_open" | "group_stage" | "playoffs" | "finished";
  championTeamId: string | null;
  competition: Competition;
  scoring: ScoringConfig;
  standings: StandingsConfig;
  playoff: PlayoffConfig;
};

/** Clasificados por grupo con las mismas reglas que la página pública (zonas de 4 → 3; zona única → al menos 2). */
export function qualifiersForGroup(group: GroupView, groupsInCategory: number, perGroup: number): number {
  if (group.teamIds.length === 4) return 3;
  if (groupsInCategory === 1 && perGroup < 2) return 2;
  return perGroup;
}

export function buildPlayerProgress(input: PlayerProgressInput): PlayerProgress {
  const { teamId, competition } = input;
  const team = competition.teams.find((t) => t.id === teamId);
  const categoryId = team?.categoryId ?? null;
  const category = categoryId ? competition.categories.find((c) => c.id === categoryId) : undefined;

  const scoring = category?.scoringConfig ?? input.scoring;
  const standingsConfig = category?.standingsConfig ?? input.standings;
  const playoffConfig = category?.playoffConfig ?? input.playoff;

  // Con categorías, cada una es una competencia aparte: se filtra por la del equipo.
  // Con una sola categoría, las filas viejas sin category_id también son suyas.
  const singleCategory = competition.categories.length === 1;
  const inCategory = <T extends { categoryId?: string | null }>(rows: T[]): T[] =>
    category ? rows.filter((r) => r.categoryId === category.id || (singleCategory && !r.categoryId)) : rows;
  const categoryGroups = inCategory(competition.groups);
  const categoryMatches = inCategory(competition.matches);
  const playoffMatches = categoryMatches.filter((m) => m.stage === "playoff");

  const teamNames = new Map(competition.teams.map((t) => [t.id, t.name]));

  // Zona del equipo y su tabla.
  let group: PlayerGroupProgress | null = null;
  const myGroup = categoryGroups.find((g) => g.teamIds.includes(teamId));
  if (myGroup) {
    const [standing] = groupStandings([myGroup], categoryMatches, scoring, standingsConfig);
    const rows = standing?.rows ?? [];
    const index = rows.findIndex((r) => r.teamId === teamId);
    group = {
      group: myGroup,
      rows,
      position: index >= 0 ? index + 1 : null,
      qualifiers: qualifiersForGroup(myGroup, categoryGroups.length, playoffConfig.qualifiersPerGroup),
    };
  }

  // Récord en partidos con resultado (sin byes).
  const mine = categoryMatches.filter((m) => !m.isBye && (m.homeTeamId === teamId || m.awayTeamId === teamId));
  const finished = mine.filter((m) => m.winnerTeamId || m.isDraw);
  const record = {
    played: finished.length,
    won: finished.filter((m) => m.winnerTeamId === teamId).length,
    drawn: finished.filter((m) => m.isDraw).length,
    lost: finished.filter((m) => m.winnerTeamId && m.winnerTeamId !== teamId).length,
  };

  // Próximo partido: el primero sin resultado, en orden cronológico (los sin horario al final).
  const rounds = playoffRoundCount(categoryMatches);
  const pending = mine.filter((m) => !m.winnerTeamId && !m.isDraw).sort(compareMatchesChronological);
  const next = pending[0];
  const nextMatch = next
    ? {
        match: next,
        label: matchStageLabel(next, categoryGroups, rounds),
        rivalName: (() => {
          const rivalId = next.homeTeamId === teamId ? next.awayTeamId : next.homeTeamId;
          return rivalId ? (teamNames.get(rivalId) ?? "Equipo") : "A definir";
        })(),
      }
    : null;

  // Eliminación: perdió un cruce sin partido de consuelo, o el cuadro ya existe y no lo incluye.
  const knockout = playoffMatches.find(
    (m) =>
      (m.homeTeamId === teamId || m.awayTeamId === teamId) &&
      m.winnerTeamId &&
      m.winnerTeamId !== teamId &&
      !m.loserNextMatchId,
  );
  const inBracket = playoffMatches.some((m) => m.homeTeamId === teamId || m.awayTeamId === teamId);
  const groupsDone =
    categoryMatches.some((m) => m.stage === "group") &&
    categoryMatches.filter((m) => m.stage === "group" && !m.isBye).every((m) => m.winnerTeamId || m.isDraw);
  const bracketSettled = playoffMatches.length > 0 && playoffMatches.filter((m) => m.round === 1).every((m) => m.homeTeamId && m.awayTeamId);
  const outInGroups = groupsDone && bracketSettled && !inBracket;

  const championId = category?.championTeamId ?? input.championTeamId;

  let phase: PlayerPhase;
  if (championId === teamId) phase = "champion";
  else if (knockout || outInGroups) phase = "eliminated";
  else if (input.tournamentStatus === "finished") phase = "finished";
  else if (input.tournamentStatus === "draft" || input.tournamentStatus === "registration_open") phase = "registration";
  else if (inBracket || input.tournamentStatus === "playoffs") phase = "playoffs";
  else phase = "groups";

  const eliminatedAt = knockout
    ? knockout.isThirdPlace
      ? "3er puesto"
      : matchStageLabel(knockout, categoryGroups, rounds)
    : outInGroups
      ? "Fase de grupos"
      : null;

  return {
    phase,
    categoryId,
    categoryName: category?.name ?? null,
    scoring,
    group,
    record,
    nextMatch,
    eliminatedAt,
    playoffMatches,
    categoryGroups,
    categoryMatches,
    standingsConfig,
    playoffConfig,
  };
}
