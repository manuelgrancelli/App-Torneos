import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { OrganizerRegistrationForm } from "@/components/registration/organizer-registration-form";
import { RegistrationsList } from "@/components/registration/registrations-list";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { InviteCard } from "@/components/tournaments/invite-card";
import { OpenRegistrationCard } from "@/components/tournaments/open-registration-card";
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

      {/* Si está en borrador: tarjeta de acción rápida para abrir inscripción */}
      {tournament.status === "draft" ? (
        <OpenRegistrationCard
          tournamentId={tournament.id}
          slotCount={slots.length}
          categoryCount={categories.length}
        />
      ) : null}

      {/* Link y código de inscripción si está abierto */}
      {tournament.inviteCode && tournament.status === "registration_open" ? (
        <CollapsibleSection
          title="Link y código de invitación"
          summary="Compartí el link para que los participantes se anoten"
          defaultOpen={true}
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

      {showWizard ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-primary/20 bg-muted/40 p-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">
                {tournament.status === "registration_open"
                  ? "¡Inscripciones habilitadas!"
                  : "Paso 4 de 4 del Asistente"}
              </p>
              {tournament.status === "registration_open" ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  <CheckCircle2 className="size-3.5" />
                  Listo
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {tournament.status === "registration_open"
                ? "Tu torneo ya está abierto al público. Podés revisar el resumen general o compartir el link."
                : "Una vez que abras las inscripciones o cargues tus equipos, podés ir al Resumen del torneo."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button asChild variant="outline" size="default" className="w-full sm:w-auto">
              <Link href={`/torneos/${tournament.id}/canchas-franjas?asistente=1`}>
                <ArrowLeft className="size-4 mr-1.5" />
                <span>Volver a Franjas</span>
              </Link>
            </Button>

            <Button asChild size="default" className="w-full sm:w-auto shrink-0 shadow-xs">
              <Link href={`/torneos/${tournament.id}`}>
                <span>Ir al Resumen del torneo</span>
                <ArrowRight className="size-4 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
