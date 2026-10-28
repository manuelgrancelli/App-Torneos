import "server-only";
import { cache } from "react";
import type { ScoringConfig } from "@/lib/domain/scoring";
import type { StandingsConfig } from "@/lib/domain/standings";
import type { PlayoffConfig } from "@/lib/domain/bracket";
import type { TournamentStatus } from "@/lib/domain/tournament-status";
import { createClient } from "@/lib/supabase/server";
import type { Tables } from "@/lib/supabase/database.types";

/**
 * Lecturas de torneos para Server Components. Todas pasan por RLS con la
 * sesión del usuario: nunca devuelven más de lo que puede ver.
 */

export type Sport = Tables<"sports">;

export const getSports = cache(async (): Promise<Sport[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase.from("sports").select("*").order("sort_order");
  if (error) throw error;
  if (!data) return [];

  // Garantizar opciones: Pádel, Tenis (Dobles y Singles) y Fútbol unificado
  const hasUnifiedFutbol = data.some((s) => s.id === "futbol");
  const filtered = data.filter((s) => {
    if (s.id === "padel" || s.id === "tenis" || s.id === "tenis-single" || s.id === "futbol") return true;
    if (!hasUnifiedFutbol && s.id === "futbol-11") return true;
    return false;
  });

  const hasTenisSingle = filtered.some((s) => s.id === "tenis-single");
  const tenisRow = filtered.find((s) => s.id === "tenis");

  const result = filtered.map((s) => {
    if (s.id === "futbol-11" && !hasUnifiedFutbol) {
      return {
        ...s,
        id: "futbol",
        name: "Fútbol",
        min_team_size: 1,
        max_team_size: 30,
      };
    }
    if (s.id === "futbol") {
      return {
        ...s,
        name: "Fútbol",
        min_team_size: 1,
        max_team_size: 30,
      };
    }
    return s;
  });

  if (!hasTenisSingle && tenisRow) {
    result.push({
      ...tenisRow,
      id: "tenis-single",
      name: "Tenis Individual",
      min_team_size: 1,
      max_team_size: 1,
    });
  }

  return result;
});

export type TournamentCategorySummary = {
  id: string;
  name: string;
  maxTeams: number | null;
  approvedTeams: number;
};

export type TournamentListItem = {
  id: string;
  name: string;
  slug: string;
  status: TournamentStatus;
  startsOn: string;
  endsOn: string;
  sportName: string;
  teamSize: number;
  maxTeams: number;
  approvedTeams: number;
  pendingTeams: number;
  championTeamId?: string | null;
  championName?: string | null;
  isTest: boolean;
  categories: TournamentCategorySummary[];
  totalCapacity: number | null;
};

/** Torneos que organiza o co-administra el usuario, del más reciente al más viejo. */
export const listOrganizedTournaments = cache(async (userId: string): Promise<TournamentListItem[]> => {
  const supabase = await createClient();

  // Obtener IDs de torneos donde el usuario es co-administrador
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: adminRows } = await (supabase as any)
    .from("tournament_admins")
    .select("tournament_id")
    .eq("user_id", userId);

  const coAdminTournamentIds: string[] = (adminRows ?? []).map((r: { tournament_id: string }) => r.tournament_id);

  let query = supabase
    .from("tournaments")
    .select(
      "id, name, slug, status, is_test, starts_on, ends_on, max_teams, champion_team_id, sports(name, min_team_size), teams!teams_tournament_id_fkey(id, name, status, category_id)",
    );

  if (coAdminTournamentIds.length > 0) {
    query = query.or(`organizer_id.eq.${userId},id.in.(${coAdminTournamentIds.join(",")})`);
  } else {
    query = query.eq("organizer_id", userId);
  }

  const { data, error } = await query.order("starts_on", { ascending: false });
  if (error) throw error;

  const tournamentIds = data.map((t) => t.id);
  const categoriesMap = new Map<string, Array<{ id: string; name: string; max_teams: number | null; position: number }>>();

  if (tournamentIds.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: catRows, error: catError } = await (supabase as any)
      .from("tournament_categories")
      .select("id, tournament_id, name, max_teams, position")
      .in("tournament_id", tournamentIds)
      .order("position");

    if (!catError && catRows) {
      for (const row of catRows) {
        const list = categoriesMap.get(row.tournament_id) ?? [];
        list.push(row);
        categoriesMap.set(row.tournament_id, list);
      }
    }
  }

  return data.map((t) => {
    const rawCategories = categoriesMap.get(t.id) ?? [];
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const teams = (t.teams as any[]) ?? [];

    const categories: TournamentCategorySummary[] = rawCategories.map((c) => ({
      id: c.id,
      name: c.name,
      maxTeams: c.max_teams ?? null,
      approvedTeams: teams.filter((team) => team.status === "approved" && team.category_id === c.id).length,
    }));

    let totalCapacity: number | null = null;
    if (categories.length > 0) {
      const allHaveLimit = categories.every((c) => typeof c.maxTeams === "number" && c.maxTeams > 0);
      if (allHaveLimit) {
        totalCapacity = categories.reduce((sum, c) => sum + (c.maxTeams as number), 0);
      }
    }

    const approvedTeams = teams.filter((team) => team.status === "approved").length;
    const pendingTeams = teams.filter((team) => team.status === "pending").length;

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status,
      startsOn: t.starts_on,
      endsOn: t.ends_on,
      sportName: t.sports?.name ?? "",
      teamSize: t.sports?.min_team_size ?? 2,
      maxTeams: totalCapacity ?? t.max_teams,
      approvedTeams,
      pendingTeams,
      championTeamId: t.champion_team_id,
      championName: t.champion_team_id
        ? teams.find((team) => team.id === t.champion_team_id)?.name ?? null
        : null,
      isTest: t.is_test,
      categories,
      totalCapacity,
    };
  });
});

export type ParticipationItem = {
  teamId: string;
  teamName: string;
  teamStatus: Tables<"teams">["status"];
  role: Tables<"team_members">["role"];
  tournament: {
    id: string;
    name: string;
    slug: string;
    status: TournamentStatus;
    startsOn: string;
    endsOn: string;
    sportName: string;
  };
};

/** Torneos donde el usuario integra un equipo y participa efectivamente (excluye rechazados y sin categoría en torneos multicategoría). */
export const listParticipations = cache(async (userId: string): Promise<ParticipationItem[]> => {
  const supabase = await createClient();
  const { data, error } = await supabase
    .from("team_members")
    .select(
      "role, teams!inner(id, name, status, category_id, tournaments!teams_tournament_id_fkey!inner(id, name, slug, status, starts_on, ends_on, sports(name)))",
    )
    .eq("user_id", userId);
  if (error) throw error;
  if (!data || data.length === 0) return [];

  // 1. Excluir equipos rechazados por el organizador
  const nonRejected = data.filter((m) => m.teams?.status !== "rejected");
  if (nonRejected.length === 0) return [];

  // 2. Si el torneo ya comenzó o finalizó, las inscripciones que quedaron en 'pending' nunca ingresaron
  const candidates = nonRejected.filter((m) => {
    const tStatus = m.teams?.tournaments?.status;
    if (tStatus && !["draft", "registration_open"].includes(tStatus)) {
      return m.teams?.status === "approved";
    }
    return true;
  });
  if (candidates.length === 0) return [];

  const tournamentIds = Array.from(new Set(candidates.map((m) => m.teams.tournaments.id)));

  // 3. Consultar si los torneos tienen categorías configuradas
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  const { data: catRows, error: catError } = await (supabase as any)
    .from("tournament_categories")
    .select("id, tournament_id")
    .in("tournament_id", tournamentIds);

  const categoriesByTournament = new Map<string, string[]>();
  if (!catError && catRows) {
    for (const cat of catRows) {
      const list = categoriesByTournament.get(cat.tournament_id) ?? [];
      list.push(cat.id);
      categoriesByTournament.set(cat.tournament_id, list);
    }
  }

  // 4. Fallback: equipos sin category_id directo asignados a un grupo (group_teams)
  const teamsNeedingCategoryCheck = candidates
    .filter((m) => {
      const tourCats = categoriesByTournament.get(m.teams.tournaments.id);
      return tourCats && tourCats.length > 0 && !m.teams.category_id;
    })
    .map((m) => m.teams.id);

  const groupTeamCatMap = new Map<string, string>();
  if (teamsNeedingCategoryCheck.length > 0) {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: groupTeamRows } = await (supabase as any)
      .from("group_teams")
      .select("team_id, groups(category_id)")
      .in("team_id", teamsNeedingCategoryCheck);

    for (const gt of groupTeamRows ?? []) {
      if (gt.team_id && gt.groups?.category_id) {
        groupTeamCatMap.set(gt.team_id, gt.groups.category_id);
      }
    }
  }

  // 5. Si el torneo tiene categorías, el equipo debe estar asignado a una de ellas
  const valid = candidates.filter((member) => {
    const team = member.teams;
    const tournament = team.tournaments;
    const tourCategories = categoriesByTournament.get(tournament.id) ?? [];
    const hasCategories = tourCategories.length > 0;

    if (hasCategories) {
      const effectiveCatId = team.category_id ?? groupTeamCatMap.get(team.id) ?? null;
      if (!effectiveCatId || !tourCategories.includes(effectiveCatId)) {
        return false;
      }
    }

    return true;
  });

  return valid
    .map((member) => {
      const team = member.teams;
      const tournament = team.tournaments;
      return {
        teamId: team.id,
        teamName: team.name,
        teamStatus: team.status,
        role: member.role,
        tournament: {
          id: tournament.id,
          name: tournament.name,
          slug: tournament.slug,
          status: tournament.status,
          startsOn: tournament.starts_on,
          endsOn: tournament.ends_on,
          sportName: tournament.sports?.name ?? "",
        },
      };
    })
    .sort((a, b) => b.tournament.startsOn.localeCompare(a.tournament.startsOn));
});

export type OrganizerTournament = {
  id: string;
  name: string;
  slug: string;
  description: string | null;
  bannerUrl: string | null;
  status: TournamentStatus;
  startsOn: string;
  endsOn: string;
  timezone: string;
  maxTeams: number;
  resultsRequireConfirmation: boolean;
  scoringConfig: ScoringConfig;
  standingsConfig: StandingsConfig;
  playoffConfig: PlayoffConfig;
  championTeamId: string | null;
  sport: Sport;
  inviteCode: string | null;
  adminInviteCode?: string | null;
  isTest: boolean;
  isOwner: boolean;
};

/**
 * Torneo visto por su organizador o co-administrador. Devuelve null si no existe o si quien
 * consulta no tiene permisos operativos (las pantallas responden 404).
 */
export const getOrganizerTournament = cache(
  async (tournamentId: string, userId: string): Promise<OrganizerTournament | null> => {
    const supabase = await createClient();
    const { data, error } = await supabase
      .from("tournaments")
      .select("*, sports(*), tournament_invites(code)")
      .eq("id", tournamentId)
      .maybeSingle();
    if (error) throw error;
    if (!data || !data.sports) return null;

    const isOwner = data.organizer_id === userId;
    let isAuthorized = isOwner;

    if (!isAuthorized) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: adminRow } = await (supabase as any)
        .from("tournament_admins")
        .select("user_id")
        .eq("tournament_id", tournamentId)
        .eq("user_id", userId)
        .maybeSingle();
      if (adminRow) isAuthorized = true;
    }

    if (!isAuthorized) return null;

    let adminInviteCode: string | null = null;
    if (isOwner) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const { data: adminInvite } = await (supabase as any)
        .from("tournament_admin_invites")
        .select("code")
        .eq("tournament_id", tournamentId)
        .maybeSingle();
      adminInviteCode = adminInvite?.code ?? null;
    }

    return {
      id: data.id,
      name: data.name,
      slug: data.slug,
      description: data.description,
      bannerUrl: data.banner_url ?? null,
      status: data.status,
      startsOn: data.starts_on,
      endsOn: data.ends_on,
      timezone: data.timezone,
      maxTeams: data.max_teams,
      resultsRequireConfirmation: data.results_require_confirmation,
      // Las configs las valida la app al guardar (y la base su forma mínima).
      scoringConfig: data.scoring_config as ScoringConfig,
      standingsConfig: data.standings_config as StandingsConfig,
      playoffConfig: data.playoff_config as PlayoffConfig,
      championTeamId: data.champion_team_id,
      sport: data.sports,
      inviteCode: data.tournament_invites?.code ?? null,
      adminInviteCode,
      isTest: data.is_test,
      isOwner,
    };
  },
);

export type TournamentAdminMember = {
  userId: string;
  displayName: string;
  avatarUrl: string | null;
  role: "owner" | "admin";
  createdAt?: string;
};

/** Lista de administradores y dueño del torneo. */
export const getTournamentAdmins = cache(
  async (tournamentId: string): Promise<TournamentAdminMember[]> => {
    const supabase = await createClient();

    // 1. Intentar primero con la RPC segura de administradores (evita bloqueos de RLS entre perfiles)
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: rpcAdmins, error: rpcError } = await (supabase.rpc as any)(
      "get_tournament_admins",
      { p_tournament_id: tournamentId },
    );

    if (!rpcError && Array.isArray(rpcAdmins) && rpcAdmins.length > 0) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      return rpcAdmins.map((a: any) => ({
        userId: a.user_id,
        displayName: a.display_name || (a.role === "owner" ? "Organizador" : "Administrador"),
        avatarUrl: a.avatar_url ?? null,
        role: a.role as "owner" | "admin",
        createdAt: a.created_at,
      }));
    }

    // 2. Fallback: consulta directa a tablas
    const { data: tourney } = await supabase
      .from("tournaments")
      .select("organizer_id, profiles!tournaments_organizer_id_fkey(id, full_name, avatar_url)")
      .eq("id", tournamentId)
      .maybeSingle();

    const members: TournamentAdminMember[] = [];
    if (tourney) {
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      const p = tourney.profiles as any;
      members.push({
        userId: tourney.organizer_id,
        displayName: p?.full_name ?? "Organizador",
        avatarUrl: p?.avatar_url ?? null,
        role: "owner",
      });
    }

    // Co-administradores
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: admins } = await (supabase as any)
      .from("tournament_admins")
      .select("user_id, created_at, profiles!tournament_admins_user_id_fkey(id, full_name, avatar_url)")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });

    if (admins) {
      for (const a of admins) {
        members.push({
          userId: a.user_id,
          displayName: a.profiles?.full_name ?? "Administrador",
          avatarUrl: a.profiles?.avatar_url ?? null,
          role: "admin",
          createdAt: a.created_at,
        });
      }
    }

    return members;
  },
);

export type TournamentCounts = {
  courts: number;
  slots: number;
  teams: number;
  approvedTeams: number;
  pendingTeams: number;
  rejectedTeams: number;
  groupMatches: number;
  pendingGroupMatches: number;
  /** Partidos de grupo sin franja asignada. */
  unscheduledGroupMatches: number;
  playoffMatches: number;
  pendingPlayoffMatches: number;
  finalDecided: boolean;
  categories: number;
  allCategoriesFinished: boolean;
};

/** Números del panel del organizador y contexto para validar transiciones de estado. */
export const getTournamentCounts = cache(async (tournamentId: string): Promise<TournamentCounts> => {
  const supabase = await createClient();
  const [courts, slots, teams, matches, categories] = await Promise.all([
    supabase.from("courts").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId),
    supabase.from("time_slots").select("id", { count: "exact", head: true }).eq("tournament_id", tournamentId),
    supabase.from("teams").select("status").eq("tournament_id", tournamentId),
    supabase
      .from("matches")
      .select("category_id, stage, result_status, is_third_place, next_match_id, winner_team_id, slot_id")
      .eq("tournament_id", tournamentId),
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    (supabase as any).from("tournament_categories").select("id, status, champion_team_id").eq("tournament_id", tournamentId),
  ]);
  for (const result of [courts, slots, teams, matches, categories]) {
    if (result.error) throw result.error;
  }

  const teamRows = teams.data ?? [];
  const matchRows = (matches.data ?? []) as Array<{
    category_id?: string | null;
    stage: "group" | "playoff";
    result_status: string | null;
    is_third_place: boolean;
    next_match_id: string | null;
    winner_team_id: string | null;
    slot_id: string | null;
  }>;
  const catRows = (categories.data ?? []) as Array<{
    id: string;
    status: TournamentStatus;
    champion_team_id: string | null;
  }>;

  const groupMatches = matchRows.filter((m) => m.stage === "group");
  const playoffMatches = matchRows.filter((m) => m.stage === "playoff");
  const pendingPlayoffMatches = playoffMatches.filter((m) => m.result_status === null).length;
  const playoffFinals = playoffMatches.filter((m) => !m.is_third_place && m.next_match_id === null);
  const finalDecided =
    playoffFinals.length > 0 && playoffFinals.every((m) => m.winner_team_id !== null);

  let allCategoriesFinished = false;
  if (catRows.length > 0) {
    const catsAllDone = catRows.every((cat) => {
      if (cat.status === "finished") return true;
      const catPlayoffs = playoffMatches.filter((m) => m.category_id === cat.id);
      if (catPlayoffs.length > 0) {
        const catPending = catPlayoffs.filter((m) => m.result_status === null).length;
        const catFinal = catPlayoffs.find((m) => !m.is_third_place && m.next_match_id === null);
        return catPending === 0 && Boolean(catFinal?.winner_team_id);
      }
      const catGroups = groupMatches.filter((m) => m.category_id === cat.id);
      if (catGroups.length > 0) {
        return catGroups.every((m) => m.result_status !== null);
      }
      return false;
    });
    // O si todos los cruces eliminatorios del torneo están 100% jugados y con ganador
    allCategoriesFinished =
      catsAllDone ||
      (playoffMatches.length > 0 && pendingPlayoffMatches === 0 && finalDecided);
  } else {
    if (playoffMatches.length > 0) {
      allCategoriesFinished = pendingPlayoffMatches === 0 && finalDecided;
    } else if (groupMatches.length > 0) {
      allCategoriesFinished = groupMatches.every((m) => m.result_status !== null);
    }
  }

  return {
    courts: courts.count ?? 0,
    slots: slots.count ?? 0,
    teams: teamRows.length,
    approvedTeams: teamRows.filter((t) => t.status === "approved").length,
    pendingTeams: teamRows.filter((t) => t.status === "pending").length,
    rejectedTeams: teamRows.filter((t) => t.status === "rejected").length,
    groupMatches: groupMatches.length,
    pendingGroupMatches: groupMatches.filter((m) => m.result_status === null).length,
    unscheduledGroupMatches: groupMatches.filter((m) => m.slot_id === null).length,
    playoffMatches: playoffMatches.length,
    pendingPlayoffMatches,
    finalDecided: matchRows.some(
      (m) => m.stage === "playoff" && !m.is_third_place && m.next_match_id === null && m.winner_team_id !== null,
    ),
    categories: catRows.length,
    allCategoriesFinished,
  };
});

export type CourtRow = { id: string; name: string; venue: string | null; position: number };
export type SlotRow = {
  id: string;
  startsAt: string;
  endsAt: string;
  courtId: string | null;
  stage: "group" | "playoff";
  availableTeams: number;
  assignedMatches: number;
};

/** Canchas y franjas del torneo, con uso de cada franja (disponibilidad marcada y partidos). */
export const getCourtsAndSlots = cache(
  async (tournamentId: string): Promise<{ courts: CourtRow[]; slots: SlotRow[] }> => {
    const supabase = await createClient();
    const [courts, slots] = await Promise.all([
      supabase
        .from("courts")
        .select("id, name, venue, position")
        .eq("tournament_id", tournamentId)
        .order("position")
        .order("name"),
      supabase
        .from("time_slots")
        .select("id, starts_at, ends_at, court_id, stage, team_availability(count), matches(count)")
        .eq("tournament_id", tournamentId)
        .order("starts_at"),
    ]);
    if (courts.error) throw courts.error;
    if (slots.error) throw slots.error;

    return {
      courts: courts.data,
      slots: slots.data.map((slot) => ({
        id: slot.id,
        startsAt: slot.starts_at,
        endsAt: slot.ends_at,
        courtId: slot.court_id,
        stage: ((slot as any).stage ?? "group") as "group" | "playoff",
        availableTeams: slot.team_availability[0]?.count ?? 0,
        assignedMatches: slot.matches[0]?.count ?? 0,
      })),
    };
  },
);

/** Verifica si un usuario es el dueño o un co-administrador del torneo. */
export async function canUserManageTournament(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  supabase: any,
  tournamentId: string,
  userId: string,
): Promise<boolean> {
  const { data: tourney } = await supabase
    .from("tournaments")
    .select("organizer_id")
    .eq("id", tournamentId)
    .maybeSingle();

  if (!tourney) return false;
  if (tourney.organizer_id === userId) return true;

  const { data: admin } = await supabase
    .from("tournament_admins")
    .select("user_id")
    .eq("tournament_id", tournamentId)
    .eq("user_id", userId)
    .maybeSingle();

  return !!admin;
}

