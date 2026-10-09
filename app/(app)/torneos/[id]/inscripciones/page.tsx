import type { Metadata } from "next";
import { OrganizerRegistrationForm } from "@/components/registration/organizer-registration-form";
import { RegistrationsList } from "@/components/registration/registrations-list";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { listTournamentTeams } from "@/lib/data/teams";
import { getCourtsAndSlots } from "@/lib/data/tournaments";
import { approvedTeamsLabel } from "@/lib/domain/tournament-status";

import Link from "next/link";

export const metadata: Metadata = { title: "Inscripciones" };

const FILTERS = ["all", "pending", "approved", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

import { getTournamentCategories } from "@/lib/data/categories";

export default async function RegistrationsPage({ params, searchParams }: PageProps<"/torneos/[id]/inscripciones">) {
  const { id } = await params;
  const { estado } = await searchParams;
  const tournament = await requireOrganizerTournament(id);
  const [teams, { courts, slots }, categories] = await Promise.all([
    listTournamentTeams(tournament.id),
    getCourtsAndSlots(tournament.id),
    getTournamentCategories(tournament.id),
  ]);
  const approved = teams.filter((t) => t.status === "approved").length;

  // Por defecto: pendientes si hay, si no todas.
  const requested = typeof estado === "string" && (FILTERS as readonly string[]).includes(estado) ? (estado as Filter) : null;
  const filter: Filter = requested ?? (teams.some((t) => t.status === "pending") ? "pending" : "all");

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name, maxTeams: c.maxTeams }));

  return (
    <div className="space-y-4">
      {tournament.status === "registration_open" ? (
        <OrganizerRegistrationForm
          tournamentId={tournament.id}
          sportId={tournament.sport.id}
          timezone={tournament.timezone}
          teamSize={tournament.sport.min_team_size}
          slots={slots}
          courts={courts}
          categories={categoryOptions}
        />
      ) : tournament.status === "draft" ? (
        <div className="rounded-xl border border-border bg-muted/40 p-4 text-sm text-muted-foreground">
          Este torneo está en <strong>Borrador</strong>. Para poder inscribir parejas y recibir participantes, primero abrí la inscripción desde el{" "}
          <Link href={`/torneos/${tournament.id}`} className="font-medium underline text-foreground">
            Resumen
          </Link>.
        </div>
      ) : null}
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
        isTestTournament={tournament.isTest}
        canReview={tournament.status === "registration_open"}
        filter={filter}
        categories={categoryOptions}
      />
    </div>
  );
}
