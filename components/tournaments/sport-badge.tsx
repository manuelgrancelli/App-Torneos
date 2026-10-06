import { Badge } from "@/components/ui/badge";
import { cn } from "@/lib/utils";

/**
 * Obtiene el emoji identificatorio según el deporte:
 * - Pádel / Tenis: 🎾 (pelota de tenis)
 * - Fútbol (Fútbol 11, etc.): ⚽ (pelota de fútbol)
 * - Básquetbol / Baloncesto: 🏀
 * - Voleibol: 🏐
 * - Rugby: 🏉
 * - Hockey: 🏑
 * - Tenis de mesa: 🏓
 * - Otros: 🏆
 */
export function getSportEmoji(sport: string | null | undefined): string {
  if (!sport) return "🏆";
  const s = sport.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (s.includes("padel") || s.includes("tenis") || s.includes("tennis")) return "🎾";
  if (s.includes("futbol") || s.includes("soccer") || s.includes("football")) return "⚽";
  if (s.includes("basquet") || s.includes("basket")) return "🏀";
  if (s.includes("voley") || s.includes("volley")) return "🏐";
  if (s.includes("rugby")) return "🏉";
  if (s.includes("hockey")) return "🏑";
  if (s.includes("ping") || s.includes("mesa")) return "🏓";
  if (s.includes("golf")) return "⛳";
  if (s.includes("natacion") || s.includes("swim")) return "🏊";
  return "🏆";
}

/**
 * Estilos visuales armónicos para el badge con soporte dark/light mode.
 */
export function getSportBadgeStyle(sport: string | null | undefined): string {
  if (!sport) return "bg-muted text-foreground border-border";
  const s = sport.toLowerCase().normalize("NFD").replace(/[\u0300-\u036f]/g, "").trim();
  if (s.includes("padel") || s.includes("tenis") || s.includes("tennis")) {
    return "bg-lime-500/10 text-lime-800 dark:text-lime-300 border-lime-500/25";
  }
  if (s.includes("futbol") || s.includes("soccer") || s.includes("football")) {
    return "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/25";
  }
  if (s.includes("basquet") || s.includes("basket")) {
    return "bg-orange-500/10 text-orange-800 dark:text-orange-300 border-orange-500/25";
  }
  if (s.includes("voley") || s.includes("volley")) {
    return "bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/25";
  }
  return "bg-secondary text-secondary-foreground border-border";
}

/**
 * Etiqueta visual del deporte con emoji identificatorio (similar a la etiqueta de estado).
 */
export function SportBadge({
  sport,
  className,
}: {
  sport: string | null | undefined;
  className?: string;
}) {
  if (!sport) return null;
  const emoji = getSportEmoji(sport);
  const colorStyle = getSportBadgeStyle(sport);

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 font-medium px-2 py-0.5 text-xs transition-colors select-none",
        colorStyle,
        className,
      )}
    >
      <span role="img" aria-label={sport} className="text-xs shrink-0">
        {emoji}
      </span>
      <span>{sport}</span>
    </Badge>
  );
}
