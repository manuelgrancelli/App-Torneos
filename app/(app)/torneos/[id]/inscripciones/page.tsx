import type { Metadata } from "next";
import { ArrowRight } from "lucide-react";
import Link from "next/link";
import { CloseRegistrationButton } from "@/components/registration/close-registration-button";
import { OrganizerRegistrationForm } from "@/components/registration/organizer-registration-form";
import { RegistrationsList } from "@/components/registration/registrations-list";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { InviteCard } from "@/components/tournaments/invite-card";
import { TournamentCelebrationCard } from "@/components/tournaments/tournament-celebration-card";
import { TournamentSetupStepper } from "@/components/tournaments/tournament-setup-stepper";
import { Button } from "@/components/ui/button";
import { getTournamentCategories } from "@/lib/data/categories";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { listTournamentTeams } from "@/lib/data/teams";
import { getCourtsAndSlots } from "@/lib/data/tournaments";
import { approvedTeamsLabel } from "@/lib/domain/tournament-status";
import { getRequestOrigin } from "@/lib/utils/origin";

export const metadata: Metadata = { title: "Inscripciones" };

const FILTERS = ["all", "pending", "approved", "rejected"] as const;
type Filter = (typeof FILTERS)[number];

export default async function RegistrationsPage({
  params,
  searchParams,
}: PageProps<"/torneos/[id]/inscripciones">) {
  const { id } = await params;
  const { estado, asistente } = await searchParams;
  const tournament = await requireOrganizerTournament(id);
  const [teams, { courts, slots }, categories, origin] = await Promise.all([
    listTournamentTeams(tournament.id),
    getCourtsAndSlots(tournament.id),
    getTournamentCategories(tournament.id),
    getRequestOrigin(),
  ]);
  const approved = teams.filter((t) => t.status === "approved").length;
  const showWizard = tournament.status === "draft" || asistente === "1";

  // Por defecto: pendientes si hay, si no todas.
  const requested =
    typeof estado === "string" && (FILTERS as readonly string[]).includes(estado)
      ? (estado as Filter)
      : null;
  const filter: Filter = requested ?? (teams.some((t) => t.status === "pending") ? "pending" : "all");

  const categoryOptions = categories.map((c) => ({ id: c.id, name: c.name, maxTeams: c.maxTeams }));

  return (
    <div className="space-y-6">
      {showWizard ? (
        <TournamentSetupStepper
          tournamentId={tournament.id}
          currentStep="inscripciones"
          counts={{
            categories: categories.length,
            slots: slots.length,
            courts: courts.length,
            approvedTeams: approved,
          }}
          isRegistrationOpen={tournament.status === "registration_open"}
        />
      ) : null}

      {/* Celebración de finalización al tener inscripciones abiertas */}
      {showWizard && tournament.status === "registration_open" ? (
        <TournamentCelebrationCard
          tournamentName={tournament.name}
          categoryCount={categories.length}
          slotCount={slots.length}
          inviteUrl={tournament.inviteCode ? `${origin}/unirse/${tournament.inviteCode}` : undefined}
        />
      ) : null}

      {/* Botón y panel para cerrar inscripciones y empezar fase de grupos */}
      {tournament.status === "registration_open" ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-4 rounded-2xl border border-emerald-500/30 bg-emerald-500/10 p-4 sm:p-5 shadow-xs">
          <div className="space-y-1">
            <div className="flex items-center gap-2">
              <span className="relative flex size-2.5">
                <span className="absolute inline-flex h-full w-full animate-ping rounded-full bg-emerald-400 opacity-75" />
                <span className="relative inline-flex size-2.5 rounded-full bg-emerald-500" />
              </span>
              <h2 className="text-base font-bold text-foreground">
                Inscripciones abiertas
              </h2>
            </div>
            <p className="text-xs sm:text-sm text-muted-foreground">
              Tenés <strong className="text-foreground">{approved} {approvedTeamsLabel(tournament.sport.min_team_size)}</strong>. Al cerrar la inscripción, los horarios y planteles quedarán confirmados y pasarás directamente a armar la fase de grupos.
            </p>
          </div>
          <CloseRegistrationButton
            tournamentId={tournament.id}
            approvedCount={approved}
            className="w-full sm:w-auto"
          />
        </div>
      ) : null}

      {tournament.status === "group_stage" ? (
        <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-2xl border border-sky-500/30 bg-sky-500/10 p-4 shadow-xs">
          <div className="space-y-0.5">
            <h2 className="text-sm font-semibold text-foreground">
              Inscripciones cerradas · Fase de grupos en marcha
            </h2>
            <p className="text-xs text-muted-foreground">
              Los planteles están fijados y los partidos de fase de grupos ya fueron habilitados.
            </p>
          </div>
          <Button asChild size="sm" className="bg-sky-600 hover:bg-sky-500 text-white font-medium">
            <Link href={`/torneos/${tournament.id}/grupos`}>
              <span>Ir a fase de grupos</span>
              <ArrowRight className="size-3.5 ml-1.5" />
            </Link>
          </Button>
        </div>
      ) : null}

      {/* Link y código de inscripción si está abierto */}
      {tournament.inviteCode && tournament.status === "registration_open" ? (
        <CollapsibleSection
          title="Link y código de invitación"
          summary="Compartí el link para que los participantes se anoten"
          defaultOpen={true}
          compact={true}
        >
          <InviteCard
            tournamentId={tournament.id}
            tournamentName={tournament.name}
            code={tournament.inviteCode}
            inviteUrl={`${origin}/unirse/${tournament.inviteCode}`}
            registrationOpen={true}
          />
        </CollapsibleSection>
      ) : null}

      {/* Formulario de inscripción manual para organizador si está abierto */}
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
      ) : null}

      <div className="space-y-3">
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
          slots={slots}
          timezone={tournament.timezone}
        />
      </div>
    </div>
  );
}
