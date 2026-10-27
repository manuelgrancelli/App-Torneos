"use client";

import {
  Calendar,
  CalendarClock,
  Clock,
  MapPin,
  Save,
  Trophy,
  X,
} from "lucide-react";
import { useRouter } from "next/navigation";
import { useMemo, useState, useTransition } from "react";
import { toast } from "sonner";
import { assignSlot, scheduleCustomMatch } from "@/app/(app)/torneos/[id]/partidos/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
  DialogTrigger,
} from "@/components/ui/dialog";
import { getCategoryColorByName } from "@/lib/category-colors";
import { formatDayHeading, formatInTimeZone, formatTimeRange, localDateKey, localToUtcIso } from "@/lib/dates";
import { roundName } from "@/lib/domain/bracket";
import { cn } from "@/lib/utils";

export type PlayoffMatchItem = {
  id: string;
  round: number;
  position: number;
  isThirdPlace?: boolean;
  homeName: string;
  awayName: string;
  startsAt: string | null;
  endsAt: string | null;
  courtId: string | null;
  categoryName?: string | null;
};

export type ScheduleBracketModalProps = {
  tournamentId: string;
  timezone: string;
  matches: PlayoffMatchItem[];
  courts: { id: string; name: string }[];
  tournamentDates?: {
    startsOn: string;
    endsOn: string;
  };
};

export function ScheduleBracketModal({
  tournamentId,
  timezone,
  matches,
  courts,
  tournamentDates,
}: ScheduleBracketModalProps) {
  const router = useRouter();
  const [open, setOpen] = useState(false);
  const [editingMatchId, setEditingMatchId] = useState<string | null>(null);
  const [isPending, startTransition] = useTransition();

  // Formulario temporal de edición
  const defaultDate = tournamentDates?.startsOn || tournamentDates?.endsOn || new Date().toISOString().slice(0, 10);
  const [formDate, setFormDate] = useState(defaultDate);
  const [formStart, setFormStart] = useState("14:00");
  const [formEnd, setFormEnd] = useState("15:30");
  const [formCourt, setFormCourt] = useState(courts[0]?.id ?? "");

  const courtNames = useMemo(() => new Map(courts.map((c) => [c.id, c.name])), [courts]);
  const maxRound = useMemo(
    () => matches.filter((m) => !m.isThirdPlace).reduce((max, m) => Math.max(max, m.round), 0),
    [matches],
  );

  // Agrupar cruces por ronda: desde la fase inicial (16avos, 8vos, 4tos) hasta la Final
  const roundsGrouped = useMemo(() => {
    const map = new Map<number, PlayoffMatchItem[]>();
    for (const m of matches) {
      const list = map.get(m.round) ?? [];
      list.push(m);
      map.set(m.round, list);
    }
    // Ordenar de menor ronda (primera fase eliminatoria) a mayor (Final)
    return Array.from(map.entries())
      .map(([round, list]): [number, PlayoffMatchItem[]] => [
        round,
        [...list].sort((a, b) => {
          if (a.isThirdPlace && !b.isThirdPlace) return 1;
          if (!a.isThirdPlace && b.isThirdPlace) return -1;
          return a.position - b.position;
        }),
      ])
      .sort(([a], [b]) => a - b);
  }, [matches]);

  function startEdit(match: PlayoffMatchItem) {
    setEditingMatchId(match.id);
    if (match.startsAt && match.endsAt) {
      setFormDate(localDateKey(match.startsAt, timezone));
      setFormStart(formatInTimeZone(match.startsAt, timezone, "HH:mm"));
      setFormEnd(formatInTimeZone(match.endsAt, timezone, "HH:mm"));
    } else {
      setFormDate(defaultDate);
      setFormStart("14:00");
      setFormEnd("15:30");
    }
    if (match.courtId) {
      setFormCourt(match.courtId);
    } else if (courts[0]) {
      setFormCourt(courts[0].id);
    }
  }

  function handleSave(matchId: string) {
    if (!formDate || !formStart || !formEnd || !formCourt) {
      toast.error("Completá fecha, hora inicio, hora fin y cancha.");
      return;
    }
    if (formStart >= formEnd) {
      toast.error("La hora de fin debe ser posterior a la de inicio.");
      return;
    }

    const startsAt = localToUtcIso(formDate, formStart, timezone);
    const endsAt = localToUtcIso(formDate, formEnd, timezone);

    startTransition(async () => {
      const res = await scheduleCustomMatch({
        tournamentId,
        matchId,
        startsAt,
        endsAt,
        courtId: formCourt,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success("Horario guardado correctamente.");
      setEditingMatchId(null);
      router.refresh();
    });
  }

  function handleClear(matchId: string) {
    startTransition(async () => {
      const res = await assignSlot({
        tournamentId,
        matchId,
        slotId: null,
        courtId: null,
      });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success("Horario quitado.");
      setEditingMatchId(null);
      router.refresh();
    });
  }

  return (
    <Dialog open={open} onOpenChange={setOpen}>
      <DialogTrigger asChild>
        <Button
          variant="outline"
          size="sm"
          className="gap-1.5 h-8 text-xs font-semibold border-border hover:bg-muted"
        >
          <CalendarClock className="size-4 text-emerald-500" aria-hidden="true" />
          <span>Programar horarios de cuadro</span>
        </Button>
      </DialogTrigger>

      <DialogContent className="max-h-[92dvh] overflow-y-auto overflow-x-hidden w-full sm:max-w-2xl p-4 sm:p-6">
        <DialogHeader className="space-y-1">
          <DialogTitle className="text-lg font-bold flex items-center gap-2">
            <CalendarClock className="size-5 text-emerald-500" />
            <span>Programar horarios de cuadro</span>
          </DialogTitle>
          <DialogDescription className="text-xs sm:text-sm text-muted-foreground">
            Elegí libremente fecha, horario y cancha para cada partido del cuadro eliminatorio, sin depender de las franjas horarias de grupos.
          </DialogDescription>
        </DialogHeader>

        {matches.length === 0 ? (
          <div className="py-8 text-center text-sm text-muted-foreground">
            Todavía no hay partidos de playoffs disponibles en el cuadro para programar.
          </div>
        ) : (
          <div className="space-y-6 pt-2">
            {roundsGrouped.map(([roundNum, roundMatches]) => {
              const label = roundName(roundNum, maxRound);
              return (
                <section key={roundNum} className="space-y-3">
                  <div className="flex items-center gap-2 border-b border-border/60 pb-1.5">
                    <Trophy className="size-4 text-amber-500" />
                    <h3 className="text-sm font-bold text-foreground uppercase tracking-wide">
                      {label}
                    </h3>
                    <Badge variant="outline" className="text-[10px] ml-auto">
                      {roundMatches.length} {roundMatches.length === 1 ? "cruce" : "cruces"}
                    </Badge>
                  </div>

                  <div className="space-y-2.5">
                    {roundMatches.map((m) => {
                      const isEditing = editingMatchId === m.id;
                      const hasSchedule = Boolean(m.startsAt && m.endsAt);
                      const catColor = getCategoryColorByName(m.categoryName);
                      const courtLabel = m.courtId ? courtNames.get(m.courtId) : null;

                      return (
                        <div
                          key={m.id}
                          className={cn(
                            "rounded-xl border border-border/80 bg-card p-3 space-y-2 transition-all",
                            catColor ? `border-l-4 ${catColor.borderLeft}` : "",
                          )}
                        >
                          {/* Cabecera del cruce */}
                          <div className="flex items-center justify-between gap-2">
                            <div className="flex items-center gap-1.5 min-w-0">
                              {m.categoryName ? (
                                <Badge
                                  variant="outline"
                                  className={cn("text-[10px] font-bold px-2 py-0.5 rounded-full shrink-0 border", catColor.badge)}
                                >
                                  {m.categoryName}
                                </Badge>
                              ) : null}
                              <span className="text-xs font-semibold text-muted-foreground">
                                {m.isThirdPlace ? "3er y 4to puesto" : `Cruce #${m.position + 1}`}
                              </span>
                            </div>

                            {/* Badge horario actual si existe */}
                            {!isEditing && hasSchedule ? (
                              <div className="flex items-center gap-1.5">
                                <div className="inline-flex items-center gap-1 rounded-full bg-emerald-500/10 border border-emerald-500/30 px-2.5 py-0.5 text-xs font-mono font-bold text-emerald-400 dark:text-emerald-300 tabular-nums">
                                  <Clock className="size-3 text-emerald-400" />
                                  <span>{formatInTimeZone(m.startsAt!, timezone, "EEE d/M")}</span>
                                  <span>{formatTimeRange(m.startsAt!, m.endsAt!, timezone)}</span>
                                </div>
                                {courtLabel ? (
                                  <div className="inline-flex items-center gap-1 rounded-full bg-sky-500/10 border border-sky-500/30 px-2 py-0.5 text-xs font-semibold text-sky-400">
                                    <MapPin className="size-3 text-sky-400" />
                                    <span>{courtLabel}</span>
                                  </div>
                                ) : null}
                              </div>
                            ) : !isEditing ? (
                              <span className="inline-flex items-center gap-1 rounded-full bg-amber-500/10 border border-amber-500/30 px-2 py-0.5 text-xs font-medium text-amber-400">
                                <Clock className="size-3 text-amber-400" />
                                <span>Sin horario</span>
                              </span>
                            ) : null}
                          </div>

                          {/* Equipos */}
                          <div className="text-xs sm:text-sm font-semibold space-y-0.5">
                            <p className="truncate text-foreground">{m.homeName}</p>
                            <p className="truncate text-foreground">{m.awayName}</p>
                          </div>

                          {/* Modo edición */}
                          {isEditing ? (
                            <div className="rounded-lg bg-muted/40 border border-border/70 p-3 space-y-3 mt-2">
                              <div className="grid grid-cols-1 sm:grid-cols-2 gap-2.5">
                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-muted-foreground block">
                                    Fecha
                                  </label>
                                  <input
                                    type="date"
                                    value={formDate}
                                    onChange={(e) => setFormDate(e.target.value)}
                                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary outline-hidden"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-muted-foreground block">
                                    Cancha
                                  </label>
                                  <select
                                    value={formCourt}
                                    onChange={(e) => setFormCourt(e.target.value)}
                                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary outline-hidden"
                                  >
                                    {courts.map((c) => (
                                      <option key={c.id} value={c.id}>
                                        {c.name}
                                      </option>
                                    ))}
                                  </select>
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-muted-foreground block">
                                    Hora inicio
                                  </label>
                                  <input
                                    type="time"
                                    value={formStart}
                                    onChange={(e) => setFormStart(e.target.value)}
                                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary outline-hidden"
                                  />
                                </div>

                                <div className="space-y-1">
                                  <label className="text-[11px] font-semibold text-muted-foreground block">
                                    Hora fin
                                  </label>
                                  <input
                                    type="time"
                                    value={formEnd}
                                    onChange={(e) => setFormEnd(e.target.value)}
                                    className="w-full rounded-md border border-input bg-background px-2.5 py-1.5 text-xs font-medium focus:ring-1 focus:ring-primary outline-hidden"
                                  />
                                </div>
                              </div>

                              <div className="flex items-center justify-end gap-2 pt-1">
                                <Button
                                  type="button"
                                  variant="ghost"
                                  size="sm"
                                  onClick={() => setEditingMatchId(null)}
                                  className="h-7 text-xs"
                                >
                                  Cancelar
                                </Button>
                                {hasSchedule ? (
                                  <Button
                                    type="button"
                                    variant="outline"
                                    size="sm"
                                    disabled={isPending}
                                    onClick={() => handleClear(m.id)}
                                    className="h-7 text-xs text-destructive hover:bg-destructive/10"
                                  >
                                    Quitar horario
                                  </Button>
                                ) : null}
                                <Button
                                  type="button"
                                  size="sm"
                                  disabled={isPending}
                                  onClick={() => handleSave(m.id)}
                                  className="h-7 text-xs gap-1 font-semibold"
                                >
                                  <Save className="size-3.5" />
                                  <span>Guardar</span>
                                </Button>
                              </div>
                            </div>
                          ) : (
                            <div className="flex items-center justify-end gap-2 pt-1 border-t border-border/40">
                              <Button
                                type="button"
                                variant="outline"
                                size="sm"
                                onClick={() => startEdit(m)}
                                className="h-7 text-xs gap-1 font-semibold"
                              >
                                <CalendarClock className="size-3.5 text-emerald-500" />
                                <span>{hasSchedule ? "Cambiar horario" : "Asignar horario"}</span>
                              </Button>
                            </div>
                          )}
                        </div>
                      );
                    })}
                  </div>
                </section>
              );
            })}
          </div>
        )}

        <DialogFooter className="pt-2">
          <Button type="button" variant="outline" onClick={() => setOpen(false)}>
            Cerrar
          </Button>
        </DialogFooter>
      </DialogContent>
    </Dialog>
  );
}
