import { hashString } from "./random";

/**
 * Motor de cálculo de tabla de posiciones para Torneos Americanos de Pádel.
 * Admite:
 * 1. Modalidad Individual Rotativo: cada jugador suma puntos individuales en sus partidos.
 * 2. Modalidad Parejas Fijas: cada dupla suma puntos en sus partidos.
 *
 * Criterios de ordenamiento canónicos (D-200):
 * 1° Puntos acumulados (puntos a favor / tantos logrados)
 * 2° Diferencia de puntos (+/-)
 * 3° Puntos a favor
 * 4° Enfrentamiento directo (Head to head)
 * 5° Sorteo determinístico con semilla estable
 */

export type AmericanMatchScoreInput = {
  id?: string;
  sideA: readonly string[];
  sideB: readonly string[];
  scoreSideA: number | null;
  scoreSideB: number | null;
  status?: "pending" | "in_progress" | "completed";
};

export type AmericanStandingRow = {
  participantId: string;
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  rank: number;
  decidedByTiebreak?: "points" | "diff" | "points_for" | "head_to_head" | "lottery";
};

export type ComputeAmericanStandingsOptions = {
  seed?: number;
  scoringMode?: "fixed_points" | "timed_round" | "single_set";
};

export function computeAmericanStandings(
  participantIds: readonly string[],
  matches: readonly AmericanMatchScoreInput[],
  options: ComputeAmericanStandingsOptions = {}
): AmericanStandingRow[] {
  const { seed = 42, scoringMode = "fixed_points" } = options;

  // 1. Inicializar registro vacío para cada participante
  const stats = new Map<
    string,
    {
      participantId: string;
      played: number;
      won: number;
      lost: number;
      pointsFor: number;
      pointsAgainst: number;
      pointDiff: number;
    }
  >();

  for (const id of participantIds) {
    stats.set(id, {
      participantId: id,
      played: 0,
      won: 0,
      lost: 0,
      pointsFor: 0,
      pointsAgainst: 0,
      pointDiff: 0,
    });
  }

  // 2. Acumular estadísticas de partidos finalizados con marcador válido
  for (const match of matches) {
    const isCompleted = match.status === undefined || match.status === "completed";
    if (!isCompleted || match.scoreSideA === null || match.scoreSideB === null) {
      continue;
    }

    const scoreA = match.scoreSideA;
    const scoreB = match.scoreSideB;
    const isWinA = scoreA > scoreB;
    const isWinB = scoreB > scoreA;

    // Actualizar participantes Lado A
    for (const pId of match.sideA) {
      const p = stats.get(pId);
      if (!p) continue;
      p.played += 1;
      p.pointsFor += scoreA;
      p.pointsAgainst += scoreB;
      p.pointDiff = p.pointsFor - p.pointsAgainst;
      if (isWinA) p.won += 1;
      else if (isWinB) p.lost += 1;
    }

    // Actualizar participantes Lado B
    for (const pId of match.sideB) {
      const p = stats.get(pId);
      if (!p) continue;
      p.played += 1;
      p.pointsFor += scoreB;
      p.pointsAgainst += scoreA;
      p.pointDiff = p.pointsFor - p.pointsAgainst;
      if (isWinB) p.won += 1;
      else if (isWinA) p.lost += 1;
    }
  }

  // 3. Ordenamiento aplicando los criterios de desempate según modo
  const list = Array.from(stats.values());

  list.sort((a, b) => {
    if (scoringMode === "single_set") {
      // Modo por set (diferencia de games):
      // 1° Diferencia de games (+/-) (ej: 6-3 da +3, supera a 7-6 que da +1)
      if (b.pointDiff !== a.pointDiff) {
        return b.pointDiff - a.pointDiff;
      }
      // 2° Partidos ganados
      if (b.won !== a.won) {
        return b.won - a.won;
      }
      // 3° Games a favor acumulados
      if (b.pointsFor !== a.pointsFor) {
        return b.pointsFor - a.pointsFor;
      }
    } else {
      // Modo por puntos fijos / tiempo:
      // 1° Puntos a favor acumulados
      if (b.pointsFor !== a.pointsFor) {
        return b.pointsFor - a.pointsFor;
      }
      // 2° Diferencia de puntos (+/-)
      if (b.pointDiff !== a.pointDiff) {
        return b.pointDiff - a.pointDiff;
      }
      // 3° Partidos ganados
      if (b.won !== a.won) {
        return b.won - a.won;
      }
    }

    // 4° Enfrentamiento directo entre ambos participantes
    const h2h = resolveHeadToHead(a.participantId, b.participantId, matches);
    if (h2h !== 0) {
      return h2h;
    }

    // 5° Desempate determinístico por hash estable (sorteo determinístico)
    const hashA = hashString(`${seed}_${a.participantId}`);
    const hashB = hashString(`${seed}_${b.participantId}`);
    return hashA - hashB;
  });

  return list.map((item, index) => ({
    ...item,
    rank: index + 1,
  }));
}

/**
 * Resuelve el desempate por enfrentamiento directo (Head to Head) entre dos participantes.
 * Retorna negativo si A supera a B, positivo si B supera a A, o 0 si empatan o no se enfrentaron.
 */
function resolveHeadToHead(
  idA: string,
  idB: string,
  matches: readonly AmericanMatchScoreInput[]
): number {
  let pointsA = 0;
  let pointsB = 0;
  let matchesWonA = 0;
  let matchesWonB = 0;

  for (const match of matches) {
    if (match.scoreSideA === null || match.scoreSideB === null) continue;

    const inAOnSideA = match.sideA.includes(idA);
    const inAOnSideB = match.sideB.includes(idA);
    const inBOnSideA = match.sideA.includes(idB);
    const inBOnSideB = match.sideB.includes(idB);

    // Solo cuentan cruces donde jugaron como RIVALES (no como compañeros)
    if (inAOnSideA && inBOnSideB) {
      pointsA += match.scoreSideA;
      pointsB += match.scoreSideB;
      if (match.scoreSideA > match.scoreSideB) matchesWonA++;
      else if (match.scoreSideB > match.scoreSideA) matchesWonB++;
    } else if (inAOnSideB && inBOnSideA) {
      pointsA += match.scoreSideB;
      pointsB += match.scoreSideA;
      if (match.scoreSideB > match.scoreSideA) matchesWonA++;
      else if (match.scoreSideA > match.scoreSideB) matchesWonB++;
    }
  }

  // 1. Quien ganó más partidos directos
  if (matchesWonB !== matchesWonA) {
    return matchesWonB - matchesWonA;
  }

  // 2. Si empataron en partidos directos, mayor diferencia de tantos en duelos directos
  if (pointsB !== pointsA) {
    return pointsB - pointsA;
  }

  return 0;
}

