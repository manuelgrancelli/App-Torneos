/** Iniciales para avatares: "Juana Pérez" → "JP", "juana@mail.com" → "J". */
export function getInitials(name: string): string {
  const parts = name.trim().split(/\s+/).filter(Boolean);
  const first = parts[0]?.[0] ?? "";
  const last = parts.length > 1 ? (parts[parts.length - 1]?.[0] ?? "") : "";
  return (first + last).toUpperCase() || "?";
}

/** Recorta a `max` caracteres (incluida la elipsis) sin cortar en un espacio final. */
export function truncate(value: string, max: number): string {
  if (value.length <= max) return value;
  return `${value.slice(0, Math.max(max - 1, 0)).trimEnd()}…`;
}
