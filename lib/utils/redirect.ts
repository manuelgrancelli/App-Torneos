/** Destino por defecto después de iniciar sesión o confirmar la cuenta. */
export const DEFAULT_REDIRECT = "/torneos";

/** Base ficticia usada solo para resolver rutas relativas y comparar el origen. */
const INTERNAL_BASE = "http://internal.invalid";

/**
 * Devuelve una ruta interna segura a partir del parámetro `next` que viaja en
 * links de login, OAuth y emails. Evita open redirects: solo acepta paths del
 * mismo origen ("/torneos?x=1"). Rechaza URLs absolutas, protocol-relative
 * ("//evil.com"), variantes con barra invertida ("/\evil.com") y caracteres de
 * control. Ante cualquier duda devuelve `fallback`.
 */
export function getSafeRedirectPath(
  next: string | null | undefined,
  fallback: string = DEFAULT_REDIRECT,
): string {
  if (!next || !next.startsWith("/")) return fallback;
  if (next.startsWith("//") || next.startsWith("/\\")) return fallback;

  // Caracteres de control (saltos de línea, tabs, NUL, DEL): nunca son válidos acá.
  for (const char of next) {
    const code = char.charCodeAt(0);
    if (code < 0x20 || code === 0x7f) return fallback;
  }

  try {
    // Segunda barrera: si al resolver la ruta cambia el origen, no es interna.
    const url = new URL(next, INTERNAL_BASE);
    if (url.origin !== INTERNAL_BASE) return fallback;
    return `${url.pathname}${url.search}${url.hash}`;
  } catch {
    return fallback;
  }
}
