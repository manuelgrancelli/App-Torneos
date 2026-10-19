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
      <DialogContent className="max-w-lg max-h-[85vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <ArrowLeftRight className="size-5 text-primary shrink-0" />
            <DialogTitle className="text-base sm:text-lg">
              Intercambiar pareja
            </DialogTitle>
          </div>
          <DialogDescription>
            Intercambiar a <strong>{sourceTeam.name}</strong> ({groupName(sourceGroupIndex)}) con una pareja de otro grupo mantendrá equilibrada la cantidad de integrantes de cada zona.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {candidateGroups.length === 0 ? (
            <div className="rounded-lg border border-dashed p-6 text-center text-sm text-muted-foreground">
              No hay otras zonas disponibles para realizar un intercambio.
            </div>
          ) : (
            candidateGroups.map((group) => (
              <div key={group.gIndex} className="space-y-2 rounded-xl border p-3 bg-muted/20">
                <div className="flex items-center justify-between">
                  <h4 className="text-xs font-semibold uppercase tracking-wider text-muted-foreground">
                    {group.name} ({group.teams.length} {group.teams.length === 1 ? "pareja" : "parejas"})
                  </h4>
                </div>

                <div className="space-y-1.5">
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
                        className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 rounded-lg border bg-background p-2.5 shadow-2xs hover:border-primary/40 transition-colors"
                      >
                        <div className="min-w-0 space-y-0.5">
                          <p className="font-medium text-sm truncate">{targetTeam.name}</p>
                          <div className="flex items-center gap-1.5 text-[11px]">
                            {hasAnyConflict ? (
                              <span className="inline-flex items-center gap-1 text-amber-700 dark:text-amber-300">
                                <TriangleAlert className="size-3 text-amber-600 dark:text-amber-400" />
                                Posible incompatibilidad horaria
                              </span>
                            ) : (
                              <span className="inline-flex items-center gap-1 text-emerald-700 dark:text-emerald-400 font-medium">
                                <CheckCircle2 className="size-3 text-emerald-600 dark:text-emerald-400" />
                                Compatible con los rivales
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
                          className="shrink-0 gap-1.5 text-xs hover:bg-primary hover:text-primary-foreground transition-colors"
                        >
                          <ArrowLeftRight className="size-3.5" />
                          Intercambiar
                        </Button>
                      </div>
                    );
                  })}
                </div>
              </div>
            ))
          )}
        </div>

        <DialogFooter>
          <Button type="button" variant="outline" size="sm" onClick={onClose} className="text-xs">
            Cancelar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
