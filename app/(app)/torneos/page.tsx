import { Plus, Trophy, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinCodeForm } from "@/components/registration/join-code-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { OrganizedTournamentCard, ParticipationCard } from "@/components/tournaments/tournament-card";
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

  return (
    <>
      <PageHeader
        title="Mis torneos"
        description="Los torneos que organizás y en los que jugás."
        actions={
          <div className="flex flex-wrap items-center gap-2">
            <Button asChild variant="outline">
              <Link href="/circuitos">
                Circuitos anuales
              </Link>
            </Button>
            <Button asChild>
              <Link href="/torneos/nuevo">
                <Plus aria-hidden="true" />
                Crear torneo
              </Link>
            </Button>
          </div>
        }
      />

      <div className="space-y-8">
        <section aria-labelledby="participo" className="space-y-3">
          <h2 id="participo" className="text-lg font-semibold">
            Participo
          </h2>
          <div className="rounded-xl border bg-muted/30 p-4">
            <JoinCodeForm />
          </div>
          {participations.length === 0 ? (
            <EmptyState
              icon={Users}
              title="Todavía no jugás en ningún torneo"
              description="Cuando te inscribas con el link o el código de un torneo, lo vas a ver acá."
            />
          ) : (
            <div className="grid gap-3">
              {participations.map((participation) => (
                <ParticipationCard key={participation.teamId} participation={participation} />
              ))}
            </div>
          )}
        </section>

        <section aria-labelledby="organizo" className="space-y-3">
          <h2 id="organizo" className="text-lg font-semibold">
            Organizo
          </h2>
          {organized.length === 0 ? (
            <EmptyState
              icon={Trophy}
              title="No organizás torneos"
              description="Creá uno: configurás el deporte, las canchas y los horarios, y compartís el link de inscripción."
              action={
                <Button asChild variant="outline">
                  <Link href="/torneos/nuevo">Crear torneo</Link>
                </Button>
              }
            />
          ) : (
            <div className="grid gap-3">
              {organized.map((tournament) => (
                <OrganizedTournamentCard key={tournament.id} tournament={tournament} />
              ))}
            </div>
          )}
        </section>
      </div>
    </>
  );
}
