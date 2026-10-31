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
import { normalizeScoringConfig } from "@/lib/domain/scoring";
import { approvedTeamsLabel, teamNoun } from "@/lib/domain/tournament-status";
import { createClient } from "@/lib/supabase/server";
import { normalizeInviteCode } from "@/lib/validation/registration";
import { getTournamentCategories } from "@/lib/data/categories";

export const metadata: Metadata = { title: "Inscripción" };

/** Sugerencia de nombre: para individual el nombre completo, para parejas "Apellido / ", para equipos vacío. */
function suggestedName(fullName: string, teamSize: number): string {
  if (teamSize === 1) return fullName.trim();
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

  // Traer afiche, descripción, configuración y categorías del torneo
  const [tourExtra, categories] = await Promise.all([
    supabase
      .from("tournaments")
      .select("banner_url, description, scoring_config")
      .eq("id", tournament.tournament_id)
      .maybeSingle(),
    getTournamentCategories(tournament.tournament_id),
  ]);

  const bannerUrl = tourExtra.data?.banner_url ?? null;
  const description = tourExtra.data?.description ?? null;
  const normalizedScoring = normalizeScoringConfig(tourExtra.data?.scoring_config);
  const minTeamSize =
    normalizedScoring.type === "goals"
      ? (normalizedScoring.minTeamSize ?? 5)
      : tournament.min_team_size;
  const maxTeamSize =
    normalizedScoring.type === "goals"
      ? (normalizedScoring.maxTeamSize ?? 15)
      : (tournament.max_team_size ?? tournament.min_team_size);

  const noun = teamNoun(minTeamSize, false, tournament.sport_id);
  const isFootball = tournament.sport_id.toLowerCase().includes("futbol");
  const hasCategories = categories.length > 0;
  const anyCategoryAvailable = hasCategories
    ? categories.some(
        (c) =>
          c.status === "registration_open" &&
          (c.maxTeams === null || c.approvedTeamsCount < c.maxTeams)
      )
    : false;
  const full = hasCategories
    ? !anyCategoryAvailable
    : tournament.approved_teams >= tournament.max_teams;

  return (
    <div className="mx-auto w-full max-w-md sm:max-w-lg space-y-3.5 min-w-0 overflow-x-hidden">
      {/* Afiche / Flyer de reglas oficial del torneo */}
      {bannerUrl ? (
        <section aria-label="Flyer oficial y reglas del torneo" className="space-y-1">
          <div className="flex items-center justify-between px-1">
            <span className="text-[11px] font-bold uppercase tracking-wider text-muted-foreground">
              📜 Flyer y reglas oficiales
            </span>
            <span className="text-[11px] text-muted-foreground">
              Tocá para ampliar
            </span>
          </div>
          <TournamentBanner
            src={bannerUrl}
            alt={`Flyer de ${tournament.name}`}
            tournamentName={tournament.name}
            priority
          />
        </section>
      ) : null}

      {/* Cabecera con datos del torneo */}
      <header className="space-y-2 rounded-xl border bg-card p-3 sm:p-4 shadow-2xs min-w-0">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <SportBadge sport={tournament.sport_name} />
          <StatusBadge status={tournament.status} />
        </div>

        <h1 className="text-lg sm:text-xl font-bold tracking-tight break-words text-foreground">
          {tournament.name}
        </h1>

        <ul className="flex flex-wrap gap-x-3.5 gap-y-1 text-xs text-muted-foreground">
          <li className="inline-flex items-center gap-1">
            <CalendarDays className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>{formatDateRange(tournament.starts_on, tournament.ends_on)}</span>
          </li>
          <li className="inline-flex items-center gap-1">
            <Users className="size-3.5 shrink-0 text-primary" aria-hidden="true" />
            <span>
              {hasCategories
                ? `${tournament.approved_teams} ${
                    isFootball
                      ? tournament.approved_teams === 1
                        ? "equipo inscripto"
                        : "equipos inscriptos"
                      : `${approvedTeamsLabel(tournament.min_team_size, tournament.sport_id)} inscriptas`
                  }`
                : `${tournament.approved_teams} de ${tournament.max_teams} ${approvedTeamsLabel(tournament.min_team_size, tournament.sport_id)}`}
            </span>
          </li>
        </ul>

        {description ? (
          <div className="rounded-lg border bg-muted/30 p-2.5 text-xs text-muted-foreground whitespace-pre-line break-words max-h-36 overflow-y-auto">
            {description}
          </div>
        ) : null}

        <p className="text-[11px] text-muted-foreground pt-0.5">
          <Link
            href={`/t/${tournament.slug}`}
            className="hover:underline text-primary inline-flex items-center gap-1 font-medium"
          >
            Ver página del torneo y fixture &rarr;
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
            <Button asChild size="sm" className="h-8 text-xs font-medium">
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
          title={hasCategories ? "Se completaron los cupos disponibles" : "El torneo completó el cupo"}
          description={
            hasCategories
              ? "Por el momento no quedan cupos disponibles en las categorías de este torneo."
              : `Ya hay ${tournament.approved_teams} ${approvedTeamsLabel(tournament.min_team_size, tournament.sport_id)}.`
          }
        />
      ) : (
        <Card size="sm" className="shadow-2xs min-w-0">
          <CardHeader className="pb-2">
            <CardTitle>
              <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-foreground">
                {isFootball
                  ? "INSCRIBIRSE A TORNEO"
                  : tournament.min_team_size === 1
                    ? "Inscripción individual"
                    : `Inscribí tu ${noun}`}
              </h2>
            </CardTitle>
            <p className="text-xs text-muted-foreground leading-snug">
              {tournament.sport_id.includes("futbol")
                ? "Vos quedás como capitán. Podés ingresar tu equipo y sumar los jugadores de tu plantel."
                : tournament.min_team_size === 1
                  ? "Completá tu nombre y seleccioná tu categoría para inscribirte."
                  : tournament.min_team_size === 2
                    ? "Vos quedás como capitán. Cargá el email de tu pareja para invitarla."
                    : "Vos quedás como capitán. Cargá los emails de tus compañeros."}
            </p>
          </CardHeader>
          <CardContent className="pt-0">
            <TeamForm
              mode="register"
              code={code}
              teamSize={minTeamSize}
              minTeamSize={minTeamSize}
              maxTeamSize={maxTeamSize}
              sportId={tournament.sport_id}
              scoringType={tournament.scoring_type}
              defaultName={suggestedName(user.fullName, minTeamSize)}
              captainName={user.fullName}
              captainEmail={user.email}
              categories={categories.map((c) => ({
                id: c.id,
                name: c.name,
                status: c.status,
                maxTeams: c.maxTeams,
                approvedTeamsCount: c.approvedTeamsCount,
              }))}
            />
          </CardContent>
        </Card>
      )}
    </div>
  );
}
