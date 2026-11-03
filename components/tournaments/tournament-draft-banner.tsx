"use client";

import { useEffect, useState } from "react";
import Link from "next/link";
import { ArrowRight, FileEdit, Trash2 } from "lucide-react";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import {
  clearTournamentDraft,
  getTournamentDraft,
  type TournamentDraft,
} from "@/lib/storage/tournament-draft";
import { toast } from "sonner";

export function TournamentDraftBanner() {
  const [draft, setDraft] = useState<TournamentDraft | null>(null);

  useEffect(() => {
    const d = getTournamentDraft();
    if (
      d &&
      (d.values.name?.trim() ||
        d.step > 0 ||
        (d.values.venues && d.values.venues.length > 0) ||
        Boolean(d.values.startsOn))
    ) {
      setDraft(d);
    }
  }, []);

  if (!draft) return null;

  const name = draft.values.name?.trim() || "Torneo sin título";
  const venuesCount = draft.values.venues?.length;
  const courtsCount =
    draft.values.courtCount ||
    draft.values.venues?.reduce((acc, v) => acc + (v.courtCount || 0), 0) ||
    2;

  const handleDiscard = () => {
    clearTournamentDraft();
    setDraft(null);
    toast.info("Borrador de torneo descartado.");
  };

  return (
    <Card className="border-amber-500/40 bg-amber-500/5 shadow-xs overflow-hidden">
      <CardContent className="p-3.5 sm:p-4 flex flex-col sm:flex-row items-start sm:items-center justify-between gap-3">
        <div className="flex items-center gap-3 min-w-0">
          <div className="size-9 rounded-xl bg-amber-500/15 border border-amber-500/30 flex items-center justify-center text-amber-600 dark:text-amber-400 shrink-0">
            <FileEdit className="size-4" />
          </div>
          <div className="min-w-0">
            <div className="flex items-center gap-2">
              <span className="text-[10px] font-bold uppercase tracking-wider text-amber-600 dark:text-amber-400">
                Borrador pendiente
              </span>
              <span className="text-[11px] text-muted-foreground">
                · Paso {draft.step + 1} de 4
              </span>
            </div>
            <p className="text-sm font-semibold text-foreground truncate">{name}</p>
            <p className="text-xs text-muted-foreground">
              {venuesCount ? `${venuesCount} sedes · ` : ""}
              {courtsCount} canchas · Guardado automáticamente
            </p>
          </div>
        </div>

        <div className="flex items-center gap-2 self-end sm:self-center shrink-0">
          <Button
            type="button"
            variant="ghost"
            size="sm"
            onClick={handleDiscard}
            className="h-8 text-xs text-muted-foreground hover:text-destructive hover:bg-destructive/10 gap-1.5"
          >
            <Trash2 className="size-3.5" />
            <span>Descartar</span>
          </Button>
          <Button
            asChild
            size="sm"
            className="h-8 text-xs bg-emerald-600 hover:bg-emerald-500 text-white font-semibold gap-1.5 shadow-xs"
          >
            <Link href="/torneos/nuevo">
              <span>Continuar creación</span>
              <ArrowRight className="size-3.5" />
            </Link>
          </Button>
        </div>
      </CardContent>
    </Card>
  );
}

