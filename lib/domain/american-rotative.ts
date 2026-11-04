import { createRng, shuffle } from "./random";
import { generateRoundRobin } from "./round-robin";

/**
 * Fixture para Torneo Americano de Pádel.
 * Contempla:
 * 1. INDIVIDUAL_ROTATIVO: Whist Tournament / Social Golfer para N participantes (múltiplo de 4)
 *    donde cada jugador disputa partidos rotando de compañero y minimizando rivales repetidos.
 * 2. PAREJAS_FIJAS: Round-robin de duplas fijas con asignación inteligente de canchas y turnos.
 */

export type AmericanRotativeMatch = {
  roundNumber: number;
  courtNumber: number;
  shiftNumber: number;
  orderNumber: number;
  sideA: [string, string];
  sideB: [string, string];
};

export type AmericanFixedPairsMatch = {
  roundNumber: number;
  courtNumber: number;
  shiftNumber: number;
  orderNumber: number;
  pairAId: string;
  pairBId: string;
};

export type GenerateRotativeOptions = {
  participantIds: readonly string[];
  courtCount: number;
  roundsCount?: number;
  seed?: number;
};

/**
 * Genera el fixture rotativo individual para N participantes (múltiplo de 4).
 * Cada cruce asigna exactamente 4 jugadores en parejas: (p1, p2) vs (p3, p4).
 */
export function generateAmericanRotativeFixture(options: GenerateRotativeOptions): AmericanRotativeMatch[] {
  const { participantIds, courtCount, seed = 42 } = options;
  const n = participantIds.length;

  if (n < 4) {
    throw new Error("Se requiere un mínimo de 4 participantes para un torneo americano.");
  }
  if (n % 4 !== 0) {
    throw new Error(`La cantidad de participantes (${n}) debe ser múltiplo de 4 (8, 12, 16, etc.).`);
  }
  if (courtCount < 1) {
    throw new Error("Se requiere al menos 1 cancha disponible.");
  }

  // Rondas sugeridas por defecto si no se especifican:
  // N=4: 3 rondas (todas las combinaciones posibles)
  // N=8: 7 rondas (Whist canónico Wh(8) perfecto)
  // N>=12: 5 rondas estándar de jornada americana
  const defaultRounds = n === 4 ? 3 : n === 8 ? 7 : Math.min(n - 1, 5);
  const rounds = options.roundsCount ?? defaultRounds;

  if (rounds < 1) {
    throw new Error("La cantidad de rondas debe ser al menos 1.");
  }

  // 1. Caso especial canónico óptimo para N=4:
  if (n === 4) {
    return generateWhist4(participantIds, courtCount, rounds);
  }

  // 2. Caso especial canónico óptimo para N=8 (Whist Wh(8) perfecto con 0 compañeros repetidos):
  if (n === 8 && rounds <= 7) {
    return generateWhist8(participantIds, courtCount, rounds);
  }

  // 3. Solver combinatorio general para N >= 12
  return generateGeneralRotative(participantIds, courtCount, rounds, seed);
}

/**
 * Fixture de 4 jugadores (1 sola cancha, 3 rondas sin repetir compañero).
 */
function generateWhist4(
  ids: readonly string[],
  courtCount: number,
  roundsCount: number
): AmericanRotativeMatch[] {
  const p = ids;
  const canonical = [
    { sideA: [p[0]!, p[1]!] as [string, string], sideB: [p[2]!, p[3]!] as [string, string] },
    { sideA: [p[0]!, p[2]!] as [string, string], sideB: [p[1]!, p[3]!] as [string, string] },
    { sideA: [p[0]!, p[3]!] as [string, string], sideB: [p[1]!, p[2]!] as [string, string] },
  ];

  const result: AmericanRotativeMatch[] = [];
  let orderNumber = 1;

  for (let r = 0; r < roundsCount; r++) {
    const match = canonical[r % 3]!;
    result.push({
      roundNumber: r + 1,
      courtNumber: 1,
      shiftNumber: 1,
      orderNumber: orderNumber++,
      sideA: match.sideA,
      sideB: match.sideB,
    });
  }

  return result;
}

/**
 * Whist Tournament canónico Wh(8) en Z_7 U {infinito}.
 * Garantiza matemáticamente que en 7 rondas:
 * - Cada jugador tiene a los otros 7 como compañeros exactamente 1 vez.
 * - Cada jugador enfrenta a los otros 7 como rivales exactamente 2 veces.
 */
function generateWhist8(
  ids: readonly string[],
  courtCount: number,
  roundsCount: number
): AmericanRotativeMatch[] {
  const result: AmericanRotativeMatch[] = [];
  let orderNumber = 1;

  for (let r = 0; r < roundsCount; r++) {
    const add = (x: number) => (x + r) % 7;

    // Mesa 1: (inf, r) vs (1+r, 3+r)
    const m1A: [string, string] = [ids[7]!, ids[add(0)]!];
    const m1B: [string, string] = [ids[add(1)]!, ids[add(3)]!];

    // Mesa 2: (2+r, 6+r) vs (4+r, 5+r)
    const m2A: [string, string] = [ids[add(2)]!, ids[add(6)]!];
    const m2B: [string, string] = [ids[add(4)]!, ids[add(5)]!];

    const roundMatches = [
      { sideA: m1A, sideB: m1B },
      { sideA: m2A, sideB: m2B },
    ];

    roundMatches.forEach((m, matchIdx) => {
      const courtNumber = (matchIdx % courtCount) + 1;
      const shiftNumber = Math.floor(matchIdx / courtCount) + 1;

      result.push({
        roundNumber: r + 1,
        courtNumber,
        shiftNumber,
        orderNumber: orderNumber++,
        sideA: m.sideA,
        sideB: m.sideB,
      });
    });
  }

  return result;
}

/**
 * Solver combinatorio voraz con múltiples reinicios para N >= 12.
 * Minimiza la función de penalización por repetición de compañeros y rivales.
 */
function generateGeneralRotative(
  ids: readonly string[],
  courtCount: number,
  roundsCount: number,
  seed: number
): AmericanRotativeMatch[] {
  const n = ids.length;
  const matchesPerRound = n / 4;
  const rng = createRng(seed);

  // Matrices de historial (0 = nunca jugaron juntos)
  const partners = Array.from({ length: n }, () => new Uint8Array(n));
  const opponents = Array.from({ length: n }, () => new Uint8Array(n));

  const result: AmericanRotativeMatch[] = [];
  let orderNumber = 1;

  for (let r = 0; r < roundsCount; r++) {
    let bestRound: { sideA: [number, number]; sideB: [number, number] }[] | null = null;
    let minCost = Number.POSITIVE_INFINITY;

    // Realizar hasta 300 intentos de partición aleatoria guiada
    const attempts = 300;
    for (let attempt = 0; attempt < attempts; attempt++) {
      const pool = shuffle(Array.from({ length: n }, (_, i) => i), rng);
      let cost = 0;
      const roundCandidates: { sideA: [number, number]; sideB: [number, number] }[] = [];

      for (let i = 0; i < n; i += 4) {
        const a = pool[i]!;
        const b = pool[i + 1]!;
        const c = pool[i + 2]!;
        const d = pool[i + 3]!;

        // Evaluar las 3 posibles formaciones de parejas entre {a, b, c, d}
        const formations = [
          { sideA: [a, b] as [number, number], sideB: [c, d] as [number, number] },
          { sideA: [a, c] as [number, number], sideB: [b, d] as [number, number] },
          { sideA: [a, d] as [number, number], sideB: [b, c] as [number, number] },
        ];

        let bestFormation = formations[0]!;
        let bestFormationCost = Number.POSITIVE_INFINITY;

        for (const f of formations) {
          const [p1, p2] = f.sideA;
          const [p3, p4] = f.sideB;

          // Penalización altísima por repetir compañero (1000 pts)
          const pCost = (partners[p1]![p2]! + partners[p3]![p4]!) * 1000;
          // Penalización moderada por repetir rival (10 pts)
          const oCost =
            (opponents[p1]![p3]! +
              opponents[p1]![p4]! +
              opponents[p2]![p3]! +
              opponents[p2]![p4]!) * 10;

          const fCost = pCost + oCost;
          if (fCost < bestFormationCost) {
            bestFormationCost = fCost;
            bestFormation = f;
          }
        }

        cost += bestFormationCost;
        roundCandidates.push(bestFormation);
      }

      if (cost < minCost) {
        minCost = cost;
        bestRound = roundCandidates;
        if (cost === 0) break; // Encontrada partición óptima perfecta
      }
    }

    if (!bestRound) {
      throw new Error(`No se pudo generar un emparejamiento válido para la ronda ${r + 1}.`);
    }

    // Registrar en matrices de historial
    for (const match of bestRound) {
      const [p1, p2] = match.sideA;
      const [p3, p4] = match.sideB;

      const inc = (arr: Uint8Array[], i: number, j: number) => {
        const row = arr[i];
        if (row && typeof row[j] === "number") {
          row[j] += 1;
        }
      };

      inc(partners, p1, p2);
      inc(partners, p2, p1);
      inc(partners, p3, p4);
      inc(partners, p4, p3);

      inc(opponents, p1, p3);
      inc(opponents, p3, p1);
      inc(opponents, p1, p4);
      inc(opponents, p4, p1);
      inc(opponents, p2, p3);
      inc(opponents, p3, p2);
      inc(opponents, p2, p4);
      inc(opponents, p4, p2);
    }

    // Asignar canchas y turnos para esta ronda
    bestRound.forEach((m, matchIdx) => {
      const courtNumber = (matchIdx % courtCount) + 1;
      const shiftNumber = Math.floor(matchIdx / courtCount) + 1;

      result.push({
        roundNumber: r + 1,
        courtNumber,
        shiftNumber,
        orderNumber: orderNumber++,
        sideA: [ids[m.sideA[0]]!, ids[m.sideA[1]]!],
        sideB: [ids[m.sideB[0]]!, ids[m.sideB[1]]!],
      });
    });
  }

  return result;
}

/**
 * Genera el fixture para la modalidad PAREJAS_FIJAS (round-robin clásico con canchas y turnos).
 */
export function generateAmericanFixedPairsFixture(
  pairIds: readonly string[],
  courtCount: number,
  roundsCount?: number
): AmericanFixedPairsMatch[] {
  if (pairIds.length < 2) {
    throw new Error("Se requieren al menos 2 parejas para armar el torneo.");
  }
  if (courtCount < 1) {
    throw new Error("Se requiere al menos 1 cancha disponible.");
  }

  const rrRounds = generateRoundRobin(pairIds);
  const totalRounds = roundsCount ? Math.min(roundsCount, rrRounds.length) : rrRounds.length;
  const result: AmericanFixedPairsMatch[] = [];
  let orderNumber = 1;

  for (let r = 0; r < totalRounds; r++) {
    const roundData = rrRounds[r]!;

    roundData.pairings.forEach((pairing, matchIdx) => {
      const courtNumber = (matchIdx % courtCount) + 1;
      const shiftNumber = Math.floor(matchIdx / courtCount) + 1;

      result.push({
        roundNumber: r + 1,
        courtNumber,
        shiftNumber,
        orderNumber: orderNumber++,
        pairAId: pairing.home,
        pairBId: pairing.away,
      });
    });
  }

  return result;
}

