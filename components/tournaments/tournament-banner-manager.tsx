"use client";

import { useRef, useState } from "react";
import { ImagePlus, RefreshCw, Trash2, UploadCloud } from "lucide-react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { updateTournamentBanner } from "@/app/(app)/torneos/[id]/actions";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { TournamentBanner } from "./tournament-banner";
import { createClient } from "@/lib/supabase/client";

const MAX_FILE_SIZE = 5 * 1024 * 1024; // 5 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

interface TournamentBannerManagerProps {
  tournamentId: string;
  bannerUrl: string | null;
  tournamentName: string;
}

/**
 * Gestor del afiche/portada del torneo para el organizador.
 * Permite subir una imagen (PNG, JPG o WEBP) a Supabase Storage,
 * visualizarla con visor modal y cambiarla o eliminarla.
 */
export function TournamentBannerManager({
  tournamentId,
  bannerUrl,
  tournamentName,
}: TournamentBannerManagerProps) {
  const router = useRouter();
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
      const filePath = `banners/${tournamentId}-${Date.now()}.${ext}`;

      // 1. Subida al bucket tournament-media
      const { error: uploadError } = await supabase.storage
        .from("tournament-media")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        if (uploadError.message?.toLowerCase().includes("bucket not found")) {
          throw new Error("El bucket 'tournament-media' no existe en Supabase Storage. Crealo desde el panel de Supabase (Storage > New bucket).");
        }
        throw new Error(uploadError.message || "Error al subir la imagen al almacenamiento.");
      }

      // 2. Obtener URL pública
      const { data: publicData } = supabase.storage
        .from("tournament-media")
        .getPublicUrl(filePath);

      if (!publicData?.publicUrl) {
        throw new Error("No se pudo obtener el enlace público de la imagen.");
      }

      // 3. Guardar en base de datos mediante Server Action
      const result = await updateTournamentBanner({
        tournamentId,
        bannerUrl: publicData.publicUrl,
      });

      if (!result.ok) {
        toast.error(result.error);
        return;
      }

      toast.success("Afiche cargado exitosamente.");
      router.refresh();
    } catch (err: unknown) {
      const message = err instanceof Error ? err.message : "Error al procesar la imagen.";
      toast.error(message);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) {
        fileInputRef.current.value = "";
      }
    }
  }

  function onFileChange(e: React.ChangeEvent<HTMLInputElement>) {
    const file = e.target.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  function handleDrop(e: React.DragEvent) {
    e.preventDefault();
    setIsDragging(false);
    const file = e.dataTransfer.files?.[0];
    if (file) {
      handleFile(file);
    }
  }

  async function handleRemove() {
    const result = await updateTournamentBanner({
      tournamentId,
      bannerUrl: null,
    });

    if (!result.ok) {
      toast.error(result.error);
      return false;
    }

    toast.success("Afiche eliminado.");
    router.refresh();
  }

  return (
    <div className="space-y-3">
      {/* Input de archivo oculto */}
      <input
        ref={fileInputRef}
        type="file"
        accept="image/png,image/jpeg,image/webp,image/gif"
        className="hidden"
        onChange={onFileChange}
        disabled={isUploading}
      />

      {bannerUrl ? (
        <div className="space-y-3">
          <TournamentBanner
            src={bannerUrl}
            alt={`Afiche de ${tournamentName}`}
            tournamentName={tournamentName}
          />

          <div className="flex flex-wrap items-center justify-between gap-2">
            <span className="text-xs text-muted-foreground">
              Tocá el afiche para verlo en tamaño completo.
            </span>

            <div className="flex items-center gap-2">
              <Button
                type="button"
                variant="outline"
                size="sm"
                disabled={isUploading}
                onClick={() => fileInputRef.current?.click()}
                className="gap-1.5 text-xs"
              >
                {isUploading ? (
                  <Spinner className="size-3.5" />
                ) : (
                  <RefreshCw className="size-3.5" aria-hidden="true" />
                )}
                Cambiar afiche
              </Button>

              <ConfirmActionButton
                variant="ghost"
                size="sm"
                destructive
                title="¿Eliminar el afiche del torneo?"
                description="El afiche dejará de mostrarse en la página pública y en el panel."
                confirmLabel="Eliminar afiche"
                onConfirm={handleRemove}
                disabled={isUploading}
                className="text-destructive text-xs gap-1.5"
              >
                <Trash2 className="size-3.5" aria-hidden="true" />
                Eliminar
              </ConfirmActionButton>
            </div>
          </div>
        </div>
      ) : (
        <div
          role="button"
          tabIndex={0}
          onDragOver={(e) => {
            e.preventDefault();
            setIsDragging(true);
          }}
          onDragLeave={() => setIsDragging(false)}
          onDrop={handleDrop}
          onClick={() => !isUploading && fileInputRef.current?.click()}
          onKeyDown={(e) => {
            if (e.key === "Enter" || e.key === " ") {
              e.preventDefault();
              fileInputRef.current?.click();
            }
          }}
          className={`flex flex-col items-center justify-center gap-3 rounded-2xl border-2 border-dashed p-6 sm:p-8 text-center transition-colors cursor-pointer ${
            isDragging
              ? "border-primary bg-primary/5"
              : "border-border/80 hover:border-primary/50 hover:bg-muted/30 bg-card/40"
          }`}
        >
          <div className="flex size-12 items-center justify-center rounded-full bg-primary/10 text-primary">
            {isUploading ? (
              <Spinner className="size-6 text-primary" />
            ) : (
              <ImagePlus className="size-6" aria-hidden="true" />
            )}
          </div>

          <div className="space-y-1">
            <p className="text-sm font-medium">
              {isUploading ? "Subiendo afiche..." : "Subir afiche o imagen informativa"}
            </p>
            <p className="text-xs text-muted-foreground max-w-sm">
              Arrastrá acá o hacé clic para elegir un archivo (.png, .jpg o .webp hasta 5 MB).
            </p>
          </div>

          <Button
            type="button"
            variant="outline"
            size="sm"
            disabled={isUploading}
            className="gap-1.5 pointer-events-none text-xs"
          >
            <UploadCloud className="size-3.5" aria-hidden="true" />
            Seleccionar imagen
          </Button>
        </div>
      )}
    </div>
  );
}
