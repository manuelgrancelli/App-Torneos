import "./zod-locale";
import { z } from "zod";
import { matchResultSchema } from "@/lib/domain/scoring";

/** Esquemas de grupos, programación y resultados. */

export const saveGroupsSchema = z.object({
  tournamentId: z.uuid(),
  categoryId: z.uuid().optional(),
  groups: z.array(z.array(z.uuid()).min(2, { error: "Cada grupo tiene que tener al menos 2 equipos." })).min(1).max(26),
});

export const autoScheduleSchema = z.object({
  tournamentId: z.uuid(),
  mode: z.enum(["unscheduled", "all"]),
});

export const assignSlotSchema = z.object({
  tournamentId: z.uuid(),
  matchId: z.uuid(),
  slotId: z.uuid().nullable(),
  courtId: z.uuid().nullable(),
});

export const recordResultSchema = z.discriminatedUnion("kind", [
  z.object({
    kind: z.literal("score"),
    tournamentId: z.uuid(),
    matchId: z.uuid(),
    result: matchResultSchema,
    totalRounds: z.number().int().min(1).max(20).optional(),
  }),
  z.object({
    kind: z.literal("walkover"),
    tournamentId: z.uuid(),
    matchId: z.uuid(),
    winner: z.enum(["home", "away"]),
    totalRounds: z.number().int().min(1).max(20).optional(),
  }),
]);

export const matchActionSchema = z.object({ tournamentId: z.uuid(), matchId: z.uuid() });

export const respondResultSchema = z
  .object({
    teamId: z.uuid(),
    matchId: z.uuid(),
    response: z.enum(["confirmed", "disputed"]),
    comment: z.string().trim().max(500, { error: "Usá como máximo 500 caracteres." }),
  })
  .refine((data) => data.response === "confirmed" || data.comment.length > 0, {
    error: "Contale al organizador qué está mal en el resultado.",
    path: ["comment"],
  });

export type RecordResultInput = z.input<typeof recordResultSchema>;
