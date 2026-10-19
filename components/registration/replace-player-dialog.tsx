"use client";

import { UserPen } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { replaceTeamPlayer } from "@/app/(app)/torneos/[id]/inscripciones/actions";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import type { OrganizerTeam } from "@/lib/data/teams";

export type ReplacePlayerDialogProps = {
  isOpen: boolean;
  onClose: () => void;
  tournamentId: string;
  team: OrganizerTeam | null;
  initialMemberId?: string | null;
};

export function ReplacePlayerDialog({
  isOpen,
  onClose,
  tournamentId,
  team,
  initialMemberId,
}: ReplacePlayerDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();

  const members = team?.members ?? [];
  const [selectedMemberId, setSelectedMemberId] = useState<string>("");
  const [newPlayerName, setNewPlayerName] = useState("");
  const [teamName, setTeamName] = useState("");
  const [autoUpdateTeamName, setAutoUpdateTeamName] = useState(true);
  const [errorMsg, setErrorMsg] = useState<string | null>(null);

  // Inicializar estado cuando se abre para un equipo
  useEffect(() => {
    if (team) {
      const defaultId = initialMemberId && members.some((m) => m.id === initialMemberId)
        ? initialMemberId
        : (members[0]?.id ?? "");
      setSelectedMemberId(defaultId);
      setNewPlayerName("");
      setTeamName(team.name);
      setAutoUpdateTeamName(true);
      setErrorMsg(null);
    }
  }, [team, initialMemberId, members]);

  // Actualizar automáticamente la sugerencia de nombre del equipo si está tildado
  useEffect(() => {
    if (!autoUpdateTeamName || !team || !selectedMemberId || !newPlayerName.trim()) {
      return;
    }

    const updatedMembers = members.map((m) => {
      if (m.id === selectedMemberId) {
        return newPlayerName.trim();
      }
      return m.fullName ?? m.displayName ?? "Jugador";
    });

    setTeamName(updatedMembers.join(" / "));
  }, [newPlayerName, selectedMemberId, autoUpdateTeamName, team, members]);

  if (!team) return null;

  const currentMember = members.find((m) => m.id === selectedMemberId);
  const currentMemberName = currentMember
    ? currentMember.fullName ?? currentMember.displayName ?? "Integrante"
    : "Integrante";

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    if (!team) return;
    if (!selectedMemberId) {
      setErrorMsg("Seleccioná el jugador a reemplazar.");
      return;
    }
    if (!newPlayerName.trim()) {
      setErrorMsg("Ingresá el nombre y apellido del nuevo jugador.");
      return;
    }
    if (teamName.trim().length < 2) {
      setErrorMsg("El nombre de la pareja debe tener al menos 2 caracteres.");
      return;
    }

    setErrorMsg(null);
    const teamId = team.id;
    const currentTeamName = team.name;

    startTransition(async () => {
      const result = await replaceTeamPlayer({
        tournamentId,
        teamId,
        memberId: selectedMemberId,
        newPlayerName: newPlayerName.trim(),
        newTeamName: teamName.trim() !== currentTeamName ? teamName.trim() : undefined,
      });

      if (!result.ok) {
        setErrorMsg(result.error);
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? "Jugador reemplazado con éxito.");
      onClose();
      router.refresh();
    });
  }

  return (
    <Dialog open={isOpen} onOpenChange={(open) => !open && onClose()}>
      <DialogContent className="max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <div className="flex items-center gap-2">
              <UserPen className="size-5 text-primary shrink-0" />
              <DialogTitle className="text-base sm:text-lg">
                Reemplazar jugador por lesión
              </DialogTitle>
            </div>
            <DialogDescription>
              Cambiá el nombre del integrante y de la pareja sin alterar los partidos, zonas ni resultados ya programados.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-3.5 py-1">
            {/* Selector de jugador a reemplazar */}
            <Field>
              <FieldLabel htmlFor="member-to-replace">Integrante a reemplazar</FieldLabel>
              {members.length <= 1 ? (
                <p className="text-sm font-medium py-1">{currentMemberName}</p>
              ) : (
                <NativeSelect
                  id="member-to-replace"
                  value={selectedMemberId}
                  disabled={isPending}
                  onChange={(e) => {
                    setSelectedMemberId(e.target.value);
                    setNewPlayerName("");
                  }}
                  className="w-full text-sm"
                >
                  {members.map((m, idx) => (
                    <NativeSelectOption key={m.id} value={m.id}>
                      {idx + 1}. {m.fullName ?? m.displayName ?? "Sin nombre"} {m.role === "captain" ? "(Capitán)" : ""}
                    </NativeSelectOption>
                  ))}
                </NativeSelect>
              )}
              <FieldDescription>
                Se reemplazará a: <strong>{currentMemberName}</strong>
              </FieldDescription>
            </Field>

            {/* Nombre del nuevo jugador */}
            <Field>
              <FieldLabel htmlFor="new-player-name">Nombre del nuevo jugador</FieldLabel>
              <Input
                id="new-player-name"
                type="text"
                value={newPlayerName}
                disabled={isPending}
                onChange={(e) => setNewPlayerName(e.target.value)}
                placeholder="Ej: Pérez Martín"
                autoFocus
                className="text-sm"
              />
            </Field>

            {/* Nombre de la pareja */}
            <Field>
              <FieldLabel htmlFor="team-name">Nombre visible de la pareja / equipo</FieldLabel>
              <Input
                id="team-name"
                type="text"
                value={teamName}
                disabled={isPending}
                onChange={(e) => {
                  setTeamName(e.target.value);
                  setAutoUpdateTeamName(false);
                }}
                className="text-sm"
              />
              <div className="pt-1">
                <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                  <input
                    type="checkbox"
                    checked={autoUpdateTeamName}
                    onChange={(e) => setAutoUpdateTeamName(e.target.checked)}
                    className="rounded border-border"
                  />
                  Actualizar nombre de pareja automáticamente al escribir el nuevo jugador
                </label>
              </div>
            </Field>

            {errorMsg ? <FieldError>{errorMsg}</FieldError> : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button type="button" variant="outline" size="sm" onClick={onClose} disabled={isPending}>
              Cancelar
            </Button>
            <Button type="submit" size="sm" disabled={isPending || !newPlayerName.trim()}>
              {isPending ? <Spinner className="size-3.5" /> : null}
              Confirmar reemplazo
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
