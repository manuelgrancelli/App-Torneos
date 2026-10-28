"use client";

import {
  Check,
  Copy,
  Download,
  Image as ImageIcon,
  Share2,
  Upload,
} from "lucide-react";
import { useCallback, useEffect, useRef, useState } from "react";
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
import {
  type BackgroundPreset,
  type GroupExportData,
  type ImageFormat,
  renderGroupsToCanvas,
} from "@/lib/graphics/groups-image";
import { slugify } from "@/lib/utils/slug";

export type ExportGroupsImageModalProps = {
  tournamentName: string;
  categoryName?: string | null;
  sportName?: string | null;
  groups: GroupExportData[];
  variant?: "outline" | "default" | "secondary";
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

export function ExportGroupsImageModal({
  tournamentName,
  categoryName,
  sportName,
  groups,
  variant = "outline",
  size = "default",
  buttonText = "Descargar",
  className,
}: ExportGroupsImageModalProps) {
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

  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  const fileName = `grupos-${slugify(tournamentName)}${categoryName ? `-${slugify(categoryName)}` : ""}${format === "story" ? "-historia" : ""}.png`;

  // Carga una imagen en memoria con cache para renderizado instantáneo
  const loadImage = useCallback((src: string): Promise<HTMLImageElement> => {
    const cached = loadedImagesCache.current.get(src);
    if (cached) return Promise.resolve(cached);

    return new Promise((resolve, reject) => {
      const img = new Image();
      img.crossOrigin = "anonymous";
      img.onload = () => {
        loadedImagesCache.current.set(src, img);
        resolve(img);
      };
      img.onerror = (err) => reject(err);
      img.src = src;
    });
  }, []);

  const generateImage = useCallback(async () => {
    if (groups.length === 0) return;
    setIsGenerating(true);

    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;

    let loadedBgImage: HTMLImageElement | null = null;

    try {
      if (selectedPreset === "custom" && customImageUrl) {
        loadedBgImage = await loadImage(customImageUrl);
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

      renderGroupsToCanvas(canvas, {
        tournamentName,
        categoryName,
        sportName,
        groups,
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
      console.error("Error al generar imagen de grupos:", err);
      toast.error("No se pudo generar la imagen.");
      setIsGenerating(false);
    }
  }, [groups, selectedPreset, customImageUrl, loadImage, tournamentName, categoryName, sportName, format]);

  const handleOpenChange = (open: boolean) => {
    setIsOpen(open);
    if (open) {
      // Regenerar cuando abre
      setTimeout(() => {
        generateImage();
      }, 50);
    } else {
      if (imageUrl) {
        URL.revokeObjectURL(imageUrl);
        setImageUrl(null);
      }
      setImageBlob(null);
    }
  };

  // Regenerar cada vez que cambia el fondo
  useEffect(() => {
    if (isOpen) {
      generateImage();
    }
  }, [isOpen, selectedPreset, customImageUrl, generateImage]);

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
    toast.success("¡Imagen descargada!");
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
    const shareData = {
      title: `Zonas y Grupos - ${tournamentName}`,
      text: `¡Así quedaron las zonas de ${tournamentName}${categoryName ? ` (${categoryName})` : ""}!`,
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
        `¡Acá están las zonas de ${tournamentName}${categoryName ? ` (${categoryName})` : ""}!`,
      );
      window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
    }
  };

  if (groups.length === 0) return null;

  return (
    <Dialog open={isOpen} onOpenChange={handleOpenChange}>
      <DialogTrigger asChild>
        <Button variant={variant} size={size} className={className}>
          <Download className="size-4 shrink-0" aria-hidden="true" />
          {buttonText}
        </Button>
      </DialogTrigger>

      <DialogContent className="max-w-lg max-h-[90dvh] flex flex-col p-4 sm:p-5 overflow-y-auto gap-3">
        <DialogHeader className="shrink-0 space-y-1">
          <DialogTitle className="flex items-center gap-2 text-base sm:text-lg">
            <ImageIcon className="size-5 text-emerald-500 shrink-0" aria-hidden="true" />
            Compartir Zonas por WhatsApp
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Elegí el fondo y compartí la imagen directamente con tus jugadores.
          </DialogDescription>
        </DialogHeader>

        {/* Acciones principales arriba de todo: compartir o descargar al instante */}
        <div className="flex flex-wrap items-center gap-2 pt-1 pb-1">
          {canNativeShare ? (
            <Button
              type="button"
              onClick={handleShare}
              disabled={!imageBlob || isGenerating}
              className="flex-1 min-w-[120px] bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm h-10 shadow-xs"
            >
              <Share2 className="size-4 mr-1.5 shrink-0" />
              Compartir directo
            </Button>
          ) : null}

          <Button
            type="button"
            onClick={handleDownload}
            disabled={!imageBlob || isGenerating}
            className={`${canNativeShare ? "flex-1 min-w-[120px]" : "w-full"} bg-emerald-600 hover:bg-emerald-700 text-white font-medium text-xs sm:text-sm h-10 shadow-xs`}
          >
            {isGenerating ? <Spinner className="size-4 mr-1.5 shrink-0" /> : <Download className="size-4 mr-1.5 shrink-0" />}
            {isGenerating ? "Generando imagen…" : "Descargar"}
          </Button>

          <Button
            type="button"
            variant="outline"
            onClick={handleCopy}
            disabled={!imageBlob || isGenerating}
            className="flex-1 min-w-[120px] text-xs sm:text-sm h-10"
          >
            {isCopied ? <Check className="size-4 text-emerald-500 mr-1.5 shrink-0" /> : <Copy className="size-4 mr-1.5 shrink-0" />}
            {isCopied ? "¡Copiada!" : "Copiar imagen"}
          </Button>
        </div>

        {/* Barra de opciones: Fondo */}
        <div className="shrink-0 flex flex-wrap items-center justify-between gap-2 py-2 border-y text-xs">
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

            {/* Botón para cambiar foto si ya subió una */}
            {selectedPreset === "custom" && customImageUrl ? (
              <button
                type="button"
                onClick={() => fileInputRef.current?.click()}
                className="inline-flex items-center gap-1 text-[11px] text-muted-foreground hover:text-foreground underline underline-offset-2 ml-1"
              >
                <Upload className="size-3" /> Cambiar
              </button>
            ) : null}

            {/* Input oculto de foto propia */}
            <input
              ref={fileInputRef}
              type="file"
              accept="image/*"
              onChange={handleCustomFileChange}
              className="hidden"
              aria-label="Subir foto de fondo personalizada"
            />
          </div>
        </div>

        {/* Contenedor de visualización con altura dinámica responsive */}
        <div className="flex items-center justify-center rounded-xl border bg-muted/30 p-2 sm:p-3 min-h-[140px]">
          {isGenerating || !imageUrl ? (
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground py-8">
              <Spinner className="size-8" />
              <span>Generando imagen en alta resolución…</span>
            </div>
          ) : (
            <div className="relative shadow-2xl rounded-lg overflow-hidden border border-white/10 max-h-[30dvh] sm:max-h-[38dvh] w-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={`Grupos de ${tournamentName}`}
                className="max-h-[30dvh] sm:max-h-[38dvh] w-auto h-auto object-contain block mx-auto"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
