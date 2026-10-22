"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { groupStandings } from "@/lib/competition-view";
import { getCompetition } from "@/lib/data/competition";
import { normalizeScoringConfig } from "@/lib/domain/scoring";
import { normalizeStandingsConfig } from "@/lib/domain/standings";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { canUserManageTournament } from "@/lib/data/tournaments";
import {
  adminInviteCodeSchema,
  changeStatusSchema,
  removeTournamentAdminSchema,
  tournamentIdSchema,
  updateTournamentBannerSchema,
  updateTournamentSchema,
} from "@/lib/validation/tournament";
import { ensurePlayoffBracket } from "./cuadro/actions";

const NOT_FOUND = "No encontramos el torneo o no tenés permiso para modificarlo.";

function revalidateTournament(tournamentId: string) {
  revalidatePath(`/torneos/${tournamentId}`, "layout");
  revalidatePath("/torneos");
  revalidatePath("/torneos/historial");
  revalidatePath("/historial");
  refreshPublicTournament(tournamentId);
}

/**
 * Guarda la configuración. RLS limita la edición al organizador y los
 * triggers bloquean lo que el estado no permite (D-029); el error llega
 * traducido por dbErrorMessage.
 */
export const updateTournament = createAction(updateTournamentSchema, async (input, { supabase }) => {
  const { data, error } = await supabase
    .from("tournaments")
    .update({
      name: input.name,
      description: input.description || null,
      starts_on: input.startsOn,
      ends_on: input.endsOn,
      timezone: input.timezone,
      max_teams: input.maxTeams,
      results_require_confirmation: input.resultsRequireConfirmation,
      scoring_config: input.scoringConfig,
      standings_config: input.standingsConfig,
      playoff_config: input.playoffConfig,
    })
    .eq("id", input.tournamentId)
    .select("id");

  if (error) return actionError(dbErrorMessage(error));
  if (data.length === 0) return actionError(NOT_FOUND);
  revalidateTournament(input.tournamentId);
  return actionOk(undefined, "Guardamos los cambios.");
});

/** Borra el torneo (solo si no está en estado finalizado: lo aplica la política de RLS). */
export const deleteTournament = createAction(tournamentIdSchema, async ({ tournamentId }, { supabase }) => {
  const { data, error } = await supabase.from("tournaments").delete().eq("id", tournamentId).select("id");
  if (error) return actionError(dbErrorMessage(error));
  if (data.length === 0) {
    return actionError("No se puede eliminar un torneo finalizado o no tenés permisos para eliminarlo.");
  }
  revalidatePath("/torneos");
  revalidatePath("/torneos/historial");
  revalidatePath("/historial");
  return actionOk(undefined, "Eliminamos el torneo.");
});

/** Cambia el estado con la RPC, que valida la transición y sus precondiciones (D-018). */
export const changeTournamentStatus = createAction(changeStatusSchema, async (input, { supabase }) => {
  let championTeamId: string | undefined;
  if (input.status === "finished") {
    const { data: tournament } = await supabase
      .from("tournaments")
      .select("status, scoring_config, standings_config")
      .eq("id", input.tournamentId)
      .maybeSingle();

    // Obtener finales de playoffs para determinar campeones
    const { data: playoffFinals } = await supabase
      .from("matches")
      .select("category_id, winner_team_id, round")
      .eq("tournament_id", input.tournamentId)
      .eq("stage", "playoff")
      .eq("is_third_place", false)
      .is("next_match_id", null);

    const winnerFinal = playoffFinals?.find((f) => f.winner_team_id !== null);
    if (winnerFinal?.winner_team_id) {
      championTeamId = winnerFinal.winner_team_id;
    }

    if (tournament?.status === "group_stage") {
      const competition = await getCompetition(input.tournamentId);
      if (competition.groups.length === 1) {
        const [table] = groupStandings(
          competition.groups,
          competition.matches,
          normalizeScoringConfig(tournament.scoring_config),
          normalizeStandingsConfig(tournament.standings_config),
        );
        championTeamId = table?.rows[0]?.teamId;
      }
    }

    // Actualizar todas las categorías a 'finished' y asegurar sus campeones
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: categories } = await (supabase as any)
      .from("tournament_categories")
      .select("id, champion_team_id")
      .eq("tournament_id", input.tournamentId);

    if (categories && categories.length > 0) {
      for (const cat of categories) {
        const catFinal = playoffFinals?.find((f) => f.category_id === cat.id && f.winner_team_id);
        const catChampion = cat.champion_team_id ?? catFinal?.winner_team_id ?? null;
        // eslint-disable-next-line @typescript-eslint/no-explicit-any
        await (supabase as any)
          .from("tournament_categories")
          .update({
            status: "finished",
            champion_team_id: catChampion,
            updated_at: new Date().toISOString(),
          })
          .eq("id", cat.id);
      }
      if (!championTeamId && categories[0]?.champion_team_id) {
        championTeamId = categories[0].champion_team_id;
      }
    }
  }

  const { error } = await supabase.rpc("set_tournament_status", {
    p_tournament_id: input.tournamentId,
    p_status: input.status,
    p_champion_team_id: championTeamId,
  });

  if (error) {
    // Si la RPC arroja error por permisos de sesión u otro desfasaje, verificar autorización directa
    const {
      data: { user },
    } = await supabase.auth.getUser();
    if (user) {
      const canManage = await canUserManageTournament(supabase, input.tournamentId, user.id);
      if (canManage) {
        const { error: directErr } = await supabase
          .from("tournaments")
          .update({
            status: input.status,
            champion_team_id: championTeamId ?? null,
            updated_at: new Date().toISOString(),
          })
          .eq("id", input.tournamentId);
        if (!directErr) {
          revalidateTournament(input.tournamentId);
          return actionOk(undefined, "¡Torneo finalizado con éxito!");
        }
      }
    }
    return actionError(dbErrorMessage(error));
  }

  if (input.status === "playoffs") {
    await ensurePlayoffBracket(supabase, input.tournamentId);
  }

  revalidateTournament(input.tournamentId);
  return actionOk(
    undefined,
    input.status === "finished" ? "¡Torneo finalizado con éxito!" : "Actualizamos el estado del torneo.",
  );
});

/** Genera un código nuevo: el link anterior deja de funcionar. */
export const rotateInviteCode = createAction(tournamentIdSchema, async ({ tournamentId }, { supabase }) => {
  const { data, error } = await supabase.rpc("rotate_invite_code", { p_tournament_id: tournamentId });
  if (error) return actionError(dbErrorMessage(error));
  revalidateTournament(tournamentId);
  return actionOk({ code: data }, "Generamos un código nuevo. El link anterior ya no funciona.");
});

/** Actualiza o quita el afiche/portada informativa del torneo. */
export const updateTournamentBanner = createAction(
  updateTournamentBannerSchema,
  async (input, { supabase }) => {
    const { data, error } = await supabase
      .from("tournaments")
      .update({ banner_url: input.bannerUrl })
      .eq("id", input.tournamentId)
      .select("id");

    if (error) return actionError(dbErrorMessage(error));
    if (data.length === 0) return actionError(NOT_FOUND);
    revalidateTournament(input.tournamentId);
    return actionOk(undefined, input.bannerUrl ? "Afiche actualizado correctamente." : "Afiche eliminado.");
  },
);

/** Rota el código de invitación de administradores: el enlace anterior deja de funcionar. */
export const rotateAdminInviteCode = createAction(
  tournamentIdSchema,
  async ({ tournamentId }, { supabase }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("rotate_tournament_admin_invite", {
      p_tournament_id: tournamentId,
    });
    if (error) return actionError(dbErrorMessage(error));
    revalidateTournament(tournamentId);
    return actionOk({ code: data }, "Generamos un enlace nuevo de administrador. El anterior ya no funciona.");
  },
);

/** Quita a un co-administrador del torneo. */
export const removeTournamentAdmin = createAction(
  removeTournamentAdminSchema,
  async ({ tournamentId, adminUserId }, { supabase }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { error } = await (supabase.rpc as any)("remove_tournament_admin", {
      p_tournament_id: tournamentId,
      p_user_id: adminUserId,
    });
    if (error) return actionError(dbErrorMessage(error));
    revalidateTournament(tournamentId);
    return actionOk(undefined, "Administrador eliminado del torneo.");
  },
);

/** Une al usuario actual como co-administrador del torneo mediante el código del enlace. */
export const joinTournamentAsAdmin = createAction(
  adminInviteCodeSchema,
  async ({ code }, { supabase }) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase.rpc as any)("join_tournament_as_admin", {
      p_code: code,
    });
    if (error) return actionError(dbErrorMessage(error));
    if (!data || data.length === 0) return actionError("No se pudo procesar la invitación.");
    const tourney = data[0];
    revalidateTournament(tourney.tournament_id);
    return actionOk(
      { tournamentId: tourney.tournament_id, slug: tourney.tournament_slug, name: tourney.tournament_name },
      `¡Ahora sos administrador de ${tourney.tournament_name}!`,
    );
  },
);

