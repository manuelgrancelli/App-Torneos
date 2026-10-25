/**
 * Parser de listas de inscriptos (WhatsApp / texto plano / planillas).
 * Permite importar por lotes parejas divididas por categoría.
 */

export type ParsedTeam = {
  teamName: string;
  playerNames: string[];
  rawLine: string;
};

export type ParsedCategoryBlock = {
  categoryName: string;
  matchedCategoryId: string | null;
  teams: ParsedTeam[];
};

export type BulkRosterResult = {
  categories: ParsedCategoryBlock[];
  totalTeams: number;
  ignoredLines: string[];
};

export type ExistingCategoryRef = {
  id: string;
  name: string;
};

/**
 * Limpia símbolos de formato comunes en WhatsApp/Markdown (*, _, ~, emojis de flechas).
 */
export function cleanHeaderFormatting(raw: string): string {
  return raw
    .replace(/^[\s*~_]+|[\s*~_]+$/g, "") // asteriscos, guiones bajos o virgulillas alrededor
    .replace(/^(?:➡️|👉|🔹|▪️|•|-|>)+\s*/u, "") // flechas o viñetas al inicio
    .replace(/[\s*~_]+$/g, "")
    .trim();
}

/**
 * Detecta si una línea es una nota de fechas del torneo (ej: "*22/23/24 y 25*", "Fecha: 22/10", etc.).
 */
export function isDateOrInfoNote(raw: string): boolean {
  const cleaned = raw.replace(/[*~_]/g, "").trim().toLowerCase();
  if (!cleaned) return true;

  // Fechas estilo "22/23/24 y 25" o "10 al 12 de octubre"
  if (/^[\d\/\s,eyy-]+$/.test(cleaned) && /\d/.test(cleaned)) {
    return true;
  }
  if (/^(?:fechas?|días?|horarios?|sede|lugar|torneo):/i.test(cleaned)) {
    return true;
  }
  return false;
}

/**
 * Detecta si una línea parece un encabezado de categoría:
 * Ej: "*➡️ Suma 10 Caballeros*", "6ta Caballeros", "Cat. 8va Damas", "+10", "Zona A - 7ma"
 */
export function isCategoryHeader(raw: string): boolean {
  const line = raw.trim();
  if (!line || isDateOrInfoNote(line)) return false;

  // Si tiene flechas o bullets destacados tipo WhatsApp
  if (/^(?:\*?\s*➡️|\*?\s*👉|\*?\s*🔹)/.test(line)) {
    return true;
  }

  const cleaned = cleanHeaderFormatting(line);

  // Palabras clave explícitas
  if (/^(?:categor[ií]a|cat\.?|divisi[oó]n|zona|grupo)\b/i.test(cleaned)) {
    return true;
  }

  // Patrones habituales de pádel / tenis / deportes:
  // "Suma 10", "Suma 12 Caballeros", "6ta", "8va Damas", "+10", "+12", "Principiantes"
  if (/^suma\s+\d+/i.test(cleaned)) return true;
  if (/^\+\d+/i.test(cleaned)) return true;
  if (/^\d+(?:ra|da|ta|ma|va|na|°)?\s*(?:caballeros|damas|masc(?:ulino)?|fem(?:enino)?|mixto)?$/i.test(cleaned)) {
    return true;
  }

  // Si la línea está completamente en negrita tipo *Texto de Categoría* y no tiene barra de pareja "/"
  if (/^\*+[^*]+\*+$/.test(line) && !line.includes("/") && !line.includes(" - ")) {
    return true;
  }

  return false;
}

/**
 * Normaliza el nombre de un jugador (elimina espacios dobles, quita viñetas o caracteres residuales).
 */
export function cleanPlayerName(raw: string): string {
  return raw
    .replace(/^[\s*~_]+|[\s*~_]+$/g, "")
    .replace(/\s+/g, " ")
    .trim();
}

/**
 * Extrae los integrantes de una línea de pareja.
 * Soporta formatos tipo:
 * - "1- López Martín / Díaz Franco"
 * - "1. López Martín / Díaz Franco"
 * - "López Martín - Díaz Franco"
 * - "López Martín y Díaz Franco"
 */
export function parsePairLine(line: string): { playerNames: string[]; teamName: string } | null {
  const trimmed = line.trim();
  if (!trimmed) return null;

  // 1. Quitar numeración inicial (ej: "1-", "1.", "1)", "10 -", etc.)
  const withoutNumber = trimmed.replace(/^\s*\d+[\s\.\-\)]+\s*/, "").trim();
  if (!withoutNumber) {
    // Era una línea vacía tipo "12-", "13-"
    return null;
  }

  // 2. Intentar separar por delimitadores habituales
  let parts: string[] = [];
  if (withoutNumber.includes("/")) {
    parts = withoutNumber.split("/");
  } else if (withoutNumber.includes(" - ")) {
    parts = withoutNumber.split(" - ");
  } else if (withoutNumber.includes(" y ") || withoutNumber.includes(" Y ")) {
    parts = withoutNumber.split(/\s+[yY]\s+/);
  } else if (withoutNumber.includes(" & ")) {
    parts = withoutNumber.split(" & ");
  }

  if (parts.length < 2) {
    // Si no tiene separador explícito, no es una pareja válida de 2 jugadores
    return null;
  }

  const p1 = cleanPlayerName(parts[0] ?? "");
  const p2 = cleanPlayerName(parts[1] ?? "");

  if (!p1 || !p2) return null;

  const playerNames = [p1, p2];
  const teamName = `${p1} / ${p2}`;

  return { playerNames, teamName };
}

import { findMatchingCategory } from "./category-matcher";

/**
 * Analiza un texto completo con múltiples categorías e inscriptos.
 */
export function parseBulkRoster(
  text: string,
  existingCategories: readonly ExistingCategoryRef[] = [],
  defaultCategoryName = "General",
): BulkRosterResult {
  const lines = text.split(/\r?\n/);
  const categories: ParsedCategoryBlock[] = [];
  const ignoredLines: string[] = [];

  let currentCategoryName = "";
  let currentTeams: ParsedTeam[] = [];

  function commitCurrentCategory() {
    if (currentTeams.length > 0) {
      const catName = currentCategoryName || defaultCategoryName;
      const matched = findMatchingCategory(existingCategories, catName);

      categories.push({
        categoryName: catName,
        matchedCategoryId: matched ? matched.id : null,
        teams: currentTeams,
      });
    }
    currentTeams = [];
  }

  for (const rawLine of lines) {
    const line = rawLine.trim();
    if (!line) continue;

    // ¿Es nota de fechas o texto superfluo al inicio?
    if (isDateOrInfoNote(line) && !currentCategoryName) {
      ignoredLines.push(rawLine);
      continue;
    }

    // ¿Es un encabezado de categoría?
    if (isCategoryHeader(line)) {
      commitCurrentCategory();
      currentCategoryName = cleanHeaderFormatting(line);
      continue;
    }

    // ¿Es una pareja de jugadores?
    const parsedPair = parsePairLine(line);
    if (parsedPair) {
      currentTeams.push({
        teamName: parsedPair.teamName,
        playerNames: parsedPair.playerNames,
        rawLine,
      });
    } else {
      ignoredLines.push(rawLine);
    }
  }

  // Guardar última categoría
  commitCurrentCategory();

  const totalTeams = categories.reduce((sum, c) => sum + c.teams.length, 0);

  return {
    categories,
    totalTeams,
    ignoredLines,
  };
}
