/**
 * Fixture "todos contra todos" por el método del círculo (tablas de Berger):
 * un equipo queda fijo y el resto rota. Con cantidad impar se agrega un
 * "libre" y a cada equipo le toca descansar exactamente una fecha.
 */

export type Pairing = { home: string; away: string };

export type RoundRobinRound = {
  /** Número de fecha, desde 1. */
  round: number;
  pairings: Pairing[];
  /** Equipo que descansa esta fecha (solo con cantidad impar). */
  bye: string | null;
};

export function generateRoundRobin(teamIds: readonly string[]): RoundRobinRound[] {
  if (new Set(teamIds).size !== teamIds.length) {
    throw new Error("Hay equipos repetidos.");
  }
  if (teamIds.length < 2) return [];

  // null representa la fecha libre.
  const slots: (string | null)[] = [...teamIds];
  if (slots.length % 2 === 1) slots.push(null);

  const n = slots.length;
  const rounds: RoundRobinRound[] = [];
  let rotation = slots;

  for (let r = 0; r < n - 1; r++) {
    const pairings: Pairing[] = [];
    let bye: string | null = null;

    for (let i = 0; i < n / 2; i++) {
      const a = rotation[i] ?? null;
      const b = rotation[n - 1 - i] ?? null;
      if (a === null || b === null) {
        bye = a ?? b;
        continue;
      }
      // Alternar localía para repartirla: el fijo alterna por fecha; el resto por posición.
      const aIsHome = i === 0 ? r % 2 === 0 : i % 2 === 1;
      pairings.push(aIsHome ? { home: a, away: b } : { home: b, away: a });
    }

    rounds.push({ round: r + 1, pairings, bye });
    // Rotación: el primero queda fijo, el último pasa a segundo lugar.
    rotation = [rotation[0] ?? null, rotation[n - 1] ?? null, ...rotation.slice(1, n - 1)];
  }

  return rounds;
}

/** Cantidad de partidos de un grupo de n equipos: n·(n−1)/2. */
export function roundRobinMatchCount(teamCount: number): number {
  return teamCount < 2 ? 0 : (teamCount * (teamCount - 1)) / 2;
}

export type GroupInitialMatch = {
  round: number;
  position: number;
  home: string;
  away: string;
};

/**
 * Genera los partidos iniciales para un grupo según su tamaño.
 * - En grupos de 4 parejas (formato padel GSL / doble eliminación simplificada):
 *   Fecha 1: Partido 0 (Pareja 0 vs Pareja 1), Partido 1 (Pareja 2 vs Pareja 3).
 *   Fecha 2: Ganadores por 1° y 2° puesto; Perdedores por 3° clasificado y 4° eliminado.
 * - En grupos de otros tamaños:
 *   Todos contra todos tradicional (Round Robin).
 */
export function generateGroupInitialMatches(teamIds: readonly string[]): GroupInitialMatch[] {
  if (teamIds.length === 4) {
    return [
      { round: 1, position: 0, home: teamIds[0]!, away: teamIds[1]! },
      { round: 1, position: 1, home: teamIds[2]!, away: teamIds[3]! },
    ];
  }

  return generateRoundRobin(teamIds).flatMap((round) =>
    round.pairings.map((pairing, position) => ({
      round: round.round,
      position,
      home: pairing.home,
      away: pairing.away,
    })),
  );
}

/** Cantidad total de partidos que se disputarán en un grupo de n equipos. */
export function groupTotalMatchCount(teamCount: number): number {
  if (teamCount < 2) return 0;
  if (teamCount === 4) return 4;
  return roundRobinMatchCount(teamCount);
}
