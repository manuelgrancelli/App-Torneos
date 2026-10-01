import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getSafeRedirectPath } from "@/lib/utils/redirect";

/**
 * Retorno de OAuth (Google) y de los links de email con los templates por
 * defecto de Supabase (flujo PKCE). Canjea el `code` por una sesión y
 * redirige a `next`, siempre que sea una ruta interna.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const code = searchParams.get("code");
  const next = getSafeRedirectPath(searchParams.get("next"));

  if (code) {
    const supabase = await createClient();
    const { error } = await supabase.auth.exchangeCodeForSession(code);
    if (!error) {
      return NextResponse.redirect(new URL(next, request.url));
    }
    console.error("[auth/callback] exchangeCodeForSession:", error.code ?? error.status);
  }

  // Sin code (p. ej. el usuario canceló en Google) o canje fallido.
  return NextResponse.redirect(new URL("/login?error=auth", request.url));
}
