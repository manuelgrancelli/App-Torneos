"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { dbErrorMessage } from "@/lib/supabase/errors";
import {
  assignTeamCategorySchema,
  assignTournamentTeamsCategorySchema,
  bulkImportTeamsSchema,
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

/**
 * Importa por lotes parejas organizadas por categoría desde texto (WhatsApp / planillas).
 * Crea automáticamente las categorías que no existan y registra a cada pareja con sus jugadores
 * y disponibilidad.
 */
export const bulkImportTeams = createAction(
  bulkImportTeamsSchema,
  async ({ tournamentId, allSlots, customSlotIds, blocks }, { supabase, userId }) => {
    // 1. Verificar torneo y organizador
    const { data: tourney, error: tourError } = await supabase
      .from("tournaments")
      .select("id, organizer_id, status, max_teams, scoring_config, standings_config, playoff_config")
      .eq("id", tournamentId)
      .maybeSingle();

    if (tourError || !tourney) return actionError("No encontramos el torneo.");
    if (tourney.organizer_id !== userId) return actionError("No tenés permiso para inscribir equipos en este torneo.");
    if (tourney.status !== "registration_open") {
      return actionError("La inscripción de este torneo no está abierta. Abrí la inscripción antes de importar.");
    }

    // 2. Obtener franjas horarias
    const { data: slots, error: slotsError } = await supabase
      .from("time_slots")
      .select("id")
      .eq("tournament_id", tournamentId);

    if (slotsError) return actionError(dbErrorMessage(slotsError));
    if (!slots || slots.length === 0) {
      return actionError("El torneo no tiene franjas horarias cargadas. Creá las canchas y franjas antes de importar.");
    }

    const availableSlotIds = slots.map((s) => s.id);
    const slotIdsToUse = allSlots || !customSlotIds || customSlotIds.length === 0
      ? availableSlotIds
      : customSlotIds.filter((id: string) => availableSlotIds.includes(id));

    if (slotIdsToUse.length === 0) {
      return actionError("Se requiere al menos una franja horaria válida para asociar disponibilidad.");
    }

    // 3. Obtener categorías existentes
    const { data: existingCategories, error: catError } = await (supabase as any)
      .from("tournament_categories")
      .select("id, name, position, status")
      .eq("tournament_id", tournamentId)
      .order("position", { ascending: false });

    if (catError) return actionError(dbErrorMessage(catError));

    const currentCats = [...(existingCategories ?? [])];
    let createdCategoriesCount = 0;
    let importedTeamsCount = 0;
    const skippedTeams: { teamName: string; reason: string }[] = [];

    // 4. Procesar cada categoría y sus parejas
    for (const block of blocks) {
      let targetCategoryId = block.categoryId ?? null;

      // Si no viene ID de categoría, buscar por nombre o crearla
      if (!targetCategoryId) {
        const found = currentCats.find(
          (c) => c.name.trim().toLowerCase() === block.categoryName.trim().toLowerCase(),
        );

        if (found) {
          targetCategoryId = found.id;
        } else {
          // Crear categoría automáticamente
          const nextPos = (currentCats[0]?.position ?? -1) + 1;
          const { data: newCat, error: newCatError } = await (supabase as any)
            .from("tournament_categories")
            .insert({
              tournament_id: tournamentId,
              name: block.categoryName.trim(),
              max_teams: null, // Sin límite prefijado según D-085
              position: nextPos,
              status: "registration_open",
              scoring_config: tourney.scoring_config,
              standings_config: tourney.standings_config,
              playoff_config: tourney.playoff_config,
            })
            .select("id, name, position, status")
            .single();

          if (newCatError) {
            console.error("[bulkImportTeams createCategory error]:", newCatError);
            return actionError(`Error al crear la categoría "${block.categoryName}": ${dbErrorMessage(newCatError)}`);
          }

          targetCategoryId = newCat.id;
          currentCats.unshift(newCat);
          createdCategoriesCount++;
        }
      }

      // Inscribir cada pareja de este bloque
      for (const team of block.teams) {
        let teamName = team.teamName.trim();
        let { error: teamError } = await (supabase.rpc as any)("create_organizer_team", {
          p_tournament_id: tournamentId,
          p_team_name: teamName,
          p_player_names: team.playerNames,
          p_slot_ids: slotIdsToUse,
          p_category_id: targetCategoryId,
        });

        // Si ya hay un equipo con ese nombre exacto, reintentar agregando el nombre de la categoría como diferenciador
        if (teamError && teamError.message?.includes("Ya hay un equipo con ese nombre")) {
          const alternateName = `${teamName} (${block.categoryName.trim()})`.slice(0, 60);
          const retry = await (supabase.rpc as any)("create_organizer_team", {
            p_tournament_id: tournamentId,
            p_team_name: alternateName,
            p_player_names: team.playerNames,
            p_slot_ids: slotIdsToUse,
            p_category_id: targetCategoryId,
          });
          teamError = retry.error;
          if (!teamError) teamName = alternateName;
        }

        if (teamError) {
          skippedTeams.push({
            teamName,
            reason: dbErrorMessage(teamError),
          });
        } else {
          importedTeamsCount++;
        }
      }
    }

    revalidatePath(`/torneos/${tournamentId}`, "layout");
    revalidatePath(`/torneos/${tournamentId}/inscripciones`);
    revalidatePath(`/torneos/${tournamentId}/categorias`);
    refreshPublicTournament(tournamentId);

    const message = `Se importaron ${importedTeamsCount} ${importedTeamsCount === 1 ? "pareja" : "parejas"}${
      createdCategoriesCount > 0 ? ` y se crearon ${createdCategoriesCount} ${createdCategoriesCount === 1 ? "categoría nueva" : "categorías nuevas"}` : ""
    }.${skippedTeams.length > 0 ? ` (${skippedTeams.length} no se pudieron ingresar por coincidencia de nombre o cupo).` : ""}`;

    return actionOk(
      {
        importedTeamsCount,
        createdCategoriesCount,
        skippedTeams,
      },
      message,
    );
  },
);

