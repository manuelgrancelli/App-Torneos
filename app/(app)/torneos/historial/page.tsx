import { ArrowLeft, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { PageHeader } from "@/components/shared/page-header";
import { FinishedTournamentsView } from "@/components/tournaments/finished-tournaments-view";
import { Button } from "@/components/ui/button";
import { getCurrentUser, isAccountOrganizer } from "@/lib/auth";
import { listOrganizedTournaments } from "@/lib/data/tournaments";

export const metadata: Metadata = {
  title: "Historial de torneos organizados",
  description: "Ediciones concluidas y campeones consagrados de tus torneos.",
};

export default async function OrganizedTournamentsHistoryPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const [organized, canCreate] = await Promise.all([listOrganizedTournaments(user.id), isAccountOrganizer()]);
  const finished = organized.filter((t) => t.status === "finished");

  return (
    <div className="space-y-6">
      <PageHeader
        title="Historial de torneos organizados"
        description="Ediciones concluidas, campeones consagrados y estadísticas acumuladas de tus competencias."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline" className="border-border/80 hover:bg-muted text-xs sm:text-sm">
              <Link href="/torneos">
                <ArrowLeft className="size-4 mr-1.5" aria-hidden="true" />
                Mis torneos
              </Link>
            </Button>
            {canCreate ? (
              <Button
                asChild
                className="bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:shadow-md hover:shadow-primary/35 transition-all text-xs sm:text-sm"
              >
                <Link href="/torneos/nuevo">
                  <Plus className="size-4 mr-1.5" aria-hidden="true" />
                  Crear torneo
                </Link>
              </Button>
            ) : null}
          </div>
        }
      />

      <FinishedTournamentsView tournaments={finished} canCreate={canCreate} />
    </div>
  );
}
