"use client";

import { ImagePlus, Trash2, UploadCloud } from "lucide-react";
import Image from "next/image";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { createClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

interface TournamentFlyerFieldProps {
  value?: string | null;
  onChange: (url: string | null) => void;
  disabled?: boolean;
}

export function TournamentFlyerField({
  value,
  onChange,
  disabled = false,
}: TournamentFlyerFieldProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [isDragging, setIsDragging] = useState(false);

  async function handleFile(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato no compatible. Por favor subí una imagen PNG, JPG o WEBP.");
      return;
    }

    if (file.size > MAX_FILE_SIZE) {
      toast.error("El archivo supera el tamaño máximo permitido de 5 MB.");
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `banners/flyer-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("tournament-media")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        if (uploadError.message?.toLowerCase().includes("bucket not found")) {
          throw new Error("El bucket 'tournament-media' no existe en Supabase Storage.");
        }
        throw new Error(uploadError.message || "Error al subir la imagen.");
      }

      const { data: publicData } = supabase.storage
        .from("tournament-media")
        .getPublicUrl(filePath);

      if (!publicData?.publicUrl) {
        throw new Error("No se pudo obtener el enlace público de la imagen.");
      }

      onChange(publicData.publicUrl);
      toast.success("Flyer cargado correctamente.");
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al subir el flyer.";
      toast.error(message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    if (disabled || isUploading) return;
    const file = e.dataTransfer.files[0];
    if (file) handleFile(file);
  }

  return (
    <div className="rounded-xl border-2 border-border bg-card p-3.5 sm:p-4 space-y-3">
      <div className="flex items-center justify-between">
        <div>
          <h4 className="text-sm font-semibold text-foreground flex items-center gap-1.5">
            <ImagePlus className="size-4 text-primary" aria-hidden="true" />
            Flyer y reglamento del torneo
          </h4>
          <p className="text-xs text-muted-foreground mt-0.5">
            Subí un afiche con las reglas, formato (ej. Fútbol 5, 7 u 11), tiempos y premios. Los jugadores lo verán al inscribirse.
          </p>
        </div>
        <span className="text-[11px] font-medium text-muted-foreground border border-border/80 rounded-md px-2 py-0.5 bg-muted/40 shrink-0">
          Opcional
        </span>
      </div>

      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        disabled={disabled || isUploading}
        onChange={(e) => {
          const file = e.target.files?.[0];
          if (file) handleFile(file);
        }}
      />

      {value ? (
        <div className="space-y-2.5">
          <div className="relative aspect-video max-h-48 w-full overflow-hidden rounded-lg border border-border bg-muted/30">
            <Image
              src={value}
              alt="Flyer del torneo"
              fill
              className="object-contain"
              unoptimized
            />
          </div>
          <div className="flex items-center justify-end gap-2">
            <Button
              type="button"
              variant="outline"
              size="sm"
              disabled={disabled || isUploading}
              onClick={() => fileInputRef.current?.click()}
              className="h-7 text-xs"
            >
              Cambiar flyer
            </Button>
            <Button
              type="button"
              variant="ghost"
              size="sm"
              disabled={disabled || isUploading}
              onClick={() => onChange(null)}
              className="h-7 text-xs text-destructive hover:bg-destructive/10 hover:text-destructive gap-1"
            >
              <Trash2 className="size-3.5" aria-hidden="true" />
              Quitar
            </Button>
          </div>
        </div>
      ) : (
        <div
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
          className={`cursor-pointer rounded-lg border-2 border-dashed p-4 text-center transition-colors ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border/80 hover:border-primary/60 hover:bg-muted/20"
          }`}
        >
          <div className="flex flex-col items-center justify-center gap-1.5">
            {isUploading ? (
              <Spinner className="size-6 text-primary" />
            ) : (
              <UploadCloud className="size-6 text-muted-foreground" aria-hidden="true" />
            )}
            <p className="text-xs font-medium text-foreground">
              {isUploading ? "Subiendo imagen..." : "Hacé clic o arrastrá el flyer acá"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              PNG, JPG o WEBP (máx. 5 MB)
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
