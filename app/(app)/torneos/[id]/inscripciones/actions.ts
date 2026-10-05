"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { dbErrorMessage } from "@/lib/supabase/errors";
import {
  organizerCreateTeamSchema,
  reviewRegistrationSchema,
  tournamentRegistrationActionSchema,
} from "@/lib/validation/registration";

/** Aprobar o rechazar una inscripción (la RPC controla cupo y plantel completo). */
export const reviewRegistration = createAction(reviewRegistrationSchema, async (input, { supabase }) => {
  const { error } = await supabase.rpc("review_registration", {
    p_team_id: input.teamId,
    p_decision: input.decision,
  });
  if (error) return actionError(dbErrorMessage(error));
  revalidatePath(`/torneos/${input.tournamentId}`, "layout");
  refreshPublicTournament(input.tournamentId);
  return actionOk(undefined, input.decision === "approved" ? "Inscripción aprobada." : "Inscripción rechazada.");
});

/** Rellena cupos de un torneo de prueba con parejas ficticias. */
export const fillTestTeamSlots = createAction(
  tournamentRegistrationActionSchema,
  async ({ tournamentId }, { supabase }) => {
    const { data, error } = await supabase.rpc("fill_test_team_slots", {
      p_tournament_id: tournamentId,
    });
    if (error) return actionError(dbErrorMessage(error));

    revalidatePath(`/torneos/${tournamentId}`, "layout");
    refreshPublicTournament(tournamentId);
    const count = data ?? 0;
    return actionOk(
      { count },
      `Agregamos ${count} ${count === 1 ? "pareja ficticia" : "parejas ficticias"} aprobadas para que puedas sortear los grupos y generar el cuadro.`,
    );
  },
);

/** Inscribe una pareja/equipo sin cuentas ni emails y registra su disponibilidad. */
export const createOrganizerTeam = createAction(
  organizerCreateTeamSchema,
  async ({ tournamentId, teamName, playerNames, slotIds }, { supabase }) => {
    const { error } = await supabase.rpc("create_organizer_team", {
      p_tournament_id: tournamentId,
      p_team_name: teamName,
      p_player_names: playerNames,
      p_slot_ids: slotIds,
    });
    if (error) return actionError(dbErrorMessage(error));

    revalidatePath(`/torneos/${tournamentId}`, "layout");
    refreshPublicTournament(tournamentId);
    return actionOk(undefined, "Inscribimos y aprobamos el equipo.");
  },
);
