"use client";

import { CalendarDays, Layers, Settings, Trophy } from "lucide-react";
import { useMemo, useState } from "react";
import { CircuitDatesList } from "./circuit-dates-list";
import { LeaderboardTable } from "./leaderboard-table";
import { LinkTournamentDialog } from "./link-tournament-dialog";
import { PointsConfigForm } from "./points-config-form";
import { EmptyState } from "@/components/shared/empty-state";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Tabs, TabsContent, TabsList, TabsTrigger } from "@/components/ui/tabs";
import type { CircuitDateItem, CircuitDetail } from "@/lib/data/circuits";
import {
  CIRCUIT_ROUNDS,
  ROUND_LABELS,
  type CircuitCategoryLeaderboard,
  type LeaderboardPlayer,
} from "@/lib/domain/circuits";
import { cn } from "@/lib/utils";

type CircuitTabsViewProps = {
  circuit: CircuitDetail;
  dates?: CircuitDateItem[];
  categoryLeaderboards?: CircuitCategoryLeaderboard[];
  /** Fallback para compatibilidad con transiciones de caché o llamadas directas */
  leaderboard?: LeaderboardPlayer[];
  availableTournaments?: { id: string; name: string; startsOn: string }[];
  canManage?: boolean;
  currentUserId?: string;
};

export function CircuitTabsView({
  circuit,
  dates = [],
  categoryLeaderboards = [],
  leaderboard,
  availableTournaments = [],
  canManage = true,
  currentUserId,
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
        <TabsList className="grid w-full grid-cols-3 max-w-md border-2 border-foreground/70 dark:border-border bg-muted/60 p-1 rounded-xl shadow-xs">
          <TabsTrigger
            value="ranking"
            className="gap-2 border border-transparent font-semibold data-[state=active]:border-foreground/70 dark:data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            <Trophy className="size-4" aria-hidden="true" />
            Ranking
          </TabsTrigger>
          <TabsTrigger
            value="dates"
            className="gap-2 border border-transparent font-semibold data-[state=active]:border-foreground/70 dark:data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            <CalendarDays className="size-4" aria-hidden="true" />
            Fechas ({safeDates.length})
          </TabsTrigger>
          <TabsTrigger
            value="config"
            className="gap-2 border border-transparent font-semibold data-[state=active]:border-foreground/70 dark:data-[state=active]:border-border data-[state=active]:bg-background data-[state=active]:text-foreground data-[state=active]:shadow-xs"
          >
            <Settings className="size-4" aria-hidden="true" />
            Puntos
          </TabsTrigger>
        </TabsList>

        <TabsContent value="ranking" className="space-y-4">
          {safeCategories.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="Todavía no hay puntos en el ranking"
              description={
                canManage
                  ? "A medida que vincules fechas al circuito y se jueguen los partidos, los jugadores sumarán puntos automáticamente según la fase alcanzada."
                  : "A medida que se disputen los partidos de las fechas del circuito, verás las posiciones y los puntos acumulados en esta tabla."
              }
            />
          ) : (
            <div className="space-y-4">
              {/* Si el circuito tiene más de una categoría, renderizamos el selector por píldoras */}
              {safeCategories.length > 1 && (
                <div className="flex flex-wrap items-center gap-2 border-b-2 border-foreground/25 dark:border-border/80 pb-3.5">
                  <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground/80 dark:text-muted-foreground mr-1">
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
                          "inline-flex h-8 sm:h-9 shrink-0 items-center gap-2 rounded-full px-3 sm:px-4 text-xs font-semibold transition-all shadow-xs cursor-pointer",
                          isSelected
                            ? "border-2 border-primary bg-primary text-primary-foreground shadow-sm ring-2 ring-primary/30"
                            : "border-2 border-foreground/60 dark:border-border bg-card text-foreground hover:bg-muted hover:border-foreground"
                        )}
                      >
                        <span>{cat.categoryName}</span>
                        <span
                          className={cn(
                            "rounded-full px-2 py-0.5 text-[10px] font-bold tabular-nums",
                            isSelected
                              ? "bg-primary-foreground/20 text-primary-foreground"
                              : "border border-foreground/25 dark:border-border bg-muted text-foreground dark:text-muted-foreground"
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
                currentUserId={currentUserId}
              />
            </div>
          )}
        </TabsContent>

        <TabsContent value="dates" className="space-y-4">
          <CircuitDatesList
            circuitId={circuit.id}
            dates={safeDates}
            onOpenLinkDialog={() => setIsLinkDialogOpen(true)}
            canManage={canManage}
          />
        </TabsContent>

        <TabsContent value="config" className="space-y-4">
          {canManage ? (
            <PointsConfigForm circuitId={circuit.id} currentPoints={circuit.pointsConfig} />
          ) : (
            <Card>
              <CardHeader>
                <CardTitle>Escala de puntos del circuito</CardTitle>
                <CardDescription>
                  Puntos otorgados individualmente a cada jugador según la fase máxima alcanzada en cada fecha.
                </CardDescription>
              </CardHeader>
              <CardContent>
                <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 md:grid-cols-4">
                  {CIRCUIT_ROUNDS.map((round) => (
                    <div key={round} className="rounded-xl border bg-muted/40 p-3 text-center space-y-1">
                      <p className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
                        {ROUND_LABELS[round]}
                      </p>
                      <p className="text-xl font-bold text-primary tabular-nums">
                        {circuit.pointsConfig[round] ?? 0}{" "}
                        <span className="text-xs font-normal text-muted-foreground">pts</span>
                      </p>
                    </div>
                  ))}
                </div>
              </CardContent>
            </Card>
          )}
        </TabsContent>
      </Tabs>

      {canManage && (
        <LinkTournamentDialog
          circuitId={circuit.id}
          nextOrder={nextOrder}
          availableTournaments={availableTournaments}
          open={isLinkDialogOpen}
          onOpenChange={setIsLinkDialogOpen}
        />
      )}
    </>
  );
}
