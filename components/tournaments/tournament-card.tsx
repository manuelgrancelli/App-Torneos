import { CalendarDays, CheckCircle2, ChevronRight, Layers, ShieldCheck, Users } from "lucide-react";
import Link from "next/link";
import type { ParticipationItem, TournamentListItem } from "@/lib/data/tournaments";
import { formatDateRange } from "@/lib/dates";
import { approvedTeamsLabel } from "@/lib/domain/tournament-status";
import { cn } from "@/lib/utils";
import { StatusBadge, TeamStatusBadge, getSportEmoji } from "./status-badge";

/** Tarjeta táctil moderna de un torneo que organiza el usuario (estilo Linear/Vercel). */
export function OrganizedTournamentCard({ tournament }: { tournament: TournamentListItem }) {
  const categories = tournament.categories ?? [];
  const hasCategories = categories.length > 0;

  // Acción contextual según el momento del torneo
  const actionLabel =
    tournament.status === "registration_open"
      ? "Gestionar inscripciones"
      : tournament.status === "group_stage"
        ? "Gestionar grupos"
        : tournament.status === "playoffs"
          ? "Ver cuadro"
          : tournament.status === "draft"
            ? "Configurar torneo"
            : "Administrar torneo";

  return (
    <Link
      href={`/torneos/${tournament.id}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-border bg-card p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Indicador de estado superior */}
      <div
        className={cn(
          "absolute inset-x-0 top-0 h-1 transition-opacity",
          tournament.status === "registration_open" && "bg-gradient-to-r from-emerald-500 to-teal-400",
          tournament.status === "group_stage" && "bg-gradient-to-r from-sky-500 to-blue-500",
          tournament.status === "playoffs" && "bg-gradient-to-r from-amber-500 to-orange-400",
          tournament.status === "draft" && "bg-muted-foreground/30",
          tournament.status === "finished" && "bg-zinc-400"
        )}
      />

      <div className="space-y-3.5">
        {/* Cabecera con deporte, nombre y badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-lg border border-border shadow-2xs group-hover:scale-105 group-hover:bg-muted transition-transform">
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

        {/* Categorías del torneo */}
        {hasCategories ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground mr-0.5">
              <Layers className="size-3 text-muted-foreground/70" aria-hidden="true" />
              <span>{categories.length} {categories.length === 1 ? "categoría" : "categorías"}:</span>
            </span>
            {categories.slice(0, 4).map((cat) => (
              <span
                key={cat.id}
                className="inline-flex items-center gap-1 rounded-md border border-border/80 bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground transition-colors group-hover:border-primary/30"
              >
                <span className="truncate max-w-[120px]">{cat.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">({cat.approvedTeams})</span>
              </span>
            ))}
            {categories.length > 4 ? (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md">
                +{categories.length - 4} más
              </span>
            ) : null}
          </div>
        ) : (
          <div className="flex items-center gap-1.5 text-[11px] text-muted-foreground/80 italic">
            <Layers className="size-3" aria-hidden="true" />
            <span>Sin categorías configuradas aún</span>
          </div>
        )}

        {/* Panel de parejas inscriptas */}
        <div className="space-y-1.5 rounded-xl bg-muted/30 p-3 border border-border">
          <div className="flex items-center justify-between text-xs">
            <span className="flex items-center gap-1.5 font-medium text-muted-foreground">
              <Users className="size-3.5 text-primary" aria-hidden="true" />
              <span>Inscripciones:</span>
            </span>
            <span className="font-semibold tabular-nums text-foreground">
              {tournament.approvedTeams} {approvedTeamsLabel(tournament.teamSize)} inscriptas
            </span>
          </div>

          {tournament.pendingTeams > 0 ? (
            <div className="pt-1 flex items-center justify-between border-t border-border/30">
              <span className="inline-flex items-center gap-1.5 text-[11px] font-medium text-amber-700 dark:text-amber-400 bg-amber-500/10 px-2 py-0.5 rounded-full border border-amber-500/30">
                <span className="size-1.5 rounded-full bg-amber-500 animate-pulse" />
                {tournament.pendingTeams} {tournament.pendingTeams === 1 ? "pareja espera" : "parejas esperan"} aprobación
              </span>
            </div>
          ) : null}
        </div>
      </div>

      {/* Footer con fechas y botón de administrar */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
        <span className="inline-flex items-center gap-1.5">
          <CalendarDays className="size-3.5" aria-hidden="true" />
          {formatDateRange(tournament.startsOn, tournament.endsOn)}
        </span>

        <span className="inline-flex items-center gap-1 font-medium text-foreground group-hover:text-primary transition-colors">
          <span>{actionLabel}</span>
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
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-border bg-card p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      <div className="space-y-3.5">
        {/* Cabecera */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-lg border border-border shadow-2xs group-hover:scale-105 group-hover:bg-muted transition-transform">
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
        <div className="flex flex-wrap items-center justify-between gap-2 rounded-xl bg-muted/30 p-3 border border-border">
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
            <span className="rounded-md border border-border bg-background/80 px-2 py-0.5 text-[11px] font-medium text-muted-foreground">
              {participation.role === "captain" ? "Capitán" : "Jugador"}
            </span>
            <TeamStatusBadge status={participation.teamStatus} />
          </div>
        </div>
      </div>

      {/* Footer */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
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
  const categories = tournament.categories ?? [];
  const hasCategories = categories.length > 0;

  return (
    <Link
      href={`/torneos/${tournament.id}`}
      className="group relative flex flex-col justify-between overflow-hidden rounded-2xl border-2 border-border bg-card p-4 sm:p-5 shadow-xs transition-all duration-200 hover:-translate-y-0.5 hover:border-primary hover:shadow-md focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
    >
      {/* Indicador de estado superior neutral / zinc */}
      <div className="absolute inset-x-0 top-0 h-1 bg-zinc-400/80" />

      <div className="space-y-3.5">
        {/* Cabecera con deporte, nombre y badges */}
        <div className="flex items-start justify-between gap-3">
          <div className="flex items-center gap-3 min-w-0">
            <div className="flex size-10 shrink-0 items-center justify-center rounded-xl bg-muted/60 text-lg border border-border shadow-2xs group-hover:scale-105 group-hover:bg-muted transition-transform">
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

        {/* Categorías del torneo */}
        {hasCategories ? (
          <div className="flex flex-wrap items-center gap-1.5 pt-0.5">
            <span className="inline-flex items-center gap-1 text-[11px] font-semibold text-muted-foreground mr-0.5">
              <Layers className="size-3 text-muted-foreground/70" aria-hidden="true" />
              <span>{categories.length} {categories.length === 1 ? "categoría" : "categorías"}:</span>
            </span>
            {categories.slice(0, 3).map((cat) => (
              <span
                key={cat.id}
                className="inline-flex items-center gap-1 rounded-md border border-border bg-muted/40 px-2 py-0.5 text-[11px] font-medium text-foreground"
              >
                <span className="truncate max-w-[110px]">{cat.name}</span>
                <span className="font-mono text-[10px] text-muted-foreground">({cat.approvedTeams})</span>
              </span>
            ))}
            {categories.length > 3 ? (
              <span className="text-[10px] font-medium text-muted-foreground bg-muted/60 px-1.5 py-0.5 rounded-md border border-border/50">
                +{categories.length - 3} más
              </span>
            ) : null}
          </div>
        ) : null}

        {/* Estado finalizado */}
        <div className="flex items-center gap-2 rounded-xl bg-muted/30 border border-border p-2.5 text-xs text-muted-foreground">
          <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
          <span>Edición finalizada y resultados archivados</span>
        </div>

        {/* Conteo de participantes */}
        <div className="flex items-center justify-between text-xs text-muted-foreground px-0.5">
          <span className="flex items-center gap-1.5">
            <Users className="size-3.5" aria-hidden="true" />
            <span>Participación:</span>
          </span>
          <span className="font-medium text-foreground tabular-nums">
            {tournament.approvedTeams} {approvedTeamsLabel(tournament.teamSize)}
            {hasCategories ? ` · ${categories.length} cat.` : ""}
          </span>
        </div>
      </div>

      {/* Footer con fechas y botón de ver */}
      <div className="mt-4 flex items-center justify-between border-t border-border pt-3 text-xs text-muted-foreground">
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

