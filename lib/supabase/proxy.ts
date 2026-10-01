import { createServerClient } from "@supabase/ssr";
import { NextResponse, type NextRequest } from "next/server";
import { env } from "@/lib/env";
import { DEFAULT_REDIRECT, getSafeRedirectPath } from "@/lib/utils/redirect";
import { SESSION_COOKIE_OPTIONS } from "./cookie-options";
import type { Database } from "./database.types";

/** Rutas que requieren sesión. El layout de (app) vuelve a chequearlo (defensa en profundidad). */
const PROTECTED_PREFIXES = [
  "/torneos",
  "/unirse",
  "/inscripciones",
  "/historial",
  "/proximos",
  "/perfil",
  "/actualizar-clave",
];

/** Rutas solo para visitantes: con sesión iniciada no tiene sentido mostrarlas. */
const GUEST_ONLY_PREFIXES = ["/login", "/registro", "/recuperar-clave"];

function matchesPrefix(pathname: string, prefixes: string[]): boolean {
  return prefixes.some((prefix) => pathname === prefix || pathname.startsWith(`${prefix}/`));
}

/**
 * Refresca la sesión de Supabase en cada request y aplica las redirecciones
 * de acceso. Sigue el patrón recomendado por @supabase/ssr: las cookies
 * renovadas se escriben tanto en el request (para el render actual) como en
 * la respuesta (para el navegador), junto con los headers anti-cache.
 */
export async function updateSession(request: NextRequest) {
  let response = NextResponse.next({ request });

  const supabase = createServerClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    {
      cookieOptions: SESSION_COOKIE_OPTIONS,
      cookies: {
        getAll() {
          return request.cookies.getAll();
        },
        setAll(cookiesToSet, headers) {
          for (const { name, value } of cookiesToSet) {
            request.cookies.set(name, value);
          }
          response = NextResponse.next({ request });
          for (const { name, value, options } of cookiesToSet) {
            response.cookies.set(name, value, options);
          }
          // Una respuesta que setea cookies de sesión nunca debe quedar en caché de un CDN.
          for (const [key, value] of Object.entries(headers)) {
            response.headers.set(key, value);
          }
        },
      },
    },
  );

  // Importante: no agregar lógica entre createServerClient y getClaims().
  // getClaims() valida la firma del JWT (no confía en la cookie a ciegas).
  const { data } = await supabase.auth.getClaims();
  const isAuthenticated = Boolean(data?.claims);
  const { pathname, search } = request.nextUrl;

  if (!isAuthenticated && matchesPrefix(pathname, PROTECTED_PREFIXES)) {
    const loginUrl = new URL("/login", request.url);
    loginUrl.searchParams.set("next", `${pathname}${search}`);
    return redirectKeepingSession(loginUrl, response);
  }

  if (isAuthenticated && matchesPrefix(pathname, GUEST_ONLY_PREFIXES)) {
    const next = new URL(getSafeRedirectPath(request.nextUrl.searchParams.get("next")), request.url);
    // Evita rebotar entre páginas de invitado (p. ej. /login?next=/registro).
    const target = matchesPrefix(next.pathname, GUEST_ONLY_PREFIXES)
      ? new URL(DEFAULT_REDIRECT, request.url)
      : next;
    return redirectKeepingSession(target, response);
  }

  return response;
}

/**
 * Redirige copiando las cookies (y headers anti-cache) que Supabase haya
 * escrito en `from`. Sin esto, una sesión recién refrescada se perdería.
 */
function redirectKeepingSession(url: URL, from: NextResponse): NextResponse {
  const redirect = NextResponse.redirect(url);
  for (const cookie of from.cookies.getAll()) {
    redirect.cookies.set(cookie);
  }
  for (const header of ["cache-control", "expires", "pragma"]) {
    const value = from.headers.get(header);
    if (value) redirect.headers.set(header, value);
  }
  return redirect;
}
