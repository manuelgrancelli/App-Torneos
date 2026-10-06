"use client";

import { Award, CalendarDays, Settings, Trophy } from "lucide-react";
import { useState } from "react";
import { CircuitDatesList } from "./circuit-dates-list";
import { LeaderboardTable } from "./leaderboard-table";
import { LinkTournamentDialog } from "./link-tournament-dialog";
import { PointsConfigForm } from "./points-config-form";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CircuitDateItem, CircuitDetail } from "@/lib/data/circuits";
import type { LeaderboardPlayer } from "@/lib/domain/circuits";

type CircuitTabsViewProps = {
  circuit: CircuitDetail;
  dates: CircuitDateItem[];
  leaderboard: LeaderboardPlayer[];
  availableTournaments: { id: string; name: string; startsOn: string }[];
};

export function CircuitTabsView({
  circuit,
  dates,
  leaderboard,
  availableTournaments,
}: CircuitTabsViewProps) {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const nextOrder = dates.length > 0 ? Math.max(...dates.map((d) => d.circuitOrder)) + 1 : 1;

  return (
    <>
      <Tabs defaultValue="ranking" className="space-y-6">
        <TabsList className="grid w-full grid-cols-3 max-w-md">
          <TabsTrigger value="ranking" className="gap-2">
            <Trophy className="size-4" aria-hidden="true" />
            Ranking
          </TabsTrigger>
          <TabsTrigger value="dates" className="gap-2">
            <CalendarDays className="size-4" aria-hidden="true" />
            Fechas ({dates.length})
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="size-4" aria-hidden="true" />
            Puntos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="space-y-4">
          <LeaderboardTable leaderboard={leaderboard} dates={dates} />
        </TabsContent>

        <TabsContent value="dates" className="space-y-4">
          <CircuitDatesList
            circuitId={circuit.id}
            dates={dates}
            onOpenLinkDialog={() => setIsLinkDialogOpen(true)}
          />
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          <PointsConfigForm circuitId={circuit.id} currentPoints={circuit.pointsConfig} />
        </TabsContent>
      </Tabs>

      <LinkTournamentDialog
        circuitId={circuit.id}
        nextOrder={nextOrder}
        availableTournaments={availableTournaments}
        open={isLinkDialogOpen}
        onOpenChange={setIsLinkDialogOpen}
      />
    </>
  );
}
