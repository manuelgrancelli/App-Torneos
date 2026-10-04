"use server";

import { revalidatePath } from "next/cache";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { refreshPublicTournament } from "@/lib/public-cache";
import { localToUtcIso } from "@/lib/dates";
import { generateSlots } from "@/lib/domain/slots";
import type { SupabaseServerClient } from "@/lib/supabase/server";
import { dbErrorMessage } from "@/lib/supabase/errors";
import {
  createCourtSchema,
  createSlotSchema,
  deleteCourtSchema,
  deleteSlotsSchema,
  generateSlotsSchema,
  updateCourtSchema,
} from "@/lib/validation/tournament";

const NOT_FOUND = "No encontramos el torneo o no tenés permiso para modificarlo.";

function revalidate(tournamentId: string) {
  revalidatePath(`/torneos/${tournamentId}`, "layout");
  refreshPublicTournament(tournamentId);
}

/** Zona horaria del torneo (si el usuario lo puede ver; el permiso de escritura lo aplica RLS). */
async function getTimezone(supabase: SupabaseServerClient, tournamentId: string): Promise<string | null> {
  const { data } = await supabase.from("tournaments").select("timezone").eq("id", tournamentId).maybeSingle();
  return data?.timezone ?? null;
}

// -----------------------------------------------------------------------------
// Canchas
// -----------------------------------------------------------------------------

export const addCourt = createAction(createCourtSchema, async (input, { supabase }) => {
  const { count } = await supabase
    .from("courts")
    .select("id", { count: "exact", head: true })
    .eq("tournament_id", input.tournamentId);

  const { error } = await supabase.from("courts").insert({
    tournament_id: input.tournamentId,
    name: input.name,
    venue: input.venue || null,
    position: (count ?? 0) + 1,
  });
  if (error) {
    if (error.code === "23505") return actionError("Ya hay una cancha con ese nombre.", { name: ["Usá otro nombre."] });
    return actionError(dbErrorMessage(error, NOT_FOUND));
  }
  revalidate(input.tournamentId);
  return actionOk(undefined, "Agregamos la cancha.");
});

export const updateCourt = createAction(updateCourtSchema, async (input, { supabase }) => {
  const { data, error } = await supabase
    .from("courts")
    .update({ name: input.name, venue: input.venue || null })
    .eq("id", input.courtId)
    .eq("tournament_id", input.tournamentId)
    .select("id");
  if (error) {
    if (error.code === "23505") return actionError("Ya hay una cancha con ese nombre.", { name: ["Usá otro nombre."] });
    return actionError(dbErrorMessage(error));
  }
  if (data.length === 0) return actionError(NOT_FOUND);
  revalidate(input.tournamentId);
  return actionOk(undefined, "Guardamos la cancha.");
});

export const deleteCourt = createAction(deleteCourtSchema, async (input, { supabase }) => {
  const { data, error } = await supabase
    .from("courts")
    .delete()
    .eq("id", input.courtId)
    .eq("tournament_id", input.tournamentId)
    .select("id");
  if (error) return actionError(dbErrorMessage(error));
  if (data.length === 0) {
    return actionError("Las canchas solo se pueden borrar antes de que empiece el torneo.");
  }
  revalidate(input.tournamentId);
  return actionOk(undefined, "Borramos la cancha.");
});

// -----------------------------------------------------------------------------
// Franjas
// -----------------------------------------------------------------------------

type SlotInsert = { tournament_id: string; starts_at: string; ends_at: string; court_id: string | null };

/**
 * Inserta franjas ignorando las que ya existen (mismo horario y cancha), en
 * una sola sentencia (D-031). Devuelve cuántas se crearon.
 */
async function insertSlots(supabase: SupabaseServerClient, rows: SlotInsert[]) {
  const { data, error } = await supabase
    .from("time_slots")
    .upsert(rows, { onConflict: "tournament_id,starts_at,ends_at,court_id", ignoreDuplicates: true })
    .select("id");
  return { created: data?.length ?? 0, error };
}

function slotsMessage(created: number, total: number): string {
  const skipped = total - created;
  const createdText = created === 1 ? "Creamos 1 franja" : `Creamos ${created} franjas`;
  if (skipped === 0) return `${createdText}.`;
  return `${createdText}; ${skipped === 1 ? "1 ya existía" : `${skipped} ya existían`}.`;
}

/** Generador en lote: días × horario (D-023, la hora local se convierte con la zona del torneo). */
export const generateTimeSlots = createAction(generateSlotsSchema, async (input, { supabase }) => {
  const timezone = await getTimezone(supabase, input.tournamentId);
  if (!timezone) return actionError(NOT_FOUND);

  const generated = generateSlots({
    dates: input.dates,
    from: input.from,
    to: input.to,
    durationMinutes: input.durationMinutes,
    breakMinutes: input.breakMinutes,
  });
  if (!generated.ok) return actionError(generated.errors.join(" "));

  const rows = generated.slots.map((slot) => ({
    tournament_id: input.tournamentId,
    starts_at: localToUtcIso(slot.date, slot.start, timezone),
    ends_at: localToUtcIso(slot.date, slot.end, timezone),
    court_id: input.courtId,
  }));

  const { created, error } = await insertSlots(supabase, rows);
  if (error) return actionError(dbErrorMessage(error, NOT_FOUND));
  revalidate(input.tournamentId);
  return actionOk({ created, total: rows.length }, slotsMessage(created, rows.length));
});

export const createTimeSlot = createAction(createSlotSchema, async (input, { supabase }) => {
  const timezone = await getTimezone(supabase, input.tournamentId);
  if (!timezone) return actionError(NOT_FOUND);

  const { created, error } = await insertSlots(supabase, [
    {
      tournament_id: input.tournamentId,
      starts_at: localToUtcIso(input.date, input.start, timezone),
      ends_at: localToUtcIso(input.date, input.end, timezone),
      court_id: input.courtId,
    },
  ]);
  if (error) return actionError(dbErrorMessage(error, NOT_FOUND));
  if (created === 0) return actionError("Esa franja ya existe.");
  revalidate(input.tournamentId);
  return actionOk(undefined, "Agregamos la franja.");
});

/** Borra franjas: se pierde la disponibilidad marcada y sus partidos quedan sin horario. */
export const deleteTimeSlots = createAction(deleteSlotsSchema, async (input, { supabase }) => {
  const { data, error } = await supabase
    .from("time_slots")
    .delete()
    .in("id", input.slotIds)
    .eq("tournament_id", input.tournamentId)
    .select("id");
  if (error) return actionError(dbErrorMessage(error));
  if (data.length === 0) return actionError(NOT_FOUND);
  revalidate(input.tournamentId);
  return actionOk(undefined, data.length === 1 ? "Borramos la franja." : `Borramos ${data.length} franjas.`);
});
