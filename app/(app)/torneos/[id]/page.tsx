import { Trophy } from "lucide-react";
import type { Metadata } from "next";
import { DeleteTournamentButton } from "@/components/tournaments/delete-tournament-button";
import { InviteCard } from "@/components/tournaments/invite-card";
import { StatusCard, type TransitionOption } from "@/components/tournaments/status-card";
import { Card, CardContent } from "@/components/ui/card";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { getTournamentCounts } from "@/lib/data/tournaments";
import {
  ALLOWED_TRANSITIONS,
  approvedTeamsLabel,
  canDeleteTournament,
  checkTransition,
} from "@/lib/domain/tournament-status";
import { createClient } from "@/lib/supabase/server";
import { getRequestOrigin } from "@/lib/utils/origin";

export async function generateMetadata({ params }: PageProps<"/torneos/[id]">): Promise<Metadata> {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);
  return { title: tournament.name };
}

function Stat({ label, value }: { label: string; value: string | number }) {
  return (
    <div className="rounded-lg border p-3">
      <p className="text-2xl font-semibold tabular-nums">{value}</p>
      <p className="text-sm text-muted-foreground">{label}</p>
    </div>
  );
}

/** Resumen del torneo: estado, link de inscripción y números clave. */
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

  return (
    <div className="grid gap-6 lg:grid-cols-2">
      {championName ? (
        <p className="flex items-center gap-2 rounded-xl border border-amber-300 bg-amber-50 px-4 py-3 font-medium text-amber-950 lg:col-span-2">
          <Trophy className="size-5 text-amber-600" aria-hidden="true" />
          Campeón: {championName}
        </p>
      ) : null}
      <div className="space-y-6">
        <StatusCard tournamentId={tournament.id} status={tournament.status} options={options} />
        <Card>
          <CardContent className="grid grid-cols-2 gap-3">
            <Stat label={`${approvedTeamsLabel(tournament.sport.min_team_size)} (cupo ${tournament.maxTeams})`} value={counts.approvedTeams} />
            <Stat label="inscripciones pendientes" value={counts.pendingTeams} />
            <Stat label="canchas" value={counts.courts} />
            <Stat label="franjas horarias" value={counts.slots} />
          </CardContent>
        </Card>
      </div>
      <div className="space-y-6">
        {tournament.inviteCode ? (
          <InviteCard
            tournamentId={tournament.id}
            tournamentName={tournament.name}
            code={tournament.inviteCode}
            inviteUrl={`${origin}/unirse/${tournament.inviteCode}`}
            registrationOpen={tournament.status === "registration_open"}
          />
        ) : null}
        {canDeleteTournament(tournament.status) ? (
          <div className="flex justify-end">
            <DeleteTournamentButton tournamentId={tournament.id} tournamentName={tournament.name} />
          </div>
        ) : null}
      </div>
    </div>
  );
}
