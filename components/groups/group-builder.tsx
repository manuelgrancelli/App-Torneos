"use client";

import { DragDropProvider, useDraggable, useDroppable } from "@dnd-kit/react";
import { GripVertical, Shuffle } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { saveGroups } from "@/app/(app)/torneos/[id]/grupos/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldLabel } from "@/components/ui/field";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { drawGroups, groupCountOptions, groupName, validateGroups } from "@/lib/domain/groups";
import { randomSeed } from "@/lib/domain/random";
import { roundRobinMatchCount } from "@/lib/domain/round-robin";
import { cn } from "@/lib/utils";

type Team = { id: string; name: string };

type GroupBuilderProps = {
  tournamentId: string;
  teams: Team[];
  /** Grupos ya guardados (para editarlos mientras no haya resultados). */
  initialGroups: string[][];
};

function TeamChip({
  team,
  groupIndex,
  groupCount,
  onMove,
}: {
  team: Team;
  groupIndex: number;
  groupCount: number;
  onMove: (teamId: string, toGroup: number) => void;
}) {
  const { ref, handleRef, isDragging } = useDraggable({ id: team.id, data: { groupIndex } });
  return (
    <li
      ref={ref}
      className={cn(
        "flex items-center gap-2 rounded-lg border bg-background px-2 py-1.5 text-sm",
        isDragging && "opacity-60 shadow",
      )}
    >
      {/* Agarre para arrastrar (mouse/touch); con teclado se usa el selector. */}
      <button
        ref={handleRef}
        type="button"
        className="cursor-grab touch-none rounded p-1 text-muted-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        aria-label={`Arrastrar ${team.name}`}
      >
        <GripVertical className="size-4" aria-hidden="true" />
      </button>
      <span className="min-w-0 flex-1 truncate">{team.name}</span>
      <NativeSelect
        size="sm"
        aria-label={`Mover ${team.name} a…`}
        value={String(groupIndex)}
        onChange={(e) => onMove(team.id, Number(e.target.value))}
        className="w-24 shrink-0"
      >
        {Array.from({ length: groupCount }, (_, i) => (
          <NativeSelectOption key={i} value={String(i)}>
            {groupName(i)}
          </NativeSelectOption>
        ))}
      </NativeSelect>
    </li>
  );
}

function GroupColumn({
  index,
  teams,
  groupCount,
  onMove,
}: {
  index: number;
  teams: Team[];
  groupCount: number;
  onMove: (teamId: string, toGroup: number) => void;
}) {
  const { ref, isDropTarget } = useDroppable({ id: `group-${index}` });
  return (
    <section
      ref={ref}
      aria-labelledby={`group-title-${index}`}
      className={cn("space-y-2 rounded-xl border p-3 transition-colors", isDropTarget && "border-foreground bg-muted/50")}
    >
      <h3 id={`group-title-${index}`} className="flex items-baseline justify-between text-sm font-semibold">
        {groupName(index)}
        <span className="font-normal text-muted-foreground">
          {teams.length} equipos · {roundRobinMatchCount(teams.length)} partidos
        </span>
      </h3>
      <ul className="min-h-12 space-y-1.5">
        {teams.map((team) => (
          <TeamChip key={team.id} team={team} groupIndex={index} groupCount={groupCount} onMove={onMove} />
        ))}
      </ul>
    </section>
  );
}

/**
 * Armado de grupos: sorteo con semilla y ajuste manual (drag and drop o el
 * selector "Mover a…", que funciona con teclado y en mobile).
 */
export function GroupBuilder({ tournamentId, teams, initialGroups }: GroupBuilderProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const options = groupCountOptions(teams.length);
  const suggested = options.find((count) => teams.length / count <= 5) ?? options[options.length - 1] ?? 1;
  const [groupCount, setGroupCount] = useState(initialGroups.length || suggested);
  const [groups, setGroups] = useState<string[][]>(initialGroups);
  const byId = new Map(teams.map((t) => [t.id, t]));

  const draw = (count = groupCount) => setGroups(drawGroups(teams.map((t) => t.id), count, randomSeed()));

  function move(teamId: string, toGroup: number) {
    setGroups((prev) => {
      const next = prev.map((group) => group.filter((id) => id !== teamId));
      next[toGroup]?.push(teamId);
      return next;
    });
  }

  const validation = groups.length > 0 ? validateGroups(teams.map((t) => t.id), groups) : null;

  function save() {
    startTransition(async () => {
      const result = await saveGroups({ tournamentId, groups });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Guardamos los grupos.");
      router.refresh();
    });
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Armar grupos</h2>
        </CardTitle>
        <CardDescription>
          Sorteá los {teams.length} equipos aprobados y, si querés, acomodalos a mano antes de confirmar. Se generan los
          partidos todos contra todos dentro de cada grupo.
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <div className="flex flex-col gap-3 sm:flex-row sm:items-end">
          <Field className="sm:w-48">
            <FieldLabel htmlFor="group-count">Cantidad de grupos</FieldLabel>
            <NativeSelect
              id="group-count"
              className="w-full"
              value={String(groupCount)}
              onChange={(e) => {
                const count = Number(e.target.value);
                setGroupCount(count);
                if (groups.length > 0) draw(count);
              }}
            >
              {options.map((count) => (
                <NativeSelectOption key={count} value={String(count)}>
                  {count} {count === 1 ? "grupo" : "grupos"} (~{Math.round(teams.length / count)} por grupo)
                </NativeSelectOption>
              ))}
            </NativeSelect>
          </Field>
          <Button type="button" variant="outline" onClick={() => draw()}>
            <Shuffle aria-hidden="true" />
            {groups.length > 0 ? "Volver a sortear" : "Sortear"}
          </Button>
        </div>

        {groups.length > 0 ? (
          <DragDropProvider
            onDragEnd={(event) => {
              if (event.canceled) return;
              const { source, target } = event.operation;
              const toGroup = typeof target?.id === "string" ? Number(target.id.replace("group-", "")) : NaN;
              if (source && Number.isInteger(toGroup)) move(String(source.id), toGroup);
            }}
          >
            <div className="grid gap-3 sm:grid-cols-2 xl:grid-cols-3">
              {groups.map((group, index) => (
                <GroupColumn
                  key={index}
                  index={index}
                  groupCount={groups.length}
                  onMove={move}
                  teams={group.map((id) => byId.get(id)).filter((t): t is Team => Boolean(t))}
                />
              ))}
            </div>
          </DragDropProvider>
        ) : null}

        {validation && !validation.ok ? (
          <ul className="list-disc space-y-1 pl-5 text-sm text-destructive" role="alert">
            {validation.errors.map((error) => (
              <li key={error}>{error}</li>
            ))}
          </ul>
        ) : null}

        {groups.length > 0 ? (
          <Button type="button" onClick={save} disabled={isPending || !validation?.ok}>
            {isPending ? <Spinner /> : null}
            Confirmar grupos y generar partidos
          </Button>
        ) : null}
      </CardContent>
    </Card>
  );
}
