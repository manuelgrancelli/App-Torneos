"use client";

import { CalendarClock, Check, Flag } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import { respondResult } from "@/app/(app)/inscripciones/[teamId]/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import {
  Dialog,
  DialogContent,
  DialogDescription,
  DialogFooter,
  DialogHeader,
  DialogTitle,
} from "@/components/ui/dialog";
import { Field, FieldLabel } from "@/components/ui/field";
import { Spinner } from "@/components/ui/spinner";
import { Textarea } from "@/components/ui/textarea";
import { formatInTimeZone, formatTimeRange } from "@/lib/dates";

export type MyMatch = {
  id: string;
  section: string;
  rivalName: string;
  startsAt: string | null;
  endsAt: string | null;
  courtName: string | null;
  resultText: string | null;
  outcome: "win" | "loss" | "draw" | null;
  resultStatus: "provisional" | "confirmed" | "disputed" | null;
  /** Lo que respondió mi equipo (si el torneo pide confirmación). */
  myResponse: "confirmed" | "disputed" | null;
};

const OUTCOME = {
  win: { label: "Ganado", className: "bg-emerald-100 text-emerald-900" },
  loss: { label: "Perdido", className: "bg-red-100 text-red-900" },
  draw: { label: "Empate", className: "bg-muted text-foreground" },
} as const;

/** Partidos del equipo, con confirmación u objeción del resultado si el torneo la pide. */
export function MyMatches({
  teamId,
  timezone,
  matches,
  requireConfirmation,
}: {
  teamId: string;
  timezone: string;
  matches: MyMatch[];
  requireConfirmation: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [disputing, setDisputing] = useState<MyMatch | null>(null);
  const [comment, setComment] = useState("");

  function respond(match: MyMatch, response: "confirmed" | "disputed", text = "") {
    startTransition(async () => {
      const result = await respondResult({ teamId, matchId: match.id, response, comment: text });
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Listo.");
      setDisputing(null);
      setComment("");
      router.refresh();
    });
  }

  if (matches.length === 0) {
    return <p className="text-sm text-muted-foreground">Todavía no tenés partidos asignados.</p>;
  }

  return (
    <>
      <ul className="divide-y rounded-lg border">
        {matches.map((match) => {
          const canRespond = requireConfirmation && match.resultText && match.resultStatus !== "confirmed";
          return (
            <li key={match.id} className="space-y-2 px-3 py-3">
              <div className="flex items-start justify-between gap-2">
                <div className="min-w-0">
                  <p className="text-xs text-muted-foreground">{match.section}</p>
                  <p className="truncate font-medium">vs {match.rivalName}</p>
                </div>
                <div className="text-right">
                  <p className="text-sm font-medium tabular-nums">{match.resultText ?? "—"}</p>
                  {match.outcome ? (
                    <Badge variant="secondary" className={OUTCOME[match.outcome].className}>
                      {OUTCOME[match.outcome].label}
                    </Badge>
                  ) : null}
                </div>
              </div>
              <p className="flex items-center gap-1 text-xs text-muted-foreground">
                <CalendarClock className="size-3.5" aria-hidden="true" />
                {match.startsAt && match.endsAt ? (
                  <>
                    <span className="first-letter:uppercase">{formatInTimeZone(match.startsAt, timezone, "EEE d/M")}</span>{" "}
                    {formatTimeRange(match.startsAt, match.endsAt, timezone)}
                    {match.courtName ? ` · ${match.courtName}` : ""}
                  </>
                ) : (
                  "Sin horario todavía"
                )}
              </p>
              {canRespond ? (
                match.myResponse ? (
                  <p className="text-xs text-muted-foreground">
                    {match.myResponse === "confirmed"
                      ? "Confirmaste el resultado. Falta el otro equipo."
                      : "Objetaste el resultado: lo revisa el organizador."}
                  </p>
                ) : (
                  <div className="flex gap-2">
                    <Button size="sm" disabled={isPending} onClick={() => respond(match, "confirmed")}>
                      {isPending ? <Spinner /> : <Check aria-hidden="true" />}
                      Confirmar
                    </Button>
                    <Button size="sm" variant="outline" disabled={isPending} onClick={() => setDisputing(match)}>
                      <Flag aria-hidden="true" />
                      Objetar
                    </Button>
                  </div>
                )
              ) : null}
            </li>
          );
        })}
      </ul>

      <Dialog open={Boolean(disputing)} onOpenChange={(open) => !open && setDisputing(null)}>
        <DialogContent>
          <DialogHeader>
            <DialogTitle>Objetar resultado</DialogTitle>
            <DialogDescription>
              {disputing ? `vs ${disputing.rivalName}: ${disputing.resultText}` : ""}. El organizador lo va a revisar.
            </DialogDescription>
          </DialogHeader>
          <Field>
            <FieldLabel htmlFor="dispute-comment">¿Qué está mal?</FieldLabel>
            <Textarea
              id="dispute-comment"
              rows={3}
              maxLength={500}
              value={comment}
              onChange={(e) => setComment(e.target.value)}
              placeholder="Por ejemplo: el segundo set fue 6-4."
            />
          </Field>
          <DialogFooter>
            <Button
              type="button"
              disabled={isPending || comment.trim().length === 0}
              onClick={() => disputing && respond(disputing, "disputed", comment)}
            >
              {isPending ? <Spinner /> : null}
              Enviar objeción
            </Button>
          </DialogFooter>
        </DialogContent>
      </Dialog>
    </>
  );
}
