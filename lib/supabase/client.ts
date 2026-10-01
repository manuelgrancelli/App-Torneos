import { createBrowserClient } from "@supabase/ssr";
import { env } from "@/lib/env";
import { SESSION_COOKIE_OPTIONS } from "./cookie-options";
import type { Database } from "./database.types";

/**
 * Cliente de Supabase para Client Components. Comparte la sesión con el
 * servidor a través de cookies y solo usa la clave pública: todo lo que haga
 * queda limitado por RLS.
 */
export function createClient() {
  return createBrowserClient<Database>(
    env.NEXT_PUBLIC_SUPABASE_URL,
    env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
    { cookieOptions: SESSION_COOKIE_OPTIONS },
  );
}
