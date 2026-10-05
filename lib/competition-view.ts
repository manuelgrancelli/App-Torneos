import type { ConfirmationView, GroupView, MatchView } from "@/lib/data/competition";
import { type BracketPlan, type Qualifier, roundName } from "@/lib/domain/bracket";
import { type MatchResult, type ScoringConfig, formatResult } from "@/lib/domain/scoring";
import { type StandingRow, type StandingsConfig, computeStandings } from "@/lib/domain/standings";

/**
 * Armado de vistas de la competencia a partir de las filas de la base
 * (sin acceso a datos: sirve en servidor y cliente).
 */

/** Tablas de posiciones de todos los grupos. */
export function groupStandings(
  groups: GroupView[],
  matches: MatchView[],
  scoring: ScoringConfig,
  config: StandingsConfig,
): { group: GroupView; rows: StandingRow[] }[] {
  return groups.map((group) => ({
    group,
    rows: computeStandings({
      teamIds: group.teamIds,
      matches: matches
        .filter((m) => m.groupId === group.id && m.homeTeamId && m.awayTeamId)
        .map((m) => ({
          homeTeamId: m.homeTeamId as string,
          awayTeamId: m.awayTeamId as string,
          winnerTeamId: m.winnerTeamId,
          isDraw: m.isDraw,
          result: m.result,
        })),
      scoring,
      config,
      seed: group.tiebreakSeed,
    }),
  }));
}

/** Etiqueta de la etapa del partido: "Grupo A · Fecha 2", "Semifinal", "3er puesto". */
export function matchStageLabel(match: MatchView, groups: GroupView[], playoffRounds: number): string {
  if (match.stage === "group") {
    const group = groups.find((g) => g.id === match.groupId);
    return `${group?.name ?? "Grupo"} · Fecha ${match.round}`;
  }
  if (match.isThirdPlace) return "3er puesto";
  return roundName(match.round, playoffRounds);
}

/** Cantidad de rondas del cuadro (la final es la ronda mayor sin partido siguiente). */
export function playoffRoundCount(matches: Pick<MatchView, "stage" | "round">[]): number {
  return matches.filter((m) => m.stage === "playoff").reduce((max, m) => Math.max(max, m.round), 0);
}

export function resultLabel(match: MatchView): string | null {
  if (!match.result) return null;
  return match.isWalkover ? `${formatResult(match.result)} (W.O.)` : formatResult(match.result);
}

/** Comentarios de objeción de un partido, para mostrarle al organizador. */
export function disputeComments(matchId: string, confirmations: ConfirmationView[]): string[] {
  return confirmations
    .filter((c) => c.matchId === matchId && c.response === "disputed" && c.comment)
    .map((c) => c.comment as string);
}

/** Fila del tablero de partidos del organizador. */
export type BoardMatch = {
  id: string;
  stage: "group" | "playoff";
  round: number;
  isThirdPlace: boolean;
  section: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  homeName: string;
  awayName: string;
  slotId: string | null;
  courtId: string | null;
  courtName: string | null;
  startsAt: string | null;
  endsAt: string | null;
  scheduleLocked: boolean;
  result: MatchResult | null;
  resultText: string | null;
  isWalkover: boolean;
  winnerTeamId: string | null;
  resultStatus: "provisional" | "confirmed" | "disputed" | null;
  disputes: string[];
};

/** Arma las filas del tablero (nombres, cancha, marcador y objeciones) a partir de la base. */
export function buildBoardMatches(
  matches: MatchView[],
  groups: GroupView[],
  teamNames: Map<string, string>,
  courtNames: Map<string, string>,
  confirmations: ConfirmationView[],
): BoardMatch[] {
  const rounds = playoffRoundCount(matches);
  return matches
    .filter((m) => !m.isBye)
    .map((m) => ({
      id: m.id,
      stage: m.stage,
      round: m.round,
      isThirdPlace: m.isThirdPlace,
      section: matchStageLabel(m, groups, rounds),
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      homeName: m.homeTeamId ? (teamNames.get(m.homeTeamId) ?? "Equipo") : "A definir",
      awayName: m.awayTeamId ? (teamNames.get(m.awayTeamId) ?? "Equipo") : "A definir",
      slotId: m.slotId,
      courtId: m.courtId,
      courtName: m.courtId ? (courtNames.get(m.courtId) ?? null) : null,
      startsAt: m.startsAt,
      endsAt: m.endsAt,
      scheduleLocked: m.scheduleLocked,
      result: m.result,
      resultText: resultLabel(m),
      isWalkover: m.isWalkover,
      winnerTeamId: m.winnerTeamId,
      resultStatus: m.resultStatus,
      // Los comentarios solo importan mientras el resultado sigue objetado.
      disputes: m.resultStatus === "disputed" ? disputeComments(m.id, confirmations) : [],
    }));
}

/** Partidos de un equipo vistos por sus integrantes (rival, horario, resultado desde su lado). */
export function buildTeamMatches(
  teamId: string,
  matches: MatchView[],
  groups: GroupView[],
  teamNames: Map<string, string>,
  courtNames: Map<string, string>,
  confirmations: ConfirmationView[],
) {
  const rounds = playoffRoundCount(matches);
  return matches
    .filter((m) => !m.isBye && (m.homeTeamId === teamId || m.awayTeamId === teamId))
    .sort((a, b) => (a.startsAt ?? "9999").localeCompare(b.startsAt ?? "9999") || a.round - b.round)
    .map((m) => {
      const rivalId = m.homeTeamId === teamId ? m.awayTeamId : m.homeTeamId;
      const outcome: "win" | "loss" | "draw" | null = m.isDraw
        ? "draw"
        : m.winnerTeamId
          ? m.winnerTeamId === teamId
            ? "win"
            : "loss"
          : null;
      const mine = confirmations.find((c) => c.matchId === m.id && c.teamId === teamId);
      return {
        id: m.id,
        section: matchStageLabel(m, groups, rounds),
        rivalName: rivalId ? (teamNames.get(rivalId) ?? "Equipo") : "A definir",
        startsAt: m.startsAt,
        endsAt: m.endsAt,
        courtName: m.courtId ? (courtNames.get(m.courtId) ?? null) : null,
        resultText: resultLabel(m),
        outcome,
        resultStatus: m.resultStatus,
        myResponse: mine?.response ?? null,
      };
    });
}

// -----------------------------------------------------------------------------
// Playoffs
// -----------------------------------------------------------------------------

/**
 * Clasificados a playoffs desde las tablas finales. El rating compara equipos
 * de grupos distintos (que pueden tener distinta cantidad de partidos):
 * [puntos por partido, diferencia por partido, a favor por partido] (D-027).
 */
export function qualifiersFromStandings(
  standings: { group: GroupView; rows: StandingRow[] }[],
  perGroup: number,
  scoringType: "sets" | "goals",
): Qualifier[] {
  return standings.flatMap(({ rows }, groupIndex) =>
    rows.slice(0, perGroup).map((row) => {
      const played = Math.max(row.played, 1);
      const diff = scoringType === "sets" ? row.setsFor - row.setsAgainst : row.goalsFor - row.goalsAgainst;
      const scored = scoringType === "sets" ? row.gamesFor : row.goalsFor;
      return {
        teamId: row.teamId,
        group: groupIndex,
        place: row.position,
        rating: [row.points / played, diff / played, scored / played],
      };
    }),
  );
}

/** Tarjeta de un partido en la vista del cuadro (preview o real). */
export type BracketCard = {
  key: string;
  round: number;
  position: number;
  isThirdPlace: boolean;
  isBye: boolean;
  home: { name: string; winner: boolean } | null;
  away: { name: string; winner: boolean } | null;
  resultText: string | null;
  startsAt: string | null;
  courtName: string | null;
};

/** Tarjetas a partir del plan calculado (vista previa antes de generar). */
export function cardsFromPlan(plan: BracketPlan, teamNames: Map<string, string>): BracketCard[] {
  const side = (teamId: string | null) =>
    teamId ? { name: teamNames.get(teamId) ?? "Equipo", winner: false } : null;
  return plan.matches.map((m) => ({
    key: m.key,
    round: m.round,
    position: m.position,
    isThirdPlace: m.isThirdPlace,
    isBye: m.isBye,
    home: side(m.home),
    away: side(m.away),
    resultText: null,
    startsAt: null,
    courtName: null,
  }));
}

/** Tarjetas a partir de los partidos de playoff guardados. */
export function cardsFromMatches(
  matches: MatchView[],
  teamNames: Map<string, string>,
  courtNames: Map<string, string>,
): BracketCard[] {
  return matches
    .filter((m) => m.stage === "playoff")
    .map((m) => {
      const side = (teamId: string | null) =>
        teamId ? { name: teamNames.get(teamId) ?? "Equipo", winner: m.winnerTeamId === teamId } : null;
      return {
        key: m.id,
        round: m.round,
        position: m.position,
        isThirdPlace: m.isThirdPlace,
        isBye: m.isBye,
        home: side(m.homeTeamId),
        away: side(m.awayTeamId),
        resultText: m.isBye ? null : resultLabel(m),
        startsAt: m.startsAt,
        courtName: m.courtId ? (courtNames.get(m.courtId) ?? null) : null,
      };
    });
}
