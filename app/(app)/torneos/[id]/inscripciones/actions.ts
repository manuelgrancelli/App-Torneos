"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { dbErrorMessage } from "@/lib/supabase/errors";
import {
  assignTeamCategorySchema,
  assignTournamentTeamsCategorySchema,
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
  async ({ tournamentId, categoryId, teamName, playerNames, slotIds }, { supabase }) => {
    const finalTeamName =
      teamName && teamName.trim().length > 0
        ? teamName.trim()
        : playerNames.map((p) => p.trim()).filter(Boolean).join(" / ");

    const { data: teamId, error } = await (supabase.rpc as any)("create_organizer_team", {
      p_tournament_id: tournamentId,
      p_team_name: finalTeamName,
      p_player_names: playerNames,
      p_slot_ids: slotIds,
      p_category_id: categoryId ?? null,
    });
    if (error) return actionError(dbErrorMessage(error));

    revalidatePath(`/torneos/${tournamentId}`, "layout");
    revalidatePath(`/torneos/${tournamentId}/inscripciones`);
    refreshPublicTournament(tournamentId);
    return actionOk(undefined, "Inscripción cargada y aprobada.");
  },
);

/** Asigna o cambia la categoría de una pareja. */
export const assignTeamCategory = createAction(
  assignTeamCategorySchema,
  async ({ tournamentId, teamId, categoryId }, { supabase }) => {
    const { error } = await (supabase.rpc as any)("assign_team_category", {
      p_team_id: teamId,
      p_category_id: categoryId ?? null,
    });
    if (error) return actionError(dbErrorMessage(error));

    revalidatePath(`/torneos/${tournamentId}`, "layout");
    refreshPublicTournament(tournamentId);
    return actionOk(undefined, "Categoría asignada con éxito.");
  },
);

/** Asigna todas las parejas sin categoría del torneo a una categoría determinada. */
export const assignAllUnassignedTeams = createAction(
  assignTournamentTeamsCategorySchema,
  async ({ tournamentId, categoryId }, { supabase }) => {
    const { data, error } = await (supabase.rpc as any)("assign_tournament_teams_category", {
      p_tournament_id: tournamentId,
      p_category_id: categoryId,
    });
    if (error) return actionError(dbErrorMessage(error));

    revalidatePath(`/torneos/${tournamentId}`, "layout");
    refreshPublicTournament(tournamentId);
    const count = data ?? 0;
    return actionOk(
      { count },
      `Se asignaron ${count} ${count === 1 ? "pareja" : "parejas"} a la categoría seleccionada.`,
    );
  },
);
