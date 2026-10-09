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

  const { error } = await supabase.rpc("apply_groups", {
    p_tournament_id: tournamentId,
    p_groups: payload,
    ...(categoryId ? { p_category_id: categoryId } : {}),
  });
  if (error) return actionError(dbErrorMessage(error));

  revalidatePath(`/torneos/${tournamentId}`, "layout");
  refreshPublicTournament(tournamentId);
  const matches = payload.reduce((sum, group) => sum + group.matches.length, 0);
  return actionOk(undefined, `Guardamos ${groups.length} ${groups.length === 1 ? "grupo" : "grupos"} y ${matches} partidos.`);
});
