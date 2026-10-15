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
    maxTeams: number | null;
    approvedTeamsCount: number;
  };
  open: boolean;
  onOpenChange: (open: boolean) => void;
};

export function EditCategoryDialog({
  tournamentId,
  category,
  open,
  onOpenChange,
}: EditCategoryDialogProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState(category.name);
  const [isUnlimited, setIsUnlimited] = useState(category.maxTeams === null);
  const [maxTeams, setMaxTeams] = useState<number>(category.maxTeams ?? 16);
  const [error, setError] = useState<string | null>(null);

  useEffect(() => {
    setName(category.name);
    setIsUnlimited(category.maxTeams === null);
    setMaxTeams(category.maxTeams ?? 16);
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
    if (!isUnlimited && maxTeams < minAllowed) {
      setError(`El cupo no puede ser menor a las ${category.approvedTeamsCount} parejas ya aprobadas.`);
      return;
    }

    startTransition(async () => {
      const res = await updateCategory({
        tournamentId,
        categoryId: category.id,
        name: trimmed,
        maxTeams: isUnlimited ? null : maxTeams,
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
              Modificá el nombre o el cupo de parejas para esta categoría.
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
              <div className="flex items-center justify-between">
                <FieldLabel htmlFor="edit-cat-max-teams">Cupo de parejas</FieldLabel>
                {isUnlimited ? (
                  <span className="text-[11px] font-semibold text-emerald-600 dark:text-emerald-400">
                    Sin límite
                  </span>
                ) : null}
              </div>

              {isUnlimited ? (
                <div className="flex h-9 w-full items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                  <span className="flex items-center gap-1.5 font-semibold truncate">
                    <span>♾️</span> Hasta cerrar inscripción
                  </span>
                  <button
                    type="button"
                    onClick={() => {
                      setIsUnlimited(false);
                      setMaxTeams(Math.max(16, minAllowed));
                    }}
                    className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 underline hover:text-emerald-700 dark:hover:text-emerald-200 ml-1 shrink-0"
                  >
                    Fijar número
                  </button>
                </div>
              ) : (
                <div className="flex items-center gap-1.5">
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
                  <button
                    type="button"
                    onClick={() => setIsUnlimited(true)}
                    className="h-9 shrink-0 rounded-md border border-border/80 bg-muted/40 px-2.5 text-xs font-medium text-muted-foreground hover:bg-muted hover:text-foreground transition-colors whitespace-nowrap"
                    title="Sin límite: la inscripción queda abierta hasta que decidas cerrarla"
                  >
                    ♾️ Sin límite
                  </button>
                </div>
              )}

              <FieldDescription>
                {isUnlimited
                  ? "Las parejas se podrán inscribir libremente hasta que cierres la inscripción del torneo o de la categoría."
                  : category.approvedTeamsCount > 0
                    ? `Mínimo ${minAllowed} parejas (ya hay ${category.approvedTeamsCount} aprobadas).`
                    : "Entre 2 y 64 parejas."}
              </FieldDescription>
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
