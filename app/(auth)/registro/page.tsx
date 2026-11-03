import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { FieldSeparator } from "@/components/ui/field";
import { ORGANIZER_CONTACT_PHONE, ORGANIZER_CONTACT_WHATSAPP_URL } from "@/lib/config";
import { DEFAULT_REDIRECT, getSafeRedirectPath } from "@/lib/utils/redirect";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function SignUpPage({ searchParams }: PageProps<"/registro">) {
  const params = await searchParams;
  const next = getSafeRedirectPath(typeof params.next === "string" ? params.next : null);
  const loginHref = next === DEFAULT_REDIRECT ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <AuthCard
      title="Creá tu cuenta"
      description="Con una sola cuenta participás de torneos y seguís tus partidos."
      footer={
        <div className="space-y-3">
          <p>
            ¿Ya tenés cuenta?{" "}
            <Link href={loginHref} className="font-medium text-foreground underline underline-offset-4">
              Ingresá
            </Link>
          </p>
          <div className="rounded-lg border border-border/80 bg-muted/40 p-2.5 text-xs text-muted-foreground flex flex-col sm:flex-row sm:items-center justify-between gap-1.5">
            <span>¿Querés organizar torneos?</span>
            <a
              href={ORGANIZER_CONTACT_WHATSAPP_URL}
              target="_blank"
              rel="noopener noreferrer"
              className="font-semibold text-emerald-600 dark:text-emerald-400 hover:underline shrink-0"
            >
              Contactanos: {ORGANIZER_CONTACT_PHONE} →
            </a>
          </div>
        </div>
      }
    >
      <GoogleSignInButton next={next} />
      <FieldSeparator>o con tu email</FieldSeparator>
      <SignUpForm next={next} />
    </AuthCard>
  );
}
