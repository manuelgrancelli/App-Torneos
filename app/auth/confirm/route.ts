import type { EmailOtpType } from "@supabase/supabase-js";
import { cookies } from "next/headers";
import { NextResponse, type NextRequest } from "next/server";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/utils/origin";
import { DEFAULT_REDIRECT, getSafeRedirectPath } from "@/lib/utils/redirect";

/** Tipos de link de email que acepta esta ruta. */
const ALLOWED_TYPES: readonly EmailOtpType[] = ["email", "signup", "recovery", "email_change"];

function isAllowedType(value: string | null): value is EmailOtpType {
  return value !== null && (ALLOWED_TYPES as readonly string[]).includes(value);
}

/**
 * Links de los emails de Supabase Auth con los templates del proyecto
 * (confirmación de cuenta y recuperación de contraseña). Verifica el
 * `token_hash` del lado del servidor, así el link funciona aunque se abra en
 * otro navegador o dispositivo.
 */
export async function GET(request: NextRequest) {
  const { searchParams } = request.nextUrl;
  const tokenHash = searchParams.get("token_hash");
  const type = searchParams.get("type");
  const rawNext = searchParams.get("next");
  const origin = await getRequestOrigin();
  let next = getSafeRedirectPath(rawNext, DEFAULT_REDIRECT);
  if (rawNext) {
    try {
      const redirectUrl = new URL(rawNext, origin);
      if (redirectUrl.origin === origin) {
        next = getSafeRedirectPath(`${redirectUrl.pathname}${redirectUrl.search}${redirectUrl.hash}`);
      }
    } catch {
      next = DEFAULT_REDIRECT;
    }
  }

  if (tokenHash && isAllowedType(type)) {
    const supabase = await createClient();
    const { error } = await supabase.auth.verifyOtp({ type, token_hash: tokenHash });
    if (!error) {
      const response = NextResponse.redirect(new URL(next, origin));
      const cookieStore = await cookies();
      for (const cookie of cookieStore.getAll()) {
        response.cookies.set(cookie);
      }
      return response;
    }
    console.error("[auth/confirm] verifyOtp:", error.code ?? error.status);
  }

  return NextResponse.redirect(new URL("/login?error=link", origin));
}
