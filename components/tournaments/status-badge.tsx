import { Badge } from "@/components/ui/badge";
import { STATUS_LABELS, type TournamentStatus } from "@/lib/domain/tournament-status";
import { cn } from "@/lib/utils";

/** Colores con contraste AA sobre fondo claro. */
const STATUS_STYLES: Record<TournamentStatus, string> = {
  draft: "bg-muted text-foreground",
  registration_open: "bg-emerald-100 text-emerald-900",
  group_stage: "bg-sky-100 text-sky-900",
  playoffs: "bg-amber-100 text-amber-900",
  finished: "bg-zinc-200 text-zinc-900",
};

export function StatusBadge({ status, className }: { status: TournamentStatus; className?: string }) {
  return (
    <Badge variant="secondary" className={cn(STATUS_STYLES[status], className)}>
      {STATUS_LABELS[status]}
    </Badge>
  );
}

const TEAM_STATUS: Record<"pending" | "approved" | "rejected", { label: string; className: string }> = {
  pending: { label: "Pendiente", className: "bg-amber-100 text-amber-900" },
  approved: { label: "Aprobada", className: "bg-emerald-100 text-emerald-900" },
  rejected: { label: "Rechazada", className: "bg-red-100 text-red-900" },
};

export function TeamStatusBadge({ status }: { status: "pending" | "approved" | "rejected" }) {
  return (
    <Badge variant="secondary" className={TEAM_STATUS[status].className}>
      {TEAM_STATUS[status].label}
    </Badge>
  );
}
