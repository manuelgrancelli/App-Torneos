import type { CreateTournamentInput } from "@/lib/validation/tournament";

/**
 * Resúmenes de una línea de la configuración, para mostrar en las secciones plegadas
 * (D-052). Solo presentación: las reglas viven en `lib/domain`.
 */

export function scoringSummary(config: CreateTournamentInput["scoringConfig"]): string {
  if (config.type === "goals") return "Por goles · empate en grupos, penales en playoffs";
  const sets = config.bestOf === 1 ? "Un set" : `Al mejor de ${config.bestOf}`;
  const decisive =
    config.bestOf > 1 && config.decidingSet === "super_tiebreak"
      ? ` · super tie-break a ${config.superTiebreakPoints ?? 11}`
      : "";
  return `${sets} a ${config.gamesPerSet} games${decisive}`;
}

export function standingsSummary(
  config: CreateTournamentInput["standingsConfig"],
  scoringType: CreateTournamentInput["scoringConfig"]["type"],
): string {
  const { win, draw, loss } = config.points;
  const points =
    scoringType === "goals"
      ? `Ganado ${win} · empatado ${draw} · perdido ${loss}`
      : `Ganado ${win} · perdido ${loss}`;
  const count = config.tiebreakers.length;
  return `${points} · ${count} ${count === 1 ? "criterio" : "criterios"} de desempate`;
}

export function playoffSummary(config: CreateTournamentInput["playoffConfig"]): string {
  const passing = `Pasan ${config.qualifiersPerGroup} por grupo`;
  return config.thirdPlace ? `${passing} · con partido por el 3.er puesto` : `${passing} · sin 3.er puesto`;
}
