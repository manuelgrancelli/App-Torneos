import type { FieldError, FieldValues, Path, UseFormSetError } from "react-hook-form";

/**
 * Primer mensaje de error de un campo, aunque sea un objeto anidado (p. ej.
 * `scoringConfig.bestOf` dentro de un campo-objeto).
 */
export function firstErrorMessage(error: unknown): string | undefined {
  if (!error || typeof error !== "object") return undefined;
  const { message } = error as Partial<FieldError>;
  if (typeof message === "string" && message) return message;
  for (const value of Object.values(error)) {
    const nested = firstErrorMessage(value);
    if (nested) return nested;
  }
  return undefined;
}

/**
 * Marca en el formulario los errores por campo que devolvió una Server Action
 * (validación Zod del servidor). Solo se muestra el primer mensaje de cada campo.
 */
export function applyServerErrors<T extends FieldValues>(
  setError: UseFormSetError<T>,
  fieldErrors: Partial<Record<string, string[]>> | undefined,
): void {
  if (!fieldErrors) return;
  for (const [name, messages] of Object.entries(fieldErrors)) {
    const message = messages?.[0];
    if (message) setError(name as Path<T>, { type: "server", message });
  }
}
