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
  categoryId: z.string().uuid().optional(),
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
    categoryId: z.string().uuid().optional(),
    teamName: z.string().trim().max(60, { error: "Usá como máximo 60 caracteres." }).optional(),
    playerNames: z
      .array(z.string().trim().min(1, { error: "Ingresá el nombre de cada jugador." }).max(80))
      .min(1)
      .max(60),
    slotIds: z
      .array(z.uuid())
      .max(1000)
      .refine((slotIds) => new Set(slotIds).size === slotIds.length, { error: "Hay franjas repetidas." })
      .default([]),
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

export const assignTeamCategorySchema = z.object({
  tournamentId: z.uuid(),
  teamId: z.uuid(),
  categoryId: z.uuid().nullable().optional(),
});

export const assignTournamentTeamsCategorySchema = z.object({
  tournamentId: z.uuid(),
  categoryId: z.uuid(),
});

export const setTeamAvailabilitySchema = z.object({
  tournamentId: z.uuid(),
  teamId: z.uuid(),
  slotIds: z.array(z.uuid()).max(1000),
});

export const bulkImportTeamItemSchema = z.object({
  teamName: z.string().trim().min(2, "El nombre de la pareja debe tener al menos 2 caracteres.").max(60),
  playerNames: z.array(z.string().trim().min(1).max(80)).min(1),
});

export const bulkImportCategoryBlockSchema = z.object({
  categoryName: z.string().trim().min(1, "El nombre de la categoría es requerido.").max(60),
  categoryId: z.string().uuid().nullable().optional(),
  teams: z.array(bulkImportTeamItemSchema).min(1, "Debe haber al menos 1 pareja en la categoría."),
});

export const bulkImportTeamsSchema = z.object({
  tournamentId: z.uuid(),
  allSlots: z.boolean().default(true),
  customSlotIds: z.array(z.uuid()).optional(),
  blocks: z.array(bulkImportCategoryBlockSchema).min(1, "No se detectaron categorías con parejas para importar."),
});

export const replaceTeamPlayerSchema = z.object({
  tournamentId: z.uuid(),
  teamId: z.uuid(),
  memberId: z.uuid(),
  newPlayerName: z.string().trim().min(1, "El nombre del jugador es requerido.").max(80, "Máximo 80 caracteres."),
  newTeamName: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(60, "Máximo 60 caracteres.").optional(),
});

export type RegisterTeamInput = z.input<typeof registerTeamSchema>;
export type UpdateRosterInput = z.input<typeof updateRosterSchema>;
export type OrganizerCreateTeamInput = z.input<typeof organizerCreateTeamSchema>;
export type AssignTeamCategoryInput = z.input<typeof assignTeamCategorySchema>;
export type AssignTournamentTeamsCategoryInput = z.input<typeof assignTournamentTeamsCategorySchema>;
export type SetTeamAvailabilityInput = z.input<typeof setTeamAvailabilitySchema>;
export type BulkImportTeamsInput = z.input<typeof bulkImportTeamsSchema>;
export type ReplaceTeamPlayerInput = z.input<typeof replaceTeamPlayerSchema>;

/** "demq2-padel " → "DEMQ2PADEL" (igual que normalize_code en la base). */
export function normalizeInviteCode(code: string): string {
  return code.replace(/[^a-z0-9]/gi, "").toUpperCase();
}

