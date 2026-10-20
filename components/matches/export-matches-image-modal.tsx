"use client";

import {
  Calendar,
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  MessageCircle,
  Share2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useMemo, useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { Spinner } from "@/components/ui/spinner";
import { formatDayHeading, formatInTimeZone, localDateKey } from "@/lib/dates";
import {
  type BackgroundPreset,
  type ImageFormat,
  type MatchExportData,
  renderMatchesToCanvas,
} from "@/lib/graphics/matches-image";
import { slugify } from "@/lib/utils/slug";

export type ExportMatchesImageModalProps = {
  tournamentName: string;
  categoryName?: string | null;
  sportName?: string | null;
  timezone: string;
  matches: MatchExportData[];
  initialDay?: string;
  variant?: "outline" | "default" | "secondary" | "ghost";
  size?: "default" | "sm" | "lg";
  buttonText?: string;
  className?: string;
};

type BackgroundOption = {
  id: BackgroundPreset;
  label: string;
  src?: string;
  colorDot: string;
};

const BACKGROUND_OPTIONS: BackgroundOption[] = [
  {
    id: "padel-red",
    label: "Pádel Rojo",
    src: "/backgrounds/padel-red.jpg",
    colorDot: "bg-rose-500",
  },
  {
    id: "padel-blue",
    label: "Pádel Azul",
    src: "/backgrounds/padel-blue.jpg",
    colorDot: "bg-sky-500",
  },
  {
    id: "dark",
    label: "Oscuro",
    colorDot: "bg-zinc-800 border border-zinc-600",
  },
  {
    id: "custom",
    label: "Mi foto",
    colorDot: "bg-amber-500",
  },
];

function buildMatchesWhatsAppText({
  tournamentName,
  sportName,
  categoryName,
  day,
  matches,
  timezone,
}: {
  tournamentName: string;
  sportName?: string | null;
  categoryName?: string | null;
  day?: string;
  matches: MatchExportData[];
  timezone: string;
}) {
  const lines: string[] = [];
  lines.push(`🏆 *${tournamentName.toUpperCase()}*`);
  if (sportName) lines.push(`🎾 _${sportName}_`);
  if (categoryName && categoryName !== "all") lines.push(`📌 *Categoría:* ${categoryName}`);

  if (day && day !== "all") {
    if (day === "unscheduled") {
      lines.push(`⏳ *Partidos sin horario asignado*`);
    } else {
      lines.push(`📅 *${formatDayHeading(day).toUpperCase()}*`);
    }
  } else {
    lines.push(`📅 *CRONOGRAMA DE PARTIDOS*`);
  }

  lines.push(`----------------------------------------`);

  for (const m of matches) {
    const timeStr = m.startsAt ? `${formatInTimeZone(m.startsAt, timezone, "HH:mm")} hs` : "Horario a definir";
    const courtStr = m.courtName ? ` · ${m.courtName}` : "";
    const sectionStr = m.section ? ` (${m.section})` : "";
    const scoreStr = m.resultText ? ` [${m.resultText}]` : "";

    lines.push(`🕐 *${timeStr}*${courtStr}${sectionStr}`);
    lines.push(`👉 *${m.homeName}* vs *${m.awayName}*${scoreStr}`);
    lines.push(``);
  }

  lines.push(`----------------------------------------`);
  lines.push(`⚡ _Organizado con LM Torneos_`);

  return lines.join("\n");
}

export function ExportMatchesImageModal({
  tournamentName,
  categoryName: initialCategoryName,
  sportName,
  timezone,
  matches,
  initialDay,
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

  // Opciones de personalización: formato fijo en 9:16 para historias / WhatsApp
  const format: ImageFormat = "story";
  const [selectedPreset, setSelectedPreset] = useState<BackgroundPreset>("padel-red");
  const [customImageUrl, setCustomImageUrl] = useState<string | null>(null);

  const canvasRef = useRef<HTMLCanvasElement | null>(null);
  const fileInputRef = useRef<HTMLInputElement | null>(null);
  const loadedImagesCache = useRef<Map<string, HTMLImageElement>>(new Map());

  // Filtros internos en el modal
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

  const [selectedDay, setSelectedDay] = useState<string>(initialDay ?? "all");
  const [selectedStage, setSelectedStage] = useState<"all" | "group" | "playoff">("all");

  useEffect(() => {
    if (initialDay !== undefined) {
      setSelectedDay(initialDay);
    }
  }, [initialDay]);

  const hasMultipleStages = useMemo(() => {
    const stages = new Set(matches.map((m) => m.stage).filter(Boolean));
    return stages.size > 1;
  }, [matches]);

  // Partidos filtrados
  const filteredMatches = useMemo(() => {
    return matches.filter((m) => {
      if (selectedCategory !== "all" && m.categoryName !== selectedCategory) {
        return false;
      }
      if (selectedStage !== "all" && m.stage !== selectedStage) {
        return false;
      }
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

  const fileName = `horarios-${slugify(tournamentName)}${effectiveCategoryLabel ? `-${slugify(effectiveCategoryLabel)}` : ""}${selectedDay !== "all" ? `-${selectedDay}` : ""}${format === "story" ? "-historia" : ""}.png`;

  // Carga una imagen en memoria con cache para renderizado fluido
  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    const cached = loadedImagesCache.current.get(src);
    if (cached) return Promise.resolve(cached);

    return new Promise((resolve, reject) => {
      const img = new Image();
      if (src.startsWith("http://") || src.startsWith("https://")) {
        img.crossOrigin = "anonymous";
      }
      img.onload = () => {
        loadedImagesCache.current.set(src, img);
        resolve(img);
      };
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  }, []);

  const generateImage = useCallback(async () => {
    if (filteredMatches.length === 0) {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      setImageBlob(null);
      setIsGenerating(false);
      return;
    }

    setIsGenerating(true);
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;

    let loadedBgImage: HTMLImageElement | null = null;

    try {
      if (selectedPreset === "custom" && customImageUrl) {
        try {
          loadedBgImage = await loadImage(customImageUrl);
        } catch (e) {
          console.warn("No se pudo cargar la imagen de fondo personalizada:", e);
        }
      } else if (selectedPreset !== "dark") {
        const option = BACKGROUND_OPTIONS.find((o) => o.id === selectedPreset);
        if (option?.src) {
          try {
            loadedBgImage = await loadImage(option.src);
          } catch (e) {
            console.warn("No se pudo cargar el fondo predefinido, se usará oscuro:", e);
          }
        }
      }

      renderMatchesToCanvas(canvas, {
        tournamentName,
        categoryName: effectiveCategoryLabel,
        sportName,
        timezone,
        matches: filteredMatches,
        format,
        backgroundPreset: selectedPreset,
        backgroundImage: loadedBgImage,
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
  }, [
    filteredMatches,
    tournamentName,
    effectiveCategoryLabel,
    sportName,
    timezone,
    selectedPreset,
    customImageUrl,
    loadImage,
  ]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (!open) {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      setImageBlob(null);
    }
  };

  useEffect(() => {
    if (isOpen) {
      generateImage();
    }
  }, [isOpen, selectedCategory, selectedDay, selectedStage, selectedPreset, customImageUrl, generateImage]);

  useEffect(() => {
    return () => {
      if (imageUrl) URL.revokeObjectURL(imageUrl);
      if (customImageUrl) URL.revokeObjectURL(customImageUrl);
    };
  }, [imageUrl, customImageUrl]);

  const handleCustomFileChange = (e: React.ChangeEvent<HTMLInputElement>) => {
    const file = e.target.files?.[0];
    if (!file) return;

    if (!file.type.startsWith("image/")) {
      toast.error("Por favor seleccioná un archivo de imagen válido.");
      return;
    }

    if (customImageUrl) {
      URL.revokeObjectURL(customImageUrl);
    }

    const url = URL.createObjectURL(file);
    setCustomImageUrl(url);
    setSelectedPreset("custom");
    toast.success("Foto propia cargada como fondo.");
  };

  const handlePresetSelect = (presetId: BackgroundPreset) => {
    if (presetId === "custom") {
      if (!customImageUrl) {
        fileInputRef.current?.click();
      } else {
        setSelectedPreset("custom");
      }
    } else {
      setSelectedPreset(presetId);
    }
  };

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

  const handleShareWhatsAppText = () => {
    if (filteredMatches.length === 0) return;
    const text = buildMatchesWhatsAppText({
      tournamentName,
      sportName,
      categoryName: selectedCategory !== "all" ? selectedCategory : undefined,
      day: selectedDay,
      matches: filteredMatches,
      timezone,
    });

    if (navigator.clipboard) {
      navigator.clipboard.writeText(text).catch(() => {});
    }

    const encoded = encodeURIComponent(text);
    window.open(`https://api.whatsapp.com/send?text=${encoded}`, "_blank");
    toast.success("Texto copiado y abriendo WhatsApp…");
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

      <DialogContent className="max-w-2xl max-h-[90dvh] flex flex-col p-4 sm:p-5 overflow-y-auto gap-3">
        <DialogHeader className="shrink-0 space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ImageIcon className="size-5 text-emerald-500 shrink-0" aria-hidden="true" />
            Compartir Horarios por WhatsApp
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Elegí el fondo y compartí el cronograma directamente con tus jugadores.
          </DialogDescription>
        </DialogHeader>

        {/* Acciones principales arriba de todo: compartir o descargar al instante */}
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
          <Button
            type="button"
            variant="outline"
            size="sm"
            onClick={handleShareWhatsAppText}
            disabled={filteredMatches.length === 0}
            className="flex-1 min-w-[120px] h-10 text-xs sm:text-sm text-emerald-600 dark:text-emerald-400 hover:text-emerald-700 hover:bg-emerald-500/10 border-emerald-500/30 truncate"
          >
            <MessageCircle className="size-4 shrink-0 text-emerald-500 mr-1.5" />
            <span className="truncate">Texto WhatsApp</span>
          </Button>

          {canNativeShare ? (
            <Button
              type="button"
              onClick={handleShare}
              disabled={!imageBlob || isGenerating || filteredMatches.length === 0}
              className="flex-1 min-w-[120px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm h-10 shadow-xs"
            >
              <Share2 className="size-4 mr-1.5 shrink-0" />
              Compartir directo
            </Button>
          ) : null}

          <Button
            type="button"
            onClick={handleDownload}
            disabled={!imageBlob || isGenerating || filteredMatches.length === 0}
            className={`${canNativeShare ? "flex-1 min-w-[120px]" : "w-full sm:flex-1"} bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm h-10 shadow-xs`}
          >
            <Download className="size-4 mr-1.5 shrink-0" />
            Descargar
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleCopy}
            disabled={!imageBlob || isGenerating || filteredMatches.length === 0}
            className="flex-1 min-w-[120px] text-xs sm:text-sm h-10"
          >
            {isCopied ? <Check className="size-4 text-emerald-500 mr-1.5 shrink-0" /> : <Copy className="size-4 mr-1.5 shrink-0" />}
            {isCopied ? "¡Copiada!" : "Copiar imagen"}
          </Button>
        </div>

        {/* Barra de opciones: Fondo */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 pt-1 pb-2 border-b text-xs">
          <span className="font-semibold text-muted-foreground">Fondo:</span>
          <div className="flex flex-wrap items-center gap-1.5">
            {BACKGROUND_OPTIONS.map((opt) => {
              const isSelected = selectedPreset === opt.id;
              return (
                <button
                  key={opt.id}
                  type="button"
                  onClick={() => handlePresetSelect(opt.id)}
                  className={`inline-flex items-center gap-1.5 px-2.5 py-1 rounded-md border text-xs font-medium transition-all ${
                    isSelected
                      ? "border-emerald-500 bg-emerald-500/10 text-emerald-400 font-semibold shadow-xs"
                      : "border-border/60 bg-muted/40 text-muted-foreground hover:text-foreground hover:bg-muted"
                  }`}
                >
                  <span className={`size-2.5 rounded-full ${opt.colorDot}`} />
                  {opt.label}
                  {opt.id === "custom" && customImageUrl ? " ✓" : ""}
                </button>
              );
            })}

            {selectedPreset === "custom" && customImageUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
              >
                <Upload className="size-3" /> Cambiar
              </button>
            ) : null}

            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleCustomFileChange}
              className="hidden"
              aria-label="Subir foto de fondo personalizada para horarios"
            />
          </div>
        </div>

        {/* Barra de Filtros: Categorías, Días y Etapas */}
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

          {/* Selector de Día: siempre presente si hay días con fecha o partidos sin horario */}
          {(availableDays.days.length > 0 || availableDays.hasUnscheduled) && (
            <div className="flex items-center gap-1">
              <span className="text-muted-foreground font-semibold flex items-center gap-1">
                <Calendar className="size-3 text-sky-500" /> Día:
              </span>
              <select
                value={selectedDay}
                onChange={(e) => setSelectedDay(e.target.value)}
                className="rounded-md border bg-background px-2 py-1 text-xs font-medium"
              >
                <option value="all">Todos los días ({matches.length})</option>
                {availableDays.days.map((d) => {
                  const dayCount = matches.filter(
                    (m) => m.startsAt && localDateKey(m.startsAt, timezone) === d,
                  ).length;
                  return (
                    <option key={d} value={d}>
                      {formatDayHeading(d)} ({dayCount})
                    </option>
                  );
                })}
                {availableDays.hasUnscheduled && (
                  <option value="unscheduled">
                    Sin horario ({matches.filter((m) => !m.startsAt).length})
                  </option>
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

        {/* Contenedor de Vista Previa con altura dinámica */}
        <div className="flex items-center justify-center rounded-xl border bg-muted/40 p-2 sm:p-3 min-h-[140px]">
          {isGenerating ? (
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground py-8">
              <Spinner className="size-8" />
              <span>Generando imagen de horarios…</span>
            </div>
          ) : filteredMatches.length === 0 ? (
            <div className="text-center text-sm text-muted-foreground py-8">
              No hay partidos que coincidan con los filtros seleccionados.
            </div>
          ) : imageUrl ? (
            <div className="relative shadow-2xl rounded-lg overflow-hidden border border-white/10 max-h-[30dvh] sm:max-h-[38dvh] w-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={`Horarios de ${tournamentName}`}
                className="max-h-[30dvh] sm:max-h-[38dvh] w-auto h-auto object-contain block mx-auto"
              />
            </div>
          ) : null}
        </div>
      </DialogContent>
    </Dialog>
  );
}
