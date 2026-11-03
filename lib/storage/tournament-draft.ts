"use client";

import type { CreateTournamentInput } from "@/lib/validation/tournament";

export const TOURNAMENT_DRAFT_KEY = "app_torneos_wizard_draft_v1";

export interface TournamentDraft {
  values: Partial<CreateTournamentInput>;
  step: number;
  isTestTournament: boolean;
  updatedAt: string;
}

export function saveTournamentDraft(draft: TournamentDraft): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.setItem(TOURNAMENT_DRAFT_KEY, JSON.stringify(draft));
  } catch (e) {
    console.warn("[tournament-draft] No se pudo guardar el borrador en localStorage", e);
  }
}

export function getTournamentDraft(): TournamentDraft | null {
  if (typeof window === "undefined") return null;
  try {
    const raw = localStorage.getItem(TOURNAMENT_DRAFT_KEY);
    if (!raw) return null;
    const parsed = JSON.parse(raw) as TournamentDraft;
    // Validar que tenga una estructura mínima coherente
    if (parsed && typeof parsed.step === "number" && parsed.values) {
      return parsed;
    }
  } catch (e) {
    console.warn("[tournament-draft] Error al leer el borrador de localStorage", e);
  }
  return null;
}

export function clearTournamentDraft(): void {
  if (typeof window === "undefined") return;
  try {
    localStorage.removeItem(TOURNAMENT_DRAFT_KEY);
  } catch (e) {
    console.warn("[tournament-draft] Error al eliminar el borrador", e);
  }
}

