import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { formatDateRange } from "@/lib/dates";
import {
  formatCurrency,
  getEnabledPaymentMethods,
  normalizePaymentConfig,
  PAYMENT_METHOD_LABELS,
  pricingTypeLabel,
} from "@/lib/domain/payment";
import type { CreateTournamentInput } from "@/lib/validation/tournament";
import { playoffSummary, scoringSummary, standingsSummary } from "./config-summary";

type ReviewRow = { label: string; value: string; step: number };

/**
 * Resumen de todo lo cargado antes de crear el torneo (D-054, D-072). Cada fila lleva un
 * "Editar" que vuelve al paso donde se completa ese dato. Estética SaaS limpia.
 */
export function TournamentReview({
  values,
  sportName,
  teamSize,
  onEdit,
}: {
  values: CreateTournamentInput;
  sportName: string;
  teamSize: number;
  onEdit: (step: number) => void;
}) {
  const description = values.description.trim();
  const isAmerican = values.isAmerican && values.sportId === "padel";
  const american = values.americanConfig;

  const modality = isAmerican
    ? american?.format === "INDIVIDUAL_ROTATIVO"
      ? "Americano · Individual (Parejas Rotativas)"
      : "Americano · Parejas Fijas"
    : values.scoringConfig.type === "goals"
      ? `Equipos (${values.scoringConfig.minTeamSize ?? 5} a ${values.scoringConfig.maxTeamSize ?? 15} jugadores)`
      : teamSize === 1
        ? "Individual (1 vs 1)"
        : teamSize === 2
          ? "En parejas (Dobles)"
          : `Equipos (${teamSize} jugadores)`;

  const rows: ReviewRow[] = [
    { label: "Nombre", value: values.name, step: 0 },
    { label: "Deporte", value: isAmerican ? "Pádel Americano" : sportName, step: 0 },
    { label: "Modalidad", value: modality, step: 0 },
    ...(isAmerican && american
      ? [
          {
            label: "Participantes",
            value: `${american.participantCount} ${american.format === "INDIVIDUAL_ROTATIVO" ? "jugadores individuales (múltiplo de 4)" : "parejas fijas"}`,
            step: 0,
          },
        ]
      : []),
    ...(description ? [{ label: "Descripción", value: description, step: 0 }] : []),
    { label: "Fechas", value: formatDateRange(values.startsOn, values.endsOn), step: 1 },
    ...(values.hasMultipleVenues && values.venues && values.venues.length > 0
      ? [
          {
            label: "Sedes y canchas",
            value: `${values.venues.reduce((acc, v) => acc + (v.courtCount || 0), 0)} canchas en ${values.venues.length} sedes (${values.venues
              .map((v) => `${v.name}${v.isMain ? " [Principal]" : ""}: ${v.courtCount}`)
              .join(" · ")})`,
            step: 1,
          },
        ]
      : [
          {
            label: values.venueName ? "Canchas y sede" : "Canchas disponibles",
            value: `${values.courtCount} (${values.courtCount === 1 ? "cancha" : "canchas"})${values.venueName ? ` · ${values.venueName}` : ""}`,
            step: 1,
          },
        ]),
    {
      label: "Resultados",
      value: values.resultsRequireConfirmation ? "Los equipos los confirman" : "Los carga el organizador",
      step: 2,
    },
    ...(isAmerican && american
      ? [
          {
            label: "Puntuación",
            value:
              american.scoringMode === "fixed_points"
                ? `A ${american.targetPoints ?? 24} puntos corridos`
                : american.scoringMode === "timed_round"
                  ? `A tiempo corrido (${american.roundDurationMinutes ?? 20} minutos por ronda)`
                  : "A 1 set clásico (clasifica por diferencia de games)",
            step: 2,
          },
          {
            label: "Rondas a disputar",
            value: `${american.roundsCount ?? 5} rondas programadas`,
            step: 0,
          },
          {
            label: "Tabla de posiciones",
            value:
              american.scoringMode === "single_set"
                ? "1° Diferencia de games (+/-) · 2° Partidos ganados · 3° Games a favor · 4° Duelo directo"
                : "1° Puntos acumulados · 2° Diferencia (+/-) · 3° Puntos a favor · 4° Duelo directo",
            step: 2,
          },
          {
            label: "Formato de competencia",
            value:
              american.format === "INDIVIDUAL_ROTATIVO"
                ? "Rotación continua de parejas y rivales por ronda"
                : "Fase de grupos corta / todos contra todos (round-robin)",
            step: 2,
          },
        ]
      : [
          { label: "Puntuación", value: scoringSummary(values.scoringConfig), step: 2 },
          { label: "Tabla de posiciones", value: standingsSummary(values.standingsConfig, values.scoringConfig.type), step: 2 },
          { label: "Playoffs", value: playoffSummary(values.playoffConfig), step: 2 },
        ]),
    ...(values.bannerUrl ? [{ label: "Flyer con reglas", value: "Cargado", step: 2 }] : []),
    {
      label: "Inscripción y Pagos",
      value: values.paymentConfig?.enabled
        ? `${formatCurrency(values.paymentConfig.amount)} (${pricingTypeLabel(values.paymentConfig.pricingType ?? "per_team", isAmerican)}) · Métodos: ${
            getEnabledPaymentMethods(normalizePaymentConfig(values.paymentConfig))
              .map((m) => PAYMENT_METHOD_LABELS[m])
              .join(", ") || "A coordinar"
          }`
        : "Sin arancel / Gratuito",
      step: 2,
    },
  ];

  return (
    <dl className="divide-y divide-border/60 overflow-hidden rounded-2xl border border-border/80 bg-card shadow-xs">
      {rows.map((row) => (
        <div
          key={row.label}
          className="group flex items-start justify-between gap-3 px-4 py-3.5 transition-colors hover:bg-muted/40 sm:px-5"
        >
          <div className="min-w-0 flex-1 space-y-1">
            <dt className="text-xs font-semibold tracking-wide text-muted-foreground uppercase">{row.label}</dt>
            <dd className="text-sm font-medium text-foreground break-words">{row.value}</dd>
          </div>
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={() => onEdit(row.step)}
            className="text-xs text-muted-foreground transition-all duration-150 hover:bg-emerald-500/10 hover:text-emerald-700 dark:hover:text-emerald-300"
          >
            <Pencil className="size-3.5" aria-hidden="true" />
            <span>Editar</span>
            <span className="sr-only"> {row.label.toLowerCase()}</span>
          </Button>
        </div>
      ))}
    </dl>
  );
}

