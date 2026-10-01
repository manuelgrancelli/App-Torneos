import { isAuthError } from "@supabase/supabase-js";

/**
 * Traducción de errores de Supabase Auth a mensajes en español para la UI.
 * Nunca se muestra el mensaje crudo del servidor: puede filtrar detalles
 * internos o estar en inglés.
 */
const AUTH_ERROR_MESSAGES: Record<string, string> = {
  invalid_credentials: "Email o contraseña incorrectos.",
  email_not_confirmed:
    "Tenés que confirmar tu email antes de ingresar. Revisá tu casilla de correo.",
  weak_password: "La contraseña es muy débil. Probá con una más larga o que combine letras y números.",
  same_password: "La nueva contraseña tiene que ser distinta de la actual.",
  email_address_invalid: "Ese email no es válido.",
  signup_disabled: "El registro de cuentas nuevas está deshabilitado.",
  email_provider_disabled: "El ingreso con email está deshabilitado.",
  provider_disabled: "Este método de ingreso no está habilitado.",
  user_banned: "Tu cuenta está suspendida.",
  over_request_rate_limit: "Hiciste demasiados intentos. Esperá unos minutos y probá de nuevo.",
  over_email_send_rate_limit: "Se enviaron demasiados emails. Esperá unos minutos y probá de nuevo.",
  otp_expired: "El link expiró o ya fue usado. Pedí uno nuevo.",
  session_expired: "Tu sesión expiró. Volvé a iniciar sesión.",
  session_not_found: "Tu sesión expiró. Volvé a iniciar sesión.",
  refresh_token_not_found: "Tu sesión expiró. Volvé a iniciar sesión.",
  reauthentication_needed: "Por seguridad, volvé a iniciar sesión y probá de nuevo.",
  flow_state_expired: "El inicio de sesión tardó demasiado. Probá de nuevo.",
  flow_state_not_found: "No pudimos completar el inicio de sesión. Probá de nuevo.",
  bad_code_verifier: "No pudimos completar el inicio de sesión. Probá de nuevo.",
  bad_oauth_state: "No pudimos completar el inicio de sesión. Probá de nuevo.",
  bad_oauth_callback: "No pudimos completar el inicio de sesión. Probá de nuevo.",
  request_timeout: "El servidor tardó demasiado en responder. Probá de nuevo.",
};

const DEFAULT_MESSAGE = "No pudimos completar la operación. Probá de nuevo.";

/** Códigos que indican que el email ya tiene cuenta (se tratan sin revelarlo). */
const USER_EXISTS_CODES = new Set(["user_already_exists", "email_exists"]);

export function authErrorMessage(error: unknown, fallback: string = DEFAULT_MESSAGE): string {
  if (isAuthError(error) && error.code) {
    return AUTH_ERROR_MESSAGES[error.code] ?? fallback;
  }
  return fallback;
}

export function isUserAlreadyExistsError(error: unknown): boolean {
  return isAuthError(error) && error.code !== undefined && USER_EXISTS_CODES.has(error.code);
}

// -----------------------------------------------------------------------------
// Errores de la base (PostgREST / RPC)
// -----------------------------------------------------------------------------

/** Forma mínima de un error de PostgREST (PostgrestError). */
type DbError = { code?: string | null; message?: string | null };

/** Errores de integridad: no se muestra el detalle crudo de Postgres. */
const DB_ERROR_MESSAGES: Record<string, string> = {
  "23505": "Ya existe un registro con esos datos.",
  "23P01": "La cancha ya tiene otro partido en ese horario.",
  "23503": "Hay datos relacionados que impiden la operación.",
  "23514": "Los datos no son válidos.",
  "23502": "Faltan datos obligatorios.",
  "22P02": "Los datos no son válidos.",
  PGRST116: "No encontramos lo que buscabas.",
};

const DB_PERMISSION_MESSAGE = "No tenés permiso para hacer esto.";

/**
 * Mensaje para la UI a partir de un error de la base.
 * - P0001: reglas de negocio de nuestras RPC (mensajes en español, pensados para el usuario).
 * - 42501: permisos. Si viene de nuestras RPC tiene mensaje propio; si es el
 *   "permission denied" de Postgres, se muestra uno genérico.
 * - Resto: mensajes fijos por código, nunca el texto crudo.
 */
export function dbErrorMessage(error: DbError | null | undefined, fallback: string = DEFAULT_MESSAGE): string {
  const code = error?.code ?? "";
  const message = error?.message?.trim() ?? "";

  if (code === "P0001" && message) return message;
  if (code === "42501") {
    // Los de Postgres/RLS vienen en inglés ("permission denied…", "new row violates row-level security…").
    return message && !/permission denied|row-level security/i.test(message) ? message : DB_PERMISSION_MESSAGE;
  }
  return DB_ERROR_MESSAGES[code] ?? fallback;
}

export function isRateLimitError(error: unknown): boolean {
  return (
    isAuthError(error) &&
    (error.code === "over_request_rate_limit" ||
      error.code === "over_email_send_rate_limit" ||
      error.status === 429)
  );
}
