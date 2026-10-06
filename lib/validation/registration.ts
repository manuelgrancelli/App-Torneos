import "./zod-locale";
import { z } from "zod";
import { emailSchema } from "./auth";

/** Esquemas de inscripción, plantel y disponibilidad (cliente y servidor). */

export const teamNameSchema = z
  .string()
  .trim()
  .min(2, { error: "Usá al menos 2 caracteres." })
  .max(60, { error: "Usá como máximo 60 caracteres." });

/** Emails de los compañeros: válidos y sin repetir. La cantidad la valida la RPC según el deporte. */
export const memberEmailsSchema = z
  .array(emailSchema)
  .max(60)
  .refine((emails) => new Set(emails).size === emails.length, { error: "Hay emails repetidos." });

export const registerTeamSchema = z.object({
  code: z.string().trim().min(1).max(40),
  teamName: teamNameSchema,
  memberEmails: memberEmailsSchema,
});

export const updateRosterSchema = z.object({
  teamId: z.uuid(),
  teamName: teamNameSchema,
  memberEmails: memberEmailsSchema,
});

export const teamIdSchema = z.object({ teamId: z.uuid() });

export const availabilitySchema = z.object({
  teamId: z.uuid(),
  slotIds: z.array(z.uuid()).max(1000),
});

export const reviewRegistrationSchema = z.object({
  tournamentId: z.uuid(),
  teamId: z.uuid(),
  decision: z.enum(["approved", "rejected"]),
});

export const tournamentRegistrationActionSchema = z.object({ tournamentId: z.uuid() });

export const organizerCreateTeamSchema = z
  .object({
    tournamentId: z.uuid(),
    teamName: z.string().trim().max(60, { error: "Usá como máximo 60 caracteres." }).optional(),
    playerNames: z
      .array(z.string().trim().min(1, { error: "Ingresá el nombre de cada jugador." }).max(80))
      .min(1)
      .max(60),
    slotIds: z
      .array(z.uuid())
      .min(1, { error: "Elegí al menos una franja disponible." })
      .max(1000)
      .refine((slotIds) => new Set(slotIds).size === slotIds.length, { error: "Hay franjas repetidas." }),
  })
  .superRefine((data, ctx) => {
    const effectiveTeamName =
      data.teamName && data.teamName.trim().length > 0
        ? data.teamName.trim()
        : data.playerNames.map((p) => p.trim()).filter(Boolean).join(" / ");

    if (effectiveTeamName.length < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El nombre debe tener al menos 2 caracteres.",
        path: data.teamName !== undefined && data.teamName.trim().length > 0 ? ["teamName"] : ["playerNames"],
      });
    } else if (effectiveTeamName.length > 60) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        message: "El nombre no puede superar los 60 caracteres.",
        path: data.teamName !== undefined && data.teamName.trim().length > 0 ? ["teamName"] : ["playerNames"],
      });
    }
  });

export type RegisterTeamInput = z.input<typeof registerTeamSchema>;
export type UpdateRosterInput = z.input<typeof updateRosterSchema>;
export type OrganizerCreateTeamInput = z.input<typeof organizerCreateTeamSchema>;

/** "demq2-padel " → "DEMQ2PADEL" (igual que normalize_code en la base). */
export function normalizeInviteCode(code: string): string {
  return code.replace(/[^a-z0-9]/gi, "").toUpperCase();
}
