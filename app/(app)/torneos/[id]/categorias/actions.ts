"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { refreshPublicTournament } from "@/lib/public-cache";
import { ensurePlayoffBracket } from "../cuadro/actions";
import {
  createCategorySchema,
  deleteCategorySchema,
  setCategoryStatusSchema,
  updateCategorySchema,
} from "@/lib/validation/tournament";

function revalidate(tournamentId: string) {
  revalidatePath(`/torneos/${tournamentId}/categorias`);
  revalidatePath(`/torneos/${tournamentId}`, "layout");
  refreshPublicTournament(tournamentId);
}

/** Agrega una categoría al torneo integrado (ej. "6ta Caballeros", "4ta Femenino"). */
export const createCategory = createAction(createCategorySchema, async (input, { supabase }) => {
  const [{ data: existing, error: countError }, { data: tourney }] = await Promise.all([
    (supabase as any)
      .from("tournament_categories")
      .select("position")
      .eq("tournament_id", input.tournamentId)
      .order("position", { ascending: false })
      .limit(1),
    (supabase as any)
      .from("tournaments")
      .select("scoring_config, standings_config, playoff_config")
      .eq("id", input.tournamentId)
      .single(),
  ]);

  if (countError) {
    console.error("[createCategory] countError:", countError);
    return actionError(dbErrorMessage(countError));
  }
  const nextPos = (existing?.[0]?.position ?? -1) + 1;

  const insertPayload: Record<string, unknown> = {
    tournament_id: input.tournamentId,
    name: input.name,
    max_teams: input.maxTeams ?? null,
    position: nextPos,
    status: "registration_open",
  };

  if (tourney?.scoring_config) insertPayload.scoring_config = tourney.scoring_config;
  if (tourney?.standings_config) insertPayload.standings_config = tourney.standings_config;
  if (tourney?.playoff_config) insertPayload.playoff_config = tourney.playoff_config;

  const { data, error } = await (supabase as any)
    .from("tournament_categories")
    .insert(insertPayload)
    .select("id")
    .single();

  if (error) {
    console.error("[createCategory] insert error:", error);
    if (error.code === "23505") {
      return actionError("Ya existe una categoría con ese nombre en este torneo.", {
        name: ["Elegí otro nombre."],
      });
    }
    return actionError(dbErrorMessage(error));
  }

  revalidate(input.tournamentId);
  return actionOk({ categoryId: data.id }, `Categoría "${input.name}" creada.`);
});

/** Edita nombre o cupo de la categoría. */
export const updateCategory = createAction(updateCategorySchema, async (input, { supabase }) => {
  const { error } = await (supabase as any)
    .from("tournament_categories")
    .update({
      name: input.name,
      max_teams: input.maxTeams ?? null,
      updated_at: new Date().toISOString(),
    })
    .eq("id", input.categoryId)
    .eq("tournament_id", input.tournamentId);

  if (error) {
    if (error.code === "23505") {
      return actionError("Ya existe una categoría con ese nombre en este torneo.", {
        name: ["Elegí otro nombre."],
      });
    }
    return actionError(dbErrorMessage(error));
  }

  revalidate(input.tournamentId);
  return actionOk(undefined, "Categoría actualizada.");
});

/** Elimina una categoría si no tiene partidos jugados ni resultados. */
export const deleteCategory = createAction(deleteCategorySchema, async (input, { supabase }) => {
  const { data: matches } = await (supabase as any)
    .from("matches")
    .select("id, result_status")
    .eq("category_id", input.categoryId)
    .not("result_status", "is", null);

  if (matches && matches.length > 0) {
    return actionError("No se puede eliminar la categoría porque ya tiene partidos con resultados.");
  }

  const { error } = await (supabase as any)
    .from("tournament_categories")
    .delete()
    .eq("id", input.categoryId)
    .eq("tournament_id", input.tournamentId);

  if (error) return actionError(dbErrorMessage(error));

  revalidate(input.tournamentId);
  return actionOk(undefined, "Categoría eliminada.");
});

/** Cambia el estado de una categoría (inscripción -> grupos -> playoffs -> finalizado). */
export const changeCategoryStatus = createAction(setCategoryStatusSchema, async (input, { supabase }) => {
  const { error } = await (supabase.rpc as any)("set_category_status", {
    p_category_id: input.categoryId,
    p_status: input.status,
    p_champion_team_id: input.championTeamId ?? null,
  });

  if (error) return actionError(dbErrorMessage(error));

  if (input.status === "playoffs") {
    await ensurePlayoffBracket(supabase, input.tournamentId, { categoryId: input.categoryId });
  }

  revalidate(input.tournamentId);
  return actionOk(undefined, `Estado de categoría actualizado a ${input.status}.`);
});
