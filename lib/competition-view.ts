import type { ConfirmationView, GroupView, MatchView } from "@/lib/data/competition";
import { type BracketPlan, type Qualifier, buildBracket, roundName } from "@/lib/domain/bracket";
import { type MatchResult, type ScoringConfig, formatResult } from "@/lib/domain/scoring";
import { type StandingRow, type StandingsConfig, computeStandings, normalizeStandingsConfig } from "@/lib/domain/standings";

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
  const safeConfig = normalizeStandingsConfig(config);
  return groups.map((group) => ({
    group,
    rows: computeStandings({
      teamIds: group.teamIds,
      matches: matches
        .filter(
          (m) =>
            m.stage === "group" &&
            m.groupId === group.id &&
            m.homeTeamId &&
            m.awayTeamId &&
            !m.isBye,
        )
        .map((m) => ({
          homeTeamId: m.homeTeamId as string,
          awayTeamId: m.awayTeamId as string,
          winnerTeamId: m.winnerTeamId,
          isDraw: m.isDraw,
          result: m.result,
          round: m.round,
          position: m.position,
        })),
      scoring,
      config: safeConfig,
      seed: group.tiebreakSeed,
    }),
  }));
}

/** Etiqueta de la etapa del partido: "Grupo A · Fecha 2", "Semifinal", "3er puesto". */
export function matchStageLabel(match: MatchView, groups: GroupView[], playoffRounds: number): string {
  if (match.stage === "group") {
    const group = groups.find((g) => g.id === match.groupId);
    if (group && group.teamIds.length === 4 && match.round === 2) {
      const gName = group.name ?? "Grupo";
      return match.position === 0
        ? `${gName} · Final (1° y 2° puesto)`
        : `${gName} · Duelo 3° puesto (Pasa a playoff)`;
    }
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
  categoryId: string | null;
  categoryName: string | null;
  stage: "group" | "playoff";
  round: number;
  position: number;
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

/**
 * Comparador cronológico para listas y fixtures de partidos:
 * 1. Partidos con fecha/horario asignado van primero, sin horario al final.
 * 2. Ordenados por startsAt (fecha y hora) de menor a mayor (del primero al último).
 * 3. En caso de coincidir fecha y hora (ej. 10:00 a 11:00), se desempata por cancha de manera natural
 *    (Cancha 1 antes que Cancha 2, Cancha 10 después).
 * 4. Desempate secundario por fase (grupos antes de playoffs), ronda y posición.
 */
export function compareMatchesChronological<T extends {
  startsAt: string | null;
  courtName?: string | null;
  courtLabel?: string | null;
  stage?: string;
  round?: number;
  position?: number;
  section?: string;
  id?: string;
}>(a: T, b: T): number {
  if (a.startsAt && !b.startsAt) return -1;
  if (!a.startsAt && b.startsAt) return 1;

  if (a.startsAt && b.startsAt) {
    const timeA = new Date(a.startsAt).getTime();
    const timeB = new Date(b.startsAt).getTime();
    if (timeA !== timeB) return timeA - timeB;

    const courtA = a.courtName ?? a.courtLabel ?? "";
    const courtB = b.courtName ?? b.courtLabel ?? "";
    if (courtA && courtB) {
      const cmp = courtA.localeCompare(courtB, undefined, { numeric: true, sensitivity: "base" });
      if (cmp !== 0) return cmp;
    } else if (courtA) {
      return -1;
    } else if (courtB) {
      return 1;
    }
  }

  if (a.stage && b.stage && a.stage !== b.stage) {
    if (a.stage === "group") return -1;
    if (b.stage === "group") return 1;
  }

  if (a.round !== undefined && b.round !== undefined && a.round !== b.round) {
    return a.round - b.round;
  }

  if (a.position !== undefined && b.position !== undefined && a.position !== b.position) {
    return a.position - b.position;
  }

  if (a.section && b.section && a.section !== b.section) {
    return a.section.localeCompare(b.section, undefined, { numeric: true });
  }

  return (a.id ?? "").localeCompare(b.id ?? "");
}

/** Arma las filas del tablero (nombres, cancha, marcador y objeciones) a partir de la base, ordenadas cronológicamente. */
export function buildBoardMatches(
  matches: MatchView[],
  groups: GroupView[],
  teamNames: Map<string, string>,
  courtNames: Map<string, string>,
  confirmations: ConfirmationView[],
  categoryNames?: Map<string, string>,
): BoardMatch[] {
  const globalRounds = playoffRoundCount(matches);
  const categoryRoundsMap = new Map<string | null, number>();
  for (const m of matches) {
    if (m.stage === "playoff") {
      const catKey = m.categoryId ?? null;
      const current = categoryRoundsMap.get(catKey) ?? 0;
      if (m.round > current) categoryRoundsMap.set(catKey, m.round);
    }
  }

  const items = matches
    .filter((m) => !m.isBye)
    .map((m) => {
      const rounds = m.stage === "playoff" ? (categoryRoundsMap.get(m.categoryId ?? null) ?? globalRounds) : globalRounds;
      const group = m.groupId ? groups.find((g) => g.id === m.groupId) : undefined;
      const is4TeamGroup = group && group.teamIds.length === 4;
      return {
        id: m.id,
        categoryId: m.categoryId ?? null,
        categoryName: m.categoryId && categoryNames ? (categoryNames.get(m.categoryId) ?? null) : null,
        stage: m.stage,
        round: m.round,
        position: m.position,
        isThirdPlace: m.isThirdPlace,
        section: matchStageLabel(m, groups, rounds),
        homeTeamId: m.homeTeamId,
        awayTeamId: m.awayTeamId,
        homeName: m.homeTeamId
          ? (teamNames.get(m.homeTeamId) ?? "Equipo")
          : is4TeamGroup && m.stage === "group" && m.round === 2
            ? m.position === 0
              ? "Ganador P1"
              : "Perdedor P1"
            : "A definir",
        awayName: m.awayTeamId
          ? (teamNames.get(m.awayTeamId) ?? "Equipo")
          : is4TeamGroup && m.stage === "group" && m.round === 2
            ? m.position === 0
              ? "Ganador P2"
              : "Perdedor P2"
            : "A definir",
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
      };
    });

  return items.sort(compareMatchesChronological);
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
    .sort(compareMatchesChronological)
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
  return standings.flatMap(({ group, rows }, groupIndex) => {
    const effectiveQualifiers = group.teamIds.length === 4 ? 3 : perGroup;
    return rows.slice(0, effectiveQualifiers).map((row) => {
      const played = Math.max(row.played, 1);
      const diff = scoringType === "sets" ? row.setsFor - row.setsAgainst : row.goalsFor - row.goalsAgainst;
      const scored = scoringType === "sets" ? row.gamesFor : row.goalsFor;
      return {
        teamId: row.teamId,
        group: groupIndex,
        place: row.position,
        rating: [row.points / played, diff / played, scored / played],
      };
    });
  });
}

/** Integrante o equipo en una tarjeta del cuadro. */
export type BracketCardTeam = {
  id?: string | null;
  name: string;
  winner: boolean;
  seedBadge?: string | null;
  isProvisional?: boolean;
};

/** Tarjeta de un partido en la vista del cuadro (preview, proyectado o real). */
export type BracketCard = {
  key: string;
  matchId?: string;
  round: number;
  position: number;
  isThirdPlace: boolean;
  isBye: boolean;
  home: BracketCardTeam | null;
  away: BracketCardTeam | null;
  resultText: string | null;
  startsAt: string | null;
  courtName: string | null;
  homeTeamId?: string | null;
  awayTeamId?: string | null;
  slotId?: string | null;
  courtId?: string | null;
  result?: MatchResult | null;
  isWalkover?: boolean;
  canScore?: boolean;
};

/** Tarjetas a partir del plan calculado (vista previa antes de generar). */
export function cardsFromPlan(plan: BracketPlan, teamNames: Map<string, string>): BracketCard[] {
  const side = (teamId: string | null): BracketCardTeam | null =>
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
    canScore: false,
  }));
}

/**
 * Mapeo de teamId a etiqueta de siembra (ej. "1A", "2B", "2F") según las tablas de posiciones.
 */
export function buildTeamSeedMap(
  groups: GroupView[],
  matches: MatchView[],
  scoring: ScoringConfig,
  standingsConfig: StandingsConfig,
  perGroup: number,
): Map<string, string> {
  const map = new Map<string, string>();
  const standings = groupStandings(groups, matches, scoring, standingsConfig);
  groups.forEach((group, g) => {
    const rawLetter = group.name.replace(/grupo\s*/i, "").trim();
    const groupLetter = (rawLetter.length <= 2 ? rawLetter : "") || String.fromCharCode(65 + g);
    const rows = standings[g]?.rows ?? [];
    const effectivePerGroup =
      group.teamIds.length === 4 ? 3 : groups.length === 1 && perGroup < 2 ? 2 : perGroup;
    for (let i = 0; i < Math.min(effectivePerGroup, rows.length); i++) {
      const row = rows[i];
      if (row) {
        map.set(row.teamId, `${i + 1}${groupLetter}`);
      }
    }
  });
  return map;
}

/**
 * Construye el cuadro proyectado en base a los grupos y las posiciones actuales de la fase de grupos.
 * Cruces fijos predeterminados (ej. 1°A vs 2°F) que se actualizan automáticamente en tiempo real.
 */
export function buildProjectedBracket(
  groups: GroupView[],
  matches: MatchView[],
  scoring: ScoringConfig,
  standingsConfig: StandingsConfig,
  playoffConfig: { qualifiersPerGroup: number; thirdPlace: boolean },
  teamNames: Map<string, string>,
  categoryId?: string | null,
): BracketCard[] | null {
  if (groups.length === 0) return null;

  let targetGroups = groups;
  if (categoryId) {
    targetGroups = groups.filter((g) => g.categoryId === categoryId);
  } else {
    const distinctCats = Array.from(new Set(groups.map((g) => g.categoryId).filter(Boolean)));
    if (distinctCats.length > 1) {
      targetGroups = groups.filter((g) => g.categoryId === distinctCats[0]);
    }
  }
  if (targetGroups.length === 0) return null;

  const rawPerGroup = Math.max(1, playoffConfig.qualifiersPerGroup);
  const groupEffectiveQualifiers = (g: GroupView) =>
    g.teamIds.length === 4 ? 3 : targetGroups.length === 1 && rawPerGroup < 2 ? 2 : rawPerGroup;

  const totalQualifiers = targetGroups.reduce((acc, g) => acc + groupEffectiveQualifiers(g), 0);
  if (totalQualifiers < 2 || totalQualifiers > 64) return null;

  const standings = groupStandings(targetGroups, matches, scoring, standingsConfig);

  type SeedInfo = {
    seedBadge: string;
    seedLabel: string;
    teamId: string | null;
    teamName: string;
    isProvisional: boolean;
  };

  const seedInfoMap = new Map<string, SeedInfo>();

  const virtualQualifiers: Qualifier[] = targetGroups.flatMap((group, g) => {
    const rawLetter = group.name.replace(/grupo\s*/i, "").trim();
    const groupLetter = (rawLetter.length <= 2 ? rawLetter : "") || String.fromCharCode(65 + g);
    const groupStanding = standings[g];
    const groupMatches = matches.filter(
      (m) => m.stage === "group" && m.groupId === group.id && !m.isBye,
    );
    const groupFinished = groupMatches.length > 0 && groupMatches.every((m) => m.resultStatus !== null);
    const effectivePerGroup = groupEffectiveQualifiers(group);

    return Array.from({ length: effectivePerGroup }, (_, i) => {
      const p = i + 1;
      const seedCode = `${p}${groupLetter}`;
      const seedLabel = targetGroups.length === 1 ? `${p}° ${group.name}` : `${p}° ${group.name || `Grupo ${groupLetter}`}`;
      const row = groupStanding?.rows[i];

      let teamId: string | null = null;
      let teamName = seedLabel;
      let isProvisional = false;

      if (row && row.played > 0) {
        teamId = row.teamId;
        teamName = teamNames.get(row.teamId) ?? seedLabel;
        isProvisional = !groupFinished;
      }

      seedInfoMap.set(seedCode, {
        seedBadge: seedCode,
        seedLabel,
        teamId,
        teamName,
        isProvisional,
      });

      return {
        teamId: seedCode,
        group: g,
        place: p,
        rating: [0, 0, 0],
      };
    });
  });

  try {
    const plan = buildBracket(virtualQualifiers, { thirdPlace: playoffConfig.thirdPlace });
    const getSide = (seedCode: string | null): BracketCardTeam | null => {
      if (!seedCode) return null;
      const info = seedInfoMap.get(seedCode);
      if (!info) return { name: seedCode, winner: false };
      return {
        id: info.teamId,
        name: info.teamName,
        winner: false,
        seedBadge: info.seedBadge,
        isProvisional: info.isProvisional,
      };
    };

    return plan.matches.map((m) => ({
      key: m.key,
      round: m.round,
      position: m.position,
      isThirdPlace: m.isThirdPlace,
      isBye: m.isBye,
      home: getSide(m.home),
      away: getSide(m.away),
      resultText: null,
      startsAt: null,
      courtName: null,
      canScore: false,
    }));
  } catch {
    return null;
  }
}

/** Tarjetas a partir de los partidos de playoff guardados en la base de datos. */
export function cardsFromMatches(
  matches: MatchView[],
  teamNames: Map<string, string>,
  courtNames: Map<string, string>,
  seedMap?: Map<string, string>,
  categoryId?: string | null,
  projectedCards?: BracketCard[] | null,
): BracketCard[] {
  let playoffMatches = matches.filter((m) => m.stage === "playoff");
  if (categoryId) {
    playoffMatches = playoffMatches.filter((m) => m.categoryId === categoryId);
  } else {
    const distinctCats = Array.from(new Set(playoffMatches.map((m) => m.categoryId).filter(Boolean)));
    if (distinctCats.length > 1) {
      playoffMatches = playoffMatches.filter((m) => m.categoryId === distinctCats[0]);
    }
  }

  return playoffMatches.map((m) => {
    const proj = projectedCards?.find(
      (p) => p.round === m.round && p.position === m.position && p.isThirdPlace === m.isThirdPlace,
    );
    const side = (teamId: string | null, fallback?: BracketCardTeam | null): BracketCardTeam | null => {
      if (teamId) {
        return {
          id: teamId,
          name: teamNames.get(teamId) ?? "Equipo",
          winner: m.winnerTeamId === teamId,
          seedBadge: seedMap?.get(teamId) ?? null,
        };
      }
      if (fallback) {
        return {
          ...fallback,
          winner: false,
        };
      }
      return null;
    };
    return {
      key: m.id,
      matchId: m.id,
      round: m.round,
      position: m.position,
      isThirdPlace: m.isThirdPlace,
      isBye: m.isBye,
      home: side(m.homeTeamId, proj?.home),
      away: side(m.awayTeamId, proj?.away),
      resultText: m.isBye ? null : resultLabel(m),
      startsAt: m.startsAt,
      courtName: m.courtId ? (courtNames.get(m.courtId) ?? null) : null,
      homeTeamId: m.homeTeamId,
      awayTeamId: m.awayTeamId,
      slotId: m.slotId,
      courtId: m.courtId,
      result: m.result,
      isWalkover: m.isWalkover,
      canScore: Boolean(m.homeTeamId && m.awayTeamId && !m.isBye),
    };
  });
}
