/**
 * Parser de listas de inscriptos (WhatsApp / texto plano / planillas).
 * Permite importar por lotes parejas divididas por categoría (pádel/tenis)
 * o equipos con nómina de jugadores (fútbol).
 */

import { findMatchingCategory } from "./category-matcher";

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

export type ParseBulkRosterOptions = {
  sportId?: string;
  defaultCategoryName?: string;
};

/**
 * Determina si el ID del deporte corresponde a alguna variante de fútbol.
 */
export function isFootballSport(sportId?: string | null): boolean {
  if (!sportId) return false;
  const s = sportId.toLowerCase();
  return s.includes("futbol") || s.includes("soccer") || s.includes("football");
}

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
 * Detecta si una línea parece un encabezado de categoría en deportes de raqueta (pádel/tenis):
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
 * Detecta si una línea parece un encabezado de categoría en fútbol.
 */
export function isFootballCategoryHeader(
  line: string,
  existingCategories: readonly ExistingCategoryRef[] = [],
): boolean {
  const trimmed = line.trim();
  if (!trimmed || isDateOrInfoNote(trimmed)) return false;

  // Si tiene formato de jugador con número al inicio (1- etc.), no es categoría
  if (/^\d+\s*[\.\-\):]/.test(trimmed)) return false;

  const cleaned = cleanHeaderFormatting(trimmed);

  // Coincidencia exacta con categoría existente
  if (
    existingCategories.some(
      (c) => c.name.trim().toLowerCase() === cleaned.toLowerCase(),
    )
  ) {
    return true;
  }

  // Palabras clave explícitas de categorías o zonas
  if (/^(?:categor[ií]a|cat\.?|divisi[oó]n|zona|grupo|serie|copa)\b/i.test(cleaned)) {
    return true;
  }

  // Si tiene flechas o bullets destacados tipo WhatsApp tipo "*➡️ Libres*" o "➡️ +35"
  if (/^(?:\*?\s*➡️|\*?\s*👉|\*?\s*🔹)/.test(trimmed)) {
    return true;
  }

  // Patrones tipo "+30", "+35", "+40", "Libres", "Senior", "Veteranos", "Femenino", "Masculino"
  if (/^\+\d+$/.test(cleaned)) return true;
  if (/^(?:libres|veteranos|senior|femenino|masculino|mixto)$/i.test(cleaned)) return true;

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
 * Extrae los integrantes de una línea de pareja para pádel/tenis.
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

/**
 * Extrae los nombres de jugadores de un texto que contiene numeración (ej. "1-Montero 2- Dillollo 3- Blanco")
 * o una línea individual de jugador (ej. "1- Montero", "1. Montero", "1) Montero", "- Montero", "• Montero").
 */
export function extractNumberedPlayers(text: string): string[] {
  const trimmed = text.trim();
  if (!trimmed) return [];

  // Busca patrones como "1-", "2.", "3)", "1:", " 1 -", " 2 - "
  const regex = /(?:^|\s+)(\d+)\s*[\.\-\):]\s*/g;
  const matches: { index: number; length: number; num: number }[] = [];
  let m: RegExpExecArray | null;

  while ((m = regex.exec(trimmed)) !== null) {
    const leadingSpaces = m[0].length - m[0].trimStart().length;
    matches.push({
      index: m.index + leadingSpaces,
      length: m[0].trim().length,
      num: parseInt(m[1]!, 10),
    });
  }

  if (matches.length > 0) {
    const players: string[] = [];
    for (let i = 0; i < matches.length; i++) {
      const current = matches[i]!;
      const startIndex = current.index + current.length;
      const endIndex = i + 1 < matches.length ? matches[i + 1]!.index : trimmed.length;
      let rawName = trimmed.slice(startIndex, endIndex);

      // Quitar comas o puntos y coma al final
      rawName = rawName.replace(/[,;]+$/, "");
      // Quitar "etc" o "etc." al final de la línea o nombre
      rawName = rawName.replace(/\s+etc\.?$/i, "");

      const cleaned = cleanPlayerName(rawName);
      if (cleaned && !/^(?:etc\.?|\.{3,})$/i.test(cleaned)) {
        players.push(cleaned);
      }
    }
    return players;
  }

  // Viñetas no numéricas tipo "- Montero", "• Montero", "* Montero"
  const bulletMatch = trimmed.match(/^[-•*]\s*(.+)$/);
  if (bulletMatch && bulletMatch[1]) {
    const cleaned = cleanPlayerName(bulletMatch[1].replace(/\s+etc\.?$/i, ""));
    if (cleaned && !/^(?:etc\.?|\.{3,})$/i.test(cleaned)) {
      return [cleaned];
    }
  }

  return [];
}

/**
 * Detecta si una línea que empieza con numeración (ej. "1- Los Galácticos") es el encabezado
 * de un equipo porque la siguiente línea reinicia la numeración con el jugador 1 ("1- Lucas Benítez").
 */
function isTeamHeaderWithNumber(line: string, nextLine: string | null): boolean {
  if (!nextLine) return false;
  const lineMatch = line.match(/^\d+\s*[\.\-\):]\s*(.+)$/);
  if (!lineMatch || !lineMatch[1]) return false;

  // Si la siguiente línea empieza con el jugador 1: "1-", "1.", "1)", "1:"
  const nextStartsWithOne = /^(?:1\s*[\.\-\):]|(?:[^\d\.\-\*~_•].*?)(?::\s*|\s+)1\s*[\.\-\):])/.test(
    nextLine.trim(),
  );
  return nextStartsWithOne;
}

/**
 * Analiza un texto de lista de equipos y jugadores de fútbol (D-188).
 * Formato soportado:
 * Nombre de equipo seguido de sus jugadores numerados (en líneas individuales o en el mismo renglón).
 * Ej:
 * Los Galácticos FC
 * 1- Lucas Benítez
 * 2- Matías Morales
 * 3- Franco Navarro
 */
export function parseFootballRoster(
  text: string,
  existingCategories: readonly ExistingCategoryRef[] = [],
  defaultCategoryName = "General",
): BulkRosterResult {
  const lines = text.split(/\r?\n/);
  const categories: ParsedCategoryBlock[] = [];
  const ignoredLines: string[] = [];

  let currentCategoryName = "";
  let currentTeams: ParsedTeam[] = [];
  let currentTeam: { name: string; players: string[]; rawLines: string[] } | null = null;

  function commitCurrentTeam() {
    if (currentTeam && currentTeam.name.trim()) {
      const players =
        currentTeam.players.length > 0
          ? currentTeam.players
          : [currentTeam.name.trim()];

      currentTeams.push({
        teamName: currentTeam.name.trim(),
        playerNames: players,
        rawLine: currentTeam.rawLines.join("\n"),
      });
    }
    currentTeam = null;
  }

  function commitCurrentCategory() {
    commitCurrentTeam();
    if (currentTeams.length > 0) {
      const catName = currentCategoryName || defaultCategoryName;
      let matched = findMatchingCategory(existingCategories, catName);
      if (!matched && existingCategories.length === 1 && !currentCategoryName) {
        matched = existingCategories[0] ?? null;
      }

      categories.push({
        categoryName: catName,
        matchedCategoryId: matched ? matched.id : null,
        teams: currentTeams,
      });
    }
    currentTeams = [];
  }

  const nonEmptyLines: { line: string; rawLine: string; index: number }[] = [];
  for (let i = 0; i < lines.length; i++) {
    const rawLine = lines[i]!;
    const line = rawLine.trim();
    if (line) {
      nonEmptyLines.push({ line, rawLine, index: i });
    }
  }

  for (let i = 0; i < nonEmptyLines.length; i++) {
    const { line, rawLine } = nonEmptyLines[i]!;
    const nextItem = i + 1 < nonEmptyLines.length ? nonEmptyLines[i + 1] : null;
    const nextLine = nextItem ? nextItem.line : "";

    // 1. ¿Es nota de fechas o texto introductorio antes de cualquier equipo o categoría?
    if (isDateOrInfoNote(line) && !currentCategoryName && !currentTeam) {
      ignoredLines.push(rawLine);
      continue;
    }

    // 2. ¿Es un encabezado de categoría?
    if (isFootballCategoryHeader(line, existingCategories)) {
      commitCurrentCategory();
      currentCategoryName = cleanHeaderFormatting(line);
      continue;
    }

    // 3. ¿Es un equipo con jugadores inline en el mismo renglón?
    // Ej: "Los Galácticos 1- Lucas Benítez 2- Matías Morales 3- Franco Navarro" o "Los Galácticos: 1- Lucas..."
    const cleanedLineForInline = line.replace(/^\d+\s*[\.\-\):]\s*/, "");
    const inlineMatch = cleanedLineForInline.match(
      /^([^\d\.\-\*~_•].*?)(?::\s*|\s+)(1\s*[\.\-\):]\s*.*)$/,
    );
    if (inlineMatch && inlineMatch[1] && inlineMatch[2]) {
      const possibleTeamName = cleanHeaderFormatting(inlineMatch[1])
        .replace(/:\s*$/, "")
        .trim();
      const players = extractNumberedPlayers(inlineMatch[2]);
      if (possibleTeamName && players.length > 0) {
        commitCurrentTeam();
        currentTeam = {
          name: possibleTeamName,
          players,
          rawLines: [rawLine],
        };
        commitCurrentTeam();
        continue;
      }
    }

    // 4. ¿Es una línea de jugadores para el equipo actual?
    const isTeamNumbered = isTeamHeaderWithNumber(line, nextLine);
    if (!isTeamNumbered) {
      const playerList = extractNumberedPlayers(line);
      if (playerList.length > 0) {
        if (!currentTeam) {
          currentTeam = {
            name: `Equipo ${currentTeams.length + 1}`,
            players: [],
            rawLines: [],
          };
        }
        currentTeam.players.push(...playerList);
        currentTeam.rawLines.push(rawLine);
        continue;
      }

      // Si no tiene números pero el equipo actual no tiene jugadores y la línea tiene comas:
      if (currentTeam && currentTeam.players.length === 0 && line.includes(",")) {
        const commaPlayers = line
          .split(/,\s*/)
          .map((p) => cleanPlayerName(p.replace(/\s+etc\.?$/i, "")))
          .filter((p) => p && !/^(?:etc\.?|\.{3,})$/i.test(p));
        if (commaPlayers.length > 0) {
          currentTeam.players.push(...commaPlayers);
          currentTeam.rawLines.push(rawLine);
          continue;
        }
      }
    }

    // 5. Es un nombre de equipo (ej. "Los Galácticos", "1- Los Galácticos", "*Los Galácticos*", "Los Galácticos:")
    const cleanName = cleanHeaderFormatting(line)
      .replace(/^\d+\s*[\.\-\):]\s*/, "")
      .replace(/^(?:equipo|team)\s*:\s*/i, "")
      .replace(/:\s*$/, "")
      .trim();

    if (cleanName) {
      commitCurrentTeam();
      currentTeam = {
        name: cleanName,
        players: [],
        rawLines: [rawLine],
      };
    } else {
      ignoredLines.push(rawLine);
    }
  }

  commitCurrentCategory();

  const totalTeams = categories.reduce((sum, c) => sum + c.teams.length, 0);

  return {
    categories,
    totalTeams,
    ignoredLines,
  };
}

/**
 * Analiza un texto de lista de parejas para pádel / tenis.
 */
export function parsePairsRoster(
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
      let matched = findMatchingCategory(existingCategories, catName);
      if (!matched && existingCategories.length === 1 && !currentCategoryName) {
        matched = existingCategories[0] ?? null;
      }

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

  commitCurrentCategory();

  const totalTeams = categories.reduce((sum, c) => sum + c.teams.length, 0);

  return {
    categories,
    totalTeams,
    ignoredLines,
  };
}

/**
 * Analiza un texto completo con múltiples categorías e inscriptos.
 * Enrutador automático según el deporte (fútbol vs pádel/tenis).
 */
export function parseBulkRoster(
  text: string,
  existingCategories: readonly ExistingCategoryRef[] = [],
  optionsOrDefaultCategory: string | ParseBulkRosterOptions = "General",
  legacySportId?: string,
): BulkRosterResult {
  let defaultCategoryName = "General";
  let sportId: string | undefined = legacySportId;

  if (typeof optionsOrDefaultCategory === "string") {
    defaultCategoryName = optionsOrDefaultCategory;
  } else if (optionsOrDefaultCategory && typeof optionsOrDefaultCategory === "object") {
    defaultCategoryName = optionsOrDefaultCategory.defaultCategoryName || "General";
    sportId = optionsOrDefaultCategory.sportId || legacySportId;
  }

  if (isFootballSport(sportId)) {
    return parseFootballRoster(text, existingCategories, defaultCategoryName);
  }

  return parsePairsRoster(text, existingCategories, defaultCategoryName);
}
