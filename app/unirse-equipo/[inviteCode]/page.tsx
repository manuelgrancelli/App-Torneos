import {
  CalendarDays,
  CircleAlert,
  CircleCheck,
  Crown,
  Lock,
  LogIn,
  Trophy,
  UserPlus,
  Users,
} from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { JoinTeamButton } from "@/components/registration/join-team-button";
import { EmptyState } from "@/components/shared/empty-state";
import { TeamShield } from "@/components/teams/team-shield";
import { SportBadge, StatusBadge } from "@/components/tournaments/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Invitación al equipo",
  robots: { index: false, follow: false },
};

type Props = {
  params: Promise<{ inviteCode: string }>;
};

export default async function JoinTeamPage({ params }: Props) {
  const { inviteCode: rawCode } = await params;
  const inviteCode = decodeURIComponent(rawCode).trim().toUpperCase();
  const user = await getCurrentUser();

  const supabase = await createClient();
  const { data: teamData, error } = await (supabase.rpc as any)("resolve_team_invite", {
    p_invite_code: inviteCode,
  });

  const team = teamData?.[0] ?? null;

  if (error || !team) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-12">
        <EmptyState
          icon={CircleAlert}
          title="El enlace no es válido"
          description="No encontramos un equipo asociado a este enlace de invitación. Pedile a tu capitán que te comparta el enlace actualizado."
          action={
            <Button asChild variant="outline">
              <Link href="/torneos">Ir a torneos</Link>
            </Button>
          }
        />
      </main>
    );
  }

  // Verificar si la inscripción sigue abierta
  if (team.tournament_status !== "registration_open") {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-12">
        <EmptyState
          icon={Lock}
          title="La inscripción ya cerró"
          description={`La inscripción para ${team.tournament_name} ya finalizó. No es posible sumarse al equipo en este momento.`}
          action={
            <Button asChild variant="outline">
              <Link href={`/t/${team.tournament_slug}`}>Ver torneo</Link>
            </Button>
          }
        />
      </main>
    );
  }

  // Consultar si el usuario actual ya está registrado en este equipo o en otro del mismo torneo
  let userInThisTeam = false;
  let userInOtherTeam = false;

  if (user) {
    const { data: existingMemberships } = await supabase
      .from("team_members")
      .select("team_id, tournament_id")
      .eq("tournament_id", team.tournament_id)
      .or(`user_id.eq.${user.id},email.eq.${user.email.toLowerCase().trim()}`);

    if (existingMemberships && existingMemberships.length > 0) {
      userInThisTeam = existingMemberships.some((m) => m.team_id === team.team_id);
      userInOtherTeam = !userInThisTeam;
    }
  }

  const isFull = team.members_count >= team.max_team_size;
  const loginUrl = `/login?next=${encodeURIComponent(`/unirse-equipo/${inviteCode}`)}`;
  const registerUrl = `/registro?next=${encodeURIComponent(`/unirse-equipo/${inviteCode}`)}`;

  return (
    <main className="mx-auto flex w-full max-w-md sm:max-w-lg flex-1 flex-col px-4 py-8 sm:py-12 space-y-5">
      {/* Cabecera del Torneo */}
      <header className="space-y-1.5 rounded-xl border bg-card p-3 sm:p-4 shadow-2xs">
        <div className="flex flex-wrap items-center justify-between gap-1.5">
          <SportBadge sport={team.sport_name} />
          <StatusBadge status={team.tournament_status} />
        </div>
        <h1 className="text-base sm:text-lg font-bold tracking-tight text-foreground">
          {team.tournament_name}
        </h1>
        {team.category_name ? (
          <p className="text-xs text-muted-foreground font-medium">
            Categoría: <span className="text-foreground">{team.category_name}</span>
          </p>
        ) : null}
      </header>

      {/* Tarjeta de Invitación al Equipo */}
      <Card className="border-2 border-emerald-500/40 shadow-sm">
        <CardHeader className="text-center pb-2">
          <div className="mx-auto mb-2">
            <TeamShield logoUrl={team.team_logo_url} teamName={team.team_name} size="xl" />
          </div>
          <CardTitle className="text-xl sm:text-2xl font-bold tracking-tight">
            {team.team_name}
          </CardTitle>
          <CardDescription className="text-xs sm:text-sm">
            Te invitaron a sumarte a este equipo para competir en el torneo
          </CardDescription>
        </CardHeader>

        <CardContent className="space-y-4 pt-1">
          {/* Detalles del Equipo */}
          <div className="rounded-lg border bg-muted/30 p-3 space-y-2 text-xs">
            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Crown className="size-3.5 text-amber-500" aria-hidden="true" />
                Capitán:
              </span>
              <span className="font-semibold text-foreground">{team.captain_name}</span>
            </div>

            <div className="flex items-center justify-between">
              <span className="text-muted-foreground flex items-center gap-1.5">
                <Users className="size-3.5 text-primary" aria-hidden="true" />
                Plantel actual:
              </span>
              <span className="font-semibold text-foreground">
                {team.members_count} de {team.max_team_size} jugadores
                {team.min_team_size > team.members_count ? ` (mínimo ${team.min_team_size})` : ""}
              </span>
            </div>
          </div>

          {/* Estado de Acceso / Botón para Unirse */}
          {!user ? (
            <div className="space-y-2 pt-1 text-center">
              <p className="text-xs text-muted-foreground">
                Iniciá sesión con tu cuenta o registrate para sumarte automáticamente al equipo.
              </p>
              <div className="flex flex-col sm:flex-row gap-2 pt-1">
                <Button asChild className="flex-1 h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-700">
                  <Link href={loginUrl}>
                    <LogIn className="size-3.5" aria-hidden="true" />
                    Iniciar sesión para unirme
                  </Link>
                </Button>
                <Button asChild variant="outline" className="flex-1 h-9 text-xs">
                  <Link href={registerUrl}>Crear cuenta</Link>
                </Button>
              </div>
            </div>
          ) : userInThisTeam ? (
            <div className="space-y-2 pt-1 text-center">
              <div className="flex items-center justify-center gap-1.5 text-emerald-600 dark:text-emerald-400 text-xs font-semibold">
                <CircleCheck className="size-4" />
                <span>Ya formás parte de este equipo</span>
              </div>
              <Button asChild className="w-full h-9 text-xs font-semibold">
                <Link href={`/inscripciones/${team.team_id}`}>Ver mi equipo y disponibilidad</Link>
              </Button>
            </div>
          ) : userInOtherTeam ? (
            <div className="rounded-lg border border-amber-500/30 bg-amber-500/10 p-3 text-xs text-amber-950 dark:text-amber-200 text-center">
              Ya estás inscripto en otro equipo de este torneo.
            </div>
          ) : isFull ? (
            <div className="rounded-lg border border-red-500/30 bg-red-500/10 p-3 text-xs text-red-950 dark:text-red-200 text-center">
              El equipo ya alcanzó el cupo máximo de {team.max_team_size} jugadores.
            </div>
          ) : (
            <div className="space-y-2 pt-1 flex flex-col items-center">
              <JoinTeamButton inviteCode={inviteCode} teamName={team.team_name} />
              <p className="text-[11px] text-muted-foreground text-center">
                Al unirte quedás registrado como jugador oficial en el plantel.
              </p>
            </div>
          )}
        </CardContent>
      </Card>
    </main>
  );
}
