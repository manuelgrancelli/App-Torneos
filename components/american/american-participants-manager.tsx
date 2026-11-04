"use client";

import { AlertTriangle, CheckCircle2, Copy, Link as LinkIcon, Mail, Plus, Share2, Sparkles, Trash2, Trophy, UserCheck, UserPlus, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { toast } from "sonner";
import {
  addAmericanParticipant,
  cleanupDuplicateAmericanParticipants,
  fillTestAmericanParticipants,
  generateAmericanFixture,
  joinSelfAsAmericanParticipant,
  removeAmericanParticipant,
  resetAmericanFixture,
} from "@/app/(app)/torneos/[id]/americano/actions";
import { Button } from "@/components/ui/button";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { AmericanParticipant } from "@/lib/data/american";
import { cn } from "@/lib/utils";

export function AmericanParticipantsManager({
  tournamentId,
  inviteCode,
  participants,
  isIndividual,
  targetCount,
  targetRounds = 5,
  hasMatches,
  readOnly = false,
}: {
  tournamentId: string;
  inviteCode?: string | null;
  participants: AmericanParticipant[];
  isIndividual: boolean;
  targetCount: number;
  targetRounds?: number;
  hasMatches: boolean;
  readOnly?: boolean;
}) {
  const [name, setName] = useState("");
  const [secondaryName, setSecondaryName] = useState("");
  const [email, setEmail] = useState("");
  const [roundsToPlay, setRoundsToPlay] = useState<number>(targetRounds || 5);
  const [isPending, startTransition] = useTransition();

  const count = participants.length;
  const isMultipleOf4 = count >= 4 && count % 4 === 0;
  const canGenerate = isIndividual ? isMultipleOf4 : count >= 2;
  const remaining = isIndividual ? (4 - (count % 4)) % 4 : 0;

  const handleCopyInvite = () => {
    if (!inviteCode) return;
    const url = `${window.location.origin}/unirse/${inviteCode}`;
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(url);
      toast.success("Link copiado. Compartilo para que los jugadores se anoten solos.");
    } else {
      toast.info(`Link de inscripción: ${url}`);
    }
  };

  const handleAdd = (e: React.FormEvent) => {
    e.preventDefault();
    if (!name.trim()) {
      toast.error("Ingresá el nombre del participante.");
      return;
    }

    startTransition(async () => {
      const res = await addAmericanParticipant({
        tournamentId,
        displayName: name.trim(),
        secondaryDisplayName: secondaryName.trim() || undefined,
        email: email.trim() || undefined,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(res.message);
      setName("");
      setSecondaryName("");
      setEmail("");
    });
  };

  const handleFillTest = () => {
    startTransition(async () => {
      const res = await fillTestAmericanParticipants({ tournamentId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
    });
  };

  const handleJoinSelf = () => {
    startTransition(async () => {
      const res = await joinSelfAsAmericanParticipant({ tournamentId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
    });
  };

  const handleGenerate = () => {
    startTransition(async () => {
      const res = await generateAmericanFixture({ tournamentId, roundsCount: roundsToPlay });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
    });
  };

  const handleResetFixture = () => {
    if (!confirm("¿Seguro que querés reiniciar el fixture? Se perderán los marcadores cargados.")) {
      return;
    }
    startTransition(async () => {
      const res = await resetAmericanFixture({ tournamentId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
    });
  };

  const handleDelete = (participantId: string, participantName: string) => {
    startTransition(async () => {
      const res = await removeAmericanParticipant({ tournamentId, participantId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(`Participante ${participantName} eliminado.`);
    });
  };

  const handleCleanupDuplicates = () => {
    startTransition(async () => {
      const res = await cleanupDuplicateAmericanParticipants({ tournamentId });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
    });
  };

  // Detección de emails duplicados para advertir al organizador y ofrecer unificación
  const emailCountMap = new Map<string, number>();
  for (const p of participants) {
    if (p.email) {
      const em = p.email.trim().toLowerCase();
      emailCountMap.set(em, (emailCountMap.get(em) || 0) + 1);
    }
  }
  const duplicatedEmails = Array.from(emailCountMap.entries())
    .filter(([_, cnt]) => cnt > 1)
    .map(([em]) => em);

  return (
    <div className="space-y-5">
      {/* Barra de estado del cupo */}
      <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs flex flex-col sm:flex-row sm:items-center justify-between gap-4">
        <div>
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <Users className="size-4" />
            </span>
            <h3 className="text-base font-bold text-foreground">
              Participantes ({count} de {targetCount || count})
            </h3>
          </div>
          <p className="text-xs text-muted-foreground mt-1">
            {isIndividual ? (
              canGenerate ? (
                <span className="text-emerald-600 dark:text-emerald-400 font-semibold inline-flex items-center gap-1">
                  <CheckCircle2 className="size-3.5" />
                  ✓ Cantidad óptima de participantes (múltiplo de 4). ¡Listo para generar el fixture!
                </span>
              ) : (
                <span>
                  Faltan <strong>{remaining}</strong> participantes para alcanzar el próximo múltiplo de 4 ({count + remaining}).
                </span>
              )
            ) : (
              <span>{count} duplas inscriptas para competir en parejas fijas.</span>
            )}
          </p>
        </div>

        {/* Acciones principales (exclusivas del organizador) */}
        {!readOnly && (
          <div className="flex flex-wrap items-center gap-2">
            {inviteCode && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleCopyInvite}
                className="text-xs font-semibold hover:bg-muted cursor-pointer"
                title="Copiar link para que los jugadores se anoten solos"
              >
                <Share2 className="size-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
                Link de inscripción
              </Button>
            )}

            <Button
              type="button"
              variant="outline"
              size="sm"
              onClick={handleJoinSelf}
              disabled={isPending}
              className="text-xs font-semibold hover:bg-muted cursor-pointer"
              title="Anotarme con mi usuario actual a este torneo"
            >
              <UserPlus className="size-3.5 mr-1.5 text-emerald-600 dark:text-emerald-400" />
              Sumarme al torneo
            </Button>

            {!hasMatches && count < targetCount && (
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleFillTest}
                disabled={isPending}
                className="text-xs font-semibold border-dashed hover:bg-muted"
              >
                <Sparkles className="size-3.5 mr-1 text-emerald-600 dark:text-emerald-400" />
                Completar con prueba
              </Button>
            )}

            {canGenerate ? (
              <div className="flex items-center gap-1.5">
                <div className="flex items-center gap-1 rounded-lg border border-border/80 bg-muted/40 px-2 py-1">
                  <span className="text-[11px] font-medium text-muted-foreground">Rondas:</span>
                  <select
                    value={roundsToPlay}
                    onChange={(e) => setRoundsToPlay(Number(e.target.value))}
                    disabled={isPending}
                    className="bg-transparent text-xs font-bold text-foreground cursor-pointer outline-none"
                    title="Elegí cuántas rondas querés que jueguen"
                  >
                    {[1, 2, 3, 4, 5, 6, 7, 8, 9, 10, 11, 12].map((r) => (
                      <option key={r} value={r} className="bg-card text-foreground">
                        {r} {r === 1 ? "ronda" : "rondas"}
                      </option>
                    ))}
                  </select>
                </div>

                <Button
                  type="button"
                  size="sm"
                  onClick={handleGenerate}
                  disabled={isPending}
                  className="bg-emerald-600 hover:bg-emerald-500 text-white text-xs font-bold shadow-xs hover:shadow-md transition-all cursor-pointer"
                >
                  {isPending ? <Spinner /> : <Trophy className="size-3.5 mr-1.5" />}
                  {hasMatches ? `Regenerar (${roundsToPlay} rondas)` : `Generar Fixture (${roundsToPlay} rondas)`}
                </Button>
              </div>
            ) : null}

            {hasMatches && (
              <Button
                type="button"
                variant="ghost"
                size="sm"
                onClick={handleResetFixture}
                disabled={isPending}
                className="text-xs text-muted-foreground hover:text-destructive cursor-pointer"
              >
                Reiniciar fixture
              </Button>
            )}
          </div>
        )}
      </div>

      {/* Alerta de participantes duplicados con botón para unificar en 1 clic */}
      {!readOnly && duplicatedEmails.length > 0 && (
        <div className="rounded-2xl border border-amber-500/40 bg-amber-500/10 p-4 flex flex-col sm:flex-row sm:items-center justify-between gap-3 text-xs text-amber-950 dark:text-amber-200">
          <div className="flex items-start sm:items-center gap-2.5">
            <AlertTriangle className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5 sm:mt-0" />
            <div>
              <p className="font-bold">Se detectaron participantes duplicados en este torneo</p>
              <p className="text-[11px] text-muted-foreground">
                Hay registros repetidos con el correo: <strong>{duplicatedEmails.join(", ")}</strong>.
              </p>
            </div>
          </div>
          <Button
            type="button"
            size="sm"
            onClick={handleCleanupDuplicates}
            disabled={isPending}
            className="bg-amber-600 hover:bg-amber-500 text-white font-semibold text-xs h-8 shrink-0 cursor-pointer shadow-xs"
          >
            {isPending ? <Spinner /> : "Unificar y limpiar duplicados"}
          </Button>
        </div>
      )}

      {/* Formulario rápido para que el organizador inscriba participantes (oculto para jugadores) */}
      {!readOnly && (
        <form onSubmit={handleAdd} className="rounded-2xl border border-border/80 bg-muted/20 p-4 space-y-3">
          <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-1">
            <span className="text-xs font-bold text-foreground block">
              Inscribir participante {isIndividual ? "individual" : "dupla"} manualmente
            </span>
            <span className="text-[11px] text-muted-foreground">
              Los jugadores también pueden auto-inscribirse usando el link de inscripción.
            </span>
          </div>

          <div className="grid grid-cols-1 sm:grid-cols-3 gap-2.5">
            <Input
              value={name}
              onChange={(e) => setName(e.target.value)}
              disabled={isPending}
              placeholder={isIndividual ? "Nombre del jugador (ej. Lucas)" : "Nombre Jugador 1"}
              className="text-xs h-9 bg-card"
            />

            {!isIndividual && (
              <Input
                value={secondaryName}
                onChange={(e) => setSecondaryName(e.target.value)}
                disabled={isPending}
                placeholder="Nombre Jugador 2 (compañero)"
                className="text-xs h-9 bg-card"
              />
            )}

            <Input
              type="email"
              value={email}
              onChange={(e) => setEmail(e.target.value)}
              disabled={isPending}
              placeholder="Email (opcional - si no tiene, dejalo vacío)"
              className="text-xs h-9 bg-card"
            />

            <Button
              type="submit"
              size="sm"
              disabled={isPending || !name.trim()}
              className="h-9 text-xs font-semibold bg-foreground text-background hover:bg-foreground/90 shrink-0 cursor-pointer"
            >
              {isPending ? <Spinner /> : <Plus className="size-3.5 mr-1" />}
              Inscribir
            </Button>
          </div>

          <p className="text-[11px] text-muted-foreground leading-relaxed">
            💡 <strong>El email es opcional:</strong> si el jugador no usa la app o no conocés su correo, podés dejarlo vacío y registrar solo su nombre. Si ingresás su email y ya tiene una cuenta, se vinculará de inmediato.
          </p>
        </form>
      )}

      {/* Lista de participantes inscriptos */}
      <div className="grid grid-cols-1 sm:grid-cols-2 md:grid-cols-3 gap-2.5">
        {participants.map((p, index) => (
          <div
            key={p.id}
            className="rounded-xl border border-border/70 bg-card p-3 flex items-center justify-between gap-2 shadow-xs transition-colors hover:bg-muted/30"
          >
            <div className="flex items-center gap-2.5 min-w-0">
              <span className="flex size-6 items-center justify-center rounded-full bg-muted text-[11px] font-bold text-muted-foreground shrink-0">
                {index + 1}
              </span>
              <div className="min-w-0 space-y-0.5">
                <span className="text-sm font-semibold text-foreground block truncate">
                  {p.displayName}
                </span>
                {p.secondaryDisplayName && (
                  <span className="text-xs text-muted-foreground block truncate">
                    / {p.secondaryDisplayName}
                  </span>
                )}
                <div className="flex items-center gap-1.5 flex-wrap pt-0.5">
                  {p.email ? (
                    <span className="inline-flex items-center gap-1 text-[11px] text-muted-foreground truncate" title={p.email}>
                      <Mail className="size-3 shrink-0" />
                      <span className="truncate max-w-[140px]">{p.email}</span>
                    </span>
                  ) : (
                    <span className="text-[10px] text-muted-foreground/80 bg-muted/60 px-1.5 py-0.5 rounded-md">
                      Inscripción manual
                    </span>
                  )}
                  {p.userId && (
                    <span className="inline-flex items-center gap-0.5 text-[10px] font-medium text-emerald-600 dark:text-emerald-400 bg-emerald-500/10 px-1.5 py-0.5 rounded-md">
                      <UserCheck className="size-2.5" />
                      Cuenta vinculada
                    </span>
                  )}
                </div>
              </div>
            </div>

            {!readOnly && !hasMatches && (
              <button
                type="button"
                onClick={() => handleDelete(p.id, p.displayName)}
                disabled={isPending}
                className="text-muted-foreground hover:text-destructive p-1 rounded-md transition-colors cursor-pointer shrink-0"
                title="Eliminar participante"
              >
                <Trash2 className="size-3.5" />
              </button>
            )}
          </div>
        ))}
      </div>
    </div>
  );
}

