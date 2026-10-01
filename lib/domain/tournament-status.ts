/**
 * Ciclo de vida del torneo. Replica las reglas de la RPC set_tournament_status
 * (supabase/migrations/…_registration_rpc.sql) para que la UI muestre solo las
 * transiciones posibles y el motivo cuando una está bloqueada. La base sigue
 * siendo la que decide: si cambian las reglas, hay que cambiar ambos lados (D-018).
 */

export const TOURNAMENT_STATUSES = ["draft", "registration_open", "group_stage", "playoffs", "finished"] as const;
export type TournamentStatus = (typeof TOURNAMENT_STATUSES)[number];

export const STATUS_LABELS: Record<TournamentStatus, string> = {
  draft: "Borrador",
  registration_open: "Inscripción abierta",
  group_stage: "Fase de grupos",
  playoffs: "Playoffs",
  finished: "Finalizado",
};

/** Etiquetas en minúscula, igual que los mensajes de la base. */
const STATUS_TEXT: Record<TournamentStatus, string> = {
  draft: "borrador",
  registration_open: "inscripción abierta",
  group_stage: "fase de grupos",
  playoffs: "playoffs",
  finished: "finalizado",
};

/** Texto del botón que lleva a cada estado. */
export const TRANSITION_ACTION_LABELS: Record<TournamentStatus, string> = {
  draft: "Volver a borrador",
  registration_open: "Abrir inscripción",
  group_stage: "Cerrar inscripción y empezar la fase de grupos",
  playoffs: "Terminar grupos y pasar a playoffs",
  finished: "Finalizar torneo",
};

/** Transiciones permitidas desde cada estado. */
export const ALLOWED_TRANSITIONS: Record<TournamentStatus, readonly TournamentStatus[]> = {
  draft: ["registration_open"],
  registration_open: ["draft", "group_stage"],
  group_stage: ["playoffs", "finished"],
  playoffs: ["finished"],
  finished: [],
};

export type TournamentStatusContext = {
  slotCount: number;
  teamCount: number;
  approvedTeamCount: number;
  groupMatchCount: number;
  pendingGroupMatchCount: number;
  finalDecided: boolean;
};

export type TransitionCheck = { ok: true } | { ok: false; reason: string };

/** ¿Se puede pasar de `from` a `to`? Mismos mensajes que la RPC. */
export function checkTransition(
  from: TournamentStatus,
  to: TournamentStatus,
  context: TournamentStatusContext,
): TransitionCheck {
  if (from === to) return { ok: true };
  if (!ALLOWED_TRANSITIONS[from].includes(to)) {
    return { ok: false, reason: `No se puede pasar de "${STATUS_TEXT[from]}" a "${STATUS_TEXT[to]}".` };
  }

  if (from === "draft" && to === "registration_open" && context.slotCount === 0) {
    return { ok: false, reason: "Cargá al menos una franja horaria antes de abrir la inscripción." };
  }
  if (from === "registration_open" && to === "draft" && context.teamCount > 0) {
    return { ok: false, reason: "No se puede volver a borrador: ya hay inscripciones." };
  }
  if (from === "registration_open" && to === "group_stage" && context.approvedTeamCount < 2) {
    return { ok: false, reason: "Necesitás al menos 2 inscripciones aprobadas para empezar la fase de grupos." };
  }
  if (from === "group_stage") {
    if (context.groupMatchCount === 0) {
      return { ok: false, reason: "Todavía no se generaron los partidos de la fase de grupos." };
    }
    if (context.pendingGroupMatchCount > 0) {
      return { ok: false, reason: "Faltan cargar resultados de la fase de grupos." };
    }
  }
  if (from === "playoffs" && to === "finished" && !context.finalDecided) {
    return { ok: false, reason: "Falta cargar el resultado de la final." };
  }
  return { ok: true };
}

export function isPublished(status: TournamentStatus): boolean {
  return status !== "draft";
}

/** El torneo solo se puede borrar antes de empezar (D-009). */
export function canDeleteTournament(status: TournamentStatus): boolean {
  return status === "draft" || status === "registration_open";
}

/** "pareja"/"parejas" si el deporte es de a 2; "equipo"/"equipos" si no (D-004). */
export function teamNoun(teamSize: number, plural = false): string {
  if (teamSize === 2) return plural ? "parejas" : "pareja";
  return plural ? "equipos" : "equipo";
}

/** "parejas aprobadas" / "equipos aprobados" (concordancia de género). */
export function approvedTeamsLabel(teamSize: number): string {
  return teamSize === 2 ? "parejas aprobadas" : "equipos aprobados";
}
