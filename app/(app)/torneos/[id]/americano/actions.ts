"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { getCurrentUser } from "@/lib/auth";
import { getAmericanConfig, listAmericanParticipants } from "@/lib/data/american";
import {
  generateAmericanFixedPairsFixture,
  generateAmericanRotativeFixture,
} from "@/lib/domain/american-rotative";
import { validateAmericanScore } from "@/lib/domain/american-scoring";
import { dbErrorMessage } from "@/lib/supabase/errors";

const addParticipantSchema = z.object({
  tournamentId: z.string().uuid(),
  displayName: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(100),
  secondaryDisplayName: z.string().trim().max(100).optional().nullable(),
  email: z
    .string()
    .trim()
    .email("Ingresá un email válido.")
    .optional()
    .nullable()
    .or(z.literal("")),
});

const removeParticipantSchema = z.object({
  tournamentId: z.string().uuid(),
  participantId: z.string().uuid(),
});

const generateFixtureSchema = z.object({
  tournamentId: z.string().uuid(),
  roundsCount: z.number().int().min(1, "El mínimo es 1 ronda.").max(30, "El máximo son 30 rondas.").optional(),
  seed: z.number().optional(),
});

const updateScoreSchema = z.object({
  tournamentId: z.string().uuid(),
  matchId: z.string().uuid(),
  scoreSideA: z.number().int().min(0, "El tanteador debe ser mayor o igual a 0."),
  scoreSideB: z.number().int().min(0, "El tanteador debe ser mayor o igual a 0."),
  status: z.enum(["pending", "in_progress", "completed"]).default("completed"),
});

const tournamentOnlySchema = z.object({
  tournamentId: z.string().uuid(),
});

function revalidateAmerican(tournamentId: string) {
  revalidatePath(`/torneos/${tournamentId}/americano`);
  revalidatePath(`/torneos/${tournamentId}`);
  revalidatePath("/torneos");
}

/**
 * Agrega un nuevo participante individual o dupla a un torneo americano.
 * El email es opcional (para personas mayores o sin cuenta en la app).
 * Si se ingresa un email y coincide con un perfil registrado, se vincula automáticamente.
 */
export const addAmericanParticipant = createAction(
  addParticipantSchema,
  async (input, { supabase }) => {
    const { data: tournament, error: tErr } = await supabase
      .from("tournaments")
      .select("id, status, max_teams")
      .eq("id", input.tournamentId)
      .maybeSingle();

    if (tErr) return actionError(dbErrorMessage(tErr));
    if (!tournament) return actionError("No se encontró el torneo.");

    const cleanEmail = input.email?.trim().toLowerCase() || null;
    const cleanName = input.displayName.trim();

    // 1. Validar que no se repita el email en este torneo
    if (cleanEmail) {
      const { data: existingEmail } = await supabase
        .from("american_participants" as any)
        .select("id, display_name")
        .eq("tournament_id", input.tournamentId)
        .ilike("email", cleanEmail)
        .maybeSingle();

      if (existingEmail) {
        return actionError(
          `Ya hay un participante inscripto con el correo ${cleanEmail} (${(existingEmail as any).display_name}).`
        );
      }
    }

    // 2. Validar que no haya un participante con nombre idéntico para evitar duplicados accidentales
    const { data: existingName } = await supabase
      .from("american_participants" as any)
      .select("id")
      .eq("tournament_id", input.tournamentId)
      .ilike("display_name", cleanName)
      .maybeSingle();

    if (existingName) {
      return actionError(
        `Ya existe un participante llamado "${cleanName}". Si se trata de otra persona con el mismo nombre, agregá una inicial o apellido diferente.`
      );
    }

    const user = await getCurrentUser();
    let userId: string | null = null;
    if (cleanEmail && user?.email && cleanEmail === user.email.toLowerCase()) {
      userId = user.id;
    }

    const { error } = await supabase.from("american_participants" as any).insert({
      tournament_id: input.tournamentId,
      display_name: cleanName,
      secondary_display_name: input.secondaryDisplayName || null,
      email: cleanEmail,
      user_id: userId,
    });

    if (error) return actionError(dbErrorMessage(error));

    // Si el torneo estaba en borrador, al cargar participantes pasa a inscripción abierta
    if (tournament.status === "draft") {
      await supabase.from("tournaments").update({ status: "registration_open" }).eq("id", input.tournamentId);
    }

    revalidateAmerican(input.tournamentId);
    return actionOk(undefined, `Participante ${cleanName} agregado correctamente.`);
  }
);

/**
 * Permite al usuario actual sumarse directamente como participante en el torneo americano.
 * Si ya había sido inscripto previamente con su email, vincula su cuenta en lugar de duplicar.
 */
export const joinSelfAsAmericanParticipant = createAction(
  tournamentOnlySchema,
  async (input, { supabase }) => {
    const user = await getCurrentUser();
    if (!user) return actionError("Debes iniciar sesión.");

    const userEmail = user.email?.trim().toLowerCase() || null;

    // Buscar si ya existe por user_id O por email
    let query = supabase
      .from("american_participants" as any)
      .select("id, user_id, email, display_name")
      .eq("tournament_id", input.tournamentId);

    if (userEmail) {
      query = query.or(`user_id.eq.${user.id},email.ilike.${userEmail}`);
    } else {
      query = query.eq("user_id", user.id);
    }

    const { data: existingList } = await query;
    const existing = existingList && existingList.length > 0 ? (existingList as any[])[0] : null;

    if (existing) {
      // Si ya tiene el user_id asignado, avisar que ya está inscripto
      if (existing.user_id === user.id) {
        return actionError("Ya estás inscripto en este torneo con tu cuenta.");
      }

      // Si estaba inscripto con el mismo email pero sin user_id vinculado, lo vinculamos sin duplicar la fila
      const { error: updateErr } = await supabase
        .from("american_participants" as any)
        .update({
          user_id: user.id,
          display_name: user.fullName || existing.display_name,
        })
        .eq("id", existing.id);

      if (updateErr) return actionError(dbErrorMessage(updateErr));

      revalidateAmerican(input.tournamentId);
      return actionOk(undefined, "¡Tu cuenta quedó vinculada exitosamente a tu inscripción existente!");
    }

    const { error } = await supabase.from("american_participants" as any).insert({
      tournament_id: input.tournamentId,
      display_name: user.fullName || "Mi Jugador",
      email: userEmail,
      user_id: user.id,
    });

    if (error) return actionError(dbErrorMessage(error));

    // Si el torneo estaba en borrador, al inscribirse pasa a inscripción abierta
    await supabase
      .from("tournaments")
      .update({ status: "registration_open" })
      .eq("id", input.tournamentId)
      .eq("status", "draft");

    revalidateAmerican(input.tournamentId);
    return actionOk(undefined, "¡Te sumaste exitosamente como participante al torneo!");
  }
);

const joinAmericanSchema = z.object({
  code: z.string().min(3, "El código es inválido."),
  displayName: z.string().trim().min(2, "El nombre debe tener al menos 2 caracteres.").max(100),
  secondaryDisplayName: z.string().trim().max(100).optional().nullable(),
});

/**
 * Permite a un jugador auto-inscribirse al Torneo Americano usando el código de invitación.
 */
export const joinAmericanParticipant = createAction(
  joinAmericanSchema,
  async (input, { supabase }) => {
    const { data, error } = await (supabase.rpc as any)("register_american_participant", {
      p_code: input.code,
      p_display_name: input.displayName,
      p_secondary_display_name: input.secondaryDisplayName || null,
    });

    if (error) return actionError(dbErrorMessage(error));

    revalidatePath("/torneos");
    return actionOk({ participantId: data }, "¡Te inscribiste con éxito al Torneo Americano!");
  }
);

/**
 * Elimina un participante si el fixture aún no fue iniciado.
 */
export const removeAmericanParticipant = createAction(
  removeParticipantSchema,
  async (input, { supabase }) => {
    const { error } = await supabase
      .from("american_participants" as any)
      .delete()
      .eq("id", input.participantId)
      .eq("tournament_id", input.tournamentId);

    if (error) return actionError(dbErrorMessage(error));

    revalidateAmerican(input.tournamentId);
    return actionOk(undefined, "Participante eliminado.");
  }
);

/**
 * Completa el cupo con participantes ficticios (Jugador 1, Jugador 2...)
 * ideal para torneos de prueba o para testing ágil por parte del organizador.
 */
export const fillTestAmericanParticipants = createAction(
  tournamentOnlySchema,
  async (input, { supabase }) => {
    const { data: tournament, error: tErr } = await supabase
      .from("tournaments")
      .select("id, scoring_config, max_teams")
      .eq("id", input.tournamentId)
      .maybeSingle();

    if (tErr) return actionError(dbErrorMessage(tErr));
    if (!tournament) return actionError("No se encontró el torneo.");

    const config = getAmericanConfig(tournament);
    const targetCount = config?.participantCount || tournament.max_teams || 12;

    const existing = await listAmericanParticipants(input.tournamentId);
    const needed = targetCount - existing.length;

    if (needed <= 0) {
      return actionError(`El torneo ya cuenta con ${existing.length} participantes (cupo: ${targetCount}).`);
    }

    const newRows = [];
    for (let i = 1; i <= needed; i++) {
      const num = existing.length + i;
      newRows.push({
        tournament_id: input.tournamentId,
        display_name: config?.format === "PAREJAS_FIJAS" ? `Dupla ${num}` : `Jugador ${num}`,
      });
    }

    const { error: insErr } = await supabase.from("american_participants" as any).insert(newRows);
    if (insErr) return actionError(dbErrorMessage(insErr));

    revalidateAmerican(input.tournamentId);
    return actionOk(undefined, `Se completaron ${needed} participantes automáticamente.`);
  }
);

/**
 * Genera el fixture rotativo o de parejas fijas para el torneo americano.
 */
export const generateAmericanFixture = createAction(
  generateFixtureSchema,
  async (input, { supabase }) => {
    const { data: tournament, error: tErr } = await supabase
      .from("tournaments")
      .select("id, scoring_config, court_count:courts(count)")
      .eq("id", input.tournamentId)
      .maybeSingle();

    if (tErr) return actionError(dbErrorMessage(tErr));
    if (!tournament) return actionError("No se encontró el torneo.");

    const participants = await listAmericanParticipants(input.tournamentId);
    if (participants.length < 4) {
      return actionError("Se requiere un mínimo de 4 participantes para armar el fixture.");
    }

    const config = getAmericanConfig(tournament);
    const isIndividual = (config?.format ?? "INDIVIDUAL_ROTATIVO") === "INDIVIDUAL_ROTATIVO";

    if (isIndividual && participants.length % 4 !== 0) {
      return actionError(
        `Para la modalidad individual rotativo la cantidad de participantes (${participants.length}) debe ser múltiplo de 4 (8, 12, 16, etc.).`
      );
    }

    // Obtener cantidad de canchas creadas en el torneo
    const { count: courtsCount, data: courtsList } = await supabase
      .from("courts")
      .select("id, name, position", { count: "exact" })
      .eq("tournament_id", input.tournamentId)
      .order("position", { ascending: true });

    const totalCourts = Math.max(1, courtsCount || 2);
    const courtsArray = courtsList || [];

    // Limpiar partidos previos no jugados si se regenera
    await supabase.from("american_matches" as any).delete().eq("tournament_id", input.tournamentId);

    const participantIds = participants.map((p) => p.id);
    const chosenRounds = input.roundsCount ?? config?.roundsCount;

    if (isIndividual) {
      const generated = generateAmericanRotativeFixture({
        participantIds,
        courtCount: totalCourts,
        roundsCount: chosenRounds,
        seed: input.seed ?? Date.now(),
      });

      const matchRows = generated.map((m) => {
        // Vincular con cancha real si existe
        const courtObj = courtsArray[m.courtNumber - 1];
        return {
          tournament_id: input.tournamentId,
          round_number: m.roundNumber,
          court_number: m.courtNumber,
          shift_number: m.shiftNumber,
          order_number: m.orderNumber,
          court_id: courtObj?.id || null,
          player_a1_id: m.sideA[0],
          player_a2_id: m.sideA[1],
          player_b1_id: m.sideB[0],
          player_b2_id: m.sideB[1],
          status: "pending",
        };
      });

      const { error: insErr } = await supabase.from("american_matches" as any).insert(matchRows);
      if (insErr) return actionError(dbErrorMessage(insErr));
    } else {
      // Parejas fijas
      const generated = generateAmericanFixedPairsFixture(participantIds, totalCourts, chosenRounds);
      const matchRows = generated.map((m) => {
        const courtObj = courtsArray[m.courtNumber - 1];
        return {
          tournament_id: input.tournamentId,
          round_number: m.roundNumber,
          court_number: m.courtNumber,
          shift_number: m.shiftNumber,
          order_number: m.orderNumber,
          court_id: courtObj?.id || null,
          player_a1_id: m.pairAId,
          player_b1_id: m.pairBId,
          status: "pending",
        };
      });

      const { error: insErr } = await supabase.from("american_matches" as any).insert(matchRows);
      if (insErr) return actionError(dbErrorMessage(insErr));
    }

    // Inicializar tabla de posiciones acumulada
    await (supabase.rpc as any)("recalculate_american_standings", {
      p_tournament_id: input.tournamentId,
      p_category_id: null,
    });

    // Actualizar estado del torneo a group_stage (fase activa de partidos)
    await supabase
      .from("tournaments")
      .update({ status: "group_stage" })
      .eq("id", input.tournamentId);

    revalidateAmerican(input.tournamentId);
    return actionOk(undefined, "Fixture americano generado exitosamente.");
  }
);

/**
 * Carga o actualiza el marcador de un partido americano y recalcula las posiciones.
 * Valida que el tanteador sea estrictamente reglamentario según el formato del torneo (puntos fijos, set, tiempo).
 */
export const updateAmericanMatchScore = createAction(
  updateScoreSchema,
  async (input, { supabase }) => {
    // 1. Obtener la configuración del torneo para validar el tanteador
    const { data: tournament, error: tErr } = await supabase
      .from("tournaments")
      .select("id, scoring_config")
      .eq("id", input.tournamentId)
      .maybeSingle();

    if (tErr) return actionError(dbErrorMessage(tErr));
    if (!tournament) return actionError("No se encontró el torneo.");

    const config = getAmericanConfig(tournament);
    const validation = validateAmericanScore(input.scoreSideA, input.scoreSideB, {
      scoringMode: config?.scoringMode,
      targetPoints: config?.targetPoints,
    });

    if (!validation.valid) {
      return actionError(validation.error || "El marcador no es válido para este formato.");
    }

    const { error } = await (supabase.rpc as any)("save_american_match_score", {
      p_match_id: input.matchId,
      p_score_side_a: input.scoreSideA,
      p_score_side_b: input.scoreSideB,
      p_status: input.status,
    });

    if (error) return actionError(dbErrorMessage(error));

    revalidateAmerican(input.tournamentId);
    return actionOk(undefined, "Marcador guardado.");
  }
);

/**
 * Reinicia el fixture completo del torneo americano.
 */
export const resetAmericanFixture = createAction(
  tournamentOnlySchema,
  async (input, { supabase }) => {
    // Borrar partidos
    await supabase.from("american_matches" as any).delete().eq("tournament_id", input.tournamentId);

    // Borrar posiciones
    await supabase.from("american_standings" as any).delete().eq("tournament_id", input.tournamentId);

    revalidateAmerican(input.tournamentId);
    return actionOk(undefined, "Fixture reiniciado.");
  }
);

/**
 * Detecta y unifica participantes duplicados (mismo email) en el torneo americano.
 * Si uno de los duplicados tiene vinculada la cuenta (user_id), preserva ese vínculo.
 */
export const cleanupDuplicateAmericanParticipants = createAction(
  tournamentOnlySchema,
  async (input, { supabase }) => {
    const { data: participants, error: pErr } = await supabase
      .from("american_participants" as any)
      .select("*")
      .eq("tournament_id", input.tournamentId)
      .order("created_at", { ascending: true });

    if (pErr) return actionError(dbErrorMessage(pErr));
    if (!participants || participants.length === 0) {
      return actionOk(undefined, "No hay participantes.");
    }

    const emailGroups = new Map<string, any[]>();
    for (const p of participants as any[]) {
      if (p.email) {
        const key = p.email.trim().toLowerCase();
        const list = emailGroups.get(key) || [];
        list.push(p);
        emailGroups.set(key, list);
      }
    }

    let mergedCount = 0;
    for (const [, group] of emailGroups.entries()) {
      if (group.length > 1) {
        // Encontrar el que tiene user_id, o el más antiguo
        const withUserId = group.find((p) => p.user_id !== null);
        const keeper = withUserId || group[0];
        const duplicates = group.filter((p) => p.id !== keeper.id);

        for (const dup of duplicates) {
          // Si el duplicado tenía user_id y el keeper no, transferir el user_id
          if (dup.user_id && !keeper.user_id) {
            await supabase
              .from("american_participants" as any)
              .update({ user_id: dup.user_id })
              .eq("id", keeper.id);
            keeper.user_id = dup.user_id;
          }

          // Eliminar el duplicado sobrante
          const { error: delErr } = await supabase
            .from("american_participants" as any)
            .delete()
            .eq("id", dup.id);

          if (!delErr) mergedCount++;
        }
      }
    }

    revalidateAmerican(input.tournamentId);
    return actionOk(
      undefined,
      mergedCount > 0
        ? `Se unificaron y eliminaron ${mergedCount} participante(s) duplicados.`
        : "No se encontraron participantes duplicados."
    );
  }
);

