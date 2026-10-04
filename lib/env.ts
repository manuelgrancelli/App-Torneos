import { z } from "zod";

/**
 * Variables de entorno públicas (llegan al navegador). Next.js solo las inyecta
 * si se referencian de forma literal (`process.env.NEXT_PUBLIC_...`), por eso
 * no se lee `process.env` completo.
 *
 * Solo se usa la clave pública del proyecto (anon o publishable). La service
 * role / secret key no se usa en ningún lugar de la app.
 */
const envSchema = z.object({
  NEXT_PUBLIC_SUPABASE_URL: z.url({ error: "debe ser una URL válida" }),
  NEXT_PUBLIC_SUPABASE_ANON_KEY: z.string().min(1, { error: "es obligatoria" }),
});

const parsed = envSchema.safeParse({
  NEXT_PUBLIC_SUPABASE_URL: process.env.NEXT_PUBLIC_SUPABASE_URL,
  NEXT_PUBLIC_SUPABASE_ANON_KEY: process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY,
});

if (!parsed.success) {
  const detail = parsed.error.issues
    .map((issue) => `${issue.path.join(".")} ${issue.message}`)
    .join("; ");
  throw new Error(
    `Variables de entorno inválidas (${detail}). Copiá .env.example a .env.local y completalas.`,
  );
}

export const env = parsed.data;
