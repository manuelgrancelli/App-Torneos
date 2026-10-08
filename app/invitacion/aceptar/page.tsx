import type { Metadata } from "next";
import Link from "next/link";
import { createHash } from "node:crypto";
import {
  CalendarDays,
  CircleAlert,
  Clock,
  ExternalLink,
  Lock,
  LogIn,
  UserCheck,
  UserPlus,
} from "lucide-react";
import { AcceptTeamInvitationButton } from "@/components/registration/accept-team-invitation-button";
import { EmptyState } from "@/components/shared/empty-state";
import { TournamentBanner } from "@/components/tournaments/tournament-banner";
import { SportBadge, StatusBadge } from "@/components/tournaments/status-badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { formatDateRange } from "@/lib/dates";
import { createClient } from "@/lib/supabase/server";

export const metadata: Metadata = {
  title: "Invitación de equipo",
  robots: { index: false, follow: false },
};

const TOKEN_PATTERN = /^[A-Za-z0-9_-]{43}$/;

export default async function AcceptInvitationPage({ searchParams }: PageProps<"/invitacion/aceptar">) {
  const params = await searchParams;
  const token = typeof params.token === "string" && TOKEN_PATTERN.test(params.token) ? params.token : null;
  const user = await getCurrentUser();

  const next = token ? `/invitacion/aceptar?token=${encodeURIComponent(token)}` : "/invitacion/aceptar";
  const loginHref = `/login?next=${encodeURIComponent(next)}`;
  const signupHref = `/registro?next=${encodeURIComponent(next)}`;

  if (!token) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-12">
        <EmptyState
          icon={CircleAlert}
          title="El enlace no es válido"
          description="El enlace de invitación está incompleto o no tiene el formato correcto. Pedile a tu compañero que te mande uno nuevo."
          action={
            <Button asChild variant="outline">
              <Link href="/">Ir al inicio</Link>
            </Button>
          }
        />
      </main>
    );
  }

  // Resolver metadatos de la invitación (torneo, afiche/banner, capitán, equipo)
  const tokenHash = createHash("sha256").update(token).digest("hex");
  const supabase = await createClient();
  const { data, error } = await supabase.rpc("resolve_team_invitation", { p_token_hash: tokenHash });

  if (error) {
    console.error("resolve_team_invitation error:", error.message);
  }

  const invitation = data?.[0] ?? null;

  // Si no se encuentra la invitación (ya fue aceptada o no existe en la base)
  if (!invitation) {
    return (
      <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-12">
        <EmptyState
          icon={CircleAlert}
          title="Invitación no encontrada o ya utilizada"
          description="No encontramos una invitación pendiente asociada a este enlace. Es posible que ya hayas aceptado la invitación o que el capitán la haya modificado."
          action={
            user ? (
              <Button asChild>
                <Link href="/torneos">Ver mis torneos</Link>
              </Button>
            ) : (
              <Button asChild>
                <Link href={loginHref}>Iniciar sesión</Link>
              </Button>
            )
          }
        />
      </main>
    );
  }

  const isUserMatching = Boolean(
    user?.email && user.email.trim().toLowerCase() === invitation.recipient_email.trim().toLowerCase()
  );

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 flex-col px-4 py-8 sm:py-12 space-y-6">
      {/* Afiche / Portada oficial del torneo (con visor lightbox para pantalla completa) */}
      {invitation.banner_url ? (
        <section aria-label="Afiche oficial del torneo">
          <TournamentBanner
            src={invitation.banner_url}
            alt={`Afiche oficial de ${invitation.tournament_name}`}
            tournamentName={invitation.tournament_name}
            priority
          />
        </section>
      ) : null}

      {/* Cabecera con datos del torneo */}
      <header className="space-y-3">
        <div className="flex flex-wrap items-center gap-2">
          <SportBadge sport={invitation.sport_name} />
          <StatusBadge status={invitation.tournament_status} />
        </div>

        <h1 className="text-2xl font-bold tracking-tight sm:text-3xl text-foreground">
          {invitation.tournament_name}
        </h1>

        <div className="flex flex-wrap items-center gap-x-4 gap-y-1.5 text-sm text-muted-foreground">
          <span className="inline-flex items-center gap-1.5">
            <CalendarDays className="size-4 shrink-0 text-primary" aria-hidden="true" />
            <span>{formatDateRange(invitation.starts_on, invitation.ends_on)}</span>
          </span>
        </div>

        {invitation.description ? (
          <div className="rounded-xl border bg-muted/30 p-3.5 text-sm text-muted-foreground whitespace-pre-line leading-relaxed">
            {invitation.description}
          </div>
        ) : null}

        <p className="text-xs text-muted-foreground">
          <Link
            href={`/t/${invitation.tournament_slug}`}
            className="hover:underline text-primary inline-flex items-center gap-1 font-medium"
          >
            <span>Ver detalles públicos del torneo</span>
            <ExternalLink className="size-3" aria-hidden="true" />
          </Link>
        </p>
      </header>

      {/* Tarjeta destacada con datos del compañero y el equipo */}
      <Card className="border-primary/30 bg-primary/5 dark:bg-primary/10 shadow-xs">
        <CardContent className="p-4 sm:p-5 flex items-start gap-3.5">
          <div className="rounded-xl bg-primary/15 p-2.5 text-primary shrink-0">
            <UserCheck className="size-5" aria-hidden="true" />
          </div>
          <div className="space-y-1.5 flex-1 min-w-0">
            <p className="text-xs font-semibold uppercase tracking-wider text-primary">
              Invitación de compañero
            </p>
            <p className="text-sm text-foreground leading-snug">
              <strong className="font-semibold text-foreground">{invitation.captain_name}</strong> te invitó a formar parte del equipo:
            </p>
            <p className="text-lg font-bold tracking-tight text-foreground truncate">
              {invitation.team_name}
            </p>
            <div className="pt-1 text-xs text-muted-foreground">
              Invitación dirigida a:{" "}
              <span className="font-mono font-medium text-foreground">{invitation.recipient_email}</span>
            </div>
          </div>
        </CardContent>
      </Card>

      {/* Estado y acciones según caducidad, estado del torneo y sesión */}
      {invitation.is_expired ? (
        <div className="rounded-xl border border-destructive/20 bg-destructive/10 p-4 text-sm text-destructive flex items-start gap-3">
          <Clock className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">Esta invitación venció</p>
            <p className="text-xs text-destructive/90 leading-relaxed">
              Las invitaciones tienen una validez de 7 días. Pedile a {invitation.captain_name} que te reenvíe la invitación desde la aplicación.
            </p>
          </div>
        </div>
      ) : invitation.tournament_status !== "registration_open" ? (
        <div className="rounded-xl border border-amber-500/20 bg-amber-500/10 p-4 text-sm text-amber-900 dark:text-amber-200 flex items-start gap-3">
          <Lock className="size-5 shrink-0 mt-0.5" aria-hidden="true" />
          <div className="space-y-1">
            <p className="font-semibold">La inscripción del torneo está cerrada</p>
            <p className="text-xs text-muted-foreground leading-relaxed">
              El torneo ya no se encuentra en período de inscripciones abiertas.
            </p>
          </div>
        </div>
      ) : user && isUserMatching ? (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">Confirmar tu participación</CardTitle>
            <p className="text-xs text-muted-foreground">
              Al aceptar, te sumás al equipo y el organizador podrá revisar la inscripción una vez que el plantel esté confirmado.
            </p>
          </CardHeader>
          <CardContent>
            <AcceptTeamInvitationButton token={token} />
          </CardContent>
        </Card>
      ) : user ? (
        <Card className="border-amber-500/40 bg-amber-500/5">
          <CardHeader className="pb-2">
            <CardTitle className="text-base font-semibold text-amber-700 dark:text-amber-400 flex items-center gap-2">
              <CircleAlert className="size-4 shrink-0" aria-hidden="true" />
              Estás conectado con otra cuenta
            </CardTitle>
          </CardHeader>
          <CardContent className="space-y-3 text-sm">
            <p className="text-muted-foreground text-xs leading-relaxed">
              Tenés la sesión iniciada como <strong className="text-foreground">{user.email}</strong>, pero esta invitación fue enviada a <strong className="text-foreground">{invitation.recipient_email}</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              Para unirte a {invitation.team_name}, cerrá sesión e ingresá con la cuenta invitada.
            </p>
            <div className="flex flex-col sm:flex-row gap-2 pt-1">
              <Button asChild className="flex-1">
                <Link href={loginHref}>
                  <LogIn className="size-4 mr-1.5" aria-hidden="true" />
                  Iniciar sesión con esa cuenta
                </Link>
              </Button>
              <Button asChild variant="outline" className="flex-1">
                <Link href="/torneos">Ir a mis torneos</Link>
              </Button>
            </div>
          </CardContent>
        </Card>
      ) : (
        <Card>
          <CardHeader className="pb-3">
            <CardTitle className="text-base font-semibold">¿Cómo unirte al equipo?</CardTitle>
            <p className="text-xs text-muted-foreground">
              Para confirmar tu lugar en <strong>{invitation.team_name}</strong>, ingresá o creá tu cuenta con el email al que te enviaron la invitación (<strong>{invitation.recipient_email}</strong>).
            </p>
          </CardHeader>
          <CardContent className="space-y-3">
            <Button asChild size="lg" className="w-full">
              <Link href={loginHref}>
                <LogIn className="size-4 mr-2" aria-hidden="true" />
                Iniciar sesión para aceptar
              </Link>
            </Button>
            <Button asChild variant="outline" size="lg" className="w-full">
              <Link href={signupHref}>
                <UserPlus className="size-4 mr-2" aria-hidden="true" />
                Crear cuenta con este email
              </Link>
            </Button>
          </CardContent>
        </Card>
      )}
    </main>
  );
}
