import { CalendarDays, Crown, UserRoundCheck, UserRoundX } from "lucide-react";
import type { Metadata } from "next";
import { notFound } from "next/navigation";
import { z } from "zod";
import { AvailabilityPicker } from "@/components/availability/availability-picker";
import { MyMatches } from "@/components/matches/my-matches";
import { SendTeamInvitationButton } from "@/components/registration/send-team-invitation-button";
import { TeamActions } from "@/components/registration/team-actions";
import { PublicPageLink } from "@/components/tournaments/public-page-link";
import { StatusBadge, TeamStatusBadge, SportBadge } from "@/components/tournaments/status-badge";
import { TournamentBanner } from "@/components/tournaments/tournament-banner";
import { Badge } from "@/components/ui/badge";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { buildTeamMatches } from "@/lib/competition-view";
import { getCompetition } from "@/lib/data/competition";
import { getTeamForMember } from "@/lib/data/teams";
import { formatDateRange } from "@/lib/dates";
import { teamNoun } from "@/lib/domain/tournament-status";

export const metadata: Metadata = { title: "Mi inscripción" };

/** Inscripción vista por un integrante: estado, plantel y disponibilidad. */
export default async function TeamPage({ params }: PageProps<"/inscripciones/[teamId]">) {
  const { teamId } = await params;
  if (!z.uuid().safeParse(teamId).success) notFound();
  const user = await getCurrentUser();
  if (!user) notFound();
  const team = await getTeamForMember(teamId, user.id);
  if (!team) notFound();

  const { tournament } = team;
  const registrationOpen = tournament.status === "registration_open";
  const noun = teamNoun(tournament.minTeamSize);
  const pendingMembers = team.members.filter((m) => !m.userId).length;
  const started = !["draft", "registration_open"].includes(tournament.status);
  const competition = started ? await getCompetition(tournament.id) : null;
  const myMatches = competition
    ? buildTeamMatches(
        team.id,
        competition.matches,
        competition.groups,
        new Map(competition.teams.map((t) => [t.id, t.name])),
        new Map(team.courts.map((c) => [c.id, c.name])),
        competition.confirmations,
      )
    : [];

  return (
    <div className="space-y-6">
      <header className="space-y-2">
        <div className="flex flex-wrap items-center gap-2">
          <span className="text-sm font-medium text-foreground">{tournament.name}</span>
          <SportBadge sport={tournament.sportName} />
        </div>
        <div className="flex flex-wrap items-center gap-2">
          <h1 className="text-2xl font-semibold tracking-tight">{team.name}</h1>
          <TeamStatusBadge status={team.status} />
        </div>
        <p className="flex flex-wrap items-center gap-x-3 gap-y-1 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1">
            <CalendarDays className="size-4" aria-hidden="true" />
            {formatDateRange(tournament.startsOn, tournament.endsOn)}
          </span>
          <StatusBadge status={tournament.status} />
          <PublicPageLink slug={tournament.slug} status={tournament.status} />
        </p>
      </header>

      {tournament.bannerUrl ? (
        <section aria-label="Afiche oficial del torneo">
          <TournamentBanner
            src={tournament.bannerUrl}
            alt={`Afiche de ${tournament.name}`}
            tournamentName={tournament.name}
          />
        </section>
      ) : null}

      {team.status === "pending" ? (
        <p className="rounded-lg bg-amber-50 px-4 py-3 text-sm text-amber-900">
          Tu inscripción está pendiente: el organizador tiene que aprobarla.
          {pendingMembers > 0 ? " Hay integrantes que todavía no aceptaron la invitación." : ""}
        </p>
      ) : team.status === "rejected" ? (
        <p className="rounded-lg bg-red-50 px-4 py-3 text-sm text-red-900">
          El organizador rechazó la inscripción. Podés editar el equipo para que la vuelva a revisar.
        </p>
      ) : null}

      {started ? (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-base font-semibold">Mis partidos</h2>
            </CardTitle>
            {tournament.resultsRequireConfirmation ? (
              <CardDescription>El organizador carga los resultados y tu equipo los confirma u objeta.</CardDescription>
            ) : null}
          </CardHeader>
          <CardContent>
            <MyMatches
              teamId={team.id}
              timezone={tournament.timezone}
              matches={myMatches}
              requireConfirmation={tournament.resultsRequireConfirmation}
            />
          </CardContent>
        </Card>
      ) : null}

      <div className="grid gap-6 lg:grid-cols-[1fr_2fr]">
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-base font-semibold">{noun === "pareja" ? "Pareja" : "Equipo"}</h2>
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-4">
            <ul className="divide-y rounded-lg border">
              {team.members.map((member) => (
                <li key={member.id} className="flex items-center gap-3 px-3 py-2">
                  {member.userId ? (
                    <UserRoundCheck className="size-5 shrink-0 text-emerald-700" aria-hidden="true" />
                  ) : (
                    <UserRoundX className="size-5 shrink-0 text-muted-foreground" aria-hidden="true" />
                  )}
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">
                      {member.fullName ?? member.displayName ?? member.email ?? "Sin nombre"}
                    </p>
                    <p className="truncate text-xs text-muted-foreground">
                      {member.userId
                        ? member.email
                        : member.email
                          ? "Pendiente de aceptar la invitación"
                          : "Sin cuenta asociada"}
                    </p>
                  </div>
                  {team.isCaptain && registrationOpen && member.role === "player" && !member.userId ? (
                    <SendTeamInvitationButton teamId={team.id} memberId={member.id} />
                  ) : null}
                  {member.role === "captain" ? (
                    <Badge variant="secondary">
                      <Crown aria-hidden="true" />
                      Capitán
                    </Badge>
                  ) : null}
                </li>
              ))}
            </ul>
            {registrationOpen ? (
              <TeamActions
                teamId={team.id}
                teamName={team.name}
                teamSize={tournament.minTeamSize}
                isCaptain={team.isCaptain}
                companionEmails={team.members.flatMap((member) =>
                  member.role !== "captain" && member.email ? [member.email] : [],
                )}
              />
            ) : (
              <p className="text-sm text-muted-foreground">
                La inscripción ya cerró: para cambios, hablá con el organizador.
              </p>
            )}
          </CardContent>
        </Card>

        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-base font-semibold">Disponibilidad</h2>
            </CardTitle>
            <CardDescription>
              {registrationOpen
                ? "Marcá todas las franjas en las que pueden jugar. Con eso se arman los horarios de los partidos."
                : "La inscripción cerró: la disponibilidad ya no se puede cambiar."}
            </CardDescription>
          </CardHeader>
          <CardContent>
            <AvailabilityPicker
              teamId={team.id}
              timezone={tournament.timezone}
              slots={team.slots}
              courts={team.courts}
              selected={team.availability}
              readOnly={!registrationOpen}
            />
          </CardContent>
        </Card>
      </div>
    </div>
  );
}
