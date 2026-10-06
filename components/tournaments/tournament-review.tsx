import { Pencil } from "lucide-react";
import { Button } from "@/components/ui/button";
import { TIMEZONE_OPTIONS, formatDateRange } from "@/lib/dates";
import { teamNoun } from "@/lib/domain/tournament-status";
import type { CreateTournamentInput } from "@/lib/validation/tournament";
import { playoffSummary, scoringSummary, standingsSummary } from "./config-summary";

type ReviewRow = { label: string; value: string; step: number };

/**
 * Resumen de todo lo cargado antes de crear el torneo (D-054). Cada fila lleva un
 * "Editar" que vuelve al paso donde se completa ese dato. Es de presentación.
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
  const timezone = TIMEZONE_OPTIONS.find((tz) => tz.value === values.timezone)?.label ?? values.timezone;
  const description = values.description.trim();

  const rows: ReviewRow[] = [
    { label: "Nombre", value: values.name, step: 0 },
    { label: "Deporte", value: sportName, step: 0 },
    ...(description ? [{ label: "Descripción", value: description, step: 0 }] : []),
    { label: "Fechas", value: formatDateRange(values.startsOn, values.endsOn), step: 1 },
    { label: "Zona horaria", value: timezone, step: 1 },
    { label: `Cupo de ${teamNoun(teamSize, true)}`, value: String(values.maxTeams), step: 1 },
    { label: "Canchas / sedes", value: String(values.courtCount), step: 1 },
    {
      label: "Resultados",
      value: values.resultsRequireConfirmation ? "Los equipos los confirman" : "Los carga el organizador",
      step: 2,
    },
    { label: "Puntuación", value: scoringSummary(values.scoringConfig), step: 2 },
    { label: "Tabla de posiciones", value: standingsSummary(values.standingsConfig, values.scoringConfig.type), step: 2 },
    { label: "Playoffs", value: playoffSummary(values.playoffConfig), step: 2 },
  ];

  return (
    <dl className="divide-y rounded-xl bg-card ring-1 ring-foreground/10">
      {rows.map((row) => (
        <div key={row.label} className="flex items-start gap-3 px-4 py-3">
          <div className="min-w-0 flex-1 space-y-0.5">
            <dt className="text-xs font-medium text-muted-foreground">{row.label}</dt>
            <dd className="text-sm break-words">{row.value}</dd>
          </div>
          <Button type="button" variant="ghost" size="sm" onClick={() => onEdit(row.step)}>
            <Pencil aria-hidden="true" />
            Editar<span className="sr-only"> {row.label.toLowerCase()}</span>
          </Button>
        </div>
      ))}
    </dl>
  );
}
