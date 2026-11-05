import "server-only";

import { cache } from "react";
import { createClient } from "@/lib/supabase/server";
import type { AmericanConfig } from "@/lib/validation/tournament";
import type { PaymentMethodType, PaymentStatus } from "@/lib/domain/payment";

export type AmericanParticipant = {
  id: string;
  tournamentId: string;
  categoryId: string | null;
  userId: string | null;
  displayName: string;
  secondaryDisplayName: string | null;
  email: string | null;
  phone: string | null;
  seedNumber: number | null;
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethodType | null;
  paidAt?: string | null;
  paymentNotes?: string | null;
  createdAt: string;
};

export type AmericanMatch = {
  id: string;
  tournamentId: string;
  categoryId: string | null;
  roundNumber: number;
  courtNumber: number;
  shiftNumber: number;
  orderNumber: number;
  courtId: string | null;
  playerA1Id: string;
  playerA2Id: string | null;
  playerA1Name: string;
  playerA2Name: string | null;
  scoreSideA: number | null;
  playerB1Id: string;
  playerB2Id: string | null;
  playerB1Name: string;
  playerB2Name: string | null;
  scoreSideB: number | null;
  status: "pending" | "in_progress" | "completed";
  playedAt: string | null;
};

export type AmericanStandingRow = {
  tournamentId: string;
  categoryId: string | null;
  participantId: string;
  displayName: string;
  secondaryDisplayName: string | null;
  played: number;
  won: number;
  lost: number;
  pointsFor: number;
  pointsAgainst: number;
  pointDiff: number;
  rank: number | null;
};

/**
 * Determina si un torneo fue creado con formato americano
 * revisando su configuración de puntuación (soporta camelCase, snake_case y rawScoringConfig).
 */
export function isAmericanTournament(
  tournament: { scoringConfig?: unknown; scoring_config?: unknown; rawScoringConfig?: unknown } | null | undefined
): boolean {
  if (!tournament) return false;
  const cfg = tournament.rawScoringConfig ?? tournament.scoring_config ?? tournament.scoringConfig;
  if (!cfg || typeof cfg !== "object") return false;
  const obj = cfg as Record<string, unknown>;
  const american = obj.american as Record<string, unknown> | undefined;
  return Boolean(american?.enabled || american?.format);
}

/**
 * Obtiene la configuración americana de un torneo.
 */
export function getAmericanConfig(
  tournament: { scoringConfig?: unknown; scoring_config?: unknown; rawScoringConfig?: unknown } | null | undefined
): AmericanConfig | null {
  if (!isAmericanTournament(tournament)) return null;
  const cfg = tournament?.rawScoringConfig ?? tournament?.scoring_config ?? tournament?.scoringConfig;
  const obj = cfg as Record<string, unknown>;
  return (obj?.american as AmericanConfig) ?? null;
}

/**
 * Lista los participantes de un torneo americano con deduplicación y auto-vinculación automática.
 */
export const listAmericanParticipants = cache(
  async (tournamentId: string, categoryId?: string | null): Promise<AmericanParticipant[]> => {
    const supabase = await createClient();
    let query = supabase
      .from("american_participants" as any)
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("created_at", { ascending: true });

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[listAmericanParticipants] Error al consultar participantes:", error);
      return [];
    }

    const rawList = (data || []) as any[];
    if (rawList.length <= 1) {
      return rawList.map((row) => ({
        id: row.id,
        tournamentId: row.tournament_id,
        categoryId: row.category_id,
        userId: row.user_id,
        displayName: row.display_name,
        secondaryDisplayName: row.secondary_display_name,
        email: row.email,
        phone: row.phone,
        seedNumber: row.seed_number,
        paymentStatus: (row.payment_status as PaymentStatus) ?? "not_required",
        paymentMethod: (row.payment_method as PaymentMethodType | null) ?? null,
        paidAt: row.paid_at ?? null,
        paymentNotes: row.payment_notes ?? null,
        createdAt: row.created_at,
      }));
    }

    // Deduplicación en memoria: si hay filas con el mismo email o mismo user_id,
    // preservamos la principal, transferimos el user_id vinculado si corresponde
    // y programamos la eliminación de la fila duplicada en la base de datos.
    const seenEmails = new Map<string, any>();
    const seenUserIds = new Map<string, any>();
    const deduplicated: any[] = [];
    const duplicateIdsToDelete: string[] = [];
    const updatesToPersist: Array<{ id: string; userId: string }> = [];

    for (const row of rawList) {
      const emailKey = row.email ? row.email.trim().toLowerCase() : null;
      const userKey = row.user_id ? String(row.user_id) : null;

      let existing = emailKey ? seenEmails.get(emailKey) : null;
      if (!existing && userKey) {
        existing = seenUserIds.get(userKey);
      }

      if (existing) {
        // Duplicado encontrado: si la fila duplicada tiene user_id y la original no, transferir el user_id
        if (row.user_id && !existing.user_id) {
          existing.user_id = row.user_id;
          updatesToPersist.push({ id: existing.id, userId: row.user_id });
        }
        duplicateIdsToDelete.push(row.id);
      } else {
        if (emailKey) seenEmails.set(emailKey, row);
        if (userKey) seenUserIds.set(userKey, row);
        deduplicated.push(row);
      }
    }

    // Limpieza asíncrona de base de datos para no bloquear la lectura
    if (duplicateIdsToDelete.length > 0 || updatesToPersist.length > 0) {
      void (async () => {
        try {
          for (const upd of updatesToPersist) {
            await supabase
              .from("american_participants" as any)
              .update({ user_id: upd.userId })
              .eq("id", upd.id);
          }
          for (const delId of duplicateIdsToDelete) {
            await supabase
              .from("american_participants" as any)
              .delete()
              .eq("id", delId);
          }
        } catch (cleanErr) {
          console.error("[listAmericanParticipants] Error en auto-limpieza de duplicados:", cleanErr);
        }
      })();
    }

    return deduplicated.map((row: any) => ({
      id: row.id,
      tournamentId: row.tournament_id,
      categoryId: row.category_id,
      userId: row.user_id,
      displayName: row.display_name,
      secondaryDisplayName: row.secondary_display_name,
      email: row.email,
      phone: row.phone,
      seedNumber: row.seed_number,
      paymentStatus: (row.payment_status as PaymentStatus) ?? "not_required",
      paymentMethod: (row.payment_method as PaymentMethodType | null) ?? null,
      paidAt: row.paid_at ?? null,
      paymentNotes: row.payment_notes ?? null,
      createdAt: row.created_at,
    }));
  }
);

/**
 * Lista todos los partidos del torneo americano con los nombres de los jugadores cargados.
 */
export const listAmericanMatches = cache(
  async (tournamentId: string, categoryId?: string | null): Promise<AmericanMatch[]> => {
    const supabase = await createClient();
    let query = supabase
      .from("american_matches" as any)
      .select(`
        *,
        pa1:american_participants!american_matches_player_a1_id_fkey(display_name),
        pa2:american_participants!american_matches_player_a2_id_fkey(display_name),
        pb1:american_participants!american_matches_player_b1_id_fkey(display_name),
        pb2:american_participants!american_matches_player_b2_id_fkey(display_name)
      `)
      .eq("tournament_id", tournamentId)
      .order("round_number", { ascending: true })
      .order("order_number", { ascending: true });

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;
    if (error) {
      // Si la relación no está explícita en PostgREST cache, caer a consulta directa con mapa
      return listAmericanMatchesFallback(tournamentId, categoryId);
    }

    return (data || []).map((row: any) => ({
      id: row.id,
      tournamentId: row.tournament_id,
      categoryId: row.category_id,
      roundNumber: row.round_number,
      courtNumber: row.court_number,
      shiftNumber: row.shift_number,
      orderNumber: row.order_number,
      courtId: row.court_id,
      playerA1Id: row.player_a1_id,
      playerA2Id: row.player_a2_id,
      playerA1Name: row.pa1?.display_name ?? "Jugador A1",
      playerA2Name: row.pa2?.display_name ?? null,
      scoreSideA: row.score_side_a,
      playerB1Id: row.player_b1_id,
      playerB2Id: row.player_b2_id,
      playerB1Name: row.pb1?.display_name ?? "Jugador B1",
      playerB2Name: row.pb2?.display_name ?? null,
      scoreSideB: row.score_side_b,
      status: row.status,
      playedAt: row.played_at,
    }));
  }
);

/**
 * Fallback para consultar partidos y mapear nombres por ID de participante.
 */
async function listAmericanMatchesFallback(
  tournamentId: string,
  categoryId?: string | null
): Promise<AmericanMatch[]> {
  const supabase = await createClient();
  const [matchesRes, participantsRes] = await Promise.all([
    supabase
      .from("american_matches" as any)
      .select("*")
      .eq("tournament_id", tournamentId)
      .order("round_number", { ascending: true })
      .order("order_number", { ascending: true }),
    supabase
      .from("american_participants" as any)
      .select("id, display_name")
      .eq("tournament_id", tournamentId),
  ]);

  const pMap = new Map<string, string>();
  ((participantsRes.data as any[]) || []).forEach((p) => pMap.set(p.id, p.display_name));

  return ((matchesRes.data as any[]) || []).map((row) => ({
    id: row.id,
    tournamentId: row.tournament_id,
    categoryId: row.category_id,
    roundNumber: row.round_number,
    courtNumber: row.court_number,
    shiftNumber: row.shift_number,
    orderNumber: row.order_number,
    courtId: row.court_id,
    playerA1Id: row.player_a1_id,
    playerA2Id: row.player_a2_id,
    playerA1Name: pMap.get(row.player_a1_id) ?? "Jugador A1",
    playerA2Name: row.player_a2_id ? pMap.get(row.player_a2_id) ?? null : null,
    scoreSideA: row.score_side_a,
    playerB1Id: row.player_b1_id,
    playerB2Id: row.player_b2_id,
    playerB1Name: pMap.get(row.player_b1_id) ?? "Jugador B1",
    playerB2Name: row.player_b2_id ? pMap.get(row.player_b2_id) ?? null : null,
    scoreSideB: row.score_side_b,
    status: row.status,
    playedAt: row.played_at,
  }));
}

/**
 * Obtiene la tabla de posiciones acumulada del torneo americano.
 */
export const getAmericanStandings = cache(
  async (tournamentId: string, categoryId?: string | null): Promise<AmericanStandingRow[]> => {
    const supabase = await createClient();
    const participants = await listAmericanParticipants(tournamentId, categoryId);
    const pMap = new Map(participants.map((p) => [p.id, p]));

    let query = supabase
      .from("american_standings" as any)
      .select("*")
      .eq("tournament_id", tournamentId);

    if (categoryId) {
      query = query.eq("category_id", categoryId);
    }

    const { data, error } = await query;
    if (error) {
      console.error("[getAmericanStandings] Error al consultar tabla:", error);
      return [];
    }

    const rows: AmericanStandingRow[] = (data || []).map((row: any) => {
      const p = pMap.get(row.participant_id);
      return {
        tournamentId: row.tournament_id,
        categoryId: row.category_id,
        participantId: row.participant_id,
        displayName: p?.displayName ?? "Jugador",
        secondaryDisplayName: p?.secondaryDisplayName ?? null,
        played: row.played ?? 0,
        won: row.won ?? 0,
        lost: row.lost ?? 0,
        pointsFor: row.points_for ?? 0,
        pointsAgainst: row.points_against ?? 0,
        pointDiff: row.point_diff ?? (row.points_for ?? 0) - (row.points_against ?? 0),
        rank: row.rank ?? null,
      };
    });

    // Ordenar por ranking si está calculado, o por criterios canónicos
    return rows.sort((a, b) => {
      if (a.rank !== null && b.rank !== null) return a.rank - b.rank;
      if (b.pointDiff !== a.pointDiff) return b.pointDiff - a.pointDiff;
      if (b.won !== a.won) return b.won - a.won;
      if (b.pointsFor !== a.pointsFor) return b.pointsFor - a.pointsFor;
      return a.pointsAgainst - b.pointsAgainst;
    });
  }
);

