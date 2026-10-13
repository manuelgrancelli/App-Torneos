"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { groupName } from "@/lib/domain/groups";
import { generateRoundRobin } from "@/lib/domain/round-robin";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { saveGroupsSchema } from "@/lib/validation/competition";

/**
 * Guarda los grupos y genera su fixture todos contra todos. El fixture se
 * calcula acá (lib/domain) y la RPC valida y persiste todo junto (D-036).
 */
export const saveGroups = createAction(saveGroupsSchema, async ({ tournamentId, categoryId, groups }, { supabase }) => {
  const payload = groups.map((teamIds, index) => ({
    name: groupName(index),
    teamIds,
    matches: generateRoundRobin(teamIds).flatMap((round) =>
      round.pairings.map((pairing, position) => ({
        round: round.round,
        position,
        home: pairing.home,
        away: pairing.away,
      })),
    ),
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

  revalidatePath(`/torneos/${tournamentId}`, "layout");
  refreshPublicTournament(tournamentId);
  const matches = payload.reduce((sum, group) => sum + group.matches.length, 0);
  return actionOk(undefined, `Guardamos ${groups.length} ${groups.length === 1 ? "grupo" : "grupos"} y ${matches} partidos.`);
});
