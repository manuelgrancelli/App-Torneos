"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { slugWithSuffix } from "@/lib/utils/slug";
import { createTournamentSchema } from "@/lib/validation/tournament";

/** Crea el torneo con sus canchas ("Cancha 1…N"). Devuelve el id para navegar al panel. */
export const createTournament = createAction(createTournamentSchema, async (input, { supabase }) => {
  const { data: sport, error: sportError } = await supabase
    .from("sports")
    .select("id, scoring_type")
    .eq("id", input.sportId)
    .maybeSingle();
  if (sportError) return actionError(dbErrorMessage(sportError));
  if (!sport) return actionError("El deporte elegido no existe.", { sportId: ["Elegí un deporte."] });
  if (sport.scoring_type !== input.scoringConfig.type) {
    return actionError("La puntuación no corresponde al deporte elegido.");
  }

  const courtNames = Array.from({ length: input.courtCount }, (_, i) => `Cancha ${i + 1}`);

  // El slug lleva un sufijo aleatorio; ante un choque (muy improbable) se reintenta una vez.
  for (let attempt = 0; attempt < 2; attempt++) {
    const { data, error } = await supabase.rpc("create_tournament", {
      p_sport_id: input.sportId,
      p_name: input.name,
      p_slug: slugWithSuffix(input.name),
      p_description: input.description,
      p_starts_on: input.startsOn,
      p_ends_on: input.endsOn,
      p_timezone: input.timezone,
      p_max_teams: input.maxTeams,
      p_court_names: courtNames,
      p_scoring_config: input.scoringConfig,
      p_standings_config: input.standingsConfig,
      p_playoff_config: input.playoffConfig,
      p_results_require_confirmation: input.resultsRequireConfirmation,
    });
    if (!error) {
      revalidatePath("/torneos");
      return actionOk({ tournamentId: data }, "Torneo creado.");
    }
    if (error.code !== "23505") return actionError(dbErrorMessage(error));
  }
  return actionError("No pudimos generar una dirección única para el torneo. Probá de nuevo.");
});
