import { Calendar, Layers, Trophy } from "lucide-react";
import Link from "next/link";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { SportBadge } from "@/components/tournaments/sport-badge";
import type { CircuitListItem } from "@/lib/data/circuits";

export function CircuitCard({ circuit }: { circuit: CircuitListItem }) {
  return (
    <Card className="transition-all hover:border-foreground/30 hover:shadow-sm">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <SportBadge sport={circuit.sportName} />
          <span className="flex items-center gap-1 text-xs text-muted-foreground">
            <Calendar className="size-3.5" aria-hidden="true" />
            Año {circuit.year}
          </span>
        </div>
        <CardTitle className="text-lg">
          <Link href={`/circuitos/${circuit.id}`} className="hover:underline focus-visible:outline-none">
            {circuit.name}
          </Link>
        </CardTitle>
      </CardHeader>
      <CardContent className="space-y-3">
        {circuit.description ? (
          <p className="line-clamp-2 text-sm text-muted-foreground">{circuit.description}</p>
        ) : null}
        <div className="flex items-center gap-4 text-xs text-muted-foreground border-t pt-3">
          <span className="flex items-center gap-1.5 font-medium text-foreground">
            <Layers className="size-4 text-primary" aria-hidden="true" />
            {circuit.tournamentsCount} {circuit.tournamentsCount === 1 ? "fecha" : "fechas"}
          </span>
          <span className="flex items-center gap-1.5">
            <Trophy className="size-3.5 text-amber-500" aria-hidden="true" />
            Ranking individual activo
          </span>
        </div>
      </CardContent>
    </Card>
  );
}
