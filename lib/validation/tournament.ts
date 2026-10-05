import "./zod-locale";
import { z } from "zod";
import { playoffConfigSchema } from "@/lib/domain/bracket";
import { scoringConfigSchema } from "@/lib/domain/scoring";
import { TIEBREAKER_LABELS, standingsConfigSchema, tiebreakersFor } from "@/lib/domain/standings";
import { isValidLocalDate } from "@/lib/domain/slots";

/** Esquemas de los formularios de torneo, canchas y franjas (cliente y servidor). */

export const localDateSchema = z
  .string()
  .refine(isValidLocalDate, { error: "Ingresá una fecha válida." });

export const localTimeSchema = z
  .string()
  .regex(/^([01]\d|2[0-3]):[0-5]\d$|^24:00$/, { error: "Ingresá una hora válida (HH:mm)." });

const integer = (min: number, max: number, label: string) =>
  z
    .number({ error: `Ingresá ${label}.` })
    .int({ error: `${label[0]?.toUpperCase()}${label.slice(1)} tiene que ser un número entero.` })
    .min(min, { error: `El mínimo es ${min}.` })
    .max(max, { error: `El máximo es ${max}.` });

/** Datos generales (comunes a crear y editar). */
const tournamentInfoShape = {
  name: z
    .string()
    .trim()
    .min(3, { error: "Usá al menos 3 caracteres." })
    .max(100, { error: "Usá como máximo 100 caracteres." }),
  description: z.string().trim().max(2000, { error: "Usá como máximo 2000 caracteres." }),
  startsOn: localDateSchema,
  endsOn: localDateSchema,
  timezone: z.string().min(1, { error: "Elegí una zona horaria." }),
  maxTeams: integer(2, 128, "el cupo"),
  resultsRequireConfirmation: z.boolean(),
  scoringConfig: scoringConfigSchema,
  standingsConfig: standingsConfigSchema,
  playoffConfig: playoffConfigSchema,
};

type ConfigFields = {
  startsOn: string;
  endsOn: string;
  scoringConfig: z.infer<typeof scoringConfigSchema>;
  standingsConfig: z.infer<typeof standingsConfigSchema>;
};

/** Reglas que cruzan campos: fechas y desempates acordes al deporte. */
function crossFieldChecks(data: ConfigFields, ctx: z.RefinementCtx) {
  if (data.startsOn && data.endsOn && data.endsOn < data.startsOn) {
    ctx.addIssue({ code: "custom", path: ["endsOn"], message: "La fecha de fin no puede ser anterior a la de inicio." });
    ctx.addIssue({ code: "custom", path: ["startsOn"], message: "La fecha de inicio no puede ser posterior a la de fin." });
  }
  const allowed = tiebreakersFor(data.scoringConfig.type);
  for (const criterion of data.standingsConfig.tiebreakers) {
    if (!allowed.includes(criterion)) {
      ctx.addIssue({
        code: "custom",
        path: ["standingsConfig", "tiebreakers"],
        message: `"${TIEBREAKER_LABELS[criterion]}" no aplica a este deporte.`,
      });
    }
  }
}

export const createTournamentSchema = z
  .object({
    ...tournamentInfoShape,
    sportId: z.string().min(1, { error: "Elegí un deporte." }),
    courtCount: integer(1, 50, "la cantidad de canchas"),
  })
  .superRefine(crossFieldChecks);

export const updateTournamentSchema = z
  .object({ ...tournamentInfoShape, tournamentId: z.uuid() })
  .superRefine(crossFieldChecks);

export type CreateTournamentInput = z.input<typeof createTournamentSchema>;
export type UpdateTournamentInput = z.input<typeof updateTournamentSchema>;

export const tournamentIdSchema = z.object({ tournamentId: z.uuid() });

export const changeStatusSchema = z.object({
  tournamentId: z.uuid(),
  status: z.enum(["draft", "registration_open", "group_stage", "playoffs", "finished"]),
});

// -----------------------------------------------------------------------------
// Canchas
// -----------------------------------------------------------------------------

const courtFields = {
  name: z
    .string()
    .trim()
    .min(1, { error: "Ingresá un nombre." })
    .max(60, { error: "Usá como máximo 60 caracteres." }),
  venue: z.string().trim().max(100, { error: "Usá como máximo 100 caracteres." }),
};

export const createCourtSchema = z.object({ tournamentId: z.uuid(), ...courtFields });
export const updateCourtSchema = z.object({ tournamentId: z.uuid(), courtId: z.uuid(), ...courtFields });
export const deleteCourtSchema = z.object({ tournamentId: z.uuid(), courtId: z.uuid() });

// -----------------------------------------------------------------------------
// Franjas
// -----------------------------------------------------------------------------

export const generateSlotsSchema = z
  .object({
    tournamentId: z.uuid(),
    dates: z.array(localDateSchema).min(1, { error: "Elegí al menos un día." }).max(62),
    from: localTimeSchema,
    to: localTimeSchema,
    durationMinutes: integer(15, 480, "la duración"),
    breakMinutes: integer(0, 240, "la pausa"),
    courtId: z.uuid().nullable(),
  })
  .refine((data) => data.to > data.from, {
    error: "La hora de fin tiene que ser posterior a la de inicio.",
    path: ["to"],
  });

export const createSlotSchema = z
  .object({
    tournamentId: z.uuid(),
    date: localDateSchema,
    start: localTimeSchema,
    end: localTimeSchema,
    courtId: z.uuid().nullable(),
  })
  .refine((data) => data.end > data.start, {
    error: "La hora de fin tiene que ser posterior a la de inicio.",
    path: ["end"],
  });

export const deleteSlotsSchema = z.object({
  tournamentId: z.uuid(),
  slotIds: z.array(z.uuid()).min(1).max(500),
});

export type GenerateSlotsInput = z.input<typeof generateSlotsSchema>;
export type CreateSlotInput = z.input<typeof createSlotSchema>;
