"use client";

import { ArrowLeftRight, CheckCircle2, TriangleAlert } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { groupName } from "@/lib/domain/groups";

type Team = {
  id: string;
  name: string;
};

export type SwapTeamsModalProps = {
  isOpen: boolean;
  onClose: () => void;
  sourceTeam: Team | null;
  sourceGroupIndex: number;
  groups: string[][];
  byId: Map<string, Team>;
  availability?: Record<string, string[]>;
  onConfirmSwap: (sourceTeamId: string, targetTeamId: string) => void;
};

export function SwapTeamsModal({
  isOpen,
  onClose,
  sourceTeam,
  sourceGroupIndex,
  groups,
  byId,
  availability,
  onConfirmSwap,
}: SwapTeamsModalProps) {
  if (!sourceTeam) return null;

  // Evaluar si una pareja tiene conflicto con un grupo de integrantes dados
  function hasConflictWithMembers(candidateId: string, memberIds: string[]): boolean {
    if (!availability) return false;
    const candSlots = availability[candidateId];
    if (!candSlots || candSlots.length === 0) return false;
    const candSet = new Set(candSlots);

    for (const memberId of memberIds) {
      if (memberId === candidateId) continue;
      const memSlots = availability[memberId];
      if (!memSlots || memSlots.length === 0) continue;
      const shares = memSlots.some((s) => candSet.has(s));
      if (!shares) return true; // Conflicto: ninguno en común
    }
    return false;
  }

  // Miembros actuales del grupo origen excluyendo a sourceTeam
  const sourceRemaining = (groups[sourceGroupIndex] ?? []).filter((id) => id !== sourceTeam.id);

  // Grupos candidatos para intercambiar (todos los demás grupos que tengan al menos 1 equipo)
  const candidateGroups = groups
    .map((teamIds, gIndex) => ({
      gIndex,
      name: groupName(gIndex),
      teams: teamIds
        .map((id) => byId.get(id))
        .filter((t): t is Team => Boolean(t)),
    }))
    .filter((g) => g.gIndex !== sourceGroupIndex && g.teams.length > 0);

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="w-full max-w-[calc(100%-1.5rem)] sm:max-w-md max-h-[85vh] p-0 flex flex-col gap-0 overflow-hidden shadow-xl border">
        {/* Encabezado fijo superior */}
        <DialogHeader className="p-3.5 pr-10 sm:p-4 sm:pr-12 border-b shrink-0 text-left bg-card">
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="size-4 text-primary shrink-0" />
            <DialogTitle className="text-sm sm:text-base font-semibold truncate">
              Intercambiar pareja
            </DialogTitle>
          </div>
          <DialogDescription className="text-xs text-muted-foreground mt-1 leading-snug">
            Intercambiar a <strong className="text-foreground">{sourceTeam.name}</strong> ({groupName(sourceGroupIndex)}) con una pareja de otro grupo mantiene equilibradas las zonas.
          </DialogDescription>
        </DialogHeader>

        {/* Lista scrollable vertical únicamente */}
        <div className="flex-1 overflow-y-auto overflow-x-hidden p-3 sm:p-3.5 space-y-3 min-w-0">
          {candidateGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-xs text-muted-foreground">
              No hay otras zonas disponibles para realizar un intercambio.
            </div>
          ) : (
            candidateGroups.map((group) => (
              <div key={group.gIndex} className="space-y-1.5 rounded-lg border p-2 sm:p-2.5 bg-muted/20 min-w-0">
                <div className="flex items-center justify-between px-0.5">
                  <h4 className="text-[11px] font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.name} ({group.teams.length} {group.teams.length === 1 ? "pareja" : "parejas"})
                  </h4>
                </div>

                <div className="space-y-1 min-w-0">
                  {group.teams.map((targetTeam) => {
                    // Evaluar compatibilidad del swap:
                    // 1. ¿TargetTeam tiene conflicto en SourceGroup?
                    const targetInSourceConflict = hasConflictWithMembers(targetTeam.id, sourceRemaining);
                    // 2. ¿SourceTeam tiene conflicto en TargetGroup (con los demás miembros de TargetGroup)?
                    const targetRemaining = group.teams
                      .filter((t) => t.id !== targetTeam.id)
                      .map((t) => t.id);
                    const sourceInTargetConflict = hasConflictWithMembers(sourceTeam.id, targetRemaining);

                    const hasAnyConflict = targetInSourceConflict || sourceInTargetConflict;

                    return (
                      <div
                        key={targetTeam.id}
                        className="flex items-center justify-between gap-2 rounded-md border bg-background p-2 hover:border-primary/40 hover:bg-muted/30 transition-colors min-w-0"
                      >
                        <div className="min-w-0 flex-1 space-y-0.5">
                          <p className="font-medium text-xs sm:text-sm truncate text-foreground">
                            {targetTeam.name}
                          </p>
                          <div className="flex items-center gap-1 text-[11px]">
                            {hasAnyConflict ? (
                              <span
                                className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-400 font-medium truncate"
                                title="Posible incompatibilidad horaria con los rivales del grupo"
                              >
                                <TriangleAlert className="size-3 shrink-0 text-amber-600 dark:text-amber-400" />
                                Incompatible
                              </span>
                            ) : (
                              <span
                                className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium truncate"
                                title="Horarios compatibles con los rivales del grupo"
                              >
                                <CheckCircle2 className="size-3 shrink-0 text-emerald-600 dark:text-emerald-400" />
                                Compatible
                              </span>
                            )}
                          </div>
                        </div>

                        <Button
                          type="button"
                          size="sm"
                          variant="outline"
                          onClick={() => {
                            onConfirmSwap(sourceTeam.id, targetTeam.id);
                            onClose();
                          }}
                          className="h-7 px-2.5 text-xs shrink-0 gap-1 font-medium hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          <ArrowLeftRight className="size-3" />
                          <span>Intercambiar</span>
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        {/* Pie fijo inferior */}
        <DialogFooter className="p-2.5 sm:p-3 border-t bg-muted/10 shrink-0 flex flex-row items-center justify-end">
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="h-7.5 px-3 text-xs">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
