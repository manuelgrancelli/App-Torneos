"use client";

import { Check, Layers, Pencil, Plus, Trash2, ArrowRight, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  changeCategoryStatus,
  createCategory,
  deleteCategory,
} from "@/app/(app)/torneos/[id]/categorias/actions";
import { EditCategoryDialog } from "@/components/categories/edit-category-dialog";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { EmptyState } from "@/components/shared/empty-state";
import { StatusBadge } from "@/components/tournaments/status-badge";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { TournamentCategory } from "@/lib/data/categories";
import type { TournamentStatus } from "@/lib/domain/tournament-status";

type CategoriesManagerProps = {
  tournamentId: string;
  categories: TournamentCategory[];
  inSetup?: boolean;
};

export function CategoriesManager({ tournamentId, categories, inSetup = false }: CategoriesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [isUnlimited, setIsUnlimited] = useState(false);
  const [maxTeams, setMaxTeams] = useState<number | null>(16);
  const [editingCategory, setEditingCategory] = useState<TournamentCategory | null>(null);
  const [nameError, setNameError] = useState<string | null>(null);

  function handleCreate(e: React.FormEvent) {
    e.preventDefault();
    if (name.trim().length < 2) {
      setNameError("El nombre debe tener al menos 2 caracteres.");
      return;
    }
    setNameError(null);

    startTransition(async () => {
      const res = await createCategory({
        tournamentId,
        name: name.trim(),
        maxTeams: isUnlimited ? null : (maxTeams ? Number(maxTeams) : null),
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(res.message);
      setName("");
      setIsUnlimited(false);
      setMaxTeams(16);
      router.refresh();
    });
  }

  function handleStatusChange(categoryId: string, status: TournamentStatus) {
    startTransition(async () => {
      const res = await changeCategoryStatus({
        tournamentId,
        categoryId,
        status,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(res.message);
      router.refresh();
    });
  }

  async function handleDelete(categoryId: string): Promise<boolean | void> {
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
    <div className="space-y-6">
      {/* Formulario para agregar nueva categoría */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">Agregar categoría</h2>
          </CardTitle>
          <CardDescription>
            Sumá las categorías que se jugarán en este torneo (ej. 6ta Caballeros, 4ta Femenino, 8va Damas).
            Todas compartirán las canchas y horarios del torneo, con sorteos y tablas independientes.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <form onSubmit={handleCreate} className="space-y-4">
            <div className="grid gap-4 sm:grid-cols-[1fr_210px]">
              <Field>
                <FieldLabel htmlFor="category-name">Nombre de la categoría</FieldLabel>
                <Input
                  id="category-name"
                  placeholder="ej. 6ta Caballeros, 8va Damas…"
                  value={name}
                  onChange={(e) => {
                    setName(e.target.value);
                    if (nameError) setNameError(null);
                  }}
                  disabled={isPending}
                />
                {nameError ? <FieldError>{nameError}</FieldError> : null}
              </Field>

              <Field>
                <FieldLabel htmlFor="category-max-teams">Cupo de parejas</FieldLabel>
                {isUnlimited ? (
                  <div className="flex h-9 w-full items-center justify-between rounded-md border border-emerald-500/40 bg-emerald-500/10 px-2.5 py-1 text-xs text-emerald-700 dark:text-emerald-300">
                    <span className="font-semibold truncate">♾️ Hasta cerrar</span>
                    <button
                      type="button"
                      onClick={() => {
                        setIsUnlimited(false);
                        setMaxTeams(16);
                      }}
                      className="text-xs font-semibold text-emerald-600 dark:text-emerald-400 underline hover:text-emerald-700 dark:hover:text-emerald-200 ml-1 shrink-0"
                    >
                      Fijar número
                    </button>
                  </div>
                ) : (
                  <div className="flex items-center gap-1.5">
                    <Input
                      id="category-max-teams"
                      type="number"
                      min={2}
                      max={64}
                      value={maxTeams ?? 16}
                      onChange={(e) => {
                        const val = Number(e.target.value);
                        setMaxTeams(val > 0 ? val : 2);
                        setIsUnlimited(false);
                      }}
                      disabled={isPending}
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
              </Field>
            </div>

            <Button
              type="submit"
              disabled={isPending || name.trim().length < 2}
              className="bg-emerald-600 hover:bg-emerald-500 text-white font-semibold shadow-xs hover:shadow-md hover:shadow-emerald-600/20 active:scale-[0.98] transition-all duration-150"
            >
              {isPending ? <Spinner /> : <Plus className="size-4" />}
              Agregar categoría
            </Button>
          </form>
        </CardContent>
      </Card>

      {/* Lista de categorías existentes */}
      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">Categorías del torneo ({categories.length})</h2>
          </CardTitle>
          <CardDescription>
            Cada categoría gestiona sus propias parejas inscriptas, cupos máximos, sorteo de grupos y cuadro eliminatorio.
          </CardDescription>
        </CardHeader>
        <CardContent>
          {categories.length === 0 ? (
            <EmptyState
              icon={Layers}
              title="Todavía no agregaste categorías"
              description="Podés crear categorías arriba (ej. Caballeros, Damas, Mixto) para organizar un torneo integrado."
            />
          ) : (
            <ul className="divide-y rounded-lg border">
              {categories.map((cat) => (
                <li key={cat.id} className="flex flex-col gap-3 p-4 sm:flex-row sm:items-center sm:justify-between">
                  <div className="space-y-1 min-w-0 flex-1">
                    <div className="flex flex-wrap items-center gap-2">
                      <span className="font-semibold text-base">{cat.name}</span>
                      <StatusBadge status={cat.status} />
                    </div>
                    <p className="text-sm text-muted-foreground">
                      {cat.approvedTeamsCount} {cat.approvedTeamsCount === 1 ? "pareja aprobada" : "parejas aprobadas"}
                      {cat.totalTeamsCount > cat.approvedTeamsCount ? ` (${cat.totalTeamsCount} inscriptas)` : ""} ·{" "}
                      {cat.maxTeams !== null ? `Cupo de ${cat.maxTeams} parejas` : "Hasta cerrar inscripción (sin límite)"}
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
                    {/* Botón de editar categoría y cupo */}
                    <Button
                      size="icon-sm"
                      variant="ghost"
                      onClick={() => setEditingCategory(cat)}
                      disabled={isPending}
                      aria-label={`Editar ${cat.name}`}
                      title="Editar nombre y cupo máximo"
                    >
                      <Pencil className="size-4 text-muted-foreground hover:text-foreground" />
                    </Button>

                    {/* Botones de acción rápida por estado */}
                    {cat.status === "registration_open" ? (
                      <Button
                        size="sm"
                        variant="outline"
                        onClick={() => handleStatusChange(cat.id, "group_stage")}
                        disabled={isPending || cat.approvedTeamsCount < 2}
                        title={cat.approvedTeamsCount < 2 ? "Se necesitan al menos 2 parejas aprobadas" : undefined}
                      >
                        Iniciar grupos
                        <ArrowRight className="size-3.5 ml-1" />
                      </Button>
                    ) : null}

                    {cat.status === "group_stage" ? (
                      <>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/torneos/${tournamentId}/grupos?cat=${cat.id}`}>
                            Ver grupos
                            <ArrowRight className="size-3.5 ml-1" />
                          </Link>
                        </Button>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/torneos/${tournamentId}/cuadro?cat=${cat.id}`}>
                            Ver cuadro
                            <ArrowRight className="size-3.5 ml-1" />
                          </Link>
                        </Button>
                      </>
                    ) : null}

                    {cat.status === "playoffs" ? (
                      <>
                        <Button size="sm" variant="outline" asChild>
                          <Link href={`/torneos/${tournamentId}/cuadro?cat=${cat.id}`}>
                            Ver cuadro
                            <ArrowRight className="size-3.5 ml-1" />
                          </Link>
                        </Button>
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStatusChange(cat.id, "finished")}
                          disabled={isPending}
                        >
                          <Trophy className="size-3.5 mr-1" />
                          Finalizar categoría
                        </Button>
                      </>
                    ) : null}

                    {cat.status === "finished" ? (
                      <Badge variant="secondary" className="gap-1 bg-emerald-100 text-emerald-900 dark:bg-emerald-950/40 dark:text-emerald-200">
                        <Check className="size-3" />
                        Finalizada
                      </Badge>
                    ) : null}

                    <ConfirmActionButton
                      title={`¿Eliminar la categoría "${cat.name}"?`}
                      description="Se borrará la categoría si no tiene partidos con resultados cargados."
                      confirmLabel="Eliminar"
                      destructive
                      variant="ghost"
                      size="icon-sm"
                      aria-label={`Eliminar ${cat.name}`}
                      onConfirm={() => handleDelete(cat.id)}
                      disabled={isPending}
                    >
                      <Trash2 className="size-4 text-destructive" />
                    </ConfirmActionButton>
                  </div>
                </li>
              ))}
            </ul>
          )}
        </CardContent>
      </Card>

      {editingCategory ? (
        <EditCategoryDialog
          tournamentId={tournamentId}
          category={editingCategory}
          open={Boolean(editingCategory)}
          onOpenChange={(open) => {
            if (!open) setEditingCategory(null);
          }}
        />
      ) : null}

      {inSetup ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-primary/20 bg-muted/40 p-4">
          <div className="space-y-0.5">
            <p className="text-sm font-semibold text-foreground">¿Listo con las categorías?</p>
            <p className="text-xs text-muted-foreground">
              {categories.length > 0
                ? "Excelente. Ahora vamos a configurar las canchas y los turnos de juego."
                : "Podés continuar sin subdivisiones si tu torneo se disputa con categoría única general."}
            </p>
          </div>
          <Button asChild size="default" className="w-full sm:w-auto shrink-0 shadow-xs">
            <Link href={`/torneos/${tournamentId}/canchas-franjas?asistente=1`}>
              <span>Siguiente paso: Franjas horarias</span>
              <ArrowRight className="size-4 ml-1.5" />
            </Link>
          </Button>
        </div>
      ) : null}
    </div>
  );
}
