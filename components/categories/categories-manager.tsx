"use client";

import { Check, Layers, Plus, Trash2, ArrowRight, Trophy } from "lucide-react";
import Link from "next/link";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  changeCategoryStatus,
  createCategory,
  deleteCategory,
} from "@/app/(app)/torneos/[id]/categorias/actions";
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
};

const CATEGORY_PRESETS = [
  "+10 Caballeros",
  "6ta Caballeros",
  "7ma Caballeros",
  "8va Damas",
  "4ta Femenino",
  "5ta Femenino",
  "Mixto A",
  "Mixto B",
];

export function CategoriesManager({ tournamentId, categories }: CategoriesManagerProps) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [name, setName] = useState("");
  const [maxTeams, setMaxTeams] = useState(16);
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
        maxTeams: Number(maxTeams),
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(res.message);
      setName("");
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
            <div className="grid gap-4 sm:grid-cols-[1fr_140px]">
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
                <FieldLabel htmlFor="category-max-teams">Cupo máx. parejas</FieldLabel>
                <Input
                  id="category-max-teams"
                  type="number"
                  min={2}
                  max={64}
                  value={maxTeams}
                  onChange={(e) => setMaxTeams(Number(e.target.value))}
                  disabled={isPending}
                />
              </Field>
            </div>

            {/* Atajos de categorías populares */}
            <div className="space-y-1.5">
              <span className="text-xs text-muted-foreground font-medium">Sugerencias rápidas:</span>
              <div className="flex flex-wrap gap-1.5">
                {CATEGORY_PRESETS.map((preset) => (
                  <button
                    key={preset}
                    type="button"
                    onClick={() => {
                      setName(preset);
                      if (nameError) setNameError(null);
                    }}
                    className="rounded-md border bg-muted/40 px-2 py-1 text-xs text-muted-foreground hover:bg-muted hover:text-foreground transition-colors"
                  >
                    + {preset}
                  </button>
                ))}
              </div>
            </div>

            <Button type="submit" disabled={isPending || name.trim().length < 2}>
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
            Cada categoría gestiona sus propias parejas inscriptas, sorteo de grupos y cuadro eliminatorio.
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
                      {cat.totalTeamsCount > cat.approvedTeamsCount ? ` (${cat.totalTeamsCount} inscriptas)` : ""} · Cupo de {cat.maxTeams} parejas
                    </p>
                  </div>

                  <div className="flex flex-wrap items-center gap-2">
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
                        <Button
                          size="sm"
                          variant="secondary"
                          onClick={() => handleStatusChange(cat.id, "playoffs")}
                          disabled={isPending}
                        >
                          Pasar a playoffs
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
    </div>
  );
}
