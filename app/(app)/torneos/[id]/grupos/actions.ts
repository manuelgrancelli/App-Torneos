"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { groupName } from "@/lib/domain/groups";
import { generateGroupInitialMatches, groupTotalMatchCount } from "@/lib/domain/round-robin";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { saveGroupsSchema } from "@/lib/validation/competition";

/**
 * Guarda los grupos y genera su fixture:
 * - Para grupos de 4 parejas (formato padel GSL): 2 partidos en fecha 1 (T0 vs T1, T2 vs T3)
 *   y 2 partidos en fecha 2 (definición 1°/2° y 3°/eliminado) que se completan dinámicamente.
 * - Para grupos de otros tamaños: fixture todos contra todos tradicional (Round Robin).
 */
export const saveGroups = createAction(saveGroupsSchema, async ({ tournamentId, categoryId, groups }, { supabase }) => {
  const payload = groups.map((teamIds, index) => ({
    name: groupName(index),
    teamIds,
    matches: generateGroupInitialMatches(teamIds),
  }));

  // 1. Intentar llamar con p_category_id explícito (incluso si es null) para desambiguar
  // en caso de que en PostgreSQL coexista la función de 2 parámetros con la de 3 parámetros (PGRST203).
  let { error } = await (supabase.rpc as any)("apply_groups", {
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
    console.error("[saveGroups error]:", error);
    return actionError(dbErrorMessage(error));
  }

  // 3. Para grupos de 4 parejas, insertar los 2 partidos de Fecha 2 (Definición 1°/2° y 3°/eliminado)
  const has4TeamGroups = groups.some((teamIds) => teamIds.length === 4);
  if (has4TeamGroups) {
    let query = supabase
      .from("tournament_groups")
      .select("id, position")
      .eq("tournament_id", tournamentId);
    if (categoryId) {
      query = (query as any).eq("category_id", categoryId);
    }
    const { data: dbGroups } = await query;
    if (dbGroups) {
      const r2MatchesToInsert = groups
        .map((teamIds, index) => {
          if (teamIds.length !== 4) return null;
          const dbGroup = dbGroups.find((g) => g.position === index);
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
        const { error: r2Error } = await (supabase as any).from("matches").insert(r2MatchesToInsert);
        if (r2Error) {
          console.error("[saveGroups round2Matches insert error]:", r2Error);
        }
      }
    }
  }

  revalidatePath(`/torneos/${tournamentId}`, "layout");
  refreshPublicTournament(tournamentId);
  const totalMatches = groups.reduce((sum, group) => sum + groupTotalMatchCount(group.length), 0);
  return actionOk(undefined, `Guardamos ${groups.length} ${groups.length === 1 ? "grupo" : "grupos"} y ${totalMatches} partidos.`);
});
