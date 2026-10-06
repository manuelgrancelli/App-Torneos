import { cn } from "cn";

type TrophyLogoProps = {
  /** Tamaño del logo: "sm" para header (30px), "md" para portada (36px), "lg" (44px). */
  size?: "sm" | "md" | "lg";
  className?: string;
};

const SIZE_CONFIG = {
  sm: {
    container: "size-8 rounded-lg",
    icon: "size-4.5",
  },
  md: {
    container: "size-9.5 rounded-xl",
    icon: "size-5.5",
  },
  lg: {
    container: "size-11 rounded-2xl",
    icon: "size-6.5",
  },
} as const;

/**
 * Insignia de la copa con fondo dorado metálico, silueta de copa en negro
 * y un destello blanco brillante que la cruza periódicamente.
 */
export function TrophyLogo({ size = "sm", className }: TrophyLogoProps) {
  const cfg = SIZE_CONFIG[size];

  return (
    <span
      className={cn(
        "relative inline-flex shrink-0 items-center justify-center overflow-hidden",
        "bg-gradient-to-br from-[#FDE68A] via-[#F59E0B] to-[#D97706]",
        "shadow-sm shadow-amber-500/30 ring-1 ring-amber-300/70 dark:ring-amber-400/40",
        cfg.container,
        className,
      )}
      aria-hidden="true"
    >
      {/* Copa en silueta negra pura */}
      <svg
        viewBox="0 0 24 24"
        fill="currentColor"
        className={cn(
          "relative z-10 text-zinc-950 drop-shadow-[0_1px_1px_rgba(255,255,255,0.2)] transition-transform duration-300 group-hover:scale-105",
          cfg.icon,
        )}
        xmlns="http://www.w3.org/2000/svg"
      >
        <path d="M19 5h-2V3a1 1 0 0 0-1-1H8a1 1 0 0 0-1 1v2H5a2 2 0 0 0-2 2v1c0 2.55 1.92 4.63 4.39 4.94A5.01 5.01 0 0 0 11 15.9V19H9a1 1 0 0 0 0 2h6a1 1 0 0 0 0-2h-2v-3.1a5.01 5.01 0 0 0 3.61-2.96C19.08 12.63 21 10.55 21 8V7a2 2 0 0 0-2-2zM5 8V7h2v3.82C5.84 10.4 5 9.3 5 8zm14 0c0 1.3-.84 2.4-2 2.82V7h2v1z" />
      </svg>

      {/* Haz / línea blanca diagonal de brillo que cruza la copa */}
      <span
        className="pointer-events-none absolute inset-0 z-20 block w-full -translate-x-full animate-trophy-shine bg-gradient-to-r from-transparent via-white/85 to-transparent"
        aria-hidden="true"
      />
    </span>
  );
}
