import { CalendarDays, CircleAlert, CircleCheck, Lock, Users } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinCodeForm } from "@/components/registration/join-code-form";
import { TeamForm } from "@/components/registration/team-form";
import { EmptyState } from "@/components/shared/empty-state";
import { TournamentBanner } from "@/components/tournaments/tournament-banner";
import { SportBadge, StatusBadge } from "@/components/tournaments/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatDateRange } from "@/lib/dates";
import { approvedTeamsLabel, teamNoun } from "@/lib/domain/tournament-status";
import { createClient } from "@/lib/supabase/server";
import { normalizeInviteCode } from "@/lib/validation/registration";

export const metadata: Metadata = { title: "Inscripción" };

/** Sugerencia de nombre para parejas: "Apellido / ". */
function suggestedName(fullName: string, teamSize: number): string {
  if (teamSize !== 2) return "";
  const surname = fullName.trim().split(/\s+/).pop() ?? "";
  return surname ? `${surname} / ` : "";
}

export default async function JoinTournamentPage({ params }: PageProps<"/unirse/[code]">) {
  const { code: rawCode } = await params;
  const code = normalizeInviteCode(decodeURIComponent(rawCode));
  const user = await getCurrentUser();
  if (!user) return null;

  const supabase = await createClient();
  const { data } = await supabase.rpc("resolve_invite_code", { p_code: code });
  const tournament = data?.[0];

  if (!tournament) {
    return (
      <div className="mx-auto max-w-lg space-y-6">
        <h1 className="text-2xl font-bold tracking-tight">Inscripción</h1>
        <EmptyState
          icon={CircleAlert}
          title="El código no es válido"
          description="Revisá que esté bien escrito o pedile al organizador el link actualizado."
        />
        <JoinCodeForm />
      </div>
    );
  }

  // Traer afiche y descripción del torneo si están cargados
  const { data: tourExtra } = await supabase
    .from("tournaments")
    .select("banner_url, description")
    .eq("id", tournament.tournament_id)
    .maybeSingle();

  const bannerUrl = tourExtra?.banner_url ?? null;
  const description = tourExtra?.description ?? null;

  const noun = teamNoun(tournament.min_team_size);
  const full = tournament.approved_teams >= tournament.max_teams;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      {/* Afiche / Portada informativa subida por el organizador */}
      {bannerUrl ? (
        <section aria-label="Afiche oficial del torneo">
          <TournamentBanner
            src={bannerUrl}
            alt={`Afiche de ${tournament.name}`}
            tournamentName={tournament.name}
            priority
          />
        </section>
      ) : null}

      {/* Cabecera con datos del torneo */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SportBadge sport={tournament.sport_name} />
          <StatusBadge status={tournament.status} />
        </div>

        <h1 className="text-2xl font-semibold tracking-tight sm:text-3xl">{tournament.name}</h1>

        <ul className="flex flex-wrap gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <li className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4 shrink-0" aria-hidden="true" />
            <span>{formatDateRange(tournament.starts_on, tournament.ends_on)}</span>
          </li>
          <li className="inline-flex items-center gap-1.5">
            <Users className="size-4 shrink-0" aria-hidden="true" />
            <span>
              {tournament.approved_teams} de {tournament.max_teams} {approvedTeamsLabel(tournament.min_team_size)}
            </span>
          </li>
        </ul>

        {description ? (
          <div className="rounded-xl border bg-muted/30 p-3.5 text-sm text-muted-foreground whitespace-pre-line">
            {description}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          <Link
            href={`/t/${tournament.slug}`}
            className="hover:underline text-primary inline-flex items-center gap-1"
          >
            Ver página completa del torneo y fixture &rarr;
          </Link>
        </p>
      </header>

      {/* Estados del torneo o formulario de inscripción */}
      {tournament.my_team_id ? (
        <EmptyState
          icon={CircleCheck}
          title="Ya estás inscripto en este torneo"
          description="Desde tu inscripción podés ver el estado, el equipo y marcar tu disponibilidad."
          action={
            <Button asChild>
              <Link href={`/inscripciones/${tournament.my_team_id}`}>Ver mi inscripción</Link>
            </Button>
          }
        />
      ) : tournament.status !== "registration_open" ? (
        <EmptyState
          icon={Lock}
          title="La inscripción está cerrada"
          description="El organizador no está recibiendo inscripciones en este momento."
        />
      ) : full ? (
        <EmptyState
          icon={Lock}
          title="El torneo completó el cupo"
          description={`Ya hay ${tournament.approved_teams} ${approvedTeamsLabel(tournament.min_team_size)}.`}
        />
      ) : (
        <Card>
          <CardHeader>
            <CardTitle>
              <h2 className="text-base font-semibold">Inscribí tu {noun}</h2>
            </CardTitle>
            <p className="text-sm text-muted-foreground">
              {tournament.min_team_size === 2
                ? "Vos quedás como capitán. Cargá el email de tu pareja y le mandamos una invitación para que acepte."
                : `Vos quedás como capitán. Cargá los emails de los otros ${tournament.min_team_size - 1} integrantes; les mandamos una invitación para que acepten.`}{" "}
              El organizador aprueba la inscripción cuando todos aceptan.
            </p>
          </CardHeader>
          <CardContent>
            <TeamForm
              mode="register"
              code={code}
              teamSize={tournament.min_team_size}
              defaultName={suggestedName(user.fullName, tournament.min_team_size)}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
