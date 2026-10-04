import { CircleAlert, CircleCheck, Lock } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinCodeForm } from "@/components/registration/join-code-form";
import { TeamForm } from "@/components/registration/team-form";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
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
        <PageHeader title="Inscripción" />
        <EmptyState
          icon={CircleAlert}
          title="El código no es válido"
          description="Revisá que esté bien escrito o pedile al organizador el link actualizado."
        />
        <JoinCodeForm />
      </div>
    );
  }

  const noun = teamNoun(tournament.min_team_size);
  const full = tournament.approved_teams >= tournament.max_teams;

  return (
    <div className="mx-auto max-w-lg space-y-6">
      <PageHeader title={tournament.name} description={`${tournament.sport_name} · ${formatDateRange(tournament.starts_on, tournament.ends_on)}`} />

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
                ? "Vos quedás como capitán. Cargá el email de tu pareja."
                : `Vos quedás como capitán. Cargá los emails de los otros ${tournament.min_team_size - 1} integrantes.`}{" "}
              El organizador aprueba cada inscripción.
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
