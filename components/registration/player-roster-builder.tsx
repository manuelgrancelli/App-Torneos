"use client";

import { Plus, Trash2, User, Users } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Field, FieldLabel } from "@/components/ui/field";
import { cn } from "@/lib/utils";

export type PlayerEntry = {
  id: string;
  name: string;
  email: string;
};

interface PlayerRosterBuilderProps {
  players: PlayerEntry[];
  onChange: (players: PlayerEntry[]) => void;
  minPlayers?: number;
  maxPlayers?: number;
  disabled?: boolean;
  isOrganizer?: boolean;
}

/**
 * Constructor interactivo de plantel de fútbol.
 * Reproduce el boceto de diseño con botón superior "[ + ] AGREGAR JUGADOR"
 * y tarjetas ordenadas "JUGADOR 1", "JUGADOR 2", etc.
 */
export function PlayerRosterBuilder({
  players,
  onChange,
  minPlayers,
  maxPlayers = 30,
  disabled = false,
  isOrganizer = false,
}: PlayerRosterBuilderProps) {
  function handleAddPlayer() {
    if (players.length >= maxPlayers) return;
    const newPlayer: PlayerEntry = {
      id: typeof crypto !== "undefined" && crypto.randomUUID ? crypto.randomUUID() : `p-${Date.now()}-${Math.random()}`,
      name: "",
      email: "",
    };
    onChange([...players, newPlayer]);
  }

  function handleRemovePlayer(index: number) {
    const updated = players.filter((_, i) => i !== index);
    onChange(updated);
  }

  function handleUpdatePlayer(index: number, field: "name" | "email", val: string) {
    const updated = [...players];
    const target = updated[index];
    if (!target) return;
    updated[index] = { ...target, [field]: val };
    onChange(updated);
  }

  return (
    <div className="space-y-3">
      {/* Botón superior AGREGAR JUGADOR (fiel al boceto) */}
      <button
        type="button"
        disabled={disabled || players.length >= maxPlayers}
        onClick={handleAddPlayer}
        className={cn(
          "w-full group flex items-center justify-center gap-3 rounded-xl border-2 border-border/80 bg-card p-3 sm:p-3.5 text-center transition-all duration-200",
          "hover:border-primary hover:bg-primary/5 hover:shadow-xs active:scale-[0.99]",
          "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-primary",
          disabled && "opacity-50 cursor-not-allowed hover:border-border hover:bg-card"
        )}
      >
        <div className="flex size-7 items-center justify-center rounded-lg border-2 border-border bg-muted/60 text-foreground transition-colors group-hover:border-primary group-hover:bg-primary/10 group-hover:text-primary">
          <Plus className="size-4 stroke-[2.5]" aria-hidden="true" />
        </div>
        <span className="text-xs sm:text-sm font-bold tracking-wider text-foreground uppercase group-hover:text-primary">
          AGREGAR JUGADOR
        </span>
      </button>

      {/* Contador de plantel */}
      <div className="flex flex-wrap items-center justify-between gap-1 px-1 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5 font-medium">
          <Users className="size-3.5 text-primary" aria-hidden="true" />
          {isOrganizer
            ? `Plantel: ${players.length} jugador${players.length === 1 ? "" : "es"}`
            : `Plantel: ${players.length + 1} jugador${players.length === 0 ? "" : "es"} (vos + ${players.length} compañero${players.length === 1 ? "" : "s"})`}
          {minPlayers !== undefined || maxPlayers !== undefined ? (
            <span className="text-[11px] text-muted-foreground/80 font-normal ml-1">
              (Mín: {isOrganizer ? minPlayers : minPlayers !== undefined ? minPlayers + 1 : 1} · Máx: {isOrganizer ? maxPlayers : maxPlayers !== undefined ? maxPlayers + 1 : 30})
            </span>
          ) : null}
        </span>
        {players.length >= maxPlayers ? (
          <span className="text-amber-500 font-semibold text-[11px]">Máximo alcanzado</span>
        ) : null}
      </div>

      {/* Lista de tarjetas de jugadores: JUGADOR 1, JUGADOR 2, ... */}
      <div className="space-y-2.5">
        {players.length === 0 ? (
          <div className="rounded-xl border-2 border-dashed border-border p-4 text-center">
            <p className="text-xs text-muted-foreground">
              {isOrganizer
                ? <>Aún no agregaste jugadores. Hacé clic en <strong>AGREGAR JUGADOR</strong> para sumar integrantes al equipo.</>
                : <>Aún no agregaste jugadores. Hacé clic en <strong>AGREGAR JUGADOR</strong> para sumar integrantes a tu equipo, o inscribite ahora e invitalos luego con link de WhatsApp.</>}
            </p>
          </div>
        ) : (
          players.map((player, idx) => {
            const playerNumber = idx + 1;
            return (
              <div
                key={player.id}
                className="group/card rounded-xl border-2 border-border bg-card p-3 sm:p-3.5 shadow-2xs transition-all hover:border-primary/60"
              >
                {/* Cabecera del jugador: JUGADOR X + botón eliminar */}
                <div className="flex items-center justify-between pb-2 mb-2.5 border-b border-border/60">
                  <div className="inline-flex items-center gap-2">
                    <div className="flex size-6 items-center justify-center rounded-md border border-border bg-muted/50 text-foreground">
                      <User className="size-3.5" aria-hidden="true" />
                    </div>
                    <span className="text-xs font-bold uppercase tracking-wider text-foreground">
                      JUGADOR {playerNumber}
                    </span>
                  </div>

                  <button
                    type="button"
                    onClick={() => handleRemovePlayer(idx)}
                    disabled={disabled}
                    className="inline-flex items-center gap-1 text-[11px] font-medium text-muted-foreground hover:text-destructive transition-colors p-1 rounded-md hover:bg-destructive/10"
                    title={`Quitar Jugador ${playerNumber}`}
                  >
                    <Trash2 className="size-3.5" aria-hidden="true" />
                    <span className="hidden sm:inline">Quitar</span>
                  </button>
                </div>

                {/* Campos: Nombre del jugador + Email opcional */}
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                  <Field className="space-y-1">
                    <FieldLabel className="text-[11px] font-medium text-foreground">
                      Nombre y apellido
                    </FieldLabel>
                    <Input
                      type="text"
                      placeholder={`Ej: Jugador ${playerNumber} o Nombre`}
                      value={player.name}
                      disabled={disabled}
                      onChange={(e) => handleUpdatePlayer(idx, "name", e.target.value)}
                      className="h-9 text-base sm:text-xs"
                    />
                  </Field>

                  <Field className="space-y-1">
                    <FieldLabel className="text-[11px] font-medium text-muted-foreground">
                      Email (opcional)
                    </FieldLabel>
                    <Input
                      type="email"
                      inputMode="email"
                      placeholder="jugador@ejemplo.com"
                      value={player.email}
                      disabled={disabled}
                      onChange={(e) => handleUpdatePlayer(idx, "email", e.target.value)}
                      className="h-9 text-base sm:text-xs"
                    />
                  </Field>
                </div>
              </div>
            );
          })
        )}
      </div>
    </div>
  );
}
