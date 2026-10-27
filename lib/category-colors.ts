/**
 * Paleta de colores temáticos para identificar y distinguir visualmente
 * cada categoría en fixtures, cuadros y listas de partidos.
 */

export type CategoryColorTheme = {
  id: string;
  badge: string;
  borderLeft: string;
  dot: string;
};

export const CATEGORY_PALETTES: readonly CategoryColorTheme[] = [
  {
    id: "sky",
    badge: "border-sky-500/40 bg-sky-500/15 text-sky-700 dark:text-sky-300",
    borderLeft: "border-l-sky-500",
    dot: "bg-sky-500",
  },
  {
    id: "violet",
    badge: "border-violet-500/40 bg-violet-500/15 text-violet-700 dark:text-violet-300",
    borderLeft: "border-l-violet-500",
    dot: "bg-violet-500",
  },
  {
    id: "amber",
    badge: "border-amber-500/40 bg-amber-500/15 text-amber-700 dark:text-amber-300",
    borderLeft: "border-l-amber-500",
    dot: "bg-amber-500",
  },
  {
    id: "rose",
    badge: "border-rose-500/40 bg-rose-500/15 text-rose-700 dark:text-rose-300",
    borderLeft: "border-l-rose-500",
    dot: "bg-rose-500",
  },
  {
    id: "emerald",
    badge: "border-emerald-500/40 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300",
    borderLeft: "border-l-emerald-500",
    dot: "bg-emerald-500",
  },
  {
    id: "fuchsia",
    badge: "border-fuchsia-500/40 bg-fuchsia-500/15 text-fuchsia-700 dark:text-fuchsia-300",
    borderLeft: "border-l-fuchsia-500",
    dot: "bg-fuchsia-500",
  },
  {
    id: "orange",
    badge: "border-orange-500/40 bg-orange-500/15 text-orange-700 dark:text-orange-300",
    borderLeft: "border-l-orange-500",
    dot: "bg-orange-500",
  },
  {
    id: "indigo",
    badge: "border-indigo-500/40 bg-indigo-500/15 text-indigo-700 dark:text-indigo-300",
    borderLeft: "border-l-indigo-500",
    dot: "bg-indigo-500",
  },
  {
    id: "teal",
    badge: "border-teal-500/40 bg-teal-500/15 text-teal-700 dark:text-teal-300",
    borderLeft: "border-l-teal-500",
    dot: "bg-teal-500",
  },
  {
    id: "cyan",
    badge: "border-cyan-500/40 bg-cyan-500/15 text-cyan-700 dark:text-cyan-300",
    borderLeft: "border-l-cyan-500",
    dot: "bg-cyan-500",
  },
];

/** Obtiene el color correspondiente según el índice ordenado de la categoría */
export function getCategoryColorByIndex(index: number): CategoryColorTheme {
  const safeIndex = Math.max(0, Math.floor(index));
  return CATEGORY_PALETTES[safeIndex % CATEGORY_PALETTES.length] ?? CATEGORY_PALETTES[0]!;
}

/** Obtiene un color consistente a partir del nombre o ID de la categoría vía hash */
export function getCategoryColorByName(nameOrId?: string | null): CategoryColorTheme {
  const fallback = CATEGORY_PALETTES[0]!;
  if (!nameOrId || !nameOrId.trim()) {
    return fallback;
  }
  const clean = nameOrId.trim().toLowerCase();
  let hash = 0;
  for (let i = 0; i < clean.length; i++) {
    hash = (hash << 5) - hash + clean.charCodeAt(i);
    hash |= 0;
  }
  const index = Math.abs(hash) % CATEGORY_PALETTES.length;
  return CATEGORY_PALETTES[index] ?? fallback;
}

