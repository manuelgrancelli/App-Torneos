/**
 * Aleatoriedad determinística: con la misma semilla, el mismo resultado.
 * Sirve para sorteos reproducibles (grupos, desempates por sorteo) y tests.
 * No es criptográfica: no usar para códigos ni secretos.
 */

/** Generador mulberry32: rápido, 32 bits de estado, buena distribución para sorteos. */
export function createRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state + 0x6d2b79f5) >>> 0;
    let t = state;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** Mezcla Fisher-Yates sin modificar el arreglo original. */
export function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const result = [...items];
  for (let i = result.length - 1; i > 0; i--) {
    const j = Math.floor(rng() * (i + 1));
    [result[i], result[j]] = [result[j] as T, result[i] as T];
  }
  return result;
}

/** Hash FNV-1a de 32 bits: clave estable para ordenar "por sorteo" sin estado. */
export function hashString(value: string): number {
  let hash = 0x811c9dc5;
  for (let i = 0; i < value.length; i++) {
    hash ^= value.charCodeAt(i);
    hash = Math.imul(hash, 0x01000193);
  }
  return hash >>> 0;
}

/** Semilla aleatoria para un sorteo nuevo (la app la guarda para poder reproducirlo). */
export function randomSeed(): number {
  return Math.floor(Math.random() * 2147483647);
}
