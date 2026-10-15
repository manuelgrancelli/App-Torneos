import { CalendarDays, CheckCircle2, ChevronRight, ShieldCheck, Trophy, Users } from "lucide-react";
import Link from "next/link";
import type { ParticipationItem, TournamentListItem } from "@/lib/data/tournaments";
import { formatDateRange } from "@/lib/dates";
import { approvedTeamsLabel } from "@/lib/domain/tournament-status";
import { cn } from "@/lib/utils";
import { StatusBadge, TeamStatusBadge, getSportEmoji } from "./status-badge";

/** Tarjeta táctil moderna de un torneo que organiza el usuario (estilo Linear/Vercel). */
export function OrganizedTournamentCard({ tournament }: { tournament: TournamentListItem }) {
  const percentFilled =
    tournament.maxTeams > 0
      ? Math.min(100, Math.round((tournament.approvedTeams / tournament.maxTeams) * 100))
      : 0;
  const isComplete = tournament.maxTeams > 0 && tournament.approvedTeams >= tournament.maxTeams;

  return (
    <Link
      href={`/torneos/${tournament.id}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Indicador de estado superior */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 transition-opacity",
          tournament.status === "registration_open" && "bg-emerald-500",
          tournament.status === "group_stage" && "bg-sky-500",
          tournament.status === "playoffs" && "bg-amber-500",
          tournament.status === "draft" && "bg-muted-foreground/30",
          tournament.status === "finished" && "bg-zinc-400"
        )}
      />

      <div className="space-y-3.5">
        {/* Cabecera con deporte, nombre y badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-lg border border-border/60 shadow-2xs group-hover:scale-105 group-hover:bg-muted transition-transform">
              <span role="img" aria-label={tournament.sportName}>
                {getSportEmoji(tournament.sportName)}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-base sm:text-lg tracking-tight group-hover:text-primary transition-colors">
                {tournament.name}
              </h3>
              <p className="text-xs text-muted-foreground capitalize font-medium">
                {tournament.sportName}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <StatusBadge status={tournament.status} />
            {tournament.isTest ? (
              <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Prueba
              </span>
            ) : null}
          </div>
        </div>

        {/* Barra de progreso de cupos */}
        <div className="space-y-1.5 rounded-xl bg-muted/30 p-3 border border-border/40">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <Users className="size-3.5 text-muted-foreground" aria-hidden="true" />
              <span>Cupo del torneo:</span>
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {tournament.approvedTeams} / {tournament.maxTeams} {approvedTeamsLabel(tournament.teamSize)}
              {isComplete ? (
                <span className="ml-1 text-emerald-600 dark:text-emerald-400 font-bold">· Completo</span>
              ) : null}
            </span>
          </div>

          <div className="h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className={cn(
                "h-full rounded-full transition-all duration-500",
                isComplete ? "bg-emerald-500" : "bg-primary"
              )}
              style={{ width: `${percentFilled}%` }}
            />
          </div>

          {tournament.pendingTeams > 0 ? (
            <div className="pt-1 flex items-center justify-between">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                {tournament.pendingTeams} {tournament.pendingTeams === 1 ? "pareja espera" : "parejas esperan"} aprobación
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer con fechas y botón de administrar */}
      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {formatDateRange(tournament.startsOn, tournament.endsOn)}
        </span>

        <span className="inline-flex items-center gap-1 font-medium text-foreground group-hover:text-primary transition-colors">
          <span>Administrar</span>
          <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

/** Tarjeta táctil moderna de un torneo donde el usuario participa como jugador. */
export function ParticipationCard({ participation }: { participation: ParticipationItem }) {
  const { tournament } = participation;

  return (
    <Link
      href={`/inscripciones/${participation.teamId}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="space-y-3.5">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-lg border border-border/60 shadow-2xs group-hover:scale-105 group-hover:bg-muted transition-transform">
              <span role="img" aria-label={tournament.sportName}>
                {getSportEmoji(tournament.sportName)}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-base sm:text-lg tracking-tight group-hover:text-primary transition-colors">
                {tournament.name}
              </h3>
              <p className="text-xs text-muted-foreground capitalize font-medium">
                {tournament.sportName}
              </p>
            </div>
          </div>

          <StatusBadge status={tournament.status} />
        </div>

        {/* Detalle del equipo del participante */}
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/30 p-3 border border-border/40">
          <div className="flex items-center gap-2.5 min-w-0">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-primary/10 text-primary font-bold text-xs">
              <ShieldCheck className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0">
              <span className="text-[11px] text-muted-foreground block leading-tight">Tu equipo:</span>
              <span className="font-semibold text-sm text-foreground truncate block">
                {participation.teamName}
              </span>
            </div>
          </div>

          <div className="flex items-center gap-2 shrink-0">
            <span className="rounded-md border bg-background/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {participation.role === "captain" ? "Capitán" : "Jugador"}
            </span>
            <TeamStatusBadge status={participation.teamStatus} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {formatDateRange(tournament.startsOn, tournament.endsOn)}
        </span>

        <span className="inline-flex items-center gap-1 font-medium text-foreground group-hover:text-primary transition-colors">
          <span>Ver mi equipo</span>
          <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

/** Tarjeta táctil moderna de un torneo finalizado en el historial del organizador. */
export function FinishedTournamentCard({ tournament }: { tournament: TournamentListItem }) {
  return (
    <Link
      href={`/torneos/${tournament.id}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border border-border/80 bg-card p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary/50 hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Indicador de estado superior neutral / zinc */}
      <div className="absolute inset-x-0 top-0 h-1 bg-zinc-400/80" />

      <div className="space-y-3.5">
        {/* Cabecera con deporte, nombre y badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-lg border border-border/60 shadow-2xs group-hover:scale-105 group-hover:bg-muted transition-transform">
              <span role="img" aria-label={tournament.sportName}>
                {getSportEmoji(tournament.sportName)}
              </span>
            </div>
            <div className="min-w-0">
              <h3 className="truncate font-semibold text-base sm:text-lg tracking-tight group-hover:text-primary transition-colors">
                {tournament.name}
              </h3>
              <p className="text-xs text-muted-foreground capitalize font-medium">
                {tournament.sportName}
              </p>
            </div>
          </div>

          <div className="flex shrink-0 items-center gap-1.5">
            <StatusBadge status="finished" />
            {tournament.isTest ? (
              <span className="rounded-full border border-border bg-muted/60 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
                Prueba
              </span>
            ) : null}
          </div>
        </div>

        {/* Destacado del Campeón o estado final */}
        {tournament.championName ? (
          <div className="flex items-center gap-2.5 rounded-xl bg-amber-500/10 border border-amber-500/30 p-3 text-xs text-amber-950 dark:text-amber-200">
            <div className="flex size-7 shrink-0 items-center justify-center rounded-lg bg-amber-500/20 text-amber-700 dark:text-amber-300">
              <Trophy className="size-4" aria-hidden="true" />
            </div>
            <div className="min-w-0 flex-1">
              <span className="text-[10px] uppercase font-bold tracking-wider text-amber-700/80 dark:text-amber-400 block leading-tight">
                Campeón
              </span>
              <span className="font-semibold text-sm truncate block">
                {tournament.championName}
              </span>
            </div>
          </div>
        ) : (
          <div className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border/40 p-2.5 text-xs text-muted-foreground">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
            <span>Edición finalizada y resultados archivados</span>
          </div>
        )}

        {/* Conteo de participantes */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden="true" />
            <span>Participación:</span>
          </span>
          <span className="font-medium text-foreground tabular-nums">
            {tournament.approvedTeams} {approvedTeamsLabel(tournament.teamSize)}
          </span>
        </div>
      </div>

      {/* Footer con fechas y botón de ver */}
      <div className="mt-4 flex items-center justify-between border-t border-border/50 pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {formatDateRange(tournament.startsOn, tournament.endsOn)}
        </span>

        <span className="inline-flex items-center gap-1 font-medium text-foreground group-hover:text-primary transition-colors">
          <span>Ver resumen y cruces</span>
          <ChevronRight className="size-4 group-hover:translate-x-1 transition-transform" aria-hidden="true" />
        </span>
      </div>
    </Link>
  );
}

