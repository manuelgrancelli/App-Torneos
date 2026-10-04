import { cache } from "react";
import { createClient } from "@/lib/supabase/server";

export type CurrentUser = {
  id: string;
  email: string;
  fullName: string;
  avatarUrl: string | null;
};

function readString(source: Record<string, unknown> | undefined, ...keys: string[]): string | null {
  for (const key of keys) {
    const value = source?.[key];
    if (typeof value === "string" && value.trim()) return value.trim();
  }
  return null;
}

/**
 * Usuario de la sesión actual, o `null` si no hay sesión válida.
 * Usa getClaims(), que verifica la firma del JWT (nunca getSession() en el
 * servidor). Se memoiza por request con `cache` para no repetir la
 * verificación entre layout y página.
 */
export const getCurrentUser = cache(async (): Promise<CurrentUser | null> => {
  const supabase = await createClient();
  const { data, error } = await supabase.auth.getClaims();
  if (error || !data?.claims.sub) return null;

  const { claims } = data;
  const metadata = claims.user_metadata as Record<string, unknown> | undefined;
  const email = typeof claims.email === "string" ? claims.email : "";

  return {
    id: claims.sub,
    email,
    // Registro por email guarda full_name; Google manda full_name o name.
    fullName: readString(metadata, "full_name", "name") ?? email,
    avatarUrl: readString(metadata, "avatar_url", "picture"),
  };
});
