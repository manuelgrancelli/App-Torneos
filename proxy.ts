import type { NextRequest } from "next/server";
import { env } from "@/lib/env";
import { buildCsp, createNonce } from "@/lib/security/csp";
import { updateSession } from "@/lib/supabase/proxy";

/**
 * Proxy de Next.js 16 (ex middleware): corre antes de cada request para
 * fijar la CSP con nonce (D-041), refrescar la sesión de Supabase y proteger
 * las rutas privadas.
 */
export async function proxy(request: NextRequest) {
  const nonce = createNonce();
  const csp = buildCsp({
    nonce,
    isDev: process.env.NODE_ENV === "development",
    supabaseUrl: env.NEXT_PUBLIC_SUPABASE_URL,
  });
  // Next lee el nonce de la CSP del request y lo aplica a sus scripts; x-nonce
  // queda para pasárselo a un <Script> propio. updateSession reenvía estos
  // headers al render con NextResponse.next({ request }).
  request.headers.set("Content-Security-Policy", csp);
  request.headers.set("x-nonce", nonce);

  const response = await updateSession(request);
  response.headers.set("Content-Security-Policy", csp);
  return response;
}

export const config = {
  // Todo menos assets estáticos e imágenes (no necesitan sesión ni CSP).
  matcher: [
    "/((?!_next/static|_next/image|favicon.ico|.*\\.(?:svg|png|jpg|jpeg|gif|webp|ico)$).*)",
  ],
};
