"use client";

import { Check, Copy, Download, Image as ImageIcon, MessageCircle, Share2 } from "lucide-react";
import { useEffect, useRef, useState } from "react";
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
import {
  type GroupExportData,
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
  const canvasRef = useRef<HTMLCanvasElement | null>(null);

  const canNativeShare =
    typeof navigator !== "undefined" &&
    typeof navigator.share === "function" &&
    typeof navigator.canShare === "function";

  const fileName = `grupos-${slugify(tournamentName)}${categoryName ? `-${slugify(categoryName)}` : ""}.png`;

  const generateImage = () => {
    if (groups.length === 0) return;
    setIsGenerating(true);
    const canvas = document.createElement("canvas");
    canvasRef.current = canvas;

    try {
      renderGroupsToCanvas(canvas, {
        tournamentName,
        categoryName,
        sportName,
        groups,
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
      // Fallback para PC / navegadores sin share de archivos
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

      <DialogContent className="max-w-2xl max-h-[92vh] flex flex-col p-4 sm:p-6 overflow-hidden">
        <DialogHeader className="shrink-0">
          <DialogTitle className="flex items-center gap-2 text-lg">
            <ImageIcon className="size-5 text-emerald-500" aria-hidden="true" />
            Imagen de grupos para WhatsApp
          </DialogTitle>
          <DialogDescription>
            Lista para descargar y enviar al grupo de WhatsApp de tu torneo.
          </DialogDescription>
        </DialogHeader>

        <div className="flex-1 my-2 overflow-y-auto rounded-xl border bg-muted/40 p-2 sm:p-4 flex items-center justify-center min-h-[300px]">
          {isGenerating || !imageUrl ? (
            <div className="flex flex-col items-center gap-3 text-sm text-muted-foreground py-12">
              <Spinner className="size-8" />
              <span>Generando imagen de alta resolución…</span>
            </div>
          ) : (
            <div className="relative w-full max-w-lg shadow-xl rounded-lg overflow-hidden border border-white/10">
              {/* eslint-disable-next-line @next/next/no-img-element */}
              <img
                src={imageUrl}
                alt={`Grupos de ${tournamentName}`}
                className="w-full h-auto object-contain block"
              />
            </div>
          )}
        </div>

        <DialogFooter className="shrink-0 flex-col sm:flex-row gap-2 pt-2">
          <Button
            type="button"
            variant="outline"
            onClick={handleCopy}
            disabled={!imageBlob || isGenerating}
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
              disabled={!imageBlob || isGenerating}
              className="w-full sm:w-auto"
            >
              <Share2 className="size-4 text-emerald-500" />
              Compartir directo
            </Button>
          ) : null}

          <Button
            type="button"
            onClick={handleDownload}
            disabled={!imageBlob || isGenerating}
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
