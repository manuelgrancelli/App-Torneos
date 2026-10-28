import { Plus, Ticket, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { ActiveTournamentCard } from "@/components/player/active-tournament-card";
import { JoinCodeForm } from "@/components/registration/join-code-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { TournamentDashboard } from "@/components/tournaments/tournament-dashboard";
import { Button } from "@/components/ui/button";
import { getAccountRole, getCurrentUser } from "@/lib/auth";
import { type MyMatchRow, getMyMatches } from "@/lib/data/history";
import { listOrganizedTournaments, listParticipations } from "@/lib/data/tournaments";
import { compareMatchesChronological } from "@/lib/competition-view";

export const metadata: Metadata = { title: "Mis torneos" };

const ACTIVE_STATUSES = new Set(["registration_open", "group_stage", "playoffs"]);

export default async function TournamentsPage() {
  // El layout de (app) ya garantiza la sesión.
  const user = await getCurrentUser();
  if (!user) return null;

  const [role, organized, participations] = await Promise.all([
    getAccountRole(),
    listOrganizedTournaments(user.id),
    listParticipations(user.id),
  ]);

  if (role === "player") {
    return <PlayerHome userId={user.id} organized={organized} participations={participations} />;
  }

  return (
    <div className="space-y-6">
      <PageHeader
        title="Mis torneos"
        description="Gestioná tus competencias organizadas o seguí los torneos donde jugás."
        actions={
          <div className="flex flex-wrap items-center gap-2">
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

/**
 * Inicio de la cuenta de jugador (D-122): sin crear torneos ni circuitos.
 * Arriba, el ingreso por código de inscripción; después, los torneos en curso
 * con su etapa y el próximo partido, y al final el listado completo.
 */
async function PlayerHome({
  userId,
  organized,
  participations,
}: {
  userId: string;
  organized: Awaited<ReturnType<typeof listOrganizedTournaments>>;
  participations: Awaited<ReturnType<typeof listParticipations>>;
}) {
  const active = participations.filter((p) => ACTIVE_STATUSES.has(p.tournament.status));
  const { matches } = active.length > 0 ? await getMyMatches(userId) : { matches: [] as MyMatchRow[] };

  const byTeam = new Map<string, MyMatchRow[]>();
  for (const m of matches) byTeam.set(m.myTeamId, [...(byTeam.get(m.myTeamId) ?? []), m]);

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mis torneos"
        description="Inscribite con el código del torneo, seguí tu progreso e invitá a tu pareja."
      />

      <JoinCodeForm />

      <section aria-labelledby="en-curso" className="space-y-3">
        <h2 id="en-curso" className="text-lg font-semibold tracking-tight">
          En curso
        </h2>
        {active.length === 0 ? (
          <EmptyState
            icon={Ticket}
            title="No estás jugando ningún torneo ahora"
            description="Pedile al organizador el código o el link de inscripción y anotate con tu pareja."
          />
        ) : (
          <div className={active.length === 1 ? "max-w-2xl" : "grid grid-cols-1 gap-4 md:grid-cols-2"}>
            {active.map((participation) => {
              const teamMatches = byTeam.get(participation.teamId) ?? [];
              const next =
                teamMatches.filter((m) => m.resultText === null).sort(compareMatchesChronological)[0] ?? null;
              const played = teamMatches.filter((m) => m.outcome !== null);
              return (
                <ActiveTournamentCard
                  key={participation.teamId}
                  participation={participation}
                  nextMatch={next}
                  record={{ played: played.length, won: played.filter((m) => m.outcome === "win").length }}
                />
              );
            })}
          </div>
        )}
      </section>

      {participations.length > 0 || organized.length > 0 ? (
        <TournamentDashboard
          organized={organized}
          participations={participations}
          hideOrganized={organized.length === 0}
        />
      ) : null}
    </div>
  );
}
