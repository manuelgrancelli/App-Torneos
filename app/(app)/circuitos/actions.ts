"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { isSchemaPendingError } from "@/lib/data/circuits";
import { circuitPointsConfigSchema, circuitSchema } from "@/lib/domain/circuits";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { slugWithSuffix } from "@/lib/utils/slug";

/** Crea un circuito nuevo con su configuración de puntos. */
export const createCircuit = createAction(circuitSchema, async (input, { supabase, userId }) => {
  const { data: sport, error: sportError } = await supabase
    .from("sports")
    .select("id")
    .eq("id", input.sportId)
    .maybeSingle();

  if (sportError) return actionError(dbErrorMessage(sportError));
  if (!sport) return actionError("El deporte elegido no existe.", { sportId: ["Elegí un deporte."] });

  for (let attempt = 0; attempt < 2; attempt++) {
    const slug = slugWithSuffix(input.name);
    const { data, error } = await supabase
      .from("circuits")
      .insert({
        name: input.name,
        slug,
        sport_id: input.sportId,
        year: input.year,
        description: input.description || null,
        points_config: input.pointsConfig,
        organizer_id: userId,
      })
      .select("id")
      .single();

    if (!error) {
      revalidatePath("/circuitos");
      revalidatePath("/torneos");
      return actionOk({ circuitId: data.id }, "Circuito creado exitosamente.");
    }
    if (isSchemaPendingError(error)) {
      return actionError("Falta ejecutar la migración SQL de circuitos en Supabase (supabase/migrations/20261006000100_circuits.sql).");
    }
    if (error.code !== "23505") return actionError(dbErrorMessage(error));
  }

  return actionError("No pudimos generar un identificador único para el circuito. Probá de nuevo.");
});

const updateCircuitPointsSchema = z.object({
  circuitId: z.uuid(),
  pointsConfig: circuitPointsConfigSchema,
});

/** Actualiza el baremo de puntos por ronda de un circuito. */
export const updateCircuitPoints = createAction(
  updateCircuitPointsSchema,
  async ({ circuitId, pointsConfig }, { supabase, userId }) => {
    const { error } = await supabase
      .from("circuits")
      .update({ points_config: pointsConfig })
      .eq("id", circuitId)
      .eq("organizer_id", userId);

    if (error) return actionError(dbErrorMessage(error));

    revalidatePath(`/circuitos/${circuitId}`);
    return actionOk(undefined, "Configuración de puntos actualizada.");
  },
);

const linkTournamentSchema = z.object({
  circuitId: z.uuid(),
  tournamentId: z.uuid(),
  circuitOrder: z.number().int().min(1).max(100),
});

/** Asocia un torneo existente como una fecha del circuito. */
export const linkTournamentToCircuit = createAction(
  linkTournamentSchema,
  async ({ circuitId, tournamentId, circuitOrder }, { supabase, userId }) => {
    // Validar que el circuito pertenezca al organizador
    const { data: circuit, error: circuitError } = await supabase
      .from("circuits")
      .select("id, sport_id")
      .eq("id", circuitId)
      .eq("organizer_id", userId)
      .maybeSingle();

    if (circuitError) return actionError(dbErrorMessage(circuitError));
    if (!circuit) return actionError("No tenés permiso para editar este circuito.");

    // Validar que el torneo pertenezca al organizador y coincida el deporte
    const { data: tour, error: tourError } = await supabase
      .from("tournaments")
      .select("id, sport_id")
      .eq("id", tournamentId)
      .eq("organizer_id", userId)
      .maybeSingle();

    if (tourError) return actionError(dbErrorMessage(tourError));
    if (!tour) return actionError("El torneo no existe o no tenés permiso.");
    if (tour.sport_id !== circuit.sport_id) {
      return actionError("El deporte del torneo no coincide con el deporte del circuito.");
    }

    const { error } = await supabase
      .from("tournaments")
      .update({ circuit_id: circuitId, circuit_order: circuitOrder })
      .eq("id", tournamentId);

    if (error) return actionError(dbErrorMessage(error));

    revalidatePath(`/circuitos/${circuitId}`);
    revalidatePath(`/torneos/${tournamentId}`);
    return actionOk(undefined, "Fecha vinculada al circuito.");
  },
);

const unlinkTournamentSchema = z.object({
  circuitId: z.uuid(),
  tournamentId: z.uuid(),
});

/** Desvincula una fecha de un circuito. */
export const unlinkTournamentFromCircuit = createAction(
  unlinkTournamentSchema,
  async ({ circuitId, tournamentId }, { supabase, userId }) => {
    const { error } = await supabase
      .from("tournaments")
      .update({ circuit_id: null, circuit_order: null })
      .eq("id", tournamentId)
      .eq("circuit_id", circuitId)
      .eq("organizer_id", userId);

    if (error) return actionError(dbErrorMessage(error));

    revalidatePath(`/circuitos/${circuitId}`);
    revalidatePath(`/torneos/${tournamentId}`);
    return actionOk(undefined, "Fecha desvinculada del circuito.");
  },
);

const deleteCircuitSchema = z.object({
  circuitId: z.uuid(),
});

/** Elimina un circuito (los torneos asociados no se borran, solo quedan desvinculados). */
export const deleteCircuit = createAction(
  deleteCircuitSchema,
  async ({ circuitId }, { supabase, userId }) => {
    const { error } = await supabase
      .from("circuits")
      .delete()
      .eq("id", circuitId)
      .eq("organizer_id", userId);

    if (error) return actionError(dbErrorMessage(error));

    revalidatePath("/circuitos");
    revalidatePath("/torneos");
    return actionOk(undefined, "Circuito eliminado.");
  },
);
