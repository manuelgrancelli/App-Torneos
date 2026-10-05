"use server";

import { redirect } from "next/navigation";
import { actionError, actionOk, createAction, createPublicAction } from "@/lib/actions/safe-action";
import {
  authErrorMessage,
  isRateLimitError,
  isUserAlreadyExistsError,
} from "@/lib/supabase/errors";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/utils/origin";
import { getSafeRedirectPath } from "@/lib/utils/redirect";
import {
  loginSchema,
  oauthSchema,
  recoverPasswordSchema,
  signUpSchema,
  updatePasswordSchema,
} from "@/lib/validation/auth";

/** Login con email y contraseña. El cliente redirige después de `ok`. */
export const signIn = createPublicAction(loginSchema, async ({ email, password }, { supabase }) => {
  const { error } = await supabase.auth.signInWithPassword({ email, password });
  if (error) return actionError(authErrorMessage(error));
  return actionOk(undefined);
});

/**
 * Registro con email y contraseña. Por seguridad no se revela si el email ya
 * tenía cuenta: la respuesta es la misma en ambos casos.
 */
export const signUp = createPublicAction(
  signUpSchema,
  async ({ fullName, email, password, next }, { supabase }) => {
    const origin = await getRequestOrigin();
    const safeNext = getSafeRedirectPath(next);
    const { data, error } = await supabase.auth.signUp({
      email,
      password,
      options: {
        data: { full_name: fullName },
        // La plantilla custom usa .RedirectTo para volver a la invitación
        // después de confirmar, incluso desde otro dispositivo.
        emailRedirectTo: `${origin}${safeNext}`,
      },
    });

    if (error && !isUserAlreadyExistsError(error)) {
      return actionError(authErrorMessage(error));
    }

    // Si el proyecto no exige confirmar el email, la sesión ya quedó iniciada.
    const needsConfirmation = !data?.session;
    return actionOk(
      { needsConfirmation },
      needsConfirmation
        ? "Te enviamos un email para confirmar la cuenta. Si ya estabas registrado, iniciá sesión."
        : "¡Listo! Tu cuenta quedó creada.",
    );
  },
);

/** Inicia el flujo OAuth con Google y devuelve la URL a la que tiene que ir el navegador. */
export const signInWithGoogle = createPublicAction(oauthSchema, async ({ next }, { supabase }) => {
  const origin = await getRequestOrigin();
  const redirectTo = `${origin}/auth/callback?next=${encodeURIComponent(getSafeRedirectPath(next))}`;

  const { data, error } = await supabase.auth.signInWithOAuth({
    provider: "google",
    options: { redirectTo },
  });

  if (error || !data.url) {
    return actionError(authErrorMessage(error, "No pudimos iniciar sesión con Google. Probá de nuevo."));
  }
  return actionOk({ url: data.url });
});

/**
 * Pide el email de recuperación. Salvo por rate limit, la respuesta no cambia
 * según exista o no la cuenta (evita enumerar usuarios).
 */
export const requestPasswordReset = createPublicAction(
  recoverPasswordSchema,
  async ({ email }, { supabase }) => {
    const origin = await getRequestOrigin();
    const { error } = await supabase.auth.resetPasswordForEmail(email, {
      redirectTo: `${origin}/auth/callback?next=${encodeURIComponent("/actualizar-clave")}`,
    });

    if (error && isRateLimitError(error)) {
      return actionError(authErrorMessage(error));
    }
    if (error) {
      console.error("[auth] resetPasswordForEmail:", error.code ?? error.status);
    }
    return actionOk(
      undefined,
      "Si hay una cuenta con ese email, te enviamos un link para restablecer la contraseña.",
    );
  },
);

/** Cambia la contraseña del usuario con sesión (incluida la sesión de recuperación). */
export const updatePassword = createAction(updatePasswordSchema, async ({ password }, { supabase }) => {
  const { error } = await supabase.auth.updateUser({ password });
  if (error) return actionError(authErrorMessage(error));
  return actionOk(undefined, "Actualizamos tu contraseña.");
});

/** Cierra la sesión solo en este dispositivo. */
export async function signOut() {
  const supabase = await createClient();
  await supabase.auth.signOut({ scope: "local" });
  redirect("/login");
}
