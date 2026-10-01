import { z } from "zod";

/**
 * Cuadro eliminatorio (playoffs) a partir de los clasificados de cada grupo.
 *
 * - Tamaño: potencia de 2 ≥ cantidad de clasificados (2 a 32). Los lugares
 *   sobrantes son byes y les tocan a los mejores sembrados.
 * - Siembra: primero todos los 1°, después los 2°, etc. Dentro de un mismo
 *   puesto se ordena por rendimiento (`rating`) y, a igualdad, por grupo.
 * - Ubicación: siembra estándar (1 vs último, los dos mejores en mitades
 *   opuestas). Los clasificados de 2° puesto en adelante se acomodan para que
 *   no se crucen en 1ª ronda con alguien de su grupo y, si se puede, para que
 *   queden en la otra mitad del cuadro (cruce tipo 1°A vs 2°B).
 */

export const playoffConfigSchema = z.object({
  qualifiersPerGroup: z.number().int().min(1).max(8),
  thirdPlace: z.boolean(),
});
export type PlayoffConfig = z.infer<typeof playoffConfigSchema>;

export const MAX_BRACKET_SIZE = 32;

export type Side = "home" | "away";

export type Qualifier = {
  teamId: string;
  /** Índice del grupo (0 = Grupo A). */
  group: number;
  /** Puesto en el grupo (1 = primero). */
  place: number;
  /** Rendimiento normalizado para comparar equipos de grupos distintos (mayor = mejor). */
  rating?: readonly number[];
};

export type BracketMatchPlan = {
  /** Clave estable: "r1-m0" (ronda 1, partido 0), "third-place". */
  key: string;
  round: number;
  position: number;
  home: string | null;
  away: string | null;
  isBye: boolean;
  isThirdPlace: boolean;
  /** En los byes, el equipo que pasa directo. */
  winnerTeamId: string | null;
  next: { key: string; side: Side } | null;
  loserNext: { key: string; side: Side } | null;
};

export type BracketPlan = {
  size: number;
  rounds: number;
  matches: BracketMatchPlan[];
  warnings: string[];
};

/** Potencia de 2 que alberga a los clasificados. */
export function bracketSize(qualifierCount: number): number {
  if (!Number.isInteger(qualifierCount) || qualifierCount < 2 || qualifierCount > MAX_BRACKET_SIZE) {
    throw new RangeError(`El cuadro admite entre 2 y ${MAX_BRACKET_SIZE} clasificados.`);
  }
  let size = 2;
  while (size < qualifierCount) size *= 2;
  return size;
}

/**
 * Número de siembra en cada posición del cuadro (1 = mejor sembrado).
 * Para 8: [1, 8, 4, 5, 2, 7, 3, 6] → cruces 1-8, 4-5, 2-7, 3-6.
 */
export function seedPositions(size: number): number[] {
  let order = [1, 2];
  while (order.length < size) {
    const total = order.length * 2 + 1;
    order = order.flatMap((seed) => [seed, total - seed]);
  }
  return order;
}

function compareRatings(a: readonly number[] = [], b: readonly number[] = []): number {
  for (let i = 0; i < Math.max(a.length, b.length); i++) {
    const diff = (b[i] ?? 0) - (a[i] ?? 0);
    if (diff !== 0) return diff;
  }
  return 0;
}

/** Orden de siembra: por puesto, después rendimiento, después grupo. */
export function orderSeeds(qualifiers: readonly Qualifier[]): Qualifier[] {
  return [...qualifiers].sort(
    (a, b) => a.place - b.place || compareRatings(a.rating, b.rating) || a.group - b.group,
  );
}

export function roundName(round: number, totalRounds: number): string {
  const fromEnd = totalRounds - round;
  if (fromEnd === 0) return "Final";
  if (fromEnd === 1) return "Semifinal";
  if (fromEnd === 2) return "Cuartos de final";
  if (fromEnd === 3) return "Octavos de final";
  return `${2 ** fromEnd}avos de final`;
}

/**
 * Ubica a los sembrados en el cuadro. Los 1° quedan fijos según la siembra;
 * los de cada puesto siguiente se permutan entre las posiciones de su puesto
 * minimizando: cruce en 1ª ronda con alguien del mismo grupo (muy penalizado)
 * y compartir mitad de cuadro con alguien del mismo grupo (poco penalizado).
 */
function placeSeeds(seeds: Qualifier[], size: number): (Qualifier | null)[] {
  const positionsBySeed = new Map<number, number>();
  seedPositions(size).forEach((seed, position) => positionsBySeed.set(seed, position));

  const slots: (Qualifier | null)[] = Array.from({ length: size }, () => null);
  const tiers = new Map<number, Qualifier[]>();
  seeds.forEach((q) => tiers.set(q.place, [...(tiers.get(q.place) ?? []), q]));

  let seedNumber = 1;
  const tierPlaces = [...tiers.keys()].sort((a, b) => a - b);

  tierPlaces.forEach((place, tierIndex) => {
    const teams = tiers.get(place) ?? [];
    const positions = teams.map(() => positionsBySeed.get(seedNumber++) as number);

    if (tierIndex === 0) {
      teams.forEach((team, i) => (slots[positions[i] as number] = team));
      return;
    }

    const half = size / 2;
    const penaltyFor = (team: Qualifier, position: number): number => {
      let penalty = 0;
      const opponent = slots[position ^ 1];
      if (opponent && opponent.group === team.group) penalty += 1000;
      const sameHalf = slots.some(
        (other, index) => other && other.group === team.group && index < half === position < half,
      );
      if (sameHalf) penalty += 1;
      return penalty;
    };

    // Búsqueda con poda sobre las permutaciones del puesto (acotada por iteraciones).
    let bestCost = Number.POSITIVE_INFINITY;
    let bestAssignment: number[] = teams.map((_, i) => i);
    const used = new Array<boolean>(teams.length).fill(false);
    const assignment: number[] = [];
    let iterations = 0;

    const search = (slotIndex: number, cost: number): void => {
      if (cost >= bestCost || ++iterations > 200_000) return;
      if (slotIndex === positions.length) {
        bestCost = cost;
        bestAssignment = [...assignment];
        return;
      }
      const position = positions[slotIndex] as number;
      for (let t = 0; t < teams.length; t++) {
        if (used[t]) continue;
        const team = teams[t] as Qualifier;
        const penalty = penaltyFor(team, position);
        used[t] = true;
        assignment.push(t);
        slots[position] = team;
        search(slotIndex + 1, cost + penalty);
        slots[position] = null;
        assignment.pop();
        used[t] = false;
        if (bestCost === 0) return;
      }
    };
    search(0, 0);

    bestAssignment.forEach((teamIndex, slotIndex) => {
      slots[positions[slotIndex] as number] = teams[teamIndex] as Qualifier;
    });
  });

  return slots;
}

/** Arma el cuadro completo (todas las rondas) con byes y 3er puesto opcional. */
export function buildBracket(qualifiers: readonly Qualifier[], options: { thirdPlace: boolean }): BracketPlan {
  if (new Set(qualifiers.map((q) => q.teamId)).size !== qualifiers.length) {
    throw new Error("Hay equipos repetidos entre los clasificados.");
  }
  const size = bracketSize(qualifiers.length);
  const rounds = Math.log2(size);
  const slots = placeSeeds(orderSeeds(qualifiers), size);
  const warnings: string[] = [];
  const matches: BracketMatchPlan[] = [];
  const key = (round: number, position: number) => `r${round}-m${position}`;

  for (let round = 1; round <= rounds; round++) {
    const count = size / 2 ** round;
    for (let position = 0; position < count; position++) {
      const isFinal = round === rounds;
      matches.push({
        key: key(round, position),
        round,
        position,
        home: round === 1 ? (slots[position * 2]?.teamId ?? null) : null,
        away: round === 1 ? (slots[position * 2 + 1]?.teamId ?? null) : null,
        isBye: false,
        isThirdPlace: false,
        winnerTeamId: null,
        next: isFinal ? null : { key: key(round + 1, Math.floor(position / 2)), side: position % 2 === 0 ? "home" : "away" },
        loserNext: null,
      });
    }
  }

  // Byes: pasan directo a la ronda siguiente.
  const byKey = new Map(matches.map((m) => [m.key, m]));
  for (const match of matches.filter((m) => m.round === 1)) {
    if (match.home && match.away) continue;
    match.isBye = true;
    match.winnerTeamId = match.home ?? match.away;
    const next = match.next ? byKey.get(match.next.key) : undefined;
    if (next && match.next) next[match.next.side] = match.winnerTeamId;
  }

  // Partido por el 3er puesto: los perdedores de las semifinales.
  if (options.thirdPlace) {
    const semis = matches.filter((m) => m.round === rounds - 1);
    if (rounds < 2) {
      warnings.push("Con 2 clasificados no hay partido por el 3er puesto.");
    } else if (semis.some((m) => m.isBye)) {
      warnings.push("No hay partido por el 3er puesto: una semifinal se define por bye.");
    } else {
      const thirdKey = "third-place";
      semis.forEach((semi, index) => {
        semi.loserNext = { key: thirdKey, side: index === 0 ? "home" : "away" };
      });
      matches.push({
        key: thirdKey,
        round: rounds,
        position: 1,
        home: null,
        away: null,
        isBye: false,
        isThirdPlace: true,
        winnerTeamId: null,
        next: null,
        loserNext: null,
      });
    }
  }

  return { size, rounds, matches, warnings };
}

// -----------------------------------------------------------------------------
// Avance de ganadores (también lo aplica la RPC de resultados en la base)
// -----------------------------------------------------------------------------

export type BracketMatchState = {
  id: string;
  homeTeamId: string | null;
  awayTeamId: string | null;
  winnerTeamId: string | null;
  nextMatchId: string | null;
  nextMatchSide: Side | null;
  loserNextMatchId: string | null;
  loserNextMatchSide: Side | null;
};

export type PropagationUpdate = { matchId: string; side: Side; teamId: string };

/**
 * Qué cambia en el cuadro al cargar el ganador de un partido: el ganador pasa
 * al partido siguiente y el perdedor (en semis) al del 3er puesto. Si alguno
 * de esos partidos ya tiene resultado con otro equipo, no se permite: primero
 * hay que borrar ese resultado.
 */
export function propagateResult(
  matches: readonly BracketMatchState[],
  matchId: string,
  winnerTeamId: string,
): { ok: true; updates: PropagationUpdate[] } | { ok: false; error: string } {
  const byId = new Map(matches.map((m) => [m.id, m]));
  const match = byId.get(matchId);
  if (!match) return { ok: false, error: "El partido no existe." };
  if (winnerTeamId !== match.homeTeamId && winnerTeamId !== match.awayTeamId) {
    return { ok: false, error: "El ganador tiene que ser uno de los equipos del partido." };
  }
  const loserTeamId = winnerTeamId === match.homeTeamId ? match.awayTeamId : match.homeTeamId;

  const moves: [string | null, Side | null, string | null][] = [
    [match.nextMatchId, match.nextMatchSide, winnerTeamId],
    [match.loserNextMatchId, match.loserNextMatchSide, loserTeamId],
  ];

  const updates: PropagationUpdate[] = [];
  for (const [targetId, side, teamId] of moves) {
    if (!targetId || !side || !teamId) continue;
    const target = byId.get(targetId);
    if (!target) return { ok: false, error: "El cuadro está incompleto." };
    const current = side === "home" ? target.homeTeamId : target.awayTeamId;
    if (target.winnerTeamId && current !== teamId) {
      return {
        ok: false,
        error: "El partido siguiente ya tiene resultado: borralo antes de corregir este.",
      };
    }
    if (current !== teamId) updates.push({ matchId: targetId, side, teamId });
  }
  return { ok: true, updates };
}
