"use client";

import { CalendarDays, Layers, Settings, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { CircuitDatesList } from "./circuit-dates-list";
import { LeaderboardTable } from "./leaderboard-table";
import { LinkTournamentDialog } from "./link-tournament-dialog";
import { PointsConfigForm } from "./points-config-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CircuitDateItem, CircuitDetail } from "@/lib/data/circuits";
import type { CircuitCategoryLeaderboard, LeaderboardPlayer } from "@/lib/domain/circuits";
import { cn } from "@/lib/utils";

type CircuitTabsViewProps = {
  circuit: CircuitDetail;
  dates?: CircuitDateItem[];
  categoryLeaderboards?: CircuitCategoryLeaderboard[];
  /** Fallback para compatibilidad con transiciones de caché o llamadas directas */
  leaderboard?: LeaderboardPlayer[];
  availableTournaments?: { id: string; name: string; startsOn: string }[];
};

export function CircuitTabsView({
  circuit,
  dates = [],
  categoryLeaderboards = [],
  leaderboard,
  availableTournaments = [],
}: CircuitTabsViewProps) {
  const [isLinkDialogOpen, setIsLinkDialogOpen] = useState(false);
  const safeDates = Array.isArray(dates) ? dates : [];
  const nextOrder = safeDates.length > 0 ? Math.max(...safeDates.map((d) => d.circuitOrder)) + 1 : 1;

  const safeCategories = useMemo(() => {
    if (Array.isArray(categoryLeaderboards) && categoryLeaderboards.length > 0) {
      return categoryLeaderboards.map((cat) => ({
        categoryName: cat.categoryName ?? "General",
        leaderboard: Array.isArray(cat.leaderboard) ? cat.leaderboard : [],
      }));
    }
    if (Array.isArray(leaderboard) && leaderboard.length > 0) {
      return [{ categoryName: "General", leaderboard }];
    }
    return [];
  }, [categoryLeaderboards, leaderboard]);

  const [selectedCategory, setSelectedCategory] = useState(
    safeCategories[0]?.categoryName ?? "",
  );

  const activeCategoryLeaderboard =
    safeCategories.find((c) => c.categoryName === selectedCategory) ??
    safeCategories[0] ??
    null;

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
            Fechas ({safeDates.length})
          </TabsTrigger>
          <TabsTrigger value="config" className="gap-2">
            <Settings className="size-4" aria-hidden="true" />
            Puntos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="space-y-4">
          {safeCategories.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Todavía no hay puntos en el ranking"
              description="A medida que vincules fechas al circuito y se jueguen los partidos, los jugadores sumarán puntos automáticamente según la fase alcanzada."
            />
          ) : (
            <div className="space-y-4">
              {/* Si el circuito tiene más de una categoría, renderizamos el selector por píldoras */}
              {safeCategories.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 border-b border-border/80 pb-3">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-muted-foreground mr-1">
                    <Layers className="size-3.5" aria-hidden="true" />
                    <span>Categoría:</span>
                  </div>
                  {safeCategories.map((cat) => {
                    const isSelected = activeCategoryLeaderboard?.categoryName === cat.categoryName;
                    return (
                      <button
                        key={cat.categoryName}
                        type="button"
                        onClick={() => setSelectedCategory(cat.categoryName)}
                        className={cn(
                          "inline-flex h-8 sm:h-9 shrink-0 items-center gap-2 rounded-full border px-3 sm:px-4 text-xs font-semibold transition-all shadow-xs cursor-pointer",
                          isSelected
                            ? "border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                            : "border-border bg-card text-muted-foreground hover:bg-muted hover:text-foreground"
                        )}
                      >
                        <span>{cat.categoryName}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                            isSelected
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "bg-muted text-muted-foreground"
                          )}
                        >
                          {cat.leaderboard.length} {cat.leaderboard.length === 1 ? "jugador" : "jugadores"}
                        </span>
                      </button>
                    );
                  })}
                </div>
              )}

              <LeaderboardTable
                categoryName={activeCategoryLeaderboard?.categoryName}
                leaderboard={activeCategoryLeaderboard?.leaderboard ?? []}
                dates={safeDates}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="dates" className="space-y-4">
          <CircuitDatesList
            circuitId={circuit.id}
            dates={safeDates}
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
