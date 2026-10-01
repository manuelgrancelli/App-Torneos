import { headers } from "next/headers";

/**
 * Origen público de la app (p. ej. "https://torneos.com") para armar los
 * links de retorno de OAuth y de los emails de Supabase Auth.
 *
 * En Server Actions el navegador siempre manda `Origin` (Next lo valida contra
 * el host para evitar CSRF). Como respaldo se usan los headers del proxy.
 * Aunque alguien forjara estos headers, Supabase solo redirige a URLs de su
 * lista permitida (Site URL / Redirect URLs).
 */
export async function getRequestOrigin(): Promise<string> {
  const headerList = await headers();

  const origin = headerList.get("origin");
  if (origin && isHttpOrigin(origin)) return origin;

  // Detrás de varios proxies estos headers pueden venir como lista ("a, b"): vale el primero.
  const host = firstValue(headerList.get("x-forwarded-host") ?? headerList.get("host"));
  const protocol = firstValue(headerList.get("x-forwarded-proto")) ?? "http";
  const candidate = `${protocol}://${host}`;
  if (host && isHttpOrigin(candidate)) return candidate;

  throw new Error("No se pudo determinar el origen de la request.");
}

function firstValue(value: string | null): string | null {
  return value?.split(",")[0]?.trim() || null;
}

function isHttpOrigin(value: string): boolean {
  try {
    const url = new URL(value);
    return (url.protocol === "http:" || url.protocol === "https:") && url.origin === value;
  } catch {
    return false;
  }
}
