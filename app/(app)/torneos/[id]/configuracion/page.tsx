import { Layers } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { DeleteTournamentButton } from "@/components/tournaments/delete-tournament-button";
import { type FormLocks, TournamentForm } from "@/components/tournaments/tournament-form";
import { TournamentBannerManager } from "@/components/tournaments/tournament-banner-manager";
import { TournamentAdminsManager } from "@/components/tournaments/tournament-admins-manager";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { getTournamentAdmins, getTournamentCounts } from "@/lib/data/tournaments";
import type { ScoringConfig } from "@/lib/domain/scoring";
import type { StandingsConfig } from "@/lib/domain/standings";
import { canDeleteTournament } from "@/lib/domain/tournament-status";

export const metadata: Metadata = { title: "Configuración del torneo" };

/** Configuración del torneo. Lo que el estado no permite cambiar queda bloqueado con su motivo (D-029). */
export default async function TournamentSettingsPage({ params }: PageProps<"/torneos/[id]/configuracion">) {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);
  const [counts, admins] = await Promise.all([
    getTournamentCounts(tournament.id),
    getTournamentAdmins(tournament.id),
  ]);
  const inSetup = tournament.status === "draft" || tournament.status === "registration_open";
  const afterGroups = tournament.status === "playoffs" || tournament.status === "finished";

  const locks: FormLocks = {
    scoring: inSetup ? undefined : "La puntuación no se puede cambiar con el torneo en curso.",
    standings: afterGroups ? "La tabla de posiciones no se puede cambiar después de la fase de grupos." : undefined,
    playoff: afterGroups ? "La configuración de playoffs no se puede cambiar después de generar el cuadro." : undefined,
    timezone: counts.slots > 0 ? "La zona horaria no se puede cambiar porque ya hay franjas cargadas." : undefined,
  };

  return (
    <div className="max-w-2xl space-y-6">
      {/* Administradores y colaboradores */}
      <TournamentAdminsManager
        tournamentId={tournament.id}
        tournamentName={tournament.name}
        isOwner={tournament.isOwner}
        adminInviteCode={tournament.adminInviteCode}
        admins={admins}
      />

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">Categorías (Torneo Integrado)</h2>
          </CardTitle>
        </CardHeader>
        <CardContent className="space-y-3">
          <p className="text-sm text-muted-foreground">
            Creá y configurá las categorías que compiten en este torneo (ej: 6ta Caballeros, 4ta Damas, +10 Mixto).
            Cada una tendrá sus propios grupos y playoffs independientes, compartiendo las mismas canchas.
          </p>
          <Button asChild size="sm">
            <Link href={`/torneos/${tournament.id}/inscripciones`}>
              <Layers className="mr-2 size-4" />
              Administrar categorías en Inscripciones
            </Link>
          </Button>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle>
            <h2 className="text-base font-semibold">Afiche o portada del torneo</h2>
          </CardTitle>
        </CardHeader>
        <CardContent>
          <TournamentBannerManager
            tournamentId={tournament.id}
            bannerUrl={tournament.bannerUrl}
            tournamentName={tournament.name}
          />
        </CardContent>
      </Card>

      <TournamentForm
        tournamentId={tournament.id}
        sport={{
          id: tournament.sport.id,
          name: tournament.sport.name,
          minTeamSize: tournament.sport.min_team_size,
          defaultScoringConfig: tournament.sport.default_scoring_config as ScoringConfig,
          defaultStandingsConfig: tournament.sport.default_standings_config as StandingsConfig,
        }}
        defaults={{
          name: tournament.name,
          description: tournament.description ?? "",
          startsOn: tournament.startsOn,
          endsOn: tournament.endsOn,
          timezone: tournament.timezone,
          maxTeams: tournament.maxTeams,
          resultsRequireConfirmation: tournament.resultsRequireConfirmation,
          scoringConfig: tournament.scoringConfig,
          standingsConfig: tournament.standingsConfig,
          playoffConfig: tournament.playoffConfig,
        }}
        locks={locks}
      />

      {tournament.isOwner && canDeleteTournament(tournament.status) ? (
        <Card className="border-destructive/30 bg-destructive/5">
          <CardHeader>
            <CardTitle className="text-base font-semibold text-destructive">
              Zona de peligro
            </CardTitle>
          </CardHeader>
          <CardContent className="flex flex-col sm:flex-row sm:items-center justify-between gap-4">
            <div className="space-y-1">
              <p className="text-sm font-medium text-foreground">Eliminar este torneo</p>
              <p className="text-xs text-muted-foreground">
                Se borrarán permanentemente las categorías, inscripciones, partidos y grupos. Esta acción no se puede deshacer.
              </p>
            </div>
            <div className="shrink-0">
              <DeleteTournamentButton
                tournamentId={tournament.id}
                tournamentName={tournament.name}
              />
            </div>
          </CardContent>
        </Card>
      ) : null}
    </div>
  );
}
