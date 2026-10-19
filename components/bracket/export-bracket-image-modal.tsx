"use client";

import { Check, Copy, Download, Image as ImageIcon, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import type { BracketCard } from "@/lib/competition-view";
import { renderBracketToCanvas } from "@/lib/graphics/bracket-image";
import { slugify } from "@/lib/utils/slug";

export type ExportBracketImageModalProps = {
  tournamentName: string;
  categoryName?: string | null;
  sportName?: string | null;
  cards: BracketCard[];
  champion?: string | null;
  variant?: "outline" | "default" | "secondary";
  size?: "default" | "sm" | "lg";
  buttonText?: string;
  className?: string;
};

export function ExportBracketImageModal({
  tournamentName,
  categoryName,
  sportName,
  cards,
  champion,
  variant = "outline",
  size = "default",
  buttonText = "Descargar",
  className,
}: ExportBracketImageModalProps) {
  const [isOpen, setIsOpen] = useState(false);
  const [imageUrl, setImageUrl] = useState<string | null>(null);
  const [imageBlob, setImageBlob] = useState<Blob | null>(null);
  const [isCopied, setIsCopied] = useState(false);
  const [isGenerating, setIsGenerating] = useState(false);
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  const fileName = `cuadro-${slugify(tournamentName)}${categoryName ? `-${slugify(categoryName)}` : ""}.png`;

  const generateImage = () => {
    if (cards.length === 0) return;
    setIsGenerating(true);
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;

    try {
      renderBracketToCanvas(canvas, {
        tournamentName,
        categoryName,
        sportName,
        cards,
        champion,
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
      console.error("Error al generar imagen del cuadro:", err);
      toast.error("No se pudo generar la imagen del cuadro.");
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
    toast.success("¡Imagen del cuadro descargada!");
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
      title: `Cuadro de Playoffs - ${tournamentName}`,
      text: `¡Así quedaron los cruces de ${tournamentName}${categoryName ? ` (${categoryName})` : ""}!`,
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
        `¡Acá está el cuadro de cruces de ${tournamentName}${categoryName ? ` (${categoryName})` : ""}!`,
      );
      window.open(`https://api.whatsapp.com/send?text=${text}`, "_blank");
    }
  };

  if (cards.length === 0) return null;

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
            Compartir Cuadro por WhatsApp
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm">
            Descargá o compartí la imagen de cruces de playoffs directamente con tus jugadores.
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
            <Download className="size-4 mr-1.5 shrink-0" />
            Descargar
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

        {/* Contenedor de visualización con altura dinámica responsive */}
        <div className="flex items-center justify-center rounded-xl border bg-muted/40 p-2 sm:p-3 min-h-[140px]">
          {isGenerating || !imageUrl ? (
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground py-8">
              <Spinner className="size-8" />
              <span>Generando imagen de cruces en alta resolución…</span>
            </div>
          ) : (
            <div className="relative shadow-xl rounded-lg overflow-hidden border border-white/10 max-h-[38dvh] w-auto">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={`Cuadro de ${tournamentName}`}
                className="max-h-[38dvh] w-auto h-auto object-contain block mx-auto"
              />
            </div>
          )}
        </div>
      </DialogContent>
    </Dialog>
  );
}
