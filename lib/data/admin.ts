import "server-only";
import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import { isSuperAdmin } from "@/lib/auth";
import type { TournamentStatus } from "@/lib/domain/tournament-status";

export type AdminDashboardStats = {
  totalTournaments: number;
  runningTournaments: number;
  openRegistrationTournaments: number;
  finishedTournaments: number;
  draftTournaments: number;
  totalTeams: number;
  approvedTeams: number;
  totalMatches: number;
  completedMatches: number;
  totalUsers: number;
};

export type AdminTournamentItem = {
  id: string;
  name: string;
  slug: string;
  status: TournamentStatus;
  sportName: string;
  startsOn: string;
  endsOn: string;
  organizerId: string;
  organizerName: string;
  organizerEmail: string | null;
  isTest: boolean;
  teamsCount: number;
  approvedTeamsCount: number;
  maxTeams: number;
  categories: Array<{ id: string; name: string }>;
  matchesCount: number;
  completedMatchesCount: number;
  createdAt: string;
};

export type SuperAdminUser = {
  id: string;
  fullName: string;
  email: string;
  createdAt: string;
};

/**
 * Consulta global de torneos y métricas de plataforma para el Panel de Superadmin.
 * Acceso estrictamente protegido por isSuperAdmin().
 */
export const getAdminDashboardData = cache(async (): Promise<{
  stats: AdminDashboardStats;
  tournaments: AdminTournamentItem[];
  superAdmins: SuperAdminUser[];
} | null> => {
  const authorized = await isSuperAdmin();
  if (!authorized) return null;

  const supabase = await createClient();

  // 1. Obtener todos los torneos con su deporte y organizador
  const { data: tournamentsRaw, error: tourError } = await supabase
    .from("tournaments")
    .select(`
      id,
      name,
      slug,
      status,
      is_test,
      starts_on,
      ends_on,
      max_teams,
      organizer_id,
      created_at,
      sports(name),
      profiles!tournaments_organizer_id_fkey(full_name)
    `)
    .order("created_at", { ascending: false });

  if (tourError) throw tourError;

  const tournamentsList = tournamentsRaw ?? [];
  const tournamentIds = tournamentsList.map((t) => t.id);

  // 2. Traer categorías, equipos y partidos si hay torneos
  let categoriesRaw: Array<{ id: string; tournament_id: string; name: string }> = [];
  let teamsRaw: Array<{ id: string; tournament_id: string; status: string }> = [];
  let matchesRaw: Array<{ id: string; tournament_id: string; result_status: string | null }> = [];

  if (tournamentIds.length > 0) {
    const [catsRes, teamsRes, matchesRes] = await Promise.all([
      // eslint-disable-next-line @typescript-eslint/no-explicit-any
      (supabase as any)
        .from("tournament_categories")
        .select("id, tournament_id, name")
        .in("tournament_id", tournamentIds),
      supabase
        .from("teams")
        .select("id, tournament_id, status")
        .in("tournament_id", tournamentIds)
        .limit(10000),
      supabase
        .from("matches")
        .select("id, tournament_id, result_status")
        .in("tournament_id", tournamentIds)
        .limit(10000),
    ]);

    categoriesRaw = catsRes.data ?? [];
    teamsRaw = teamsRes.data ?? [];
    matchesRaw = matchesRes.data ?? [];
  }

  // 3. Conteo total de usuarios registrados
  const { count: usersCount } = await supabase
    .from("profiles")
    .select("id", { count: "exact", head: true });

  // 4. Mapear datos por torneo
  const catsByTourney = new Map<string, Array<{ id: string; name: string }>>();
  for (const c of categoriesRaw) {
    const list = catsByTourney.get(c.tournament_id) ?? [];
    list.push({ id: c.id, name: c.name });
    catsByTourney.set(c.tournament_id, list);
  }

  const teamsByTourney = new Map<string, { total: number; approved: number }>();
  for (const team of teamsRaw) {
    const current = teamsByTourney.get(team.tournament_id) ?? { total: 0, approved: 0 };
    current.total++;
    if (team.status === "approved") current.approved++;
    teamsByTourney.set(team.tournament_id, current);
  }

  const matchesByTourney = new Map<string, { total: number; completed: number }>();
  for (const match of matchesRaw) {
    const current = matchesByTourney.get(match.tournament_id) ?? { total: 0, completed: 0 };
    current.total++;
    if (match.result_status === "confirmed") current.completed++;
    matchesByTourney.set(match.tournament_id, current);
  }

  const mappedTournaments: AdminTournamentItem[] = tournamentsList.map((t) => {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const profile = t.profiles as any;
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const sport = t.sports as any;
    const teamStats = teamsByTourney.get(t.id) ?? { total: 0, approved: 0 };
    const matchStats = matchesByTourney.get(t.id) ?? { total: 0, completed: 0 };

    return {
      id: t.id,
      name: t.name,
      slug: t.slug,
      status: t.status as TournamentStatus,
      sportName: sport?.name ?? "Pádel",
      startsOn: t.starts_on,
      endsOn: t.ends_on,
      organizerId: t.organizer_id,
      organizerName: profile?.full_name ?? "Organizador",
      organizerEmail: null,
      isTest: t.is_test ?? false,
      teamsCount: teamStats.total,
      approvedTeamsCount: teamStats.approved,
      maxTeams: t.max_teams ?? 0,
      categories: catsByTourney.get(t.id) ?? [],
      matchesCount: matchStats.total,
      completedMatchesCount: matchStats.completed,
      createdAt: t.created_at,
    };
  });

  // 5. Calcular estadísticas agregadas
  const stats: AdminDashboardStats = {
    totalTournaments: mappedTournaments.length,
    runningTournaments: mappedTournaments.filter((t) => t.status === "group_stage" || t.status === "playoffs").length,
    openRegistrationTournaments: mappedTournaments.filter((t) => t.status === "registration_open").length,
    finishedTournaments: mappedTournaments.filter((t) => t.status === "finished").length,
    draftTournaments: mappedTournaments.filter((t) => t.status === "draft").length,
    totalTeams: teamsRaw.length,
    approvedTeams: teamsRaw.filter((t) => t.status === "approved").length,
    totalMatches: matchesRaw.length,
    completedMatches: matchesRaw.filter((m) => m.result_status === "confirmed").length,
    totalUsers: usersCount ?? 0,
  };

  // 6. Obtener lista de superadministradores actuales
  let superAdmins: SuperAdminUser[] = [];
  try {
    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data: saData, error: saError } = await (supabase as any).rpc("get_superadmin_users");
    if (!saError && saData && Array.isArray(saData) && saData.length > 0) {
      superAdmins = saData.map((u: Record<string, unknown>) => ({
        id: String(u.id),
        fullName: String(u.full_name || "Sin nombre"),
        email: String(u.email || "Sin email"),
        createdAt: String(u.created_at || ""),
      }));
    }
  } catch {
    // ignorar error de RPC para pasar al fallback
  }

  // Fallback directo a profiles si la RPC falló o no devolvió resultados
  if (superAdmins.length === 0) {
    const { data: pData } = await supabase
      .from("profiles")
      .select("id, full_name, created_at")
      .eq("account_role", "superadmin");

    if (pData && pData.length > 0) {
      superAdmins = pData.map((p) => ({
        id: p.id,
        fullName: p.full_name,
        email: p.full_name || "Superadministrador",
        createdAt: p.created_at,
      }));
    }
  }

  // Garantizar que la cuenta principal de Manuel siempre figure en la nómina
  const hasManuel = superAdmins.some((a) => a.email.toLowerCase() === "manuelgrancelli@gmail.com");
  if (!hasManuel) {
    superAdmins.unshift({
      id: "owner-manuel",
      fullName: "Manuel Grancelli",
      email: "manuelgrancelli@gmail.com",
      createdAt: new Date().toISOString(),
    });
  }

  return {
    stats,
    tournaments: mappedTournaments,
    superAdmins,
  };
});

/**
 * Obtener detalles completos de un torneo para inspección de solo lectura por el Superadmin.
 */
export const getAdminTournamentDetails = cache(async (tournamentId: string) => {
  const authorized = await isSuperAdmin();
  if (!authorized) return null;

  const supabase = await createClient();

  const { data: tournament, error: tourError } = await supabase
    .from("tournaments")
    .select(`
      *,
      sports(*),
      profiles!tournaments_organizer_id_fkey(id, full_name, avatar_url)
    `)
    .eq("id", tournamentId)
    .maybeSingle();

  if (tourError || !tournament) return null;

  // Traer canchas
  const { data: courts } = await supabase
    .from("courts")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("sort_order");

  // Traer franjas horarias
  const { data: timeSlots } = await supabase
    .from("time_slots")
    .select("*")
    .eq("tournament_id", tournamentId)
    .order("starts_at")
    .limit(5000);

  return {
    tournament,
    courts: courts ?? [],
    timeSlots: timeSlots ?? [],
  };
});

