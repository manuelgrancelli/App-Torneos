import { Check, Clock, X } from "lucide-react";
import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type TournamentStatus } from "@/lib/domain/tournament-status";
import { cn } from "@/lib/utils";

/** Estilos modernos con contraste AA, soporte dark mode y dot indicator. */
const STATUS_STYLES: Record<
  TournamentStatus,
  { container: string; dot: string; ping?: boolean }
> = {
  draft: {
    container: "bg-muted text-muted-foreground border-border/80",
    dot: "bg-muted-foreground/60",
  },
  registration_open: {
    container: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
    dot: "bg-emerald-500",
    ping: true,
  },
  group_stage: {
    container: "bg-sky-500/10 text-sky-800 dark:text-sky-300 border-sky-500/30",
    dot: "bg-sky-500",
    ping: true,
  },
  playoffs: {
    container: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30",
    dot: "bg-amber-500",
    ping: true,
  },
  finished: {
    container: "bg-zinc-500/10 text-zinc-700 dark:text-zinc-300 border-zinc-500/25",
    dot: "bg-zinc-400",
  },
};

export function StatusBadge({ status, className }: { status: TournamentStatus; className?: string }) {
  const config = STATUS_STYLES[status] ?? STATUS_STYLES.draft;

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1.5 px-2.5 py-0.5 text-xs font-medium tracking-tight rounded-full transition-colors select-none",
        config.container,
        className
      )}
    >
      <span className="relative flex size-1.5 shrink-0">
        {config.ping ? (
          <span
            className={cn(
              "absolute inline-flex h-full w-full animate-ping rounded-full opacity-75",
              config.dot
            )}
          />
        ) : null}
        <span className={cn("relative inline-flex size-1.5 rounded-full", config.dot)} />
      </span>
      <span>{STATUS_LABELS[status]}</span>
    </Badge>
  );
}

const TEAM_STATUS: Record<
  "pending" | "approved" | "rejected",
  { label: string; className: string; icon: typeof Check }
> = {
  pending: {
    label: "Pendiente",
    className: "bg-amber-500/10 text-amber-800 dark:text-amber-300 border-amber-500/30",
    icon: Clock,
  },
  approved: {
    label: "Aprobada",
    className: "bg-emerald-500/10 text-emerald-800 dark:text-emerald-300 border-emerald-500/30",
    icon: Check,
  },
  rejected: {
    label: "Rechazada",
    className: "bg-red-500/10 text-red-800 dark:text-red-300 border-red-500/30",
    icon: X,
  },
};

export function TeamStatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  const item = TEAM_STATUS[status] ?? TEAM_STATUS.pending;
  const Icon = item.icon;

  return (
    <Badge
      variant="outline"
      className={cn(
        "inline-flex items-center gap-1 px-2 py-0.5 text-[11px] font-medium rounded-full select-none",
        item.className
      )}
    >
      <Icon className="size-3 shrink-0" aria-hidden="true" />
      <span>{item.label}</span>
    </Badge>
  );
}

export { SportBadge, getSportEmoji } from "./sport-badge";


