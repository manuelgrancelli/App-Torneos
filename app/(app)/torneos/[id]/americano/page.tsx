import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { AmericanDashboard } from "@/components/american/american-dashboard";
import {
  getAmericanConfig,
  getAmericanStandings,
  isAmericanTournament,
  listAmericanMatches,
  listAmericanParticipants,
} from "@/lib/data/american";
import { requireOrganizerTournament } from "@/lib/data/organizer";

export const metadata: Metadata = {
  title: "Torneo Americano de Pádel",
};

export default async function AmericanTournamentPage({
  params,
}: PageProps<"/torneos/[id]">) {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);

  if (!isAmericanTournament(tournament)) {
    // Si no es americano, no corresponde mostrar este panel
    notFound();
  }

  const config = getAmericanConfig(tournament);

  const [participants, matches, standings] = await Promise.all([
    listAmericanParticipants(tournament.id),
    listAmericanMatches(tournament.id),
    getAmericanStandings(tournament.id),
  ]);

  return (
    <div className="space-y-6">
      <AmericanDashboard
        tournamentId={tournament.id}
        tournamentName={tournament.name}
        inviteCode={tournament.inviteCode}
        config={config}
        participants={participants}
        matches={matches}
        standings={standings}
      />
    </div>
  );
}

