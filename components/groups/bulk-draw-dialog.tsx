"use client";

import { AlertCircle, CheckCircle2, Dices, HelpCircle, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { drawAllCategories } from "@/app/(app)/torneos/[id]/grupos/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { NativeSelect, NativeSelectOption } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { groupCountOptions, groupName } from "@/lib/domain/groups";
import { cn } from "@/lib/utils";

export type CategoryForBulkDraw = {
  id: string;
  name: string;
  approvedCount: number;
  hasResults: boolean;
  existingGroupsCount: number;
  status: string;
};

type BulkDrawDialogProps = {
  tournamentId: string;
  categories: CategoryForBulkDraw[];
};

export function BulkDrawDialog({ tournamentId, categories }: BulkDrawDialogProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [isPending, startTransition] = useTransition();

  // Inicializar configuraciones sugeridas de grupos por categoría
  const defaultConfigs = useMemo(() => {
    const map: Record<string, number> = {};
    for (const cat of categories) {
      if (cat.approvedCount >= 2 && !cat.hasResults) {
        const options = groupCountOptions(cat.approvedCount);
        const suggested =
          options.find((count) => cat.approvedCount / count <= 4) ??
          options.find((count) => cat.approvedCount / count <= 5) ??
          options[options.length - 1] ??
          1;
        map[cat.id] = cat.existingGroupsCount > 0 && options.includes(cat.existingGroupsCount)
          ? cat.existingGroupsCount
          : suggested;
      }
    }
    return map;
  }, [categories]);

  const [selectedCounts, setSelectedCounts] = useState<Record<string, number>>(defaultConfigs);

  // Al abrir el diálogo, refrescar valores
  function handleOpenChange(nextOpen: boolean) {
    if (nextOpen) {
      setSelectedCounts(defaultConfigs);
    }
    setOpen(nextOpen);
  }

  function handleGroupCountChange(catId: string, count: number) {
    setSelectedCounts((prev) => ({
      ...prev,
      [catId]: count,
    }));
  }

  const isCategoryLocked = (c: CategoryForBulkDraw) =>
    c.hasResults || c.status === "playoffs" || c.status === "finished";

  const eligibleCategories = categories.filter(
    (c) => c.approvedCount >= 2 && !isCategoryLocked(c),
  );
  const blockedByResults = categories.filter((c) => isCategoryLocked(c));
  const blockedByCount = categories.filter((c) => c.approvedCount < 2 && !isCategoryLocked(c));

  function onSubmit() {
    startTransition(async () => {
      const categoryConfigs = eligibleCategories.map((c) => ({
        categoryId: c.id,
        groupCount: selectedCounts[c.id] ?? defaultConfigs[c.id] ?? 1,
      }));

      const result = await drawAllCategories({
        tournamentId,
        categoryConfigs,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success(result.message ?? "Grupos sorteados con éxito.");
      setOpen(false);
      router.refresh();
    });
  }

  if (categories.length <= 1 || eligibleCategories.length === 0) {
    return null;
  }

  return (
    <Dialog open={open} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-2 border-primary/30 bg-primary/5 hover:bg-primary/10 text-primary font-medium"
        >
          <Dices className="size-4 shrink-0 text-primary" aria-hidden="true" />
          <span>Sortear todas las categorías</span>
        </Button>
      </DialogTrigger>
      <DialogContent className="max-w-2xl max-h-[90vh] flex flex-col p-0 gap-0 overflow-hidden">
        {/* Cabecera */}
        <DialogHeader className="p-5 pb-3 border-b border-border/60 bg-muted/20">
          <div className="flex items-center gap-2.5">
            <div className="flex size-9 shrink-0 items-center justify-center rounded-xl bg-primary/10 text-primary">
              <Dices className="size-5" aria-hidden="true" />
            </div>
            <div>
              <DialogTitle className="text-base font-semibold">
                Sortear todas las categorías
              </DialogTitle>
              <DialogDescription className="text-xs text-muted-foreground mt-0.5">
                Arma los grupos de todas las categorías optimizando la compatibilidad horaria para ocupar la mayor cantidad de canchas en los partidos.
              </DialogDescription>
            </div>
          </div>
        </DialogHeader>

        {/* Contenido scrolleable */}
        <div className="flex-1 overflow-y-auto p-5 space-y-4">
          {/* Banner de optimización */}
          <div className="flex items-start gap-3 rounded-xl border border-primary/20 bg-primary/5 p-3.5 text-xs text-muted-foreground">
            <Sparkles className="size-4 shrink-0 text-primary mt-0.5" />
            <div className="space-y-1">
              <p className="font-semibold text-foreground">
                Optimización horaria intrazona
              </p>
              <p>
                El sorteo analiza las franjas horarias de disponibilidad de cada pareja para evitar agrupar rivales que no coincidan en ningún horario. Luego, en la sección <strong>Partidos</strong>, la programación automática distribuirá los cruces de todas las categorías aprovechando todas las canchas disponibles.
              </p>
            </div>
          </div>

          {/* Listado de categorías */}
          <div className="space-y-2">
            <h3 className="text-xs font-semibold text-muted-foreground uppercase tracking-wider">
              Categorías ({categories.length})
            </h3>

            <div className="divide-y divide-border/60 rounded-xl border border-border/70 overflow-hidden bg-card">
              {categories.map((cat) => {
                const isEligible = cat.approvedCount >= 2 && !cat.hasResults;
                const options = isEligible ? groupCountOptions(cat.approvedCount) : [];
                const currentCount = selectedCounts[cat.id] ?? defaultConfigs[cat.id] ?? 1;

                return (
                  <div
                    key={cat.id}
                    className={cn(
                      "p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3 transition-colors",
                      !isEligible && "bg-muted/30 opacity-75",
                    )}
                  >
                    <div className="space-y-1 min-w-0">
                      <div className="flex items-center gap-2">
                        <span className="font-semibold text-sm text-foreground truncate">
                          {cat.name}
                        </span>
                        {cat.hasResults ? (
                          <Badge variant="outline" className="text-[10px] bg-muted text-muted-foreground border-border/80">
                            Con resultados cargados
                          </Badge>
                        ) : cat.approvedCount < 2 ? (
                          <Badge variant="outline" className="text-[10px] border-amber-300 text-amber-700 bg-amber-50 dark:border-amber-800 dark:bg-amber-950/40 dark:text-amber-300">
                            Menos de 2 parejas
                          </Badge>
                        ) : cat.existingGroupsCount > 0 ? (
                          <Badge variant="outline" className="text-[10px] border-primary/30 text-primary bg-primary/5">
                            {cat.existingGroupsCount} {cat.existingGroupsCount === 1 ? "grupo actual" : "grupos actuales"}
                          </Badge>
                        ) : (
                          <Badge variant="outline" className="text-[10px] border-emerald-300 text-emerald-700 bg-emerald-50 dark:border-emerald-800 dark:bg-emerald-950/40 dark:text-emerald-300">
                            Pendiente de sorteo
                          </Badge>
                        )}
                      </div>
                      <p className="text-xs text-muted-foreground">
                        {cat.approvedCount} {cat.approvedCount === 1 ? "pareja aprobada" : "parejas aprobadas"}
                        {isEligible && (
                          <span className="text-muted-foreground">
                            {" "}· {Math.floor(cat.approvedCount / currentCount)} a {Math.ceil(cat.approvedCount / currentCount)} por grupo
                          </span>
                        )}
                      </p>
                    </div>

                    {isEligible ? (
                      <div className="flex items-center gap-2 shrink-0">
                        <label htmlFor={`group-count-${cat.id}`} className="text-xs font-medium text-muted-foreground">
                          Zonas:
                        </label>
                        <NativeSelect
                          id={`group-count-${cat.id}`}
                          size="sm"
                          value={String(currentCount)}
                          onChange={(e) => handleGroupCountChange(cat.id, Number(e.target.value))}
                          className="w-32 text-xs"
                          aria-label={`Cantidad de grupos para ${cat.name}`}
                        >
                          {options.map((opt) => (
                            <NativeSelectOption key={opt} value={String(opt)}>
                              {opt} {opt === 1 ? "grupo" : "grupos"}
                            </NativeSelectOption>
                          ))}
                        </NativeSelect>
                      </div>
                    ) : (
                      <div className="text-xs text-muted-foreground italic shrink-0">
                        {cat.hasResults ? "Se mantendrán los grupos actuales" : "Se omitirá del sorteo"}
                      </div>
                    )}
                  </div>
                );
              })}
            </div>
          </div>

          {/* Advertencia si hay categorías bloqueadas */}
          {blockedByResults.length > 0 ? (
            <p className="text-xs text-muted-foreground flex items-center gap-1.5">
              <AlertCircle className="size-3.5 text-muted-foreground shrink-0" />
              Las categorías con partidos jugados o resultados cargados no se modificarán para preservar su progreso.
            </p>
          ) : null}
        </div>

        {/* Pie de diálogo */}
        <DialogFooter className="p-4 border-t border-border/60 bg-muted/10 gap-2 sm:gap-0">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
          >
            Cancelar
          </Button>
          <Button
            type="button"
            onClick={onSubmit}
            disabled={isPending || eligibleCategories.length === 0}
            className="gap-2"
          >
            {isPending ? <Spinner /> : <Dices className="size-4" />}
            {isPending
              ? "Sorteando y distribuyendo grupos…"
              : eligibleCategories.length > 0
                ? `Sortear ${eligibleCategories.length} ${eligibleCategories.length === 1 ? "categoría" : "categorías"}`
                : "No hay categorías elegibles"}
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
