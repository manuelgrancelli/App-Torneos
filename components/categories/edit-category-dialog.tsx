"use client";

import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { updateCategory } from "@/app/(app)/torneos/[id]/categorias/actions";
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

type EditCategoryDialogProps = {
  tournamentId: string;
  category: {
    id: string;
    name: string;
    maxTeams: number;
    approvedTeamsCount: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

const CUPO_PRESETS = [4, 8, 12, 16, 24, 32];

export function EditCategoryDialog({
  tournamentId,
  category,
  open,
  onOpenChange,
}: EditCategoryDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(category.name);
  const [maxTeams, setMaxTeams] = useState(category.maxTeams);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(category.name);
    setMaxTeams(category.maxTeams);
    setError(null);
  }, [category, open]);

  const minAllowed = Math.max(2, category.approvedTeamsCount);

  function handleSubmit(e: React.FormEvent) {
    e.preventDefault();
    const trimmed = name.trim();
    if (trimmed.length < 2) {
      setError("El nombre debe tener al menos 2 caracteres.");
      return;
    }
    if (maxTeams < minAllowed) {
      setError(`El cupo no puede ser menor a las ${category.approvedTeamsCount} parejas ya aprobadas.`);
      return;
    }

    startTransition(async () => {
      const res = await updateCategory({
        tournamentId,
        categoryId: category.id,
        name: trimmed,
        maxTeams,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(res.message);
      onOpenChange(false);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={onOpenChange}>
      <DialogContent className="sm:max-w-md">
        <form onSubmit={handleSubmit} className="space-y-4">
          <DialogHeader>
            <DialogTitle>Editar categoría</DialogTitle>
            <DialogDescription>
              Modificá el nombre o el cupo máximo de parejas para esta categoría.
            </DialogDescription>
          </DialogHeader>

          <div className="space-y-4 py-2">
            <Field>
              <FieldLabel htmlFor="edit-cat-name">Nombre de la categoría</FieldLabel>
              <Input
                id="edit-cat-name"
                value={name}
                onChange={(e) => {
                  setName(e.target.value);
                  if (error) setError(null);
                }}
                disabled={isPending}
                required
              />
            </Field>

            <Field>
              <FieldLabel htmlFor="edit-cat-max-teams">Cupo máx. de parejas</FieldLabel>
              <Input
                id="edit-cat-max-teams"
                type="number"
                min={minAllowed}
                max={64}
                value={maxTeams}
                onChange={(e) => {
                  setMaxTeams(Number(e.target.value));
                  if (error) setError(null);
                }}
                disabled={isPending}
                required
              />
              <FieldDescription>
                {category.approvedTeamsCount > 0
                  ? `Mínimo ${minAllowed} parejas (ya hay ${category.approvedTeamsCount} aprobadas).`
                  : "Entre 2 y 64 parejas."}
              </FieldDescription>

              <div className="mt-2 flex flex-wrap items-center gap-1.5">
                <span className="text-xs text-muted-foreground font-semibold">Cupos habituales:</span>
                {CUPO_PRESETS.filter((p) => p >= minAllowed).map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => setMaxTeams(preset)}
                    className={`rounded-lg border px-2.5 py-0.5 text-xs transition-all duration-150 ${
                      maxTeams === preset
                        ? "border-emerald-500 bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 font-bold ring-1 ring-emerald-500/30"
                        : "border-border/80 bg-card text-muted-foreground hover:-translate-y-0.5 hover:border-emerald-500/40 hover:text-foreground"
                    }`}
                  >
                    {preset}
                  </button>
                ))}
              </div>
            </Field>

            {error ? <FieldError>{error}</FieldError> : null}
          </div>

          <DialogFooter className="gap-2 sm:gap-0">
            <Button
              type="button"
              variant="outline"
              onClick={() => onOpenChange(false)}
              disabled={isPending}
            >
              Cancelar
            </Button>
            <Button
              type="submit"
              disabled={isPending || name.trim().length < 2}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs hover:shadow-md hover:shadow-emerald-600/20 active:scale-[0.98] transition-all duration-150"
            >
              {isPending ? <Spinner /> : null}
              Guardar cambios
            </Button>
          </DialogFooter>
        </form>
      </DialogContent>
    </Dialog>
  );
}
