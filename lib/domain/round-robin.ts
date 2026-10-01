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
