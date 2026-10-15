"use client";

import { useId, useState } from "react";
import { Swords, Trophy } from "lucide-react";
import { cn } from "@/lib/utils";

export type HistoryTab = "jugados" | "organizados";

interface HistoryViewTabsProps {
  defaultTab?: HistoryTab;
  playedCount: number;
  organizedCount: number;
  jugadosContent: React.ReactNode;
  organizadosContent: React.ReactNode;
}

export function HistoryViewTabs({
  defaultTab = "jugados",
  playedCount,
  organizedCount,
  jugadosContent,
  organizadosContent,
}: HistoryViewTabsProps) {
  const [activeTab, setActiveTab] = useState<HistoryTab>(defaultTab);
  const baseId = useId();
  const jugadosTabId = `${baseId}-tab-jugados`;
  const organizadosTabId = `${baseId}-tab-organizados`;
  const jugadosPanelId = `${baseId}-panel-jugados`;
  const organizadosPanelId = `${baseId}-panel-organizados`;

  const handleSelectTab = (tab: HistoryTab) => {
    setActiveTab(tab);
    if (typeof window !== "undefined") {
      const url = new URL(window.location.href);
      if (tab === "jugados") {
        url.searchParams.delete("tab");
      } else {
        url.searchParams.set("tab", tab);
      }
      window.history.replaceState({}, "", url.toString());
    }
  };

  return (
    <div className="space-y-6">
      {/* Segmented Control / Tabs */}
      <div className="flex items-center">
        <div
          role="tablist"
          aria-label="Tipo de historial"
          className="inline-flex rounded-xl bg-muted/60 p-1 border border-border/50 text-xs font-medium"
        >
          <button
            id={jugadosTabId}
            type="button"
            role="tab"
            aria-selected={activeTab === "jugados"}
            aria-controls={jugadosPanelId}
            onClick={() => handleSelectTab("jugados")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition-all text-xs font-medium cursor-pointer",
              activeTab === "jugados"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Swords className="size-3.5" aria-hidden="true" />
            <span>Jugados</span>
            {playedCount > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-semibold",
                  activeTab === "jugados"
                    ? "bg-primary/15 text-primary"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {playedCount}
              </span>
            ) : null}
          </button>

          <button
            id={organizadosTabId}
            type="button"
            role="tab"
            aria-selected={activeTab === "organizados"}
            aria-controls={organizadosPanelId}
            onClick={() => handleSelectTab("organizados")}
            className={cn(
              "flex items-center gap-1.5 rounded-lg px-3.5 py-1.5 transition-all text-xs font-medium cursor-pointer",
              activeTab === "organizados"
                ? "bg-background text-foreground shadow-xs font-semibold"
                : "text-muted-foreground hover:text-foreground"
            )}
          >
            <Trophy className="size-3.5 text-amber-500" aria-hidden="true" />
            <span>Organizados</span>
            {organizedCount > 0 ? (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px] tabular-nums font-semibold",
                  activeTab === "organizados"
                    ? "bg-amber-500/15 text-amber-600 dark:text-amber-400"
                    : "bg-muted text-muted-foreground"
                )}
              >
                {organizedCount}
              </span>
            ) : null}
          </button>
        </div>
      </div>

      {/* Contenido de Jugados */}
      <div
        id={jugadosPanelId}
        role="tabpanel"
        aria-labelledby={jugadosTabId}
        className={cn("space-y-6", activeTab !== "jugados" && "hidden")}
      >
        {jugadosContent}
      </div>

      {/* Contenido de Organizados */}
      <div
        id={organizadosPanelId}
        role="tabpanel"
        aria-labelledby={organizadosTabId}
        className={cn("space-y-6", activeTab !== "organizados" && "hidden")}
      >
        {organizadosContent}
      </div>
    </div>
  );
}
