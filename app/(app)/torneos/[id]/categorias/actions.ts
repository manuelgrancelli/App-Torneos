"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { refreshPublicTournament } from "@/lib/public-cache";
import { ensurePlayoffBracket } from "../cuadro/actions";
import { findMatchingCategory } from "@/lib/domain/category-matcher";
import {
  createCategorySchema,
  deleteCategorySchema,
  mergeCategoriesSchema,
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
  const [{ data: existing, error: countError }, { data: tourney }, { data: currentCategories }] = await Promise.all([
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
    (supabase as any)
      .from("tournament_categories")
      .select("id, name")
      .eq("tournament_id", input.tournamentId),
  ]);

  if (countError) {
    console.error("[createCategory] countError:", countError);
    return actionError(dbErrorMessage(countError));
  }

  // Prevenir creación de categorías equivalentes o duplicadas
  const match = findMatchingCategory(currentCategories ?? [], input.name);
  if (match) {
    return actionError(
      `Ya existe la categoría "${match.name}", que es equivalente a "${input.name}". Podés usar esa o editarla.`,
      { name: [`Equivalente a "${match.name}" ya existente.`] },
    );
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
  // Verificar que no coincida con otra categoría existente
  const { data: currentCategories } = await (supabase as any)
    .from("tournament_categories")
    .select("id, name")
    .eq("tournament_id", input.tournamentId)
    .neq("id", input.categoryId);

  const match = findMatchingCategory(currentCategories ?? [], input.name);
  if (match) {
    return actionError(
      `Ya existe la categoría "${match.name}", que es equivalente a "${input.name}".`,
      { name: [`Equivalente a "${match.name}".`] },
    );
  }

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

/** Unifica dos categorías: mueve todas las parejas a la categoría de destino y elimina la categoría origen. */
export const mergeCategories = createAction(mergeCategoriesSchema, async (input, { supabase }) => {
  if (input.sourceCategoryId === input.targetCategoryId) {
    return actionError("No se puede unificar una categoría consigo misma.");
  }

  const [{ data: sourceCat }, { data: targetCat }] = await Promise.all([
    (supabase as any)
      .from("tournament_categories")
      .select("id, name, tournament_id")
      .eq("id", input.sourceCategoryId)
      .eq("tournament_id", input.tournamentId)
      .maybeSingle(),
    (supabase as any)
      .from("tournament_categories")
      .select("id, name, tournament_id")
      .eq("id", input.targetCategoryId)
      .eq("tournament_id", input.tournamentId)
      .maybeSingle(),
  ]);

  if (!sourceCat || !targetCat) {
    return actionError("No encontramos una o ambas categorías para unificar.");
  }

  // 1. Reasignar todos los equipos de sourceCategoryId a targetCategoryId
  const { data: teamsToMove, error: teamsError } = await (supabase as any)
    .from("teams")
    .select("id")
    .eq("tournament_id", input.tournamentId)
    .eq("category_id", input.sourceCategoryId);

  if (teamsError) {
    return actionError(dbErrorMessage(teamsError));
  }

  const count = teamsToMove?.length ?? 0;

  if (count > 0) {
    const { error: updateError } = await (supabase as any)
      .from("teams")
      .update({ category_id: input.targetCategoryId })
      .eq("tournament_id", input.tournamentId)
      .eq("category_id", input.sourceCategoryId);

    if (updateError) {
      return actionError(dbErrorMessage(updateError));
    }
  }

  // 2. Eliminar la categoría origen si no tiene partidos con resultados jugados
  const { data: matches } = await (supabase as any)
    .from("matches")
    .select("id, result_status")
    .eq("category_id", input.sourceCategoryId)
    .not("result_status", "is", null);

  let categoryDeleted = false;
  if (!matches || matches.length === 0) {
    const { error: delError } = await (supabase as any)
      .from("tournament_categories")
      .delete()
      .eq("id", input.sourceCategoryId)
      .eq("tournament_id", input.tournamentId);

    if (!delError) categoryDeleted = true;
  }

  revalidate(input.tournamentId);
  revalidatePath(`/torneos/${input.tournamentId}/inscripciones`);

  const { data: tour } = await supabase.from("tournaments").select("sport_id").eq("id", input.tournamentId).maybeSingle();
  const isFootball = (tour?.sport_id ?? "").toLowerCase().includes("futbol");
  const unitText = isFootball
    ? (count === 1 ? "1 equipo" : `${count} equipos`)
    : (count === 1 ? "1 pareja" : `${count} parejas`);
  return actionOk(
    { movedCount: count, categoryDeleted },
    `Categorías unificadas: se ${count === 1 ? `movió ${unitText}` : `movieron ${unitText}`} a "${targetCat.name}"${categoryDeleted ? ` y se eliminó "${sourceCat.name}"` : ""}.`,
  );
});

