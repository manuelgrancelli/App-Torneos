import { notFound, redirect } from "next/navigation";
import { CircuitTabsView } from "@/components/circuits/circuit-tabs-view";
import { DeleteCircuitButton } from "@/components/circuits/delete-circuit-button";
import { PageHeader } from "@/components/shared/page-header";
import { SportBadge } from "@/components/tournaments/sport-badge";
import { Badge } from "@/components/ui/badge";
import { getCurrentUser } from "@/lib/auth";
import {
  getAvailableTournamentsForCircuit,
  getCircuitDates,
  getCircuitDetail,
  getCircuitLeaderboardData,
  playerHasPlayedInCircuit,
} from "@/lib/data/circuits";

export async function generateMetadata({ params }: PageProps<"/circuitos/[id]">) {
  const { id } = await params;
  const circuit = await getCircuitDetail(id);
  return { title: circuit ? `${circuit.name} - Ranking y fechas` : "Circuito" };
}

export default async function CircuitDetailPage({ params }: PageProps<"/circuitos/[id]">) {
  const { id } = await params;
  const user = await getCurrentUser();
  if (!user) notFound();

  const circuit = await getCircuitDetail(id);
  if (!circuit) notFound();

  const isOrganizer = circuit.organizerId === user.id;

  // Un jugador solo puede ver el circuito si ha jugado al menos una fecha (D-143).
  if (!isOrganizer) {
    const hasPlayed = await playerHasPlayedInCircuit(user.id, circuit.id);
    if (!hasPlayed) {
      redirect("/circuitos");
    }
  }

  const [dates, availableTournaments, categoryLeaderboards] = await Promise.all([
    getCircuitDates(circuit.id),
    isOrganizer ? getAvailableTournamentsForCircuit(user.id, circuit.sportId, circuit.id) : Promise.resolve([]),
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
            <Badge variant="outline" className="text-xs border-foreground/50 dark:border-border font-medium">
              Año {circuit.year}
            </Badge>
            {isOrganizer ? (
              <DeleteCircuitButton circuitId={circuit.id} circuitName={circuit.name} />
            ) : null}
          </div>
        }
      />

      <CircuitTabsView
        circuit={circuit}
        dates={dates}
        categoryLeaderboards={categoryLeaderboards}
        availableTournaments={availableTournaments}
        canManage={isOrganizer}
        currentUserId={user.id}
      />
    </div>
  );
}
