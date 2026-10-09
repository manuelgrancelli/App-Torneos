import { createRng, shuffle } from "./random";

/**
 * Armado de grupos: sorteo reproducible (con semilla) y validación del armado
 * manual (drag and drop).
 */

export const MIN_GROUP_SIZE = 2;
const LETTERS = "ABCDEFGHIJKLMNOPQRSTUVWXYZ";

/** "Grupo A", "Grupo B"… (hasta 26 grupos). */
export function groupName(index: number): string {
  const letter = LETTERS[index];
  if (index < 0 || !letter) throw new RangeError("Índice de grupo fuera de rango.");
  return `Grupo ${letter}`;
}

/** Cantidades de grupos posibles para n equipos (cada grupo con al menos 2). */
export function groupCountOptions(teamCount: number): number[] {
  const max = Math.min(Math.floor(teamCount / MIN_GROUP_SIZE), LETTERS.length);
  return Array.from({ length: Math.max(max, 0) }, (_, i) => i + 1);
}

export type GroupConflict = {
  groupIndex: number;
  teamA: string;
  teamB: string;
};

/**
 * Detecta parejas incompatibles dentro de un mismo grupo.
 * Dos equipos son incompatibles si ambos indicaron disponibilidad pero no tienen
 * ninguna franja horaria en común.
 */
export function getGroupAvailabilityConflicts(
  groups: readonly (readonly string[])[],
  availability?: Readonly<Record<string, readonly string[]>>,
): GroupConflict[] {
  if (!availability) return [];
  const conflicts: GroupConflict[] = [];

  groups.forEach((group, groupIndex) => {
    for (let i = 0; i < group.length; i++) {
      const teamA = group[i]!;
      const slotsA = availability[teamA];
      if (!slotsA || slotsA.length === 0) continue;
      const setA = new Set(slotsA);

      for (let j = i + 1; j < group.length; j++) {
        const teamB = group[j]!;
        const slotsB = availability[teamB];
        if (!slotsB || slotsB.length === 0) continue;

        const hasCommonSlot = slotsB.some((s) => setA.has(s));
        if (!hasCommonSlot) {
          conflicts.push({ groupIndex, teamA, teamB });
        }
      }
    }
  });

  return conflicts;
}

/**
 * Sorteo: reparte los equipos en grupos de tamaños que difieren a lo sumo en 1,
 * optimizando para que las parejas compartan franjas horarias disponibles y
 * evitando que queden en el mismo grupo equipos sin franjas en común.
 * Es reproducible: con la misma semilla, mismos equipos y misma disponibilidad
 * produce exactamente el mismo resultado determinístico.
 */
export function drawGroups(
  teamIds: readonly string[],
  groupCount: number,
  seed: number,
  availability?: Readonly<Record<string, readonly string[]>>,
): string[][] {
  if (new Set(teamIds).size !== teamIds.length) throw new Error("Hay equipos repetidos.");
  if (!groupCountOptions(teamIds.length).includes(groupCount)) {
    throw new RangeError(
      `Con ${teamIds.length} equipos se pueden armar entre 1 y ${Math.floor(teamIds.length / MIN_GROUP_SIZE)} grupos.`,
    );
  }

  const rng = createRng(seed);

  // Si no se pasó disponibilidad o nadie tiene franjas cargadas, sorteo uniforme
  const hasAnyAvailability =
    availability &&
    Object.values(availability).some((slots) => Array.isArray(slots) && slots.length > 0);

  if (!hasAnyAvailability) {
    const groups: string[][] = Array.from({ length: groupCount }, () => []);
    shuffle(teamIds, rng).forEach((teamId, index) => {
      groups[index % groupCount]?.push(teamId);
    });
    return groups;
  }

  const teamCount = teamIds.length;
  const baseSize = Math.floor(teamCount / groupCount);
  const remainder = teamCount % groupCount;
  // Grupos más grandes primero para mantener consistencia
  const targetSizes = Array.from({ length: groupCount }, (_, i) => baseSize + (i < remainder ? 1 : 0));

  const teamSlotSets = new Map<string, Set<string>>();
  for (const id of teamIds) {
    const slots = availability[id];
    if (slots && slots.length > 0) {
      teamSlotSets.set(id, new Set(slots));
    }
  }

  const pairKey = (a: string, b: string) => (a < b ? `${a}|${b}` : `${b}|${a}`);
  const pairConflict = new Map<string, boolean>();
  const pairOverlap = new Map<string, number>();

  for (let i = 0; i < teamIds.length; i++) {
    const a = teamIds[i]!;
    const slotsA = teamSlotSets.get(a);
    for (let j = i + 1; j < teamIds.length; j++) {
      const b = teamIds[j]!;
      const slotsB = teamSlotSets.get(b);
      const key = pairKey(a, b);

      if (slotsA && slotsB) {
        let common = 0;
        for (const s of slotsA) {
          if (slotsB.has(s)) common++;
        }
        if (common === 0) {
          pairConflict.set(key, true);
          pairOverlap.set(key, 0);
        } else {
          pairConflict.set(key, false);
          pairOverlap.set(key, common);
        }
      } else {
        pairConflict.set(key, false);
        pairOverlap.set(key, 0);
      }
    }
  }

  const getConflict = (a: string, b: string) => pairConflict.get(pairKey(a, b)) ?? false;
  const getOverlap = (a: string, b: string) => pairOverlap.get(pairKey(a, b)) ?? 0;

  function evaluateGroups(groups: string[][]): { conflicts: number; overlap: number } {
    let conflicts = 0;
    let overlap = 0;
    for (const group of groups) {
      for (let i = 0; i < group.length; i++) {
        const a = group[i]!;
        for (let j = i + 1; j < group.length; j++) {
          const b = group[j]!;
          if (getConflict(a, b)) conflicts++;
          overlap += getOverlap(a, b);
        }
      }
    }
    return { conflicts, overlap };
  }

  let bestGroups: string[][] | null = null;
  let minConflicts = Infinity;
  let maxOverlap = -Infinity;

  const RESTARTS = 40;

  for (let attempt = 0; attempt < RESTARTS; attempt++) {
    const shuffledTeams = shuffle([...teamIds], rng);

    if (attempt % 2 === 1) {
      shuffledTeams.sort((a, b) => {
        let confA = 0;
        let confB = 0;
        for (const t of teamIds) {
          if (t !== a && getConflict(a, t)) confA++;
          if (t !== b && getConflict(b, t)) confB++;
        }
        return confB - confA || (rng() < 0.5 ? -1 : 1);
      });
    }

    const currentGroups: string[][] = Array.from({ length: groupCount }, () => []);

    for (const team of shuffledTeams) {
      const candidateIndices: number[] = [];
      for (let g = 0; g < groupCount; g++) {
        if (currentGroups[g]!.length < targetSizes[g]!) {
          candidateIndices.push(g);
        }
      }

      let bestGroup = candidateIndices[0]!;
      let bestScore = Infinity;

      shuffle(candidateIndices, rng);

      for (const g of candidateIndices) {
        const group = currentGroups[g]!;
        let addedConflicts = 0;
        let addedOverlap = 0;
        for (const member of group) {
          if (getConflict(team, member)) addedConflicts++;
          addedOverlap += getOverlap(team, member);
        }

        const score = addedConflicts * 10000 - addedOverlap + rng() * 0.1;
        if (score < bestScore) {
          bestScore = score;
          bestGroup = g;
        }
      }

      currentGroups[bestGroup]!.push(team);
    }

    let { conflicts: curConflicts, overlap: curOverlap } = evaluateGroups(currentGroups);

    let improved = true;
    let localSteps = 0;
    while (improved && localSteps < 100) {
      improved = false;
      localSteps++;

      for (let g1 = 0; g1 < groupCount; g1++) {
        for (let g2 = g1 + 1; g2 < groupCount; g2++) {
          const group1 = currentGroups[g1]!;
          const group2 = currentGroups[g2]!;

          for (let i = 0; i < group1.length; i++) {
            const teamA = group1[i]!;
            for (let j = 0; j < group2.length; j++) {
              const teamB = group2[j]!;

              let oldAInG1Conflicts = 0;
              let oldAInG1Overlap = 0;
              let oldBInG2Conflicts = 0;
              let oldBInG2Overlap = 0;
              let newBInG1Conflicts = 0;
              let newBInG1Overlap = 0;
              let newAInG2Conflicts = 0;
              let newAInG2Overlap = 0;

              for (const m of group1) {
                if (m === teamA) continue;
                if (getConflict(teamA, m)) oldAInG1Conflicts++;
                oldAInG1Overlap += getOverlap(teamA, m);
                if (getConflict(teamB, m)) newBInG1Conflicts++;
                newBInG1Overlap += getOverlap(teamB, m);
              }

              for (const m of group2) {
                if (m === teamB) continue;
                if (getConflict(teamB, m)) oldBInG2Conflicts++;
                oldBInG2Overlap += getOverlap(teamB, m);
                if (getConflict(teamA, m)) newAInG2Conflicts++;
                newAInG2Overlap += getOverlap(teamA, m);
              }

              const deltaConflicts = newBInG1Conflicts + newAInG2Conflicts - (oldAInG1Conflicts + oldBInG2Conflicts);
              const deltaOverlap = newBInG1Overlap + newAInG2Overlap - (oldAInG1Overlap + oldBInG2Overlap);

              if (deltaConflicts < 0 || (deltaConflicts === 0 && deltaOverlap > 0)) {
                group1[i] = teamB;
                group2[j] = teamA;
                curConflicts += deltaConflicts;
                curOverlap += deltaOverlap;
                improved = true;
                break;
              }
            }
            if (improved) break;
          }
          if (improved) break;
        }
        if (improved) break;
      }
    }

    if (
      curConflicts < minConflicts ||
      (curConflicts === minConflicts && curOverlap > maxOverlap)
    ) {
      minConflicts = curConflicts;
      maxOverlap = curOverlap;
      bestGroups = currentGroups.map((g) => [...g]);

      if (minConflicts === 0 && attempt >= 10) {
        break;
      }
    }
  }

  if (!bestGroups) {
    const fallback: string[][] = Array.from({ length: groupCount }, () => []);
    shuffle(teamIds, rng).forEach((teamId, index) => {
      fallback[index % groupCount]?.push(teamId);
    });
    return fallback;
  }

  const shuffledGroups = shuffle(bestGroups, rng);
  shuffledGroups.sort((a, b) => b.length - a.length);
  return shuffledGroups.map((g) => shuffle(g, rng));
}

export type GroupsValidation = { ok: true } | { ok: false; errors: string[] };

/** Valida un armado manual: cada equipo aprobado en exactamente un grupo, grupos de 2+. */
export function validateGroups(teamIds: readonly string[], groups: readonly (readonly string[])[]): GroupsValidation {
  const errors: string[] = [];
  const expected = new Set(teamIds);
  const seen = new Set<string>();

  if (groups.length === 0) errors.push("Tiene que haber al menos un grupo.");
  if (groups.length > LETTERS.length) errors.push(`Puede haber como máximo ${LETTERS.length} grupos.`);

  groups.forEach((group, index) => {
    if (group.length < MIN_GROUP_SIZE) {
      errors.push(`${groupName(Math.min(index, LETTERS.length - 1))} tiene que tener al menos ${MIN_GROUP_SIZE} equipos.`);
    }
    for (const teamId of group) {
      if (!expected.has(teamId)) errors.push("Hay un equipo que no está aprobado en el torneo.");
      else if (seen.has(teamId)) errors.push("Un equipo aparece en más de un grupo.");
      seen.add(teamId);
    }
  });

  const missing = teamIds.filter((id) => !seen.has(id)).length;
  if (missing > 0) {
    errors.push(missing === 1 ? "Falta asignar 1 equipo." : `Faltan asignar ${missing} equipos.`);
  }

  return errors.length === 0 ? { ok: true } : { ok: false, errors: [...new Set(errors)] };
}
