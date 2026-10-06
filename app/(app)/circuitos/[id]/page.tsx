import { notFound } from "next/navigation";
import { CircuitTabsView } from "@/components/circuits/circuit-tabs-view";
import { DeleteCircuitButton } from "@/components/circuits/delete-circuit-button";
import { PageHeader } from "@/components/shared/page-header";
import { SportBadge } from "@/components/tournaments/sport-badge";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import {
  getAvailableTournamentsForCircuit,
  getCircuitDates,
  getCircuitLeaderboardData,
  getOrganizerCircuit,
} from "@/lib/data/circuits";

export async function generateMetadata({ params }: PageProps<"/circuitos/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) return { title: "Circuito" };
  const circuit = await getOrganizerCircuit(id, user.id);
  return { title: circuit ? `${circuit.name} - Ranking y fechas` : "Circuito" };
}

export default async function CircuitDetailPage({ params }: PageProps<"/circuitos/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const circuit = await getOrganizerCircuit(id, user.id);
  if (!circuit) notFound();

  const [dates, availableTournaments, leaderboard] = await Promise.all([
    getCircuitDates(circuit.id),
    getAvailableTournamentsForCircuit(user.id, circuit.sportId, circuit.id),
    getCircuitLeaderboardData(circuit.id, circuit.pointsConfig),
  ]);

  return (
    <div className="space-y-6">
      <PageHeader
        title={circuit.name}
        description={circuit.description ?? "Circuito deportivo por fechas con ranking individual consolidado."}
        actions={
          <div className="flex items-center gap-2">
            <SportBadge sport={circuit.sportName} />
            <Badge variant="outline" className="text-xs">
              Año {circuit.year}
            </Badge>
            <DeleteCircuitButton circuitId={circuit.id} circuitName={circuit.name} />
          </div>
        }
      />

      <CircuitTabsView
        circuit={circuit}
        dates={dates}
        leaderboard={leaderboard}
        availableTournaments={availableTournaments}
      />
    </div>
  );
}
