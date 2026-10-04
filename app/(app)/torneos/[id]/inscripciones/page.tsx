import type { Metadata } from "next";
import { RegistrationsList } from "@/components/registration/registrations-list";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { listTournamentTeams } from "@/lib/data/teams";
import { approvedTeamsLabel } from "@/lib/domain/tournament-status";

export const metadata: Metadata = { title: "Inscripciones" };

const FILTERS = ["all", "pending", "approved", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

export default async function RegistrationsPage({ params, searchParams }: PageProps<"/torneos/[id]/inscripciones">) {
  const { id } = await params;
  const { estado } = await searchParams;
  const tournament = await requireOrganizerTournament(id);
  const teams = await listTournamentTeams(tournament.id);
  const approved = teams.filter((t) => t.status === "approved").length;

  // Por defecto: pendientes si hay, si no todas.
  const requested = typeof estado === "string" && (FILTERS as readonly string[]).includes(estado) ? (estado as Filter) : null;
  const filter: Filter = requested ?? (teams.some((t) => t.status === "pending") ? "pending" : "all");

  return (
    <div className="space-y-4">
      <p className="text-sm text-muted-foreground">
        {approved} de {tournament.maxTeams} {approvedTeamsLabel(tournament.sport.min_team_size)}.
        {tournament.status === "registration_open"
          ? " Las pendientes que superen el cupo quedan en lista de espera."
          : " Con la inscripción cerrada ya no se aprueban ni rechazan inscripciones."}
      </p>
      <RegistrationsList
        tournamentId={tournament.id}
        teams={teams}
        teamSize={tournament.sport.min_team_size}
        maxTeams={tournament.maxTeams}
        canReview={tournament.status === "registration_open"}
        filter={filter}
      />
    </div>
  );
}
