"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { isAccountOrganizer } from "@/lib/auth";
import { dbErrorMessage } from "@/lib/supabase/errors";
import { slugWithSuffix } from "@/lib/utils/slug";
import { createTournamentSchema } from "@/lib/validation/tournament";


/** Crea el torneo con sus canchas ("Cancha 1…N"). Devuelve el id para navegar al panel. */
export const createTournament = createAction(createTournamentSchema, async (input, { supabase }) => {
  if (!(await isAccountOrganizer())) return actionError("Tu cuenta es de jugador: no podés crear torneos.");
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

  type CourtDef = { name: string; venue: string | null };
  const courtsToCreate: CourtDef[] = [];

  if (input.hasMultipleVenues && input.venues && input.venues.length > 0) {
    let courtNum = 1;
    for (const v of input.venues) {
      for (let i = 0; i < v.courtCount; i++) {
        courtsToCreate.push({
          name: `Cancha ${courtNum}`,
          venue: v.name.trim(),
        });
        courtNum++;
      }
    }
  } else {
    const count = input.courtCount || 2;
    const vName = input.venueName?.trim() || null;
    for (let i = 1; i <= count; i++) {
      courtsToCreate.push({
        name: `Cancha ${i}`,
        venue: vName,
      });
    }
  }

  const courtNames = courtsToCreate.map((c) => c.name);
  const mainVenue = input.hasMultipleVenues && input.venues
    ? input.venues.find((v) => v.isMain)?.name ?? input.venues[0]?.name ?? null
    : input.venueName?.trim() || null;

  const effectivePlayoffConfig = {
    ...input.playoffConfig,
    ...(mainVenue ? { mainVenue } : {}),
  };

  // El slug lleva un sufijo aleatorio; ante un choque (muy improbable) se reintenta una vez.
  for (let attempt = 0; attempt < 2; attempt++) {
    const effectiveScoringConfig = input.isAmerican && input.americanConfig
      ? { ...input.scoringConfig, american: input.americanConfig }
      : input.scoringConfig;
    const effectiveMaxTeams = input.isAmerican && input.americanConfig?.participantCount
      ? input.americanConfig.participantCount
      : input.maxTeams;

    const values = {
      p_sport_id: input.sportId,
      p_name: input.name,
      p_slug: slugWithSuffix(input.name),
      p_description: input.description,
      p_starts_on: input.startsOn,
      p_ends_on: input.endsOn,
      p_timezone: input.timezone,
      p_max_teams: effectiveMaxTeams,
      p_court_names: courtNames,
      p_scoring_config: effectiveScoringConfig,
      p_standings_config: input.standingsConfig,
      p_playoff_config: effectivePlayoffConfig,
      p_results_require_confirmation: input.resultsRequireConfirmation,
    };
    const { data, error } = input.isTest
      ? await supabase.rpc("create_test_tournament", values)
      : await supabase.rpc("create_tournament", values);
    if (!error) {
      if (input.bannerUrl) {
        await supabase.from("tournaments").update({ banner_url: input.bannerUrl }).eq("id", data);
      }

      if (input.paymentConfig) {
        await supabase.from("tournaments").update({ payment_config: input.paymentConfig as any }).eq("id", data);
      }

      if (input.isAmerican) {
        await supabase.from("tournaments").update({ status: "registration_open" }).eq("id", data);
      }

      // Asignar sede a cada cancha creada
      for (const c of courtsToCreate) {
        if (c.venue) {
          await supabase
            .from("courts")
            .update({ venue: c.venue })
            .eq("tournament_id", data)
            .eq("name", c.name);
        }
      }

      revalidatePath("/torneos");
      return actionOk(
        { tournamentId: data },
        input.isTest ? "Torneo privado de prueba creado." : "Torneo creado.",
      );
    }
    if (error.code !== "23505") return actionError(dbErrorMessage(error));
  }
  return actionError("No pudimos generar una dirección única para el torneo. Probá de nuevo.");
});
