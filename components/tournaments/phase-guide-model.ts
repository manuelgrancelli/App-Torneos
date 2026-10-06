import type { TournamentCounts } from "@/lib/data/tournaments";
import { TOURNAMENT_STATUSES, type TournamentStatus, approvedTeamsLabel } from "@/lib/domain/tournament-status";

/**
 * Modelo de la guía de fase (D-055): qué pasos tiene la fase actual, cuáles están hechos y
 * cuánto se avanzó. Es puro y solo informa: las reglas que bloquean un cambio de estado
 * siguen en `checkTransition` y en la base.
 */

export type GuideStep = {
  label: string;
  done: boolean;
  /** Dato que acompaña al paso ("2 canchas"). */
  detail?: string;
  href?: string;
  actionLabel?: string;
};

export type GuideProgress = {
  value: number;
  max: number;
  /** Texto completo ("8 de 16 parejas aprobadas"). */
  label: string;
  /** Versión corta para el stepper ("8/16"). */
  short: string;
};

export type PhaseGuideModel = {
  phaseNumber: number;
  phaseCount: number;
  title: string;
  intro: string;
  steps: GuideStep[];
  progress: GuideProgress;
  /** Nombre de la fase que sigue (null en la última). */
  nextPhase: string | null;
};

/** Nombres cortos de cada fase (los mismos que usa el stepper). */
export const PHASE_TITLES: Record<TournamentStatus, string> = {
  draft: "Preparación",
  registration_open: "Inscripción",
  group_stage: "Grupos",
  playoffs: "Playoffs",
  finished: "Final",
};

const INTROS: Record<TournamentStatus, string> = {
  draft: "Armá lo necesario para poder abrir la inscripción.",
  registration_open: "Compartí el link, revisá las inscripciones y aprobá a quienes entran.",
  group_stage: "Armá los grupos, programá los partidos y cargá los resultados.",
  playoffs: "Generá el cuadro y cargá los resultados hasta la final.",
  finished: "El torneo terminó. Ya no se cargan resultados.",
};

function count(n: number, one: string, many: string): string {
  return `${n} ${n === 1 ? one : many}`;
}

function stepsFor(status: TournamentStatus, counts: TournamentCounts, teamSize: number, base: string): GuideStep[] {
  switch (status) {
    case "draft":
      return [
        {
          label: "Cargar canchas",
          done: counts.courts > 0,
          detail: count(counts.courts, "cancha", "canchas"),
          href: `${base}/canchas-franjas`,
          actionLabel: "Ir a canchas",
        },
        {
          label: "Cargar franjas horarias",
          done: counts.slots > 0,
          detail: count(counts.slots, "franja", "franjas"),
          href: `${base}/canchas-franjas`,
          actionLabel: "Ir a franjas",
        },
      ];
    case "registration_open":
      return [
        {
          label: `Tener al menos 2 ${approvedTeamsLabel(teamSize)}`,
          done: counts.approvedTeams >= 2,
          detail: `${counts.approvedTeams} ${counts.approvedTeams === 1 ? "aprobada" : "aprobadas"}`,
          href: `${base}/inscripciones`,
          actionLabel: "Ir a equipos",
        },
        {
          label: "Revisar las inscripciones pendientes",
          done: counts.pendingTeams === 0,
          detail: count(counts.pendingTeams, "pendiente", "pendientes"),
          href: `${base}/inscripciones`,
          actionLabel: "Ir a equipos",
        },
      ];
    case "group_stage":
      return [
        {
          label: "Armar los grupos y generar los partidos",
          done: counts.groupMatches > 0,
          detail: count(counts.groupMatches, "partido", "partidos"),
          href: `${base}/grupos`,
          actionLabel: "Ir a grupos",
        },
        {
          label: "Programar los partidos",
          done: counts.groupMatches > 0 && counts.unscheduledGroupMatches === 0,
          detail: counts.groupMatches > 0 ? `${counts.unscheduledGroupMatches} sin horario` : undefined,
          href: `${base}/partidos`,
          actionLabel: "Ir a partidos",
        },
        {
          label: "Cargar los resultados de la fase de grupos",
          done: counts.groupMatches > 0 && counts.pendingGroupMatches === 0,
          detail: counts.groupMatches > 0 ? count(counts.pendingGroupMatches, "pendiente", "pendientes") : undefined,
          href: `${base}/partidos`,
          actionLabel: "Ir a partidos",
        },
      ];
    case "playoffs":
      return [
        {
          label: "Generar el cuadro",
          done: counts.playoffMatches > 0,
          detail: count(counts.playoffMatches, "partido", "partidos"),
          href: `${base}/cuadro`,
          actionLabel: "Ir al cuadro",
        },
        {
          label: "Cargar resultados hasta la final",
          done: counts.finalDecided,
          detail: counts.playoffMatches > 0 ? count(counts.pendingPlayoffMatches, "pendiente", "pendientes") : undefined,
          href: `${base}/partidos`,
          actionLabel: "Ir a partidos",
        },
      ];
    case "finished":
      return [];
  }
}

/** Progreso de la fase: lo más concreto que haya (cupo, partidos jugados) o los pasos hechos. */
function progressFor(
  status: TournamentStatus,
  counts: TournamentCounts,
  maxTeams: number,
  teamSize: number,
  steps: GuideStep[],
): GuideProgress {
  const byCount = (value: number, max: number, label: string): GuideProgress => ({
    value,
    max,
    label,
    short: `${value}/${max}`,
  });

  if (status === "finished") return { value: 1, max: 1, label: "Torneo finalizado", short: "" };
  if (status === "registration_open") {
    return byCount(counts.approvedTeams, maxTeams, `${counts.approvedTeams} de ${maxTeams} ${approvedTeamsLabel(teamSize)}`);
  }
  if (status === "group_stage" && counts.groupMatches > 0) {
    const played = counts.groupMatches - counts.pendingGroupMatches;
    return byCount(played, counts.groupMatches, `${played} de ${counts.groupMatches} partidos jugados`);
  }
  if (status === "playoffs" && counts.playoffMatches > 0) {
    const played = counts.playoffMatches - counts.pendingPlayoffMatches;
    return byCount(played, counts.playoffMatches, `${played} de ${counts.playoffMatches} partidos jugados`);
  }
  const done = steps.filter((step) => step.done).length;
  return byCount(done, steps.length, `${done} de ${steps.length} pasos completados`);
}

export function buildPhaseGuide(
  status: TournamentStatus,
  counts: TournamentCounts,
  options: { tournamentId: string; maxTeams: number; teamSize: number },
): PhaseGuideModel {
  const base = `/torneos/${options.tournamentId}`;
  const index = TOURNAMENT_STATUSES.indexOf(status);
  const steps = stepsFor(status, counts, options.teamSize, base);
  const next = TOURNAMENT_STATUSES[index + 1];

  return {
    phaseNumber: index + 1,
    phaseCount: TOURNAMENT_STATUSES.length,
    title: PHASE_TITLES[status],
    intro: INTROS[status],
    steps,
    progress: progressFor(status, counts, options.maxTeams, options.teamSize, steps),
    nextPhase: next ? PHASE_TITLES[next] : null,
  };
}
