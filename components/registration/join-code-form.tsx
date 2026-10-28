"use client";

import { ArrowRight, Sparkles, Ticket } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState } from "react";
import { Button } from "@/components/ui/button";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { normalizeInviteCode } from "@/lib/validation/registration";

/** Portal para unirse a un torneo mediante código de invitación */
export function JoinCodeForm() {
  const router = useRouter();
  const [code, setCode] = useState("");
  const [error, setError] = useState<string | null>(null);

  function onSubmit(event: React.FormEvent) {
    event.preventDefault();
    const normalized = normalizeInviteCode(code);
    if (normalized.length !== 10) {
      setError("El código tiene 10 letras y números (por ejemplo ABCDE-FGHIJ).");
      return;
    }
    router.push(`/unirse/${normalized}`);
  }

  return (
    <div className="@container relative overflow-hidden rounded-xl border-2 border-border bg-gradient-to-br from-amber-500/5 via-card to-background py-2.5 px-3.5 sm:py-3 sm:px-4.5 shadow-xs transition-all hover:border-amber-500/40">
      <div className="flex flex-col gap-2.5 @2xl:flex-row @2xl:items-center @2xl:justify-between">
        <div className="flex items-center gap-2.5 shrink-0">
          <div className="flex size-8 shrink-0 items-center justify-center rounded-lg bg-amber-500/15 text-amber-500 dark:text-amber-400 border border-amber-500/30 shadow-xs shadow-amber-500/10">
            <Ticket className="size-4" aria-hidden="true" />
          </div>
          <div className="flex items-center gap-1.5">
            <span className="font-semibold text-sm text-foreground">
              Inscripción con código
            </span>
            <Sparkles className="size-3 text-amber-500 dark:text-amber-400" aria-hidden="true" />
          </div>
        </div>

        <form onSubmit={onSubmit} noValidate className="flex flex-col sm:flex-row gap-2 sm:items-end">
          <Field data-invalid={Boolean(error)} className="w-full sm:flex-1 @2xl:w-64 @2xl:flex-none">
            <FieldLabel htmlFor="join-code" className="text-[11px] font-medium text-foreground whitespace-normal">
              ¿Tenés un código de inscripción a un torneo?
            </FieldLabel>
            <Input
              id="join-code"
              value={code}
              onChange={(e) => {
                setCode(e.target.value);
                setError(null);
              }}
              placeholder="ABCDE-FGHIJ"
              autoComplete="off"
              autoCapitalize="characters"
              spellCheck="false"
              className="h-9 text-center sm:text-left font-mono font-bold tracking-widest text-base sm:text-xs uppercase bg-white dark:bg-zinc-900/90 text-zinc-950 dark:text-white placeholder:text-muted-foreground/50 dark:placeholder:text-zinc-500 border-2 border-zinc-300 dark:border-zinc-700 focus:bg-white dark:focus:bg-zinc-900 focus:border-zinc-600 dark:focus:border-white focus-visible:ring-zinc-400/20 transition-colors shadow-2xs"
              aria-invalid={Boolean(error)}
            />
          </Field>
          <Button
            type="submit"
            className="h-9 group px-3.5 text-xs font-semibold shadow-xs shadow-primary/20 hover:shadow-primary/30 transition-all active:scale-[0.98] shrink-0"
          >
            <span>Inscribirme</span>
            <ArrowRight className="size-3.5 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
          </Button>
        </form>
      </div>
      {error ? (
        <p className="mt-1.5 text-xs font-medium text-destructive">{error}</p>
      ) : null}
    </div>
  );
}

