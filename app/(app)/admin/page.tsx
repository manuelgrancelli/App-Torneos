import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { ShieldCheck } from "lucide-react";
import { getCurrentUser, isSuperAdmin } from "@/lib/auth";
import { getAdminDashboardData } from "@/lib/data/admin";
import { AdminStatsOverview } from "@/components/admin/admin-stats-overview";
import { AdminTournamentList } from "@/components/admin/admin-tournament-list";
import { SuperAdminsDialog } from "@/components/admin/superadmins-dialog";

export const metadata: Metadata = {
  title: "Panel Administrador Global · LM Torneos",
  robots: { index: false, follow: false },
};

export default async function AdminDashboardPage() {
  const authorized = await isSuperAdmin();
  if (!authorized) {
    redirect("/");
  }

  const user = await getCurrentUser();
  const data = await getAdminDashboardData();

  if (!data) {
    redirect("/");
  }

  return (
    <div className="space-y-6">
      {/* Encabezado del Panel Admin */}
      <div className="flex flex-col gap-3 sm:flex-row sm:items-center sm:justify-between border-b pb-4 border-border/80">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <div className="flex size-7 items-center justify-center rounded-lg bg-amber-500/20 text-amber-600 dark:text-amber-400">
              <ShieldCheck className="size-4" />
            </div>
            <h1 className="text-xl sm:text-2xl font-bold tracking-tight text-foreground">
              Panel Administrador Global
            </h1>
          </div>
          <p className="text-xs text-muted-foreground">
            Auditoría de plataforma, métricas en tiempo real y supervisión deportiva de todos los torneos.
          </p>
        </div>

        {/* Botón para gestionar Superadministradores */}
        <SuperAdminsDialog
          superAdmins={data.superAdmins}
          currentUserEmail={user?.email}
        />
      </div>

      {/* Resumen de Estadísticas Globales */}
      <section aria-label="Estadísticas globales de la plataforma">
        <AdminStatsOverview stats={data.stats} />
      </section>

      {/* Listado de Todos los Torneos con filtros por En Curso / Inscripciones / etc */}
      <section aria-label="Listado de torneos y auditoría" className="space-y-3 pt-2">
        <div className="flex items-center justify-between">
          <h2 className="text-sm font-bold uppercase tracking-wider text-foreground">
            Torneos de la Plataforma
          </h2>
          <span className="text-xs text-muted-foreground">
            {data.tournaments.length} torneo(s) registrado(s)
          </span>
        </div>

        <AdminTournamentList tournaments={data.tournaments} />
      </section>
    </div>
  );
}

