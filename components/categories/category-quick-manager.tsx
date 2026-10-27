"use client";

import { Layers, Pencil, Plus, Trash2 } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { createCategory, deleteCategory } from "@/app/(app)/torneos/[id]/categorias/actions";
import { EditCategoryDialog } from "@/components/categories/edit-category-dialog";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
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
import { Spinner } from "@/components/ui/spinner";
import type { TournamentCategory } from "@/lib/data/categories";

type CategoryQuickManagerProps = {
  tournamentId: string;
  categories: TournamentCategory[];
  teamCountsByCategory?: Record<string, number>;
  canEdit?: boolean;
};

export function CategoryQuickManager({
  tournamentId,
  categories,
  teamCountsByCategory = {},
  canEdit = true,
}: CategoryQuickManagerProps) {
  const router = useRouter();
  const [isAddOpen, setIsAddOpen] = useState(false);
  const [editingCategory, setEditingCategory] = useState<TournamentCategory | null>(null);

  // Estado para crear categoría
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [isUnlimited, setIsUnlimited] = useState(true);
  const [maxTeams, setMaxTeams] = useState<number | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setNameError("El nombre debe tener al menos 2 caracteres.");
      return;
    }
    setNameError(null);

    startTransition(async () => {
      const res = await createCategory({
        tournamentId,
        name: trimmed,
        maxTeams: isUnlimited ? null : (maxTeams ? Number(maxTeams) : null),
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(res.message);
      setName("");
      setIsUnlimited(true);
      setMaxTeams(null);
      setIsAddOpen(false);
      router.refresh();
    });
  }

  async function handleDelete(categoryId: string) {
    const res = await deleteCategory({
      tournamentId,
      categoryId,
    });

    if (!res.ok) {
      toast.error(res.error);
      return false;
    }

    toast.success(res.message);
    router.refresh();
  }

  return (
    <>
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 rounded-xl border border-border/80 bg-card p-3 shadow-xs">
        <div className="flex flex-wrap items-center gap-2 min-w-0">
          <div className="flex items-center gap-1.5 text-xs font-semibold text-foreground mr-1 shrink-0">
            <Layers className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>Categorías:</span>
          </div>

          {categories.length === 0 ? (
            <span className="text-xs text-muted-foreground">
              Sin categorías específicas aún (podés crearlas con el botón verde).
            </span>
          ) : (
            <div className="flex flex-wrap items-center gap-1.5">
              {categories.map((cat) => {
                const count = teamCountsByCategory[cat.id] ?? 0;
                return (
                  <div
                    key={cat.id}
                    className="group/chip inline-flex items-center gap-1.5 rounded-lg border border-border/70 bg-muted/40 px-2.5 py-1 text-xs transition-colors hover:border-emerald-500/40"
                  >
                    <span className="font-semibold text-foreground">{cat.name}</span>
                    <span className="text-[11px] text-muted-foreground">
                      ({count} {cat.maxTeams ? `/ ${cat.maxTeams}` : "libre"})
                    </span>

                    {canEdit ? (
                      <div className="flex items-center gap-0.5 ml-0.5">
                        <button
                          type="button"
                          onClick={() => setEditingCategory(cat)}
                          className="rounded p-0.5 text-muted-foreground hover:bg-muted hover:text-foreground transition-colors cursor-pointer"
                          title="Editar categoría"
                          aria-label={`Editar categoría ${cat.name}`}
                        >
                          <Pencil className="size-3" />
                        </button>

                        <ConfirmActionButton
                          title={`¿Eliminar categoría "${cat.name}"?`}
                          description="Si hay parejas asignadas, quedarán sin categoría pero no se borrarán."
                          confirmLabel="Eliminar categoría"
                          onConfirm={() => handleDelete(cat.id)}
                          className="rounded p-0.5 text-muted-foreground hover:bg-destructive/10 hover:text-destructive transition-colors cursor-pointer"
                          aria-label={`Eliminar categoría ${cat.name}`}
                        >
                          <Trash2 className="size-3" />
                        </ConfirmActionButton>
                      </div>
                    ) : null}
                  </div>
                );
              })}
            </div>
          )}
        </div>

        {canEdit ? (
          <Button
            type="button"
            size="sm"
            onClick={() => {
              setName("");
              setNameError(null);
              setIsUnlimited(false);
              setMaxTeams(16);
              setIsAddOpen(true);
            }}
            className="shrink-0 h-8 font-semibold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs hover:shadow-md hover:shadow-emerald-600/20 active:scale-[0.98] transition-all duration-150"
          >
            <Plus className="size-3.5 mr-1" aria-hidden="true" />
            <span>Agregar categoría</span>
          </Button>
        ) : null}
      </div>

      {/* Modal para agregar categoría */}
      <Dialog open={isAddOpen} onOpenChange={setIsAddOpen}>
        <DialogContent className="sm:max-w-md">
          <form onSubmit={handleCreate} className="space-y-4">
            <DialogHeader>
              <DialogTitle className="flex items-center gap-2">
                <Layers className="size-5 text-emerald-600 dark:text-emerald-400" />
                <span>Agregar categoría</span>
              </DialogTitle>
              <DialogDescription>
                Definí una nueva categoría para este torneo (ej. 6ta Caballeros, 7ma Damas, Suma 11).
              </DialogDescription>
            </DialogHeader>

            <div className="space-y-3 py-2">
              <Field>
                <FieldLabel htmlFor="new-category-name">Nombre de la categoría</FieldLabel>
                <Input
                  id="new-category-name"
                  placeholder="Ej: 6ta Caballeros"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  autoFocus
                  required
                />
                {nameError ? <FieldError>{nameError}</FieldError> : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="new-category-max-teams">Cupo de parejas</FieldLabel>
                <div className="space-y-2">
                  <Input
                    id="new-category-max-teams"
                    type="number"
                    min={2}
                    max={128}
                    value={isUnlimited ? "" : (maxTeams ?? "")}
                    disabled={isUnlimited}
                    onChange={(e) => setMaxTeams(e.target.value ? Number(e.target.value) : null)}
                    placeholder={isUnlimited ? "Sin límite" : "ej. 16"}
                  />
                  <label className="flex items-center gap-2 text-xs text-muted-foreground cursor-pointer select-none">
                    <input
                      type="checkbox"
                      checked={isUnlimited}
                      onChange={(e) => {
                        setIsUnlimited(e.target.checked);
                        if (e.target.checked) setMaxTeams(null);
                      }}
                      className="size-4 rounded border-border text-emerald-600 focus:ring-emerald-500"
                    />
                    <span>Sin límite de cupo (inscripción abierta/libre)</span>
                  </label>
                </div>
                <FieldDescription>
                  Cantidad máxima de parejas que pueden anotarse antes de quedar en lista de espera.
                </FieldDescription>
              </Field>
            </div>

            <DialogFooter className="gap-2 sm:gap-0">
              <Button
                type="button"
                variant="outline"
                onClick={() => setIsAddOpen(false)}
                disabled={isPending}
              >
                Cancelar
              </Button>
              <Button
                type="submit"
                disabled={isPending || name.trim().length < 2}
                className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold"
              >
                {isPending ? <Spinner className="size-4 mr-1.5" /> : null}
                <span>Crear categoría</span>
              </Button>
            </DialogFooter>
          </form>
        </DialogContent>
      </Dialog>

      {/* Modal para editar categoría */}
      {editingCategory ? (
        <EditCategoryDialog
          tournamentId={tournamentId}
          category={{
            id: editingCategory.id,
            name: editingCategory.name,
            maxTeams: editingCategory.maxTeams,
            approvedTeamsCount: teamCountsByCategory[editingCategory.id] ?? 0,
          }}
          open={Boolean(editingCategory)}
          onOpenChange={(open) => {
            if (!open) setEditingCategory(null);
          }}
        />
      ) : null}
    </>
  );
}
