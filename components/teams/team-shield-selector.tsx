"use client";

import { Check, ImagePlus, Shield, Trash2, UploadCloud } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import { PRESET_SHIELDS, TeamShield } from "./team-shield";
import { createClient } from "@/lib/supabase/client";
import { cn } from "@/lib/utils";

const MAX_CREST_SIZE = 4 * 1024 * 1024; // 4 MB
const ALLOWED_TYPES = ["image/png", "image/jpeg", "image/webp", "image/gif"];

type TeamShieldSelectorProps = {
  value?: string | null;
  onChange: (value: string | null) => void;
  teamName?: string;
  disabled?: boolean;
};

export function TeamShieldSelector({
  value,
  onChange,
  teamName = "Mi Equipo",
  disabled,
}: TeamShieldSelectorProps) {
  const fileInputRef = useRef<HTMLInputElement>(null);
  const [isUploading, setIsUploading] = useState(false);
  const [activeTab, setActiveTab] = useState<"presets" | "upload">(
    value?.startsWith("http") ? "upload" : "presets"
  );

  async function handleFileUpload(file: File) {
    if (!ALLOWED_TYPES.includes(file.type)) {
      toast.error("Formato no soportado. Subí una imagen PNG, JPG o WEBP.");
      return;
    }
    if (file.size > MAX_CREST_SIZE) {
      toast.error("El archivo supera el límite de 4 MB.");
      return;
    }

    setIsUploading(true);
    try {
      const supabase = createClient();
      const ext = file.name.split(".").pop()?.toLowerCase() || "png";
      const filePath = `team-crests/crest-${Date.now()}-${Math.random().toString(36).substring(2, 7)}.${ext}`;

      const { error: uploadError } = await supabase.storage
        .from("tournament-media")
        .upload(filePath, file, {
          cacheControl: "3600",
          upsert: true,
        });

      if (uploadError) {
        throw new Error(uploadError.message || "Error al subir el escudo.");
      }

      const { data: publicData } = supabase.storage
        .from("tournament-media")
        .getPublicUrl(filePath);

      if (!publicData?.publicUrl) {
        throw new Error("No se pudo obtener el enlace público del escudo.");
      }

      onChange(publicData.publicUrl);
      toast.success("¡Escudo cargado correctamente!");
    } catch (err: unknown) {
      const msg = err instanceof Error ? err.message : "Error al procesar el escudo.";
      toast.error(msg);
    } finally {
      setIsUploading(false);
      if (fileInputRef.current) fileInputRef.current.value = "";
    }
  }

  return (
    <div className="space-y-3 rounded-xl border border-border/70 bg-card p-3 sm:p-4 shadow-2xs">
      {/* Cabecera y Previsualización en Vivo */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 pb-3 border-b border-border/60">
        <div className="flex items-center gap-3">
          <TeamShield logoUrl={value} teamName={teamName} size="lg" />
          <div className="min-w-0">
            <p className="text-xs font-semibold text-foreground truncate">
              {teamName || "Nombre del equipo"}
            </p>
            <p className="text-[11px] text-muted-foreground">
              {value
                ? value.startsWith("preset:")
                  ? `Escudo: ${PRESET_SHIELDS.find((p) => p.id === value)?.name ?? "Predeterminado"}`
                  : "Escudo personalizado cargado"
                : "Sin escudo seleccionado (opcional)"}
            </p>
          </div>
        </div>

        {value ? (
          <Button
            type="button"
            variant="ghost"
            size="sm"
            disabled={disabled || isUploading}
            onClick={() => onChange(null)}
            className="h-8 text-xs text-muted-foreground hover:text-destructive self-start sm:self-auto gap-1.5"
          >
            <Trash2 className="size-3.5" aria-hidden="true" />
            Quitar escudo
          </Button>
        ) : null}
      </div>

      {/* Tabs: Elegir diseño vs Subir imagen propia */}
      <div className="flex rounded-lg bg-muted/50 p-1 text-xs font-medium">
        <button
          type="button"
          onClick={() => setActiveTab("presets")}
          className={cn(
            "flex-1 rounded-md py-1.5 text-center transition-all",
            activeTab === "presets"
              ? "bg-background text-foreground shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Diseños de escudo
        </button>
        <button
          type="button"
          onClick={() => setActiveTab("upload")}
          className={cn(
            "flex-1 rounded-md py-1.5 text-center transition-all",
            activeTab === "upload"
              ? "bg-background text-foreground shadow-2xs font-semibold"
              : "text-muted-foreground hover:text-foreground"
          )}
        >
          Subir mi escudo
        </button>
      </div>

      {/* Grilla de Diseños Predeterminados */}
      {activeTab === "presets" ? (
        <div className="grid grid-cols-4 sm:grid-cols-6 gap-2 pt-1 max-h-52 overflow-y-auto p-1">
          {PRESET_SHIELDS.map((preset) => {
            const isSelected = value === preset.id;
            return (
              <button
                key={preset.id}
                type="button"
                disabled={disabled}
                onClick={() => onChange(preset.id)}
                className={cn(
                  "group relative flex flex-col items-center justify-center p-2 rounded-lg border text-center transition-all",
                  isSelected
                    ? "border-emerald-500 bg-emerald-500/10 ring-2 ring-emerald-500/30 -translate-y-0.5"
                    : "border-border/60 bg-muted/20 hover:border-border hover:bg-muted/40 hover:-translate-y-0.5"
                )}
                title={preset.name}
              >
                <TeamShield logoUrl={preset.id} teamName={preset.name} size="md" />
                <span className="mt-1 text-[10px] font-medium text-foreground truncate w-full">
                  {preset.name.split(" ")[0]}
                </span>
                {isSelected ? (
                  <span className="absolute top-1 right-1 flex size-3.5 items-center justify-center rounded-full bg-emerald-500 text-white">
                    <Check className="size-2.5 stroke-[3]" />
                  </span>
                ) : null}
              </button>
            );
          })}
        </div>
      ) : (
        /* Subida de Imagen Personalizada */
        <div className="space-y-3 pt-1">
          <input
            ref={fileInputRef}
            type="file"
            accept={ALLOWED_TYPES.join(",")}
            className="hidden"
            onChange={(e) => {
              const file = e.target.files?.[0];
              if (file) handleFileUpload(file);
            }}
          />
          <div
            onClick={() => !disabled && !isUploading && fileInputRef.current?.click()}
            className={cn(
              "flex flex-col items-center justify-center p-5 rounded-xl border-2 border-dashed text-center cursor-pointer transition-colors",
              isUploading ? "opacity-60 cursor-wait border-muted" : "border-border/80 hover:border-emerald-500/60 hover:bg-emerald-500/[0.02]"
            )}
          >
            {isUploading ? (
              <div className="flex flex-col items-center gap-2">
                <Spinner className="size-6 text-emerald-600" />
                <span className="text-xs text-muted-foreground">Subiendo imagen del escudo...</span>
              </div>
            ) : (
              <div className="flex flex-col items-center gap-1.5">
                <div className="size-10 rounded-full bg-primary/10 flex items-center justify-center text-primary">
                  <ImagePlus className="size-5" />
                </div>
                <p className="text-xs font-semibold text-foreground">
                  Hacé clic para seleccionar una imagen
                </p>
                <p className="text-[11px] text-muted-foreground">
                  PNG, JPG o WEBP (máx. 4 MB). Fondo transparente recomendado.
                </p>
              </div>
            )}
          </div>
        </div>
      )}
    </div>
  );
}
