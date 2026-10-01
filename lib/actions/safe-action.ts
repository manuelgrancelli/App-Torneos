import { unstable_rethrow } from "next/navigation";
import { z } from "zod";
import { createClient, type SupabaseServerClient } from "@/lib/supabase/server";

/**
 * Resultado tipado de toda Server Action. El cliente lo usa para mostrar un
 * toast y, si hay `fieldErrors`, marcar los campos del formulario.
 */
export type ActionResult<T = undefined> =
  | { ok: true; data: T; message?: string }
  | { ok: false; error: string; fieldErrors?: Partial<Record<string, string[]>> };

export function actionOk<T>(data: T, message?: string): ActionResult<T> {
  return { ok: true, data, message };
}

export function actionError(
  error: string,
  fieldErrors?: Partial<Record<string, string[]>>,
): { ok: false; error: string; fieldErrors?: Partial<Record<string, string[]>> } {
  return { ok: false, error, fieldErrors };
}

type PublicContext = { supabase: SupabaseServerClient };
type AuthedContext = PublicContext & { userId: string };

const INVALID_INPUT = "Revisá los datos ingresados.";
const SESSION_EXPIRED = "Tu sesión expiró. Volvé a iniciar sesión.";
const UNEXPECTED = "Ocurrió un error inesperado. Probá de nuevo.";

/**
 * Envuelve la lógica común de las Server Actions:
 * 1. Valida el input con Zod en el servidor (nunca se confía en el cliente).
 * 2. Crea el cliente de Supabase con la sesión del usuario (RLS aplica siempre).
 * 3. Captura errores inesperados sin filtrar detalles internos a la UI.
 *    `redirect()` y `notFound()` de Next se dejan pasar.
 */
async function run<Schema extends z.ZodType, T, Ctx>(
  schema: Schema,
  input: unknown,
  buildContext: (supabase: SupabaseServerClient) => Promise<Ctx | null>,
  handler: (input: z.output<Schema>, ctx: Ctx) => Promise<ActionResult<T>>,
): Promise<ActionResult<T>> {
  const parsed = schema.safeParse(input);
  if (!parsed.success) {
    return actionError(INVALID_INPUT, z.flattenError(parsed.error).fieldErrors);
  }

  try {
    const supabase = await createClient();
    const ctx = await buildContext(supabase);
    if (!ctx) return actionError(SESSION_EXPIRED);
    return await handler(parsed.data, ctx);
  } catch (error) {
    unstable_rethrow(error);
    // Solo el mensaje: nunca se loguea el input (puede traer datos personales).
    console.error("[server-action]", error instanceof Error ? error.message : error);
    return actionError(UNEXPECTED);
  }
}

/** Server Action que requiere sesión. El handler recibe el `userId` verificado. */
export function createAction<Schema extends z.ZodType, T>(
  schema: Schema,
  handler: (input: z.output<Schema>, ctx: AuthedContext) => Promise<ActionResult<T>>,
) {
  return async (input: z.input<Schema>): Promise<ActionResult<T>> =>
    run(
      schema,
      input,
      async (supabase) => {
        // getClaims() verifica la firma del JWT; getSession() no sería seguro acá.
        const { data, error } = await supabase.auth.getClaims();
        if (error || !data?.claims.sub) return null;
        return { supabase, userId: data.claims.sub };
      },
      handler,
    );
}

/** Server Action sin sesión obligatoria (login, registro, recuperar contraseña). */
export function createPublicAction<Schema extends z.ZodType, T>(
  schema: Schema,
  handler: (input: z.output<Schema>, ctx: PublicContext) => Promise<ActionResult<T>>,
) {
  return async (input: z.input<Schema>): Promise<ActionResult<T>> =>
    run(schema, input, async (supabase) => ({ supabase }), handler);
}
