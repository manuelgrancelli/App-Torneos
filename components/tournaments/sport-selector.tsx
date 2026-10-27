"use client";

import { Check, CircleDot, Flame, Shield, Trophy } from "lucide-react";
import type { SportOption } from "./tournament-form";
import { cn } from "@/lib/utils";

type SportSelectorProps = {
  sports: SportOption[];
  value: string;
  onChange: (sportId: string) => void;
  disabled?: boolean;
};

function getSportIcon(id: string) {
  const normalized = id.toLowerCase();
  if (normalized.includes("padel") || normalized.includes("pádel")) {
    return CircleDot;
  }
  if (normalized.includes("tenis") || normalized.includes("tennis")) {
    return Trophy;
  }
  if (normalized.includes("futbol") || normalized.includes("fútbol") || normalized.includes("soccer")) {
    return Shield;
  }
  return Flame;
}

export function SportSelector({ sports, value, onChange, disabled }: SportSelectorProps) {
  const tenisSingleSport = sports.find((s) => s.id === "tenis-single");
  const tenisDoublesSport = sports.find((s) => s.id === "tenis");

  // Filtrar tenis-single de la grilla principal para que no aparezca como recuadro aparte (D-156)
  const visibleSports = sports.filter((s) => s.id !== "tenis-single");

  return (
    <div
      role="radiogroup"
      aria-label="Seleccionar deporte del torneo"
      className="grid grid-cols-1 gap-3 sm:grid-cols-2 lg:grid-cols-3"
    >
      {visibleSports.map((sport) => {
        const isTenisCard = sport.id === "tenis";
        const isSelected = isTenisCard
          ? value === "tenis" || value === "tenis-single"
          : sport.id === value;

        const isTenisSingle = isTenisCard && value === "tenis-single";
        const Icon = getSportIcon(sport.id);

        const formatLabel = isTenisCard
          ? isTenisSingle
            ? "Individual (Singles · 1 vs 1)"
            : "Parejas (Dobles · 2 vs 2)"
          : sport.id.includes("futbol")
            ? "Equipos · Reglas y formato por afiche"
            : sport.minTeamSize === 2
              ? "Parejas (2 por equipo)"
              : sport.minTeamSize === 1
                ? "Individual (1 vs 1)"
                : `Equipos de ${sport.minTeamSize}`;

        const ruleSummary =
          sport.defaultScoringConfig.type === "sets"
            ? `Sets a ${sport.defaultScoringConfig.gamesPerSet} games`
            : "Marcador por goles";

        return (
          <div
            key={sport.id}
            role="radio"
            aria-checked={isSelected}
            tabIndex={disabled ? -1 : 0}
            onClick={() => {
              if (disabled) return;
              if (isTenisCard) {
                // Si ya está seleccionado alguno de tenis, preserva la modalidad; si no, toma la activa
                if (value === "tenis-single") {
                  onChange(tenisSingleSport?.id ?? "tenis-single");
                } else {
                  onChange(tenisDoublesSport?.id ?? "tenis");
                }
              } else {
                onChange(sport.id);
              }
            }}
            onKeyDown={(e) => {
              if (e.key === "Enter" || e.key === " ") {
                e.preventDefault();
                if (disabled) return;
                if (isTenisCard) {
                  onChange(isTenisSingle ? (tenisSingleSport?.id ?? "tenis-single") : (tenisDoublesSport?.id ?? "tenis"));
                } else {
                  onChange(sport.id);
                }
              }
            }}
            className={cn(
              "group relative flex flex-col justify-between rounded-xl border p-4 text-left transition-all duration-200 cursor-pointer focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-emerald-500",
              isSelected
                ? "border-emerald-500 bg-emerald-500/[0.04] shadow-sm ring-2 ring-emerald-500/20 dark:bg-emerald-500/[0.08] -translate-y-0.5"
                : "border-border/80 bg-card hover:-translate-y-1 hover:border-emerald-500/40 hover:shadow-md hover:shadow-emerald-500/5",
              disabled && "cursor-not-allowed opacity-60 hover:translate-y-0 hover:shadow-none",
            )}
          >
            {/* Cabecera con icono e indicador de seleccionado */}
            <div>
              <div className="flex items-start justify-between gap-2">
                <div
                  className={cn(
                    "flex size-10 shrink-0 items-center justify-center rounded-xl transition-colors duration-200",
                    isSelected
                      ? "bg-emerald-500/15 text-emerald-600 dark:text-emerald-400"
                      : "bg-muted text-muted-foreground group-hover:bg-emerald-500/10 group-hover:text-emerald-600 dark:group-hover:text-emerald-400",
                  )}
                >
                  <Icon className="size-5" aria-hidden="true" />
                </div>

                {isSelected ? (
                  <span
                    aria-hidden="true"
                    className="animate-scale-in flex size-5 shrink-0 items-center justify-center rounded-full bg-emerald-500 text-white shadow-xs"
                  >
                    <Check className="size-3 stroke-[3]" />
                  </span>
                ) : (
                  <span
                    aria-hidden="true"
                    className="size-5 shrink-0 rounded-full border border-border/80 transition-colors group-hover:border-emerald-500/50"
                  />
                )}
              </div>

              {/* Información del deporte */}
              <div className="mt-4 space-y-1">
                <h3 className="text-base font-bold tracking-tight text-foreground">{sport.name}</h3>
                <p className="text-xs font-medium text-muted-foreground">{formatLabel}</p>
                <div className="pt-1.5">
                  <span className="inline-block rounded-md border border-border/60 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                    {ruleSummary}
                  </span>
                </div>
              </div>
            </div>

            {/* Selector de modalidad dentro del mismo recuadro para Tenis (D-156) */}
            {isTenisCard ? (
              <div
                className="mt-3.5 pt-3 border-t border-border/70"
                onClick={(e) => e.stopPropagation()}
              >
                <p className="text-[11px] font-semibold text-foreground mb-1.5">
                  Modalidad de tenis:
                </p>
                <div className="grid grid-cols-2 gap-1.5 rounded-lg border border-border/80 bg-muted/50 p-1">
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(tenisSingleSport?.id ?? "tenis-single")}
                    className={cn(
                      "rounded-md py-1.5 px-2 text-center text-xs font-medium transition-all",
                      isTenisSingle && isSelected
                        ? "bg-background text-foreground shadow-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/40"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    Individual (1 vs 1)
                  </button>
                  <button
                    type="button"
                    disabled={disabled}
                    onClick={() => onChange(tenisDoublesSport?.id ?? "tenis")}
                    className={cn(
                      "rounded-md py-1.5 px-2 text-center text-xs font-medium transition-all",
                      !isTenisSingle && isSelected
                        ? "bg-background text-foreground shadow-xs font-semibold text-emerald-600 dark:text-emerald-400 border border-emerald-500/40"
                        : "text-muted-foreground hover:text-foreground"
                    )}
                  >
                    En parejas (Dobles)
                  </button>
                </div>
              </div>
            ) : null}
          </div>
        );
      })}
    </div>
  );
}
