import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import { CollapsibleSection } from "@/components/shared/collapsible-section";
import { DeleteTournamentButton } from "@/components/tournaments/delete-tournament-button";
import { InviteCard } from "@/components/tournaments/invite-card";
import { PhaseGuide, type TransitionOption } from "@/components/tournaments/phase-guide";
import { buildPhaseGuide } from "@/components/tournaments/phase-guide-model";
import { TournamentBannerManager } from "@/components/tournaments/tournament-banner-manager";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { getTournamentCounts } from "@/lib/data/tournaments";
import { ALLOWED_TRANSITIONS, canDeleteTournament, checkTransition } from "@/lib/domain/tournament-status";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/utils/origin";

export async function generateMetadata({ params }: PageProps<"/torneos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);
  return { title: tournament.name };
}

/**
 * Resumen del torneo (D-052, D-055): la guía de la fase actual (qué falta y cuál es el
 * siguiente paso). Lo secundario (link de inscripción, eliminar) queda plegado.
 */
export default async function TournamentSummaryPage({ params }: PageProps<"/torneos/[id]">) {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);
  const [counts, origin] = await Promise.all([getTournamentCounts(tournament.id), getRequestOrigin()]);
  let championName: string | null = null;
  if (tournament.championTeamId) {
    const supabase = await createClient();
    const { data } = await supabase.from("teams").select("name").eq("id", tournament.championTeamId).maybeSingle();
    championName = data?.name ?? null;
  }

  // Transiciones posibles con su validación (la base vuelve a validar al aplicar).
  const options: TransitionOption[] = ALLOWED_TRANSITIONS[tournament.status].map((to) => {
    const check = checkTransition(tournament.status, to, {
      slotCount: counts.slots,
      teamCount: counts.teams,
      approvedTeamCount: counts.approvedTeams,
      groupMatchCount: counts.groupMatches,
      pendingGroupMatchCount: counts.pendingGroupMatches,
      finalDecided: counts.finalDecided,
    });
    return { to, ok: check.ok, reason: check.ok ? undefined : check.reason };
  });

  const registrationOpen = tournament.status === "registration_open";
  const guide = buildPhaseGuide(tournament.status, counts, {
    tournamentId: tournament.id,
    maxTeams: tournament.maxTeams,
    teamSize: tournament.sport.min_team_size,
  });

  return (
    <div className="max-w-2xl space-y-4">
      {championName ? (
        <p className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-medium text-amber-950">
          <Trophy className="size-5 text-amber-600" aria-hidden="true" />
          Campeón: {championName}
        </p>
      ) : null}

      <PhaseGuide tournamentId={tournament.id} status={tournament.status} guide={guide} options={options} />

      <CollapsibleSection
        title="Afiche o portada del torneo"
        summary={
          tournament.bannerUrl
            ? "Afiche cargado · clic para ampliar o editar"
            : "Subí una imagen PNG/JPG con info, horarios o sponsors"
        }
        defaultOpen={true}
      >
        <TournamentBannerManager
          tournamentId={tournament.id}
          bannerUrl={tournament.bannerUrl}
          tournamentName={tournament.name}
        />
      </CollapsibleSection>

      {tournament.inviteCode ? (
        // `key` por estado: al abrir la inscripción la sección se vuelve a montar y aparece desplegada.
        <CollapsibleSection
          key={tournament.status}
          title="Link y código de inscripción"
          summary={
            registrationOpen ? "Compartilo para que se anoten" : "Se usa cuando abras la inscripción"
          }
          defaultOpen={registrationOpen}
        >
          <InviteCard
            tournamentId={tournament.id}
            tournamentName={tournament.name}
            code={tournament.inviteCode}
            inviteUrl={`${origin}/unirse/${tournament.inviteCode}`}
            registrationOpen={registrationOpen}
          />
        </CollapsibleSection>
      ) : null}

      {canDeleteTournament(tournament.status) ? (
        <CollapsibleSection
          title="Más opciones"
          summary="Eliminar el torneo"
          description="Un torneo solo se puede eliminar antes de que empiece la fase de grupos."
        >
          <DeleteTournamentButton tournamentId={tournament.id} tournamentName={tournament.name} />
        </CollapsibleSection>
      ) : null}
    </div>
  );
}
