import { z } from "zod";

/**
 * Esquemas de validación de autenticación. Los usan tanto los formularios
 * (React Hook Form + zodResolver) como las Server Actions, así el servidor
 * valida exactamente lo mismo que el cliente.
 */

/** Email normalizado (sin espacios, en minúscula). */
export const emailSchema = z
  .string()
  .trim()
  .min(1, { error: "Ingresá tu email." })
  .toLowerCase()
  .pipe(z.email({ error: "Ingresá un email válido." }));

/** 72 es el límite de bcrypt, que usa Supabase Auth. */
export const newPasswordSchema = z
  .string()
  .min(8, { error: "Usá al menos 8 caracteres." })
  .max(72, { error: "Usá como máximo 72 caracteres." });

export const fullNameSchema = z
  .string()
  .trim()
  .min(2, { error: "Ingresá tu nombre y apellido." })
  .max(80, { error: "Usá como máximo 80 caracteres." });

export const loginSchema = z.object({
  email: emailSchema,
  // En el login no se exige el largo mínimo: solo que la complete.
  password: z.string().min(1, { error: "Ingresá tu contraseña." }),
});

export const signUpSchema = z
  .object({
    fullName: fullNameSchema,
    email: emailSchema,
    password: newPasswordSchema,
    confirmPassword: z.string(),
    next: z.string().max(2048).optional(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

export const recoverPasswordSchema = z.object({
  email: emailSchema,
});

export const updatePasswordSchema = z
  .object({
    password: newPasswordSchema,
    confirmPassword: z.string(),
  })
  .refine((data) => data.password === data.confirmPassword, {
    error: "Las contraseñas no coinciden.",
    path: ["confirmPassword"],
  });

/** Ruta a la que volver después del login con Google (se sanea en el servidor). */
export const oauthSchema = z.object({
  next: z.string().max(2048).optional(),
});

export type LoginInput = z.input<typeof loginSchema>;
export type SignUpInput = z.input<typeof signUpSchema>;
export type RecoverPasswordInput = z.input<typeof recoverPasswordSchema>;
export type UpdatePasswordInput = z.input<typeof updatePasswordSchema>;
