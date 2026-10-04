import "server-only";
import { createClient } from "@supabase/supabase-js";
import { env } from "@/lib/env";
import type { Database } from "./database.types";

/**
 * Cliente anónimo sin cookies para la página pública: siempre consulta como
 * `anon`, así RLS limita a torneos publicados y equipos aprobados aunque
 * quien navegue tenga sesión. Al no leer cookies, sus datos se pueden cachear.
 */
export function createPublicClient() {
  return createClient<Database>(env.NEXT_PUBLIC_SUPABASE_URL, env.NEXT_PUBLIC_SUPABASE_ANON_KEY, {
    auth: { persistSession: false, autoRefreshToken: false, detectSessionInUrl: false },
  });
}
