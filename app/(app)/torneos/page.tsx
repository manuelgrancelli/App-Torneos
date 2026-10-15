import { History, Plus, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinCodeForm } from "@/components/registration/join-code-form";
import { PageHeader } from "@/components/shared/page-header";
import { TournamentDashboard } from "@/components/tournaments/tournament-dashboard";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { listOrganizedTournaments, listParticipations } from "@/lib/data/tournaments";

export const metadata: Metadata = { title: "Mis torneos" };

export default async function TournamentsPage() {
  // El layout de (app) ya garantiza la sesión.
  const user = await getCurrentUser();
  if (!user) return null;

  const [organized, participations] = await Promise.all([
    listOrganizedTournaments(user.id),
    listParticipations(user.id),
  ]);

  const finishedCount = organized.filter((t) => t.status === "finished").length;

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis torneos"
        description="Gestioná tus competencias organizadas o seguí los torneos donde jugás."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            {finishedCount > 0 ? (
              <Button asChild variant="outline" className="border-border/80 hover:bg-muted">
                <Link href="/torneos/historial">
                  <History className="size-4 mr-1.5 text-muted-foreground" aria-hidden="true" />
                  Historial ({finishedCount})
                </Link>
              </Button>
            ) : null}
            <Button asChild variant="outline" className="border-border/80 hover:bg-muted">
              <Link href="/circuitos">
                <Trophy className="size-4 mr-1.5 text-amber-500" aria-hidden="true" />
                Circuitos anuales
              </Link>
            </Button>
            <Button
              asChild
              className="bg-primary text-primary-foreground shadow-sm shadow-primary/25 hover:shadow-md hover:shadow-primary/35 transition-all active:scale-[0.98]"
            >
              <Link href="/torneos/nuevo">
                <Plus className="size-4 mr-1.5" aria-hidden="true" />
                Crear torneo
              </Link>
            </Button>
          </div>
        }
      />

      <JoinCodeForm />

      <TournamentDashboard
        organized={organized}
        participations={participations}
      />
    </div>
  );
}

