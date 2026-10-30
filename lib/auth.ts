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

export type AccountRole = "player" | "organizer" | "superadmin";

/**
 * Rol de cuenta del usuario actual (D-122, D-187): "superadmin" tiene acceso
 * al panel de administración global y auditoría; "organizer" puede crear torneos
 * y circuitos; "player" solo participa.
 */
export const getAccountRole = cache(async (): Promise<AccountRole> => {
  const user = await getCurrentUser();
  if (!user) return "player";

  // Bootstrap / override por variable de entorno o email principal
  const superAdminEmails = (process.env.SUPERADMIN_EMAILS || "")
    .split(",")
    .map((e) => e.trim().toLowerCase())
    .filter(Boolean);

  if (
    user.email &&
    (user.email.toLowerCase() === "manuelgrancelli@gmail.com" ||
      superAdminEmails.includes(user.email.toLowerCase()))
  ) {
    return "superadmin";
  }

  const supabase = await createClient();
  const { data, error } = await supabase.from("profiles").select("account_role").eq("id", user.id).maybeSingle();
  if (error || !data) return "player";
  if (data.account_role === "superadmin") return "superadmin";
  return data.account_role === "organizer" ? "organizer" : "player";
});

/** Atajo para páginas y acciones de organizador (superadmin también puede organizar). */
export async function isAccountOrganizer(): Promise<boolean> {
  const role = await getAccountRole();
  return role === "organizer" || role === "superadmin";
}

/** Atajo para páginas y acciones de superadministrador de la plataforma (D-187). */
export async function isSuperAdmin(): Promise<boolean> {
  return (await getAccountRole()) === "superadmin";
}
