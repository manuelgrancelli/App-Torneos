import { type SupabaseClient, createClient } from "@supabase/supabase-js";
import { DEMO_PASSWORD, unique } from "./helpers";

/**
 * Armado de escenarios por API (con sesiones reales de usuarios del seed y
 * las mismas RPC que usa la app), para que los specs de fases avanzadas no
 * dependan de recorrer toda la UI previa.
 */
// Las mismas variables que usa `pnpm dev` (Supabase local).
process.loadEnvFile(".env.local");

const url = process.env.NEXT_PUBLIC_SUPABASE_URL as string;
const key = process.env.NEXT_PUBLIC_SUPABASE_ANON_KEY as string;

async function signIn(email: string): Promise<SupabaseClient> {
  const client = createClient(url, key, { auth: { persistSession: false, autoRefreshToken: false } });
  const { error } = await client.auth.signInWithPassword({ email, password: DEMO_PASSWORD });
  if (error) throw new Error(`No se pudo iniciar sesión como ${email}: ${error.message}`);
  return client;
}

function must<T>(result: { data: T; error: { message: string } | null }, what: string): T {
  if (result.error) throw new Error(`${what}: ${result.error.message}`);
  return result.data;
}

export type Scenario = {
  tournamentId: string;
  name: string;
  slug: string;
  teams: { id: string; name: string; captain: string }[];
};

/** Parejas del seed: capitán + compañero. */
const PAIRS = [
  { captain: "ana@demo.test", partner: "bruno@demo.test", name: "López / García" },
  { captain: "carla@demo.test", partner: "diego@demo.test", name: "Méndez / Suárez" },
  { captain: "eva@demo.test", partner: "fede@demo.test", name: "Romero / Álvarez" },
  { captain: "gabi@demo.test", partner: "organizador@demo.test", name: "Torres / Org" },
];

/**
 * Torneo de pádel en fase de grupos con N parejas aprobadas (2 a 4), 2
 * canchas y 6 franjas en las que todos pueden jugar.
 */
export async function groupStageScenario({
  pairs = 4,
  requireConfirmation = false,
}: { pairs?: number; requireConfirmation?: boolean } = {}): Promise<Scenario> {
  const organizer = await signIn("organizador@demo.test");
  const name = unique("Torneo grupos");
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  const tournamentId = must(
    await organizer.rpc("create_tournament", {
      p_sport_id: "padel",
      p_name: name,
      p_slug: slug,
      p_description: "",
      p_starts_on: "2026-11-21",
      p_ends_on: "2026-11-21",
      p_timezone: "America/Argentina/Buenos_Aires",
      p_max_teams: 8,
      p_court_names: ["Cancha 1", "Cancha 2"],
      p_results_require_confirmation: requireConfirmation,
    }),
    "create_tournament",
  ) as string;

  const starts = ["09:00", "10:30", "12:00", "13:30", "15:00", "16:30"];
  const slots = must(
    await organizer
      .from("time_slots")
      .insert(
        starts.map((time) => {
          const start = new Date(`2026-11-21T${time}:00-03:00`);
          return {
            tournament_id: tournamentId,
            starts_at: start.toISOString(),
            ends_at: new Date(start.getTime() + 90 * 60_000).toISOString(),
          };
        }),
      )
      .select("id"),
    "time_slots",
  ) as { id: string }[];
  must(await organizer.rpc("set_tournament_status", { p_tournament_id: tournamentId, p_status: "registration_open" }), "abrir inscripción");
  const { code } = must(
    await organizer.from("tournament_invites").select("code").eq("tournament_id", tournamentId).single(),
    "código",
  ) as { code: string };

  const teams: Scenario["teams"] = [];
  for (const pair of PAIRS.slice(0, pairs)) {
    const captain = await signIn(pair.captain);
    const teamId = must(
      await captain.rpc("register_team", { p_code: code, p_team_name: pair.name, p_member_emails: [pair.partner] }),
      `register_team ${pair.name}`,
    ) as string;
    must(await captain.rpc("set_team_availability", { p_team_id: teamId, p_slot_ids: slots.map((s) => s.id) }), "disponibilidad");
    must(await organizer.rpc("review_registration", { p_team_id: teamId, p_decision: "approved" }), "aprobar");
    teams.push({ id: teamId, name: pair.name, captain: pair.captain });
    await captain.auth.signOut();
  }

  must(await organizer.rpc("set_tournament_status", { p_tournament_id: tournamentId, p_status: "group_stage" }), "fase de grupos");
  await organizer.auth.signOut();
  return { tournamentId, name, slug, teams };
}

/** Sesión del organizador del seed (para pasos por API dentro de un spec). */
export function organizerClient(): Promise<SupabaseClient> {
  return signIn("organizador@demo.test");
}

/** Arma un único "Grupo A" con todas las parejas y su fixture todos contra todos. */
async function applySingleGroup(organizer: SupabaseClient, scenario: Scenario): Promise<void> {
  const teamIds = scenario.teams.map((t) => t.id);
  // Mismo cálculo que la app: lib/domain/round-robin.
  const { generateRoundRobin } = await import("../../lib/domain/round-robin");
  const matches = generateRoundRobin(teamIds).flatMap((round) =>
    round.pairings.map((p, position) => ({ round: round.round, position, home: p.home, away: p.away })),
  );
  must(
    await organizer.rpc("apply_groups", {
      p_tournament_id: scenario.tournamentId,
      p_groups: [{ name: "Grupo A", teamIds, matches }],
    }),
    "apply_groups",
  );
}

/**
 * Fase de grupos con un "Grupo A" de 4 parejas y los 6 partidos programados
 * (fecha N → franja N, posición → cancha), todavía sin resultados.
 */
export async function scheduledGroupScenario(): Promise<Scenario> {
  const scenario = await groupStageScenario({ pairs: 4 });
  const organizer = await organizerClient();
  await applySingleGroup(organizer, scenario);

  const [matches, slots, courts] = await Promise.all([
    organizer.from("matches").select("id, round, position").eq("tournament_id", scenario.tournamentId),
    organizer.from("time_slots").select("id").eq("tournament_id", scenario.tournamentId).order("starts_at"),
    organizer.from("courts").select("id").eq("tournament_id", scenario.tournamentId).order("position"),
  ]);
  const slotIds = (must(slots, "franjas") as { id: string }[]).map((s) => s.id);
  const courtIds = (must(courts, "canchas") as { id: string }[]).map((c) => c.id);
  const assignments = (must(matches, "partidos") as { id: string; round: number; position: number }[]).map((m) => ({
    matchId: m.id,
    slotId: slotIds[m.round - 1],
    courtId: courtIds[m.position],
  }));
  must(
    await organizer.rpc("apply_schedule", { p_tournament_id: scenario.tournamentId, p_assignments: assignments }),
    "apply_schedule",
  );
  await organizer.auth.signOut();
  return scenario;
}

/** Torneo en borrador (no tiene página pública). */
export async function draftTournament(): Promise<{ slug: string }> {
  const organizer = await organizerClient();
  const name = unique("Borrador");
  const slug = name.toLowerCase().replace(/[^a-z0-9]+/g, "-");
  must(
    await organizer.rpc("create_tournament", {
      p_sport_id: "tenis",
      p_name: name,
      p_slug: slug,
      p_description: "",
      p_starts_on: "2026-11-21",
      p_ends_on: "2026-11-21",
      p_timezone: "America/Argentina/Buenos_Aires",
      p_max_teams: 8,
      p_court_names: ["Cancha 1"],
      p_results_require_confirmation: false,
    }),
    "create_tournament",
  );
  await organizer.auth.signOut();
  return { slug };
}

/**
 * Torneo en playoffs: un grupo de 4 parejas con todos los partidos jugados
 * (gana siempre la pareja local) y el torneo ya pasado a playoffs.
 */
export async function playoffsScenario(): Promise<Scenario> {
  const scenario = await groupStageScenario({ pairs: 4 });
  const organizer = await organizerClient();
  await applySingleGroup(organizer, scenario);

  const rows = must(
    await organizer.from("matches").select("id, home_team_id").eq("tournament_id", scenario.tournamentId),
    "partidos",
  ) as { id: string; home_team_id: string }[];
  for (const match of rows) {
    must(
      await organizer.rpc("record_match_result", {
        p_match_id: match.id,
        p_result: { type: "sets", sets: [{ home: 6, away: 2 }, { home: 6, away: 3 }] },
        p_winner_team_id: match.home_team_id,
      }),
      "record_match_result",
    );
  }
  must(await organizer.rpc("set_tournament_status", { p_tournament_id: scenario.tournamentId, p_status: "playoffs" }), "playoffs");
  await organizer.auth.signOut();
  return scenario;
}
