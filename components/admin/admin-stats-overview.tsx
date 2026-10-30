import { Trophy, Flame, Users, CalendarDays, CheckCircle2, UserCheck, ShieldAlert } from "lucide-react";
import type { AdminDashboardStats } from "@/lib/data/admin";
import { Card, CardContent } from "@/components/ui/card";

export function AdminStatsOverview({ stats }: { stats: AdminDashboardStats }) {
  const completionRate =
    stats.totalMatches > 0 ? Math.round((stats.completedMatches / stats.totalMatches) * 100) : 0;
  const approvalRate =
    stats.totalTeams > 0 ? Math.round((stats.approvedTeams / stats.totalTeams) * 100) : 0;

  return (
    <div className="grid grid-cols-2 gap-3 sm:grid-cols-3 lg:grid-cols-4">
      {/* 1. Torneos en curso (Prioridad alta) */}
      <Card className="border-amber-500/30 bg-gradient-to-br from-amber-500/10 via-background to-background col-span-2 sm:col-span-1 shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-amber-700 dark:text-amber-400">
              En Curso
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <Flame className="size-4 animate-pulse" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {stats.runningTournaments}
            </span>
            <span className="text-xs text-muted-foreground">torneo(s) jugando</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Grupos o playoffs activos</p>
        </CardContent>
      </Card>

      {/* 2. Inscripciones abiertas */}
      <Card className="border-emerald-500/30 bg-gradient-to-br from-emerald-500/10 via-background to-background shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-semibold uppercase tracking-wider text-emerald-700 dark:text-emerald-400">
              Inscripciones
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
              <CalendarDays className="size-4" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {stats.openRegistrationTournaments}
            </span>
            <span className="text-xs text-muted-foreground">abiertos</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">Recibiendo parejas hoy</p>
        </CardContent>
      </Card>

      {/* 3. Total de torneos */}
      <Card className="border-border/60 bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Total Torneos
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-foreground">
              <Trophy className="size-4 text-amber-500" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {stats.totalTournaments}
            </span>
            <span className="text-xs text-muted-foreground">creados</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {stats.finishedTournaments} finalizados · {stats.draftTournaments} borradores
          </p>
        </CardContent>
      </Card>

      {/* 4. Parejas / Equipos inscriptos */}
      <Card className="border-border/60 bg-card shadow-sm">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Parejas / Equipos
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-foreground">
              <Users className="size-4 text-sky-500" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {stats.totalTeams}
            </span>
            <span className="text-xs text-muted-foreground">inscriptas</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            {stats.approvedTeams} aprobadas ({approvalRate}%)
          </p>
        </CardContent>
      </Card>

      {/* 5. Partidos jugados */}
      <Card className="border-border/60 bg-card shadow-sm col-span-2 sm:col-span-1 lg:col-span-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Partidos Disputados
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-foreground">
              <CheckCircle2 className="size-4 text-emerald-500" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {stats.completedMatches}
            </span>
            <span className="text-xs text-muted-foreground">de {stats.totalMatches} partidos ({completionRate}%)</span>
          </div>
          <div className="mt-2 h-1.5 w-full overflow-hidden rounded-full bg-muted">
            <div
              className="h-full bg-emerald-500 transition-all duration-500"
              style={{ width: `${completionRate}%` }}
            />
          </div>
        </CardContent>
      </Card>

      {/* 6. Usuarios en la plataforma */}
      <Card className="border-border/60 bg-card shadow-sm col-span-2 sm:col-span-2 lg:col-span-2">
        <CardContent className="p-4">
          <div className="flex items-center justify-between">
            <span className="text-xs font-medium uppercase tracking-wider text-muted-foreground">
              Deportistas y Cuentas
            </span>
            <div className="flex size-7 items-center justify-center rounded-lg bg-muted text-foreground">
              <UserCheck className="size-4 text-indigo-500" />
            </div>
          </div>
          <div className="mt-2 flex items-baseline gap-2">
            <span className="text-2xl font-bold tracking-tight text-foreground">
              {stats.totalUsers}
            </span>
            <span className="text-xs text-muted-foreground">usuarios registrados</span>
          </div>
          <p className="mt-1 text-[11px] text-muted-foreground">
            Jugadores y organizadores activos en la plataforma
          </p>
        </CardContent>
      </Card>
    </div>
  );
}

