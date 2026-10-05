import type { Metadata } from "next";
import Link from "next/link";
import { AcceptTeamInvitationButton } from "@/components/registration/accept-team-invitation-button";
import { AuthCard } from "@/components/auth/auth-card";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = {
  title: "Aceptar invitación",
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

  return (
    <main className="mx-auto flex w-full max-w-lg flex-1 items-center px-4 py-10">
      <AuthCard
        title="Invitación a jugar"
        description="Para confirmar tu lugar en la pareja, usá la cuenta del email que recibió la invitación."
      >
        {token && user ? (
          <AcceptTeamInvitationButton token={token} />
        ) : token ? (
          <div className="flex flex-col gap-3">
            <Button asChild>
              <Link href={loginHref}>Ingresar y aceptar</Link>
            </Button>
            <Button asChild variant="outline">
              <Link href={signupHref}>Crear cuenta con este email</Link>
            </Button>
          </div>
        ) : (
          <p className="text-sm text-muted-foreground">El link de invitación no es válido. Pedile al capitán que te mande uno nuevo.</p>
        )}
      </AuthCard>
    </main>
  );
}
