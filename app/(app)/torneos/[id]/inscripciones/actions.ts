"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { canUserManageTournament } from "@/lib/data/tournaments";
import {
  assignTeamCategorySchema,
  assignTournamentTeamsCategorySchema,
  bulkImportTeamsSchema,
  organizerCreateTeamSchema,
  replaceTeamPlayerSchema,
  reviewRegistrationSchema,
  setTeamAvailabilitySchema,
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

/** El organizador modifica la disponibilidad horaria (franjas) de una pareja. */
export const setTeamAvailabilityByOrganizer = createAction(
  setTeamAvailabilitySchema,
  async ({ tournamentId, teamId, slotIds }, { supabase }) => {
    const { data, error } = await supabase.rpc("set_team_availability", {
      p_team_id: teamId,
      p_slot_ids: slotIds,
    });
    if (error) {
      console.error("[setTeamAvailabilityByOrganizer error]:", error);
      return actionError(dbErrorMessage(error));
    }

    revalidatePath(`/torneos/${tournamentId}`, "layout");
    revalidatePath(`/torneos/${tournamentId}/inscripciones`);
    revalidatePath(`/torneos/${tournamentId}/canchas-franjas`);
    revalidatePath(`/torneos/${tournamentId}/partidos`);
    refreshPublicTournament(tournamentId);

    const count = data ?? 0;
    return actionOk(
      { count },
      count === 0
        ? "Disponibilidad actualizada (sin franjas asignadas)."
        : count === 1
          ? "Se asignó 1 franja horaria a la pareja."
          : `Se asignaron ${count} franjas horarias a la pareja.`,
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
    const canManage = await canUserManageTournament(supabase, tournamentId, userId);
    if (!canManage) return actionError("No tenés permiso para inscribir equipos en este torneo.");
    if (tourney.status !== "registration_open") {
      return actionError("La inscripción de este torneo no está abierta. Abrí la inscripción antes de importar.");
    }

    // 2. Obtener franjas horarias
    const { data: slots, error: slotsError } = await supabase
      .from("time_slots")
      .select("id")
      .eq("tournament_id", tournamentId);

    const availableSlotIds = (slots ?? []).map((s) => s.id);
    const slotIdsToUse = allSlots
      ? availableSlotIds
      : (customSlotIds ?? []).filter((id: string) => availableSlotIds.includes(id));

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

      // Obtener nombres de equipos existentes en esta categoría para deduplicar
      const { data: existingTeams } = await (supabase as any)
        .from("teams")
        .select("name")
        .eq("tournament_id", tournamentId)
        .eq("category_id", targetCategoryId);

      const existingNameSet = new Set(
        (existingTeams ?? []).map((t: { name: string }) => t.name.trim().toLowerCase()),
      );

      // Inscribir cada pareja de este bloque
      for (const team of block.teams) {
        const teamName = team.teamName.trim();

        // Saltar si ya existe un equipo con ese nombre en la categoría
        if (existingNameSet.has(teamName.toLowerCase())) {
          skippedTeams.push({
            teamName,
            reason: "Ya existe en esta categoría",
          });
          continue;
        }

        const { error: teamError } = await (supabase.rpc as any)("create_organizer_team", {
          p_tournament_id: tournamentId,
          p_team_name: teamName,
          p_player_names: team.playerNames,
          p_slot_ids: slotIdsToUse,
          p_category_id: targetCategoryId,
        });

        if (teamError) {
          skippedTeams.push({
            teamName,
            reason: dbErrorMessage(teamError),
          });
        } else {
          importedTeamsCount++;
          // Agregar al set para evitar duplicados dentro del mismo lote
          existingNameSet.add(teamName.toLowerCase());
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

/** Reemplaza o edita a un jugador de una pareja (por lesión o cambio de integrante). */
export const replaceTeamPlayer = createAction(
  replaceTeamPlayerSchema,
  async ({ tournamentId, teamId, memberId, newPlayerName, newTeamName }, { supabase }) => {
    const { error } = await (supabase.rpc as any)("replace_team_player", {
      p_team_id: teamId,
      p_member_id: memberId,
      p_new_player_name: newPlayerName,
      p_new_team_name: newTeamName ?? null,
    });

    if (error) {
      console.error("[replaceTeamPlayer error]:", error);
      return actionError(dbErrorMessage(error));
    }

    revalidatePath(`/torneos/${tournamentId}`, "layout");
    revalidatePath(`/torneos/${tournamentId}/inscripciones`);
    revalidatePath(`/torneos/${tournamentId}/grupos`);
    revalidatePath(`/torneos/${tournamentId}/partidos`);
    revalidatePath(`/torneos/${tournamentId}/cuadro`);
    refreshPublicTournament(tournamentId);

    return actionOk(undefined, "Jugador reemplazado con éxito.");
  },
);

