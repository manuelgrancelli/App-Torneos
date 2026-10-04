import type { CookieOptionsWithName } from "@supabase/ssr";

/**
 * Opciones de las cookies de sesión, iguales en el proxy, el servidor y el
 * browser. Se suman a los defaults de @supabase/ssr (path "/", SameSite=Lax).
 * `Secure` en producción: la cookie nunca viaja por http (D-041). No pueden
 * ser HttpOnly porque el cliente del browser de Supabase las lee.
 */
export const SESSION_COOKIE_OPTIONS: CookieOptionsWithName = {
  secure: process.env.NODE_ENV === "production",
};
