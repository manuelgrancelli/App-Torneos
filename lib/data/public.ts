import "server-only";
import { unstable_cache } from "next/cache";
import { cache } from "react";
import { toMatchView } from "@/lib/data/competition";
import type { Competition } from "@/lib/data/competition";
import type { PlayoffConfig } from "@/lib/domain/bracket";
import type { ScoringConfig } from "@/lib/domain/scoring";
import type { StandingsConfig } from "@/lib/domain/standings";
import type { TournamentStatus } from "@/lib/domain/tournament-status";
import { publicTournamentTag } from "@/lib/public-cache";
import { createPublicClient } from "@/lib/supabase/public";

/** Datos de la página pública (solo lo que puede ver `anon`). */

export type PublicTournament = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  status: TournamentStatus;
  startsOn: string;
  endsOn: string;
  timezone: string;
  sportName: string;
  teamSize: number;
  scoringConfig: ScoringConfig;
  standingsConfig: StandingsConfig;
  playoffConfig: PlayoffConfig;
  championTeamId: string | null;
  competition: Competition;
  courts: { id: string; name: string; venue: string | null }[];
};

/**
 * Id de un torneo publicado por su slug. Sin cache entre requests (consulta
 * liviana): si el torneo vuelve a borrador, deja de verse al instante.
 */
export const getPublicTournamentId = cache(async (slug: string): Promise<string | null> => {
  if (slug.length > 120 || !/^[a-z0-9]+(-[a-z0-9]+)*$/.test(slug)) return null;
  const supabase = createPublicClient();
  const { data, error } = await supabase.from("tournaments").select("id").eq("slug", slug).maybeSingle();
  if (error) throw error;
  return data?.id ?? null;
});

async function loadPublicTournament(tournamentId: string): Promise<PublicTournament | null> {
  const supabase = createPublicClient();
  const [tournament, teams, groups, matches, courts] = await Promise.all([
    supabase
      .from("tournaments")
      .select(
        "id, name, slug, description, banner_url, status, starts_on, ends_on, timezone, scoring_config, standings_config, playoff_config, champion_team_id, sports(name, min_team_size)",
      )
      .eq("id", tournamentId)
      .maybeSingle(),
    supabase.from("teams").select("id, name, status").eq("tournament_id", tournamentId).order("name"),
    supabase
      .from("tournament_groups")
      .select("id, name, position, tiebreak_seed, group_teams(team_id, position)")
      .eq("tournament_id", tournamentId)
      .order("position"),
    supabase.from("matches").select("*").eq("tournament_id", tournamentId).order("stage").order("round").order("position"),
    supabase.from("courts").select("id, name, venue").eq("tournament_id", tournamentId).order("position"),
  ]);
  for (const result of [tournament, teams, groups, matches, courts]) {
    if (result.error) throw result.error;
  }
  const t = tournament.data;
  if (!t) return null;

  return {
    id: t.id,
    name: t.name,
    slug: t.slug,
    description: t.description,
    bannerUrl: t.banner_url ?? null,
    status: t.status,
    startsOn: t.starts_on,
    endsOn: t.ends_on,
    timezone: t.timezone,
    sportName: t.sports?.name ?? "",
    teamSize: t.sports?.min_team_size ?? 2,
    scoringConfig: t.scoring_config as ScoringConfig,
    standingsConfig: t.standings_config as StandingsConfig,
    playoffConfig: t.playoff_config as PlayoffConfig,
    championTeamId: t.champion_team_id,
    competition: {
      teams: teams.data ?? [],
      groups: (groups.data ?? []).map((g) => ({
        id: g.id,
        name: g.name,
        position: g.position,
        tiebreakSeed: g.tiebreak_seed,
        teamIds: [...g.group_teams].sort((a, b) => a.position - b.position).map((gt) => gt.team_id),
      })),
      matches: (matches.data ?? []).map(toMatchView),
      confirmations: [],
    },
    courts: courts.data ?? [],
  };
}

/**
 * Torneo público cacheado (60 s como máximo) e invalidado por tag cuando el
 * organizador cambia resultados, programación, grupos, cuadro o estado.
 */
export const getPublicTournament = cache(
  (tournamentId: string): Promise<PublicTournament | null> =>
    unstable_cache(loadPublicTournament, ["public-tournament", tournamentId], {
      tags: [publicTournamentTag(tournamentId)],
      revalidate: 60,
    })(tournamentId),
);
