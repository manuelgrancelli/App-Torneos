"use client";

import { Check, Copy, Download, Image as ImageIcon, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
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
import { Spinner } from "@/components/ui/spinner";
import { formatDayHeading, localDateKey } from "@/lib/dates";
import {
  type MatchExportData,
  renderMatchesToCanvas,
} from "@/lib/graphics/matches-image";
import { cn } from "@/lib/utils";
import { slugify } from "@/lib/utils/slug";

export type ExportMatchesImageModalProps = {
  tournamentName: string;
  categoryName?: string | null;
  sportName?: string | null;
  timezone: string;
  matches: MatchExportData[];
  variant?: "outline" | "default" | "secondary";
  size?: "default" | "sm" | "lg";
  buttonText?: string;
  className?: string;
};

export function ExportMatchesImageModal({
  tournamentName,
  categoryName: initialCategoryName,
  sportName,
  timezone,
  matches,
  variant = "outline",
  size = "default",
  buttonText = "Descargar",
  className,
}: ExportMatchesImageModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  // Filtros internos en el modal para máxima comodidad del organizador
  const availableCategories = useMemo(() => {
    return Array.from(
      new Set(matches.map((m) => m.categoryName).filter((c): c is string => Boolean(c))),
    );
  }, [matches]);

  const [selectedCategory, setSelectedCategory] = useState<string>(
    initialCategoryName ?? "all",
  );

  const availableDays = useMemo(() => {
    const days = new Set<string>();
    let hasUnscheduled = false;
    for (const m of matches) {
      if (m.startsAt) {
        days.add(localDateKey(m.startsAt, timezone));
      } else {
        hasUnscheduled = true;
      }
    }
    const sortedDays = Array.from(days).sort();
    return {
      days: sortedDays,
      hasUnscheduled,
    };
  }, [matches, timezone]);

  const [selectedDay, setSelectedDay] = useState<string>("all");

  const [selectedStage, setSelectedStage] = useState<"all" | "group" | "playoff">("all");
  const hasMultipleStages = useMemo(() => {
    const stages = new Set(matches.map((m) => m.stage).filter(Boolean));
    return stages.size > 1;
  }, [matches]);

  // Partidos filtrados según las selecciones del organizador
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      // Filtro categoría
      if (selectedCategory !== "all" && m.categoryName !== selectedCategory) {
        return false;
      }
      // Filtro etapa
      if (selectedStage !== "all" && m.stage !== selectedStage) {
        return false;
      }
      // Filtro día
      if (selectedDay !== "all") {
        if (selectedDay === "unscheduled") {
          if (m.startsAt) return false;
        } else {
          if (!m.startsAt || localDateKey(m.startsAt, timezone) !== selectedDay) {
            return false;
          }
        }
      }
      return true;
    });
  }, [matches, selectedCategory, selectedStage, selectedDay, timezone]);

  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  const effectiveCategoryLabel =
    selectedCategory !== "all" ? selectedCategory : initialCategoryName;

  const fileName = `horarios-${slugify(tournamentName)}${effectiveCategoryLabel ? `-${slugify(effectiveCategoryLabel)}` : ""}${selectedDay !== "all" ? `-${selectedDay}` : ""}.png`;

  const generateImage = () => {
    if (filteredMatches.length === 0) {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      setImageBlob(null);
      return;
    }

    setIsGenerating(true);
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;

    try {
      renderMatchesToCanvas(canvas, {
        tournamentName,
        categoryName: effectiveCategoryLabel,
        sportName,
        timezone,
        matches: filteredMatches,
      });

      canvas.toBlob((blob) => {
        if (!blob) {
          setIsGenerating(false);
          return;
        }
        setImageBlob(blob);
        setImageUrl((prev) => {
          if (prev) URL.revokeObjectURL(prev);
          return URL.createObjectURL(blob);
        });
        setIsGenerating(false);
      }, "image/png");
    } catch (err) {
      console.error("Error al generar imagen de partidos:", err);
      toast.error("No se pudo generar la imagen de horarios.");
      setIsGenerating(false);
    }
  };

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      generateImage();
    } else {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      setImageBlob(null);
    }
  };

  // Re-generar cada vez que cambien los filtros
  useEffect(() => {
    if (isOpen) {
      generateImage();
    }
    // eslint-disable-next-line react-hooks/exhaustive-deps
  }, [selectedCategory, selectedDay, selectedStage, isOpen]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
    };
  }, [imageUrl]);

  const handleDownload = () => {
    if (!imageUrl) return;
    const a = document.createElement("a");
    a.href = imageUrl;
    a.download = fileName;
    document.body.appendChild(a);
    a.click();
    document.body.removeChild(a);
    toast.success("¡Imagen de horarios descargada!");
  };

  const handleCopy = async () => {
    if (!imageBlob) return;
    try {
      if (navigator.clipboard && typeof ClipboardItem !== "undefined") {
        await navigator.clipboard.write([
          new ClipboardItem({ "image/png": imageBlob }),
        ]);
        setIsCopied(true);
        toast.success("Imagen copiada al portapapeles. Podés pegarla directo en WhatsApp.");
        setTimeout(() => setIsCopied(false), 2500);
      } else {
        handleDownload();
      }
    } catch {
      handleDownload();
    }
  };

  const handleShare = async () => {
    if (!imageBlob) return;

    const file = new File([imageBlob], fileName, { type: "image/png" });
    const catText = effectiveCategoryLabel ? ` (${effectiveCategoryLabel})` : "";
    const shareData = {
      title: `Horarios y Partidos - ${tournamentName}`,
      text: `¡Cronograma y horarios de partidos de ${tournamentName}${catText}!`,
      files: [file],
    };

    if (canNativeShare && navigator.canShare(shareData)) {
      try {
        await navigator.share(shareData);
        toast.success("¡Compartido!");
      } catch (err: unknown) {
        if ((err as Error)?.name !== "AbortError") {
          handleDownload();
        }
      }
    } else {
      handleDownload();
      const text = encodeURIComponent(
        `¡Acá están los horarios de ${tournamentName}${catText}!`,
      );
      window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
    }
  };

  if (matches.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Download className="size-4 shrink-0" aria-hidden="true" />
          {buttonText}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-4xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="size-5 text-emerald-500" aria-hidden="true" />
            Imagen de enfrentamientos y horarios para WhatsApp
          </DialogTitle>
          <DialogDescription>
            Diseño oscuro neutro de alta resolución con cuadros compactos para compartir por WhatsApp sin ocupar espacio excesivo.
          </DialogDescription>
        </DialogHeader>

        {/* Barra de Filtros opcionales si hay categorías, días o etapas */}
        {(availableCategories.length > 1 || availableDays.days.length > 1 || hasMultipleStages) && (
          <div className="shrink-0 flex flex-wrap items-center gap-2 pt-1 pb-2 border-b text-xs">
            {availableCategories.length > 1 && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground font-medium">Categoría:</span>
                <select
                  value={selectedCategory}
                  onChange={(e) => setSelectedCategory(e.target.value)}
                  className="rounded-md border bg-background px-2 py-1 text-xs"
                >
                  <option value="all">Todas ({matches.length})</option>
                  {availableCategories.map((c) => (
                    <option key={c} value={c}>
                      {c} ({matches.filter((m) => m.categoryName === c).length})
                    </option>
                  ))}
                </select>
              </div>
            )}

            {availableDays.days.length > 1 && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground font-medium">Día:</span>
                <select
                  value={selectedDay}
                  onChange={(e) => setSelectedDay(e.target.value)}
                  className="rounded-md border bg-background px-2 py-1 text-xs"
                >
                  <option value="all">Todos los días</option>
                  {availableDays.days.map((d) => (
                    <option key={d} value={d}>
                      {formatDayHeading(d)}
                    </option>
                  ))}
                  {availableDays.hasUnscheduled && (
                    <option value="unscheduled">Sin horario</option>
                  )}
                </select>
              </div>
            )}

            {hasMultipleStages && (
              <div className="flex items-center gap-1">
                <span className="text-muted-foreground font-medium">Etapa:</span>
                <select
                  value={selectedStage}
                  onChange={(e) => setSelectedStage(e.target.value as "all" | "group" | "playoff")}
                  className="rounded-md border bg-background px-2 py-1 text-xs"
                >
                  <option value="all">Todas</option>
                  <option value="group">Fase de grupos</option>
                  <option value="playoff">Playoffs</option>
                </select>
              </div>
            )}

            <span className="ml-auto text-muted-foreground font-mono">
              {filteredMatches.length} {filteredMatches.length === 1 ? "partido" : "partidos"}
            </span>
          </div>
        )}

        {/* Contenedor de Vista Previa */}
        <div className="flex-1 my-2 overflow-auto rounded-xl border bg-muted/40 p-2 sm:p-4 flex items-center justify-center min-h-[300px]">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground py-12">
              <Spinner className="size-8" />
              <span>Generando imagen de horarios en alta resolución…</span>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-12">
              No hay partidos que coincidan con los filtros seleccionados.
            </div>
          ) : imageUrl ? (
            <div className="relative w-full max-w-3xl shadow-xl rounded-lg overflow-hidden border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={`Horarios de ${tournamentName}`}
                className="w-full h-auto object-contain block"
              />
            </div>
          ) : null}
        </div>

        {/* Acciones */}
        <DialogFooter className="shrink-0 flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopy}
            disabled={!imageBlob || isGenerating || filteredMatches.length === 0}
            className="w-full sm:w-auto"
          >
            {isCopied ? <Check className="size-4 text-emerald-500" /> : <Copy className="size-4" />}
            {isCopied ? "Copiada" : "Copiar imagen"}
          </Button>

          {canNativeShare ? (
            <Button
              type="button"
              variant="outline"
              onClick={handleShare}
              disabled={!imageBlob || isGenerating || filteredMatches.length === 0}
              className="w-full sm:w-auto"
            >
              <Share2 className="size-4 text-emerald-500" />
              Compartir directo
            </Button>
          ) : null}

          <Button
            type="button"
            onClick={handleDownload}
            disabled={!imageBlob || isGenerating || filteredMatches.length === 0}
            className="w-full sm:w-auto bg-emerald-600 hover:bg-emerald-700 text-white"
          >
            <Download className="size-4" />
            Descargar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
