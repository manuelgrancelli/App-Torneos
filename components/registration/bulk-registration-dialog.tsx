"use client";

import { AlertCircle, CheckCircle2, ClipboardList, Info, Sparkles } from "lucide-react";
import { useRouter } from "next/navigation";
import { useId, useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { bulkImportTeams } from "@/app/(app)/torneos/[id]/inscripciones/actions";
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
import { Label } from "@/components/ui/label";
import { NativeSelect } from "@/components/ui/native-select";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { parseBulkRoster, type ExistingCategoryRef } from "@/lib/domain/roster-parser";

type BulkRegistrationDialogProps = {
  tournamentId: string;
  categories: { id: string; name: string }[];
  slotCount: number;
};

const SAMPLE_PLACEHOLDER = `*➡️ Suma 10 Caballeros*

1- Reynoso Luciano / Gimenez Alejandro
2- Gallo Brian / Kemmerer Hernán
3- Taulada Valentin / Taborda Fabricio

*➡️ 6ta Caballeros*

1- Ale Gonzalo / Grancelli Rodrigo
2- Wainz Leonardo / Zapata Oscar`;

export function BulkRegistrationDialog({
  tournamentId,
  categories,
  slotCount,
}: BulkRegistrationDialogProps) {
  const [open, setOpen] = useState(false);
  const [rawText, setRawText] = useState("");
  const [overrideCategoryMap, setOverrideCategoryMap] = useState<Record<string, string>>({});
  const [allSlots, setAllSlots] = useState(true);
  const [isPending, startTransition] = useTransition();
  const router = useRouter();
  const textareaId = useId();

  const existingCategoryRefs: ExistingCategoryRef[] = useMemo(
    () => categories.map((c) => ({ id: c.id, name: c.name })),
    [categories],
  );

  // Parseo en tiempo real
  const parsed = useMemo(() => {
    if (!rawText.trim()) return null;
    return parseBulkRoster(rawText, existingCategoryRefs);
  }, [rawText, existingCategoryRefs]);

  const totalTeams = parsed?.totalTeams ?? 0;

  function handleCategoryMappingChange(categoryName: string, categoryIdOrNew: string) {
    setOverrideCategoryMap((prev) => ({
      ...prev,
      [categoryName]: categoryIdOrNew,
    }));
  }

  function handleImport() {
    if (!parsed || parsed.categories.length === 0) return;

    const blocks = parsed.categories.map((block) => {
      const override = overrideCategoryMap[block.categoryName];
      let finalCategoryId: string | null = block.matchedCategoryId;

      if (override === "NEW") {
        finalCategoryId = null;
      } else if (override && override !== "AUTO") {
        finalCategoryId = override;
      }

      return {
        categoryName: block.categoryName,
        categoryId: finalCategoryId,
        teams: block.teams.map((t) => ({
          teamName: t.teamName,
          playerNames: t.playerNames,
        })),
      };
    });

    startTransition(async () => {
      const res = await bulkImportTeams({
        tournamentId,
        allSlots,
        blocks,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(res.message);
      setOpen(false);
      setRawText("");
      setOverrideCategoryMap({});
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button variant="outline" size="default" className="gap-2 border-primary/30 hover:border-primary/60">
          <ClipboardList className="size-4 text-primary" aria-hidden="true" />
          <span>Importar lista (WhatsApp)</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-2xl max-h-[90vh] overflow-y-auto">
        <DialogHeader>
          <div className="flex items-center gap-2">
            <div className="flex size-8 items-center justify-center rounded-lg bg-emerald-500/10 text-emerald-600 dark:text-emerald-400">
              <Sparkles className="size-4" aria-hidden="true" />
            </div>
            <DialogTitle>Importar lista de inscriptos</DialogTitle>
          </div>
          <DialogDescription>
            Pegá la lista de jugadores tal como la recibís por WhatsApp o mensajes. El sistema detecta automáticamente las categorías, limpia la numeración e inscribe a las parejas.
          </DialogDescription>
        </DialogHeader>

        <div className="space-y-4 py-2">
          {slotCount === 0 ? (
            <div className="flex items-start gap-2.5 rounded-xl border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-900 dark:text-amber-200">
              <AlertCircle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" aria-hidden="true" />
              <div>
                <p className="font-semibold">Atención: El torneo aún no tiene franjas horarias creadas.</p>
                <p className="text-muted-foreground mt-0.5">
                  Para que las parejas tengan disponibilidad y puedan programarse los partidos, se recomienda cargar al menos una franja en Canchas y franjas.
                </p>
              </div>
            </div>
          ) : null}

          <div className="space-y-2">
            <Label htmlFor={textareaId} className="text-xs font-semibold">
              Pegá el texto de la lista aquí:
            </Label>
            <Textarea
              id={textareaId}
              rows={8}
              value={rawText}
              onChange={(e) => setRawText(e.target.value)}
              placeholder={SAMPLE_PLACEHOLDER}
              className="font-mono text-xs leading-relaxed"
            />
          </div>

          {/* Previsualización en vivo */}
          {parsed && parsed.categories.length > 0 ? (
            <div className="space-y-3 rounded-xl border border-border/70 bg-muted/30 p-3.5">
              <div className="flex items-center justify-between border-b border-border/50 pb-2.5">
                <span className="text-xs font-semibold text-foreground flex items-center gap-1.5">
                  <CheckCircle2 className="size-3.5 text-emerald-600 dark:text-emerald-400" />
                  Previsualización detectada:
                </span>
                <span className="text-xs font-medium tabular-nums text-muted-foreground">
                  {totalTeams} {totalTeams === 1 ? "pareja" : "parejas"} en {parsed.categories.length} {parsed.categories.length === 1 ? "categoría" : "categorías"}
                </span>
              </div>

              <div className="space-y-3 max-h-60 overflow-y-auto pr-1">
                {parsed.categories.map((cat, idx) => {
                  const currentSelection = overrideCategoryMap[cat.categoryName] ?? (cat.matchedCategoryId ? "MATCHED" : "NEW");

                  return (
                    <div key={idx} className="rounded-lg border border-border/60 bg-card p-3 space-y-2 text-xs">
                      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2">
                        <div className="flex items-center gap-2">
                          <span className="font-semibold text-foreground text-sm">
                            {cat.categoryName}
                          </span>
                          <Badge variant="secondary" className="text-[11px] font-medium">
                            {cat.teams.length} {cat.teams.length === 1 ? "pareja" : "parejas"}
                          </Badge>
                        </div>

                        {/* Selector de asignación de categoría */}
                        <div className="flex items-center gap-2 w-full sm:w-auto">
                          <span className="text-muted-foreground text-[11px] whitespace-nowrap">Asignar a:</span>
                          <NativeSelect
                            value={
                              currentSelection === "NEW"
                                ? "NEW"
                                : currentSelection === "MATCHED"
                                  ? (cat.matchedCategoryId ?? "NEW")
                                  : currentSelection
                            }
                            onChange={(e) => handleCategoryMappingChange(cat.categoryName, e.target.value)}
                            className="h-8 text-xs py-0"
                          >
                            <option value="NEW">➕ Crear categoría &quot;{cat.categoryName}&quot;</option>
                            {categories.map((c) => (
                              <option key={c.id} value={c.id}>
                                Asociar a &quot;{c.name}&quot;
                              </option>
                            ))}
                          </NativeSelect>
                        </div>
                      </div>

                      {/* Lista resumida de parejas */}
                      <div className="text-[11px] text-muted-foreground space-y-1 bg-muted/30 p-2 rounded border border-border/40">
                        {cat.teams.map((team, tIdx) => (
                          <div key={tIdx} className="flex items-center gap-1.5 truncate">
                            <span className="text-foreground/70 w-5 tabular-nums text-right shrink-0">{tIdx + 1}.</span>
                            <span className="text-foreground font-medium truncate">{team.teamName}</span>
                          </div>
                        ))}
                      </div>
                    </div>
                  );
                })}
              </div>

              {parsed.ignoredLines.length > 0 ? (
                <p className="text-[11px] text-muted-foreground flex items-center gap-1 pt-1">
                  <Info className="size-3.5 shrink-0" />
                  <span>
                    Se omitieron {parsed.ignoredLines.length} líneas que no correspondían a nombres (fechas o renglones vacíos).
                  </span>
                </p>
              ) : null}
            </div>
          ) : rawText.trim() ? (
            <div className="rounded-xl border border-destructive/30 bg-destructive/5 p-3 text-xs text-destructive flex items-center gap-2">
              <AlertCircle className="size-4 shrink-0" />
              <span>No se pudieron identificar parejas válidas. Asegurate de que cada pareja tenga dos nombres separados por barra ( / ), guion ( - ) o &quot;y&quot;.</span>
            </div>
          ) : null}

          {/* Opciones de disponibilidad horaria */}
          <div className="rounded-xl border border-border/70 bg-muted/20 p-3 space-y-2">
            <div className="flex items-start gap-2.5">
              <input
                type="checkbox"
                id="allSlotsCheckbox"
                checked={allSlots}
                onChange={(e) => setAllSlots(e.target.checked)}
                className="mt-0.5 size-4 rounded border-border text-primary focus:ring-primary cursor-pointer"
              />
              <div className="space-y-0.5">
                <Label htmlFor="allSlotsCheckbox" className="text-xs font-semibold text-foreground cursor-pointer">
                  Asignar disponibilidad completa a todas las parejas importadas (predeterminado)
                </Label>
                <p className="text-[11px] text-muted-foreground leading-relaxed">
                  {allSlots
                    ? "Las parejas quedarán habilitadas para jugar en cualquier día y franja horaria del torneo."
                    : "Las parejas se importarán sin disponibilidad asignada. Luego podrás definir las franjas horarias de cada pareja una por una en la lista de inscriptos."}
                </p>
              </div>
            </div>
          </div>
        </div>

        <DialogFooter className="flex-col sm:flex-row gap-2">
          <Button
            type="button"
            variant="outline"
            onClick={() => setOpen(false)}
            disabled={isPending}
            size="default"
          >
            Cancelar
          </Button>

          <Button
            type="button"
            onClick={handleImport}
            disabled={isPending || totalTeams === 0}
            size="default"
            className="gap-2"
          >
            {isPending ? <Spinner className="size-4" /> : null}
            <span>
              {totalTeams > 0
                ? `Inscribir ${totalTeams} ${totalTeams === 1 ? "pareja" : "parejas"}`
                : "Importar parejas"}
            </span>
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
