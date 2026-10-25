/**
 * Algoritmos de normalización y coincidencia inteligente para categorías deportivas.
 * Identifica que "5ta caballreos", "5TA Caballeros", "5ta masc", "5º caballeros"
 * refieren a la misma categoría, tolerando mayúsculas, tildes, formatos de número
 * y errores tipográficos comunes (como transposición de letras 're' / 'er').
 */

export type CanonicalGender = "caballeros" | "damas" | "mixto";

export type NormalizedCategory = {
  raw: string;
  cleanedText: string;
  level: string | null;
  gender: CanonicalGender | null;
  normalizedKey: string;
};

/**
 * Distancia Damerau-Levenshtein: cuenta inserciones, eliminaciones,
 * sustituciones y transposiciones de caracteres adyacentes.
 */
export function damerauLevenshteinDistance(a: string, b: string): number {
  if (a === b) return 0;
  const lenA = a.length;
  const lenB = b.length;
  if (lenA === 0) return lenB;
  if (lenB === 0) return lenA;

  const d: number[][] = [];
  for (let i = 0; i <= lenA; i++) {
    d[i] = [];
    d[i]![0] = i;
  }
  for (let j = 0; j <= lenB; j++) {
    d[0]![j] = j;
  }

  for (let i = 1; i <= lenA; i++) {
    for (let j = 1; j <= lenB; j++) {
      const charA = a[i - 1];
      const charB = b[j - 1];
      const cost = charA === charB ? 0 : 1;

      d[i]![j] = Math.min(
        d[i - 1]![j]! + 1, // eliminación
        d[i]![j - 1]! + 1, // inserción
        d[i - 1]![j - 1]! + cost, // sustitución
      );

      // Transposición de caracteres adyacentes (ej. 're' <-> 'er' en caballreos / caballeros)
      if (
        i > 1 &&
        j > 1 &&
        charA === b[j - 2] &&
        a[i - 2] === charB
      ) {
        d[i]![j] = Math.min(d[i]![j]!, d[i - 2]![j - 2]! + 1);
      }
    }
  }

  return d[lenA]![lenB]!;
}

/**
 * Elimina acentos/tildes y caracteres diacríticos.
 */
export function removeDiacritics(str: string): string {
  return str.normalize("NFD").replace(/[\u0300-\u036f]/g, "");
}

/**
 * Limpia puntuación, formato WhatsApp/Markdown y normaliza espacios.
 */
export function sanitizeCategoryText(raw: string): string {
  return removeDiacritics(raw)
    .toLowerCase()
    .replace(/^[\s*~_#➡️👉🔹▪️•\-|>]+|[\s*~_#]+$/g, "")
    .replace(/[()[\]{}.,:;\/\\|_\-~*#]/g, " ")
    .replace(/\s+/g, " ")
    .trim();
}

const GENDER_EXACT: Record<string, CanonicalGender> = {
  // Caballeros / Masculino
  caballeros: "caballeros",
  caballero: "caballeros",
  caballreos: "caballeros", // Transposición tipográfica habitual
  cballeros: "caballeros",
  caballros: "caballeros",
  caballerosss: "caballeros",
  masculino: "caballeros",
  masculinos: "caballeros",
  masc: "caballeros",
  hombres: "caballeros",
  hombre: "caballeros",
  varones: "caballeros",
  varon: "caballeros",
  cab: "caballeros",

  // Damas / Femenino
  damas: "damas",
  dama: "damas",
  dmas: "damas",
  femenino: "damas",
  femenina: "damas",
  femeninas: "damas",
  fem: "damas",
  mujeres: "damas",
  mujer: "damas",

  // Mixto
  mixto: "mixto",
  mixtos: "mixto",
  mixta: "mixto",
  mixtas: "mixto",
  mix: "mixto",
};

const NUMBER_WORDS: Record<string, string> = {
  primera: "1",
  primero: "1",
  segunda: "2",
  segundo: "2",
  tercera: "3",
  tercero: "3",
  cuarta: "4",
  cuarto: "4",
  quinta: "5",
  quinto: "5",
  sexta: "6",
  sexto: "6",
  septima: "7",
  septimo: "7",
  octava: "8",
  octavo: "8",
  novena: "9",
  noveno: "9",
  decima: "10",
  decimo: "10",
  principiantes: "principiantes",
  principiante: "principiantes",
  iniciados: "principiantes",
  iniciado: "principiantes",
};

/**
 * Detecta si una palabra aislada se aproxima fuertemente a una designación de género.
 */
function detectGenderToken(word: string): CanonicalGender | null {
  const direct = GENDER_EXACT[word];
  if (direct) return direct;

  // Tolerancia difusa a errores de tipeo
  if (word.length >= 6 && damerauLevenshteinDistance(word, "caballeros") <= 2) {
    return "caballeros";
  }
  if (word.length >= 7 && damerauLevenshteinDistance(word, "masculino") <= 2) {
    return "caballeros";
  }
  if (word.length >= 4 && damerauLevenshteinDistance(word, "damas") <= 1) {
    return "damas";
  }
  if (word.length >= 6 && damerauLevenshteinDistance(word, "femenino") <= 2) {
    return "damas";
  }
  if (word.length >= 4 && damerauLevenshteinDistance(word, "mixto") <= 1) {
    return "mixto";
  }

  return null;
}

/**
 * Normaliza y extrae los componentes canónicos de un nombre de categoría.
 */
export function normalizeCategory(rawName: string): NormalizedCategory {
  const cleaned = sanitizeCategoryText(rawName);
  const words = cleaned.split(" ").filter(Boolean);

  let level: string | null = null;
  let gender: CanonicalGender | null = null;
  const otherTokens: string[] = [];

  // 1. Detectar patrón Suma (ej: "suma 10", "suma10", "+10", "+ 12")
  const sumaMatch = cleaned.match(/(?:^|\s)(?:suma\s*\+?|\+)(\d{1,2})(?:\s|$)/);
  if (sumaMatch && sumaMatch[1]) {
    level = `suma_${sumaMatch[1]}`;
  }

  // 2. Analizar palabras para identificar nivel ordinal y género
  for (const word of words) {
    // Si ya detectamos género o es un token de género
    const detectedGender = detectGenderToken(word);
    if (detectedGender) {
      if (!gender) gender = detectedGender;
      continue;
    }

    // Si es palabra de número ordinal (ej. "quinta" -> "5")
    if (NUMBER_WORDS[word]) {
      if (!level) level = NUMBER_WORDS[word]!;
      continue;
    }

    // Si es número con sufijo ordinal (ej. "5ta", "5to", "5ª", "5°", "5ta.", "5")
    const ordMatch = word.match(/^(\d{1,2})(?:ra|da|ta|ma|va|na|ro|do|to|mo|vo|no|°|ª|\.)?$/);
    if (ordMatch && ordMatch[1]) {
      if (!level) level = ordMatch[1];
      continue;
    }

    // Palabras ignorables comunes
    if (["categoria", "cat", "division", "zona", "grupo", "torneo", "de"].includes(word)) {
      continue;
    }

    otherTokens.push(word);
  }

  // Si no se detectó nivel ni género pero hay tokens
  if (!level && otherTokens.length > 0) {
    level = otherTokens.join("_");
  }

  // Construir clave normalizada única
  const keyParts: string[] = [];
  if (level) keyParts.push(level);
  if (gender) keyParts.push(gender);
  if (!level && !gender && otherTokens.length > 0) {
    keyParts.push(otherTokens.join("_"));
  }
  const normalizedKey = keyParts.length > 0 ? keyParts.join("_") : cleaned;

  return {
    raw: rawName,
    cleanedText: cleaned,
    level,
    gender,
    normalizedKey,
  };
}

/**
 * Compara dos nombres de categorías y determina si representan la misma categoría.
 * Soporta variaciones de mayúsculas, tildes, números (5ta vs 5TA vs 5 vs quinta),
 * transposición tipográfica ("caballreos" vs "caballeros") y abreviaturas ("masc" vs "caballeros").
 */
export function areCategoriesEquivalent(nameA: string, nameB: string): boolean {
  if (!nameA || !nameB) return false;

  const trimA = nameA.trim();
  const trimB = nameB.trim();

  // 1. Coincidencia exacta insensible a mayúsculas
  if (trimA.toLowerCase() === trimB.toLowerCase()) {
    return true;
  }

  const normA = normalizeCategory(nameA);
  const normB = normalizeCategory(nameB);

  // 2. Coincidencia de texto limpio
  if (normA.cleanedText === normB.cleanedText) {
    return true;
  }

  // 3. Clave canónica idéntica (ej. ambos son "5_caballeros" o "suma_10_caballeros")
  if (normA.normalizedKey === normB.normalizedKey && normA.normalizedKey.length > 0) {
    return true;
  }

  // 4. Si ambos tienen nivel especificado
  if (normA.level && normB.level) {
    // Si los niveles son distintos (ej. 5 vs 6 o Suma 10 vs Suma 12), NUNCA son equivalentes
    if (normA.level !== normB.level) {
      return false;
    }

    // Si los niveles coinciden:
    // a) Ambos tienen género especificado:
    if (normA.gender && normB.gender) {
      return normA.gender === normB.gender;
    }

    // b) Uno tiene género y el otro no (ej. "5ta" vs "5ta Caballeros"):
    // Pueden considerarse compatibles si no hay conflicto de tokens adicionales
    return true;
  }

  // 5. Comparación difusa en categorías no numéricas (ej. nombres de zonas o nombres propios)
  if (normA.cleanedText.length >= 5 && normB.cleanedText.length >= 5) {
    const dist = damerauLevenshteinDistance(normA.cleanedText, normB.cleanedText);
    const maxLen = Math.max(normA.cleanedText.length, normB.cleanedText.length);
    // Tolerar hasta 2 errores tipográficos para palabras de más de 6 letras
    if (dist <= 2 && dist / maxLen <= 0.25) {
      return true;
    }
  }

  return false;
}

/**
 * Busca en una lista de categorías existentes si alguna coincide o es equivalente
 * al nombre buscado. Devuelve la categoría coincidente o null.
 */
export function findMatchingCategory<T extends { id: string; name: string }>(
  categories: readonly T[],
  targetName: string,
): T | null {
  if (!targetName || categories.length === 0) return null;

  const targetTrimmed = targetName.trim().toLowerCase();

  // 1. Prioridad: Coincidencia exacta de texto
  const exact = categories.find((c) => c.name.trim().toLowerCase() === targetTrimmed);
  if (exact) return exact;

  // 2. Prioridad: Coincidencia por clave canónica exacta
  const targetNorm = normalizeCategory(targetName);
  const byKey = categories.find((c) => {
    const cNorm = normalizeCategory(c.name);
    return cNorm.normalizedKey === targetNorm.normalizedKey && targetNorm.normalizedKey.length > 0;
  });
  if (byKey) return byKey;

  // 3. Prioridad: Equivalencia con tolerancia a errores tipográficos
  const candidates = categories.filter((c) => areCategoriesEquivalent(c.name, targetName));

  if (candidates.length === 1) {
    return candidates[0]!;
  }

  if (candidates.length > 1) {
    // Si hay varias coincidencias compatibles (ej. target es "5ta" y existen "5ta Caballeros" y "5ta"),
    // preferir la que tenga el mismo género si el target lo define
    if (targetNorm.gender) {
      const sameGender = candidates.find((c) => normalizeCategory(c.name).gender === targetNorm.gender);
      if (sameGender) return sameGender;
    }
    // O la de menor distancia Damerau-Levenshtein
    const sorted = [...candidates].sort((a, b) => {
      const distA = damerauLevenshteinDistance(targetTrimmed, a.name.trim().toLowerCase());
      const distB = damerauLevenshteinDistance(targetTrimmed, b.name.trim().toLowerCase());
      return distA - distB;
    });
    return sorted[0] ?? null;
  }

  return null;
}

/**
 * Detecta pares o grupos de categorías en un torneo que son equivalentes
 * (ej. creadas accidentalmente por error de tipeo o diferencia de mayúsculas).
 */
export function findDuplicateCategoryPairs<T extends { id: string; name: string }>(
  categories: readonly T[],
): Array<{ primary: T; duplicate: T }> {
  const duplicates: Array<{ primary: T; duplicate: T }> = [];
  const handledIds = new Set<string>();

  for (let i = 0; i < categories.length; i++) {
    const catA = categories[i]!;
    if (handledIds.has(catA.id)) continue;

    for (let j = i + 1; j < categories.length; j++) {
      const catB = categories[j]!;
      if (handledIds.has(catB.id)) continue;

      if (areCategoriesEquivalent(catA.name, catB.name)) {
        // Elegir como "primary" la que tenga ortografía más estándar
        // (ej. "5TA Caballeros" sobre "5ta caballreos")
        const normA = normalizeCategory(catA.name);
        const normB = normalizeCategory(catB.name);

        const aHasTypo = catA.name.toLowerCase().includes("caballreos") || catA.name.toLowerCase().includes("dmas");
        const bHasTypo = catB.name.toLowerCase().includes("caballreos") || catB.name.toLowerCase().includes("dmas");

        let primary = catA;
        let duplicate = catB;

        if (aHasTypo && !bHasTypo) {
          primary = catB;
          duplicate = catA;
        } else if (!aHasTypo && !bHasTypo && catB.name.length > catA.name.length) {
          // Si una tiene nombre más completo, preferirla
          primary = catB;
          duplicate = catA;
        }

        duplicates.push({ primary, duplicate });
        handledIds.add(duplicate.id);
      }
    }
  }

  return duplicates;
}
