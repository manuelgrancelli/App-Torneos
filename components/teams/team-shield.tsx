"use client";

import { Shield } from "lucide-react";
import Image from "next/image";
import { useState } from "react";
import { cn } from "@/lib/utils";

export type PresetShield = {
  id: string;
  name: string;
  primaryColor: string;
  secondaryColor: string;
  accentColor: string;
  pattern: "stripes" | "halves" | "diagonal" | "star" | "chevron" | "cross";
};

export const PRESET_SHIELDS: PresetShield[] = [
  { id: "preset:f-azulgrana", name: "Azulgrana Clásico", primaryColor: "#1d4ed8", secondaryColor: "#b91c1c", accentColor: "#fbbf24", pattern: "stripes" },
  { id: "preset:f-azulamarillo", name: "Azul y Oro", primaryColor: "#1e3a8a", secondaryColor: "#eab308", accentColor: "#ffffff", pattern: "diagonal" },
  { id: "preset:f-albiceleste", name: "Albiceleste Gloria", primaryColor: "#38bdf8", secondaryColor: "#ffffff", accentColor: "#eab308", pattern: "stripes" },
  { id: "preset:f-rojiblanco", name: "Rojiblanco a Bastones", primaryColor: "#dc2626", secondaryColor: "#ffffff", accentColor: "#1e293b", pattern: "stripes" },
  { id: "preset:f-aurinegro", name: "Aurinegro Campeón", primaryColor: "#0f172a", secondaryColor: "#eab308", accentColor: "#ffffff", pattern: "stripes" },
  { id: "preset:f-negrodorado", name: "Negro & Dorado Élite", primaryColor: "#09090b", secondaryColor: "#d97706", accentColor: "#fef08a", pattern: "star" },
  { id: "preset:f-verdeblanco", name: "Verde Esperanza", primaryColor: "#15803d", secondaryColor: "#ffffff", accentColor: "#0f172a", pattern: "stripes" },
  { id: "preset:f-rojonegro", name: "Rojinegro Potencia", primaryColor: "#0f172a", secondaryColor: "#b91c1c", accentColor: "#ffffff", pattern: "halves" },
  { id: "preset:f-violeta", name: "Violeta Imperial", primaryColor: "#6b21a8", secondaryColor: "#ffffff", accentColor: "#facc15", pattern: "chevron" },
  { id: "preset:f-vinotinto", name: "Granate Orgullo", primaryColor: "#831843", secondaryColor: "#ffffff", accentColor: "#f59e0b", pattern: "star" },
  { id: "preset:f-celeste", name: "Celeste Puro", primaryColor: "#0284c7", secondaryColor: "#f0f9ff", accentColor: "#0369a1", pattern: "diagonal" },
  { id: "preset:f-cruz", name: "Cruzada Deportiva", primaryColor: "#ffffff", secondaryColor: "#1e40af", accentColor: "#dc2626", pattern: "cross" },
];

export function getPresetShield(id: string | null | undefined): PresetShield | undefined {
  if (!id) return undefined;
  return PRESET_SHIELDS.find((p) => p.id === id);
}

const SIZE_MAP = {
  xs: { box: "size-4 text-[9px]", imgSize: 16 },
  sm: { box: "size-6 text-[11px]", imgSize: 24 },
  md: { box: "size-9 text-xs", imgSize: 36 },
  lg: { box: "size-12 text-sm", imgSize: 48 },
  xl: { box: "size-16 text-base", imgSize: 64 },
};

export type TeamShieldProps = {
  logoUrl?: string | null;
  shieldUrl?: string | null;
  teamName?: string;
  size?: "xs" | "sm" | "md" | "lg" | "xl";
  className?: string;
};

/** Renderiza el escudo del equipo: imagen personalizada o vector de diseño predeterminado. */
export function TeamShield({ logoUrl, shieldUrl, teamName = "Equipo", size = "md", className }: TeamShieldProps) {
  const effectiveUrl = logoUrl ?? shieldUrl;
  const [imageError, setImageError] = useState(false);
  const sizeConfig = SIZE_MAP[size] ?? SIZE_MAP.md;
  const isPreset = effectiveUrl?.startsWith("preset:");
  const preset = isPreset ? getPresetShield(effectiveUrl) : undefined;
  const isHttp = Boolean(effectiveUrl && (effectiveUrl.startsWith("http://") || effectiveUrl.startsWith("https://")));

  if (isHttp && !imageError && effectiveUrl) {
    return (
      <div
        className={cn(
          "relative shrink-0 overflow-hidden rounded-full border-2 border-border/70 bg-card shadow-2xs aspect-square flex items-center justify-center",
          sizeConfig.box,
          className,
        )}
        title={teamName}
      >
        <Image
          src={effectiveUrl}
          alt={`Escudo de ${teamName}`}
          fill
          sizes={`${sizeConfig.imgSize}px`}
          className="object-cover"
          onError={() => setImageError(true)}
        />
      </div>
    );
  }

  if (preset) {
    return (
      <div
        className={cn(
          "relative shrink-0 select-none overflow-hidden rounded-md drop-shadow-xs aspect-[4/5] flex items-center justify-center transition-transform",
          sizeConfig.box,
          className,
        )}
        title={`${teamName} (${preset.name})`}
      >
        <svg
          viewBox="0 0 100 120"
          className="h-full w-full"
          fill="none"
          xmlns="http://www.w3.org/2000/svg"
          aria-hidden="true"
        >
          {/* Contorno del escudo */}
          <clipPath id={`clip-${preset.id}-${size}`}>
            <path d="M50 5 L92 20 C92 75 75 105 50 115 C25 105 8 75 8 20 Z" />
          </clipPath>

          <g clipPath={`url(#clip-${preset.id}-${size})`}>
            {/* Fondo base */}
            <rect width="100" height="120" fill={preset.primaryColor} />

            {/* Diseños interiores */}
            {preset.pattern === "stripes" && (
              <>
                <rect x="22" width="18" height="120" fill={preset.secondaryColor} />
                <rect x="60" width="18" height="120" fill={preset.secondaryColor} />
              </>
            )}

            {preset.pattern === "halves" && (
              <rect x="50" width="50" height="120" fill={preset.secondaryColor} />
            )}

            {preset.pattern === "diagonal" && (
              <polygon points="0,0 40,0 100,80 100,120 60,120 0,40" fill={preset.secondaryColor} />
            )}

            {preset.pattern === "star" && (
              <>
                <polygon points="50,25 90,110 10,110" fill={preset.secondaryColor} opacity="0.3" />
                <circle cx="50" cy="55" r="22" fill={preset.secondaryColor} />
              </>
            )}

            {preset.pattern === "chevron" && (
              <>
                <polygon points="50,60 92,30 92,45 50,75 8,45 8,30" fill={preset.secondaryColor} />
                <polygon points="50,85 92,55 92,70 50,100 8,70 8,55" fill={preset.secondaryColor} />
              </>
            )}

            {preset.pattern === "cross" && (
              <>
                <rect x="42" width="16" height="120" fill={preset.secondaryColor} />
                <rect y="40" width="100" height="16" fill={preset.secondaryColor} />
              </>
            )}

            {/* Balón estilizado central */}
            <circle cx="50" cy="62" r="15" fill={preset.accentColor} stroke="#0f172a" strokeWidth="2.5" />
            <polygon points="50,56 56,60 54,67 46,67 44,60" fill="#0f172a" />
          </g>

          {/* Borde exterior del escudo */}
          <path
            d="M50 5 L92 20 C92 75 75 105 50 115 C25 105 8 75 8 20 Z"
            fill="none"
            stroke={preset.accentColor}
            strokeWidth="5"
          />
          <path
            d="M50 8 L89 22 C89 74 73 102 50 112 C27 102 11 74 11 22 Z"
            fill="none"
            stroke="rgba(0,0,0,0.3)"
            strokeWidth="1.5"
          />
        </svg>
      </div>
    );
  }

  // Fallback por defecto si no tiene escudo o falló la carga
  return (
    <div
      className={cn(
        "relative shrink-0 flex items-center justify-center rounded-md border border-border/80 bg-muted/60 text-muted-foreground",
        sizeConfig.box,
        className,
      )}
      title={teamName}
    >
      <Shield className="size-3.5 stroke-[2] opacity-80" aria-hidden="true" />
    </div>
  );
}
