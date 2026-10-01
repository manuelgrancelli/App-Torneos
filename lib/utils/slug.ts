/** "Copa Verano Pádel 2026!" → "copa-verano-padel-2026". Máximo 80 caracteres. */
export function slugify(value: string): string {
  return value
    .normalize("NFD")
    .replace(/[̀-ͯ]/g, "")
    .toLowerCase()
    .replace(/[^a-z0-9]+/g, "-")
    .replace(/^-+|-+$/g, "")
    .slice(0, 80)
    .replace(/-+$/g, "");
}

const SUFFIX_ALPHABET = "abcdefghijkmnpqrstuvwxyz23456789";

/**
 * Slug único para URLs públicas: base legible + sufijo aleatorio de 6
 * caracteres (D-030). Evita choques sin consultar la base y no permite
 * adivinar torneos en borrador a partir del nombre.
 */
export function slugWithSuffix(name: string): string {
  const bytes = crypto.getRandomValues(new Uint8Array(6));
  const suffix = Array.from(bytes, (b) => SUFFIX_ALPHABET[b % SUFFIX_ALPHABET.length]).join("");
  const base = slugify(name) || "torneo";
  return `${base}-${suffix}`;
}
