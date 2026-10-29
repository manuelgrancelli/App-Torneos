"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { groupCountOptions, groupName, drawGroups } from "@/lib/domain/groups";
import { generateGroupInitialMatches, groupTotalMatchCount } from "@/lib/domain/round-robin";
import { randomSeed } from "@/lib/domain/random";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { drawAllCategoriesSchema, saveGroupsSchema } from "@/lib/validation/competition";

/**
 * Persiste los grupos de una categoría en la base de datos y genera sus partidos:
 * - Para grupos de 4 parejas (formato padel GSL): 2 partidos en fecha 1 (T0 vs T1, T2 vs T3)
 *   y 2 partidos en fecha 2 (definición 1°/2° y 3°/eliminado) que se completan dinámicamente.
 * - Para grupos de otros tamaños: fixture todos contra todos tradicional (Round Robin).
 */
async function persistCategoryGroups(
  supabase: any,
  tournamentId: string,
  categoryId: string | null | undefined,
  groups: string[][],
): Promise<{ ok: boolean; error?: any; totalMatches: number }> {
  const payload = groups.map((teamIds, index) => ({
    name: groupName(index),
    teamIds,
    matches: generateGroupInitialMatches(teamIds),
  }));

  // 1. Intentar llamar con p_category_id explícito (incluso si es null) para desambiguar
  // en caso de que en PostgreSQL coexista la función de 2 parámetros con la de 3 parámetros (PGRST203).
  let { error } = await supabase.rpc("apply_groups", {
    p_tournament_id: tournamentId,
    p_groups: payload,
    p_category_id: categoryId ?? null,
  });

  // 2. Si falló porque la base de datos solo tiene la versión legacy de 2 parámetros (PGRST202 o parámetro no encontrado),
  // reintentar con la firma legacy de 2 parámetros (solo cuando categoryId no esté definido).
  if (error && !categoryId && (error.code === "PGRST202" || error.code === "42883" || error.message?.includes("p_category_id"))) {
    const fallback = await supabase.rpc("apply_groups", {
      p_tournament_id: tournamentId,
      p_groups: payload,
    });
    error = fallback.error;
  }

  if (error) {
    console.error("[persistCategoryGroups error]:", error);
    return { ok: false, error, totalMatches: 0 };
  }

  // 3. Para grupos de 4 parejas, insertar los 2 partidos de Fecha 2 (Definición 1°/2° y 3°/eliminado)
  const has4TeamGroups = groups.some((teamIds) => teamIds.length === 4);
  if (has4TeamGroups) {
    let query = supabase
      .from("tournament_groups")
      .select("id, position")
      .eq("tournament_id", tournamentId);
    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }
    const { data: dbGroups } = await query;
    if (dbGroups) {
      const r2MatchesToInsert = groups
        .map((teamIds, index) => {
          if (teamIds.length !== 4) return null;
          const dbGroup = dbGroups.find((g: any) => g.position === index);
          if (!dbGroup) return null;
          return [
            {
              tournament_id: tournamentId,
              category_id: categoryId ?? null,
              stage: "group" as const,
              group_id: dbGroup.id,
              round: 2,
              position: 0, // Ganadores (1° vs 2° puesto)
              home_team_id: null,
              away_team_id: null,
            },
            {
              tournament_id: tournamentId,
              category_id: categoryId ?? null,
              stage: "group" as const,
              group_id: dbGroup.id,
              round: 2,
              position: 1, // Perdedores (3° puesto vs eliminado)
              home_team_id: null,
              away_team_id: null,
            },
          ];
        })
        .filter(Boolean)
        .flat();

      if (r2MatchesToInsert.length > 0) {
        const { error: r2Error } = await supabase.from("matches").insert(r2MatchesToInsert);
        if (r2Error) {
          console.error("[persistCategoryGroups round2Matches insert error]:", r2Error);
        }
      }
    }
  }

  const totalMatches = groups.reduce((sum, group) => sum + groupTotalMatchCount(group.length), 0);
  return { ok: true, totalMatches };
}

/** Guarda los grupos de una categoría específica y genera su fixture. */
export const saveGroups = createAction(saveGroupsSchema, async ({ tournamentId, categoryId, groups }, { supabase }) => {
  const result = await persistCategoryGroups(supabase, tournamentId, categoryId, groups);
  if (!result.ok) {
    return actionError(dbErrorMessage(result.error));
  }

  revalidatePath(`/torneos/${tournamentId}`, "layout");
  refreshPublicTournament(tournamentId);
  return actionOk(undefined, `Guardamos ${groups.length} ${groups.length === 1 ? "grupo" : "grupos"} y ${result.totalMatches} partidos.`);
});

/**
 * Sortea y guarda los grupos de todas las categorías del torneo que tengan al menos 2 parejas aprobadas.
 * Optimiza la compatibilidad horaria intrazona en cada categoría utilizando la disponibilidad de las parejas.
 */
export const drawAllCategories = createAction(
  drawAllCategoriesSchema,
  async ({ tournamentId, categoryConfigs }, { supabase }) => {
    const [categoriesRes, teamsRes, matchesRes] = await Promise.all([
      (supabase as any).from("tournament_categories").select("*").eq("tournament_id", tournamentId).order("position").limit(500),
      (supabase as any).from("teams").select("id, name, category_id, status, team_availability(slot_id)").eq("tournament_id", tournamentId).eq("status", "approved").limit(5000),
      (supabase as any).from("matches").select("id, category_id, result_status").eq("tournament_id", tournamentId).limit(5000),
    ]);

    if (categoriesRes.error) return actionError(dbErrorMessage(categoriesRes.error));
    if (teamsRes.error) return actionError(dbErrorMessage(teamsRes.error));
    if (matchesRes.error) return actionError(dbErrorMessage(matchesRes.error));

    const categories = categoriesRes.data ?? [];
    const teams = teamsRes.data ?? [];
    const matches = matchesRes.data ?? [];

    if (categories.length === 0) {
      return actionError("El torneo no tiene categorías creadas.");
    }

    // Mapa de disponibilidad teamId -> slotIds
    const availability: Record<string, string[]> = {};
    for (const t of teams) {
      availability[t.id] = ((t.team_availability as Array<{ slot_id: string }>) ?? []).map((a: any) => a.slot_id);
    }

    // Categorías con resultados ya cargados (no deben re-sortearse para no alterar resultados jugados)
    const categoriesWithResults = new Set<string>();
    for (const m of matches) {
      if (m.result_status !== null && m.category_id) {
        categoriesWithResults.add(m.category_id);
      }
    }

    const configMap = new Map((categoryConfigs ?? []).map((c) => [c.categoryId, c.groupCount]));

    let drawnCount = 0;
    let totalGroupsCount = 0;
    let totalMatchesCount = 0;
    const skippedCategories: string[] = [];

    for (const cat of categories) {
      if (cat.status === "playoffs" || cat.status === "finished") {
        skippedCategories.push(`${cat.name} (ya está en playoffs o finalizada)`);
        continue;
      }

      if (categoriesWithResults.has(cat.id)) {
        skippedCategories.push(`${cat.name} (ya tiene resultados cargados)`);
        continue;
      }

      const catTeams = teams.filter(
        (t: any) => t.category_id === cat.id || (!t.category_id && categories.length === 1),
      );

      if (catTeams.length < 2) {
        skippedCategories.push(`${cat.name} (tiene menos de 2 parejas aprobadas)`);
        continue;
      }

      // Si la categoría aún está en inscripción o borrador, avanzar a fase de grupos
      if (cat.status === "registration_open" || cat.status === "draft") {
        await (supabase.rpc as any)("set_category_status", {
          p_category_id: cat.id,
          p_status: "group_stage",
        });
      }

      const options = groupCountOptions(catTeams.length);
      const suggested =
        options.find((count) => catTeams.length / count <= 4) ??
        options.find((count) => catTeams.length / count <= 5) ??
        options[options.length - 1] ??
        1;

      const requestedCount = configMap.get(cat.id);
      const targetGroupCount =
        requestedCount && options.includes(requestedCount) ? requestedCount : suggested;

      const teamIds = catTeams.map((t: any) => t.id);
      const groups = drawGroups(teamIds, targetGroupCount, randomSeed(), availability);

      const persistRes = await persistCategoryGroups(supabase, tournamentId, cat.id, groups);
      if (!persistRes.ok) {
        console.error(`[drawAllCategories error in category ${cat.name}]:`, persistRes.error);
        return actionError(`Error al guardar los grupos de "${cat.name}": ${dbErrorMessage(persistRes.error)}`);
      }

      drawnCount++;
      totalGroupsCount += groups.length;
      totalMatchesCount += persistRes.totalMatches;
    }

    if (drawnCount === 0) {
      const reasons = skippedCategories.length > 0 ? `: ${skippedCategories.join(", ")}.` : ".";
      return actionError(`No se pudo sortear ninguna categoría${reasons}`);
    }

    revalidatePath(`/torneos/${tournamentId}`, "layout");
    refreshPublicTournament(tournamentId);

    const message =
      drawnCount === 1
        ? `Sorteamos 1 categoría (${totalGroupsCount} grupos y ${totalMatchesCount} partidos).`
        : `Sorteamos ${drawnCount} categorías (${totalGroupsCount} grupos y ${totalMatchesCount} partidos en total) optimizando los horarios de juego.`;

    return actionOk({ drawnCount, totalGroupsCount, totalMatchesCount }, message);
  },
);
