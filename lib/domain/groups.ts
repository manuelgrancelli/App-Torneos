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

/**
 * Sorteo: mezcla con la semilla y reparte en orden, así los tamaños difieren
 * a lo sumo en 1. Misma semilla y mismos equipos = mismo resultado.
 */
export function drawGroups(teamIds: readonly string[], groupCount: number, seed: number): string[][] {
  if (new Set(teamIds).size !== teamIds.length) throw new Error("Hay equipos repetidos.");
  if (!groupCountOptions(teamIds.length).includes(groupCount)) {
    throw new RangeError(
      `Con ${teamIds.length} equipos se pueden armar entre 1 y ${Math.floor(teamIds.length / MIN_GROUP_SIZE)} grupos.`,
    );
  }

  const groups: string[][] = Array.from({ length: groupCount }, () => []);
  shuffle(teamIds, createRng(seed)).forEach((teamId, index) => {
    groups[index % groupCount]?.push(teamId);
  });
  return groups;
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
