import { KeyRound, LogOut, Palette, Trophy } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { PlayerStatsSummary } from "@/components/player/player-stats-summary";
import { TournamentStatsSummary } from "@/components/tournaments/tournament-stats-summary";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getAccountRole, getCurrentUser } from "@/lib/auth";
import { getMyMatches } from "@/lib/data/history";
import { computePlayerStats } from "@/lib/domain/stats";
import { listOrganizedTournaments, listParticipations } from "@/lib/data/tournaments";
import { getInitials } from "@/lib/utils/text";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  // El layout ya garantiza la sesión; acá se leen los datos del usuario y sus torneos.
  const user = await getCurrentUser();
  if (!user) return null;

  const [role, organized, participations] = await Promise.all([
    getAccountRole(),
    listOrganizedTournaments(user.id),
    listParticipations(user.id),
  ]);
  // Cuenta de jugador sin torneos que co-administre: KPIs de jugador (D-122).
  const playerOnly = role === "player" && organized.length === 0;
  const history = playerOnly ? await getMyMatches(user.id) : null;

  return (
    <div className="space-y-8">
      <PageHeader
        title="Mi perfil"
        description="Tu cuenta, historial de competencias organizadas y torneos donde jugás."
      />

      {/* Tarjeta de usuario */}
      <Card className="rounded-2xl border-border/80 shadow-xs">
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between p-5 sm:p-6">
          <div className="flex items-center gap-4">
            <Avatar className="size-16 border-2 border-primary/20 shadow-xs">
              {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
              <AvatarFallback className="font-semibold text-lg">{getInitials(user.fullName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <div className="flex flex-wrap items-center gap-2">
                <p className="truncate font-semibold text-lg text-foreground">{user.fullName}</p>
                <span className="rounded-full bg-primary/10 border border-primary/20 px-2 py-0.5 text-[11px] font-medium text-primary">
                  {role === "organizer"
                    ? participations.length > 0
                      ? "Organizador & Jugador"
                      : "Organizador"
                    : "Jugador"}
                </span>
              </div>
              <p className="truncate text-sm text-muted-foreground mt-0.5">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" asChild className="rounded-xl">
              <Link href="/actualizar-clave">
                <KeyRound aria-hidden="true" />
                Cambiar contraseña
              </Link>
            </Button>
            <form action={signOut}>
              <Button
                type="submit"
                variant="outline"
                className="w-full rounded-xl hover:bg-destructive/10 hover:text-destructive hover:border-destructive/30 transition-colors"
              >
                <LogOut aria-hidden="true" />
                Cerrar sesión
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      {/* Resumen de métricas de torneos (KPIs) */}
      {history ? (
        <PlayerStatsSummary
          tournaments={participations.length}
          stats={computePlayerStats(history.matches, history.championTournamentIds)}
        />
      ) : (
        <TournamentStatsSummary
          organized={organized}
          participations={participations}
        />
      )}

      {/* Apariencia */}
      <Card className="rounded-2xl border-border/80 shadow-xs">
        <CardHeader>
          <CardTitle className="flex items-center gap-2 text-base font-semibold">
            <Palette className="size-4 text-primary" aria-hidden="true" />
            Apariencia
          </CardTitle>
          <CardDescription className="text-xs">
            Personalizá cómo ves la aplicación: tema claro, oscuro o sincronizado con tu sistema.
          </CardDescription>
        </CardHeader>
        <CardContent>
          <ThemeSelector />
        </CardContent>
      </Card>
    </div>
  );
}

