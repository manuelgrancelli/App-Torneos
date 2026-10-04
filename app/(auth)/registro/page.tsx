import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { SignUpForm } from "@/components/auth/sign-up-form";
import { FieldSeparator } from "@/components/ui/field";
import { DEFAULT_REDIRECT, getSafeRedirectPath } from "@/lib/utils/redirect";

export const metadata: Metadata = { title: "Crear cuenta" };

export default async function SignUpPage({ searchParams }: PageProps<"/registro">) {
  const params = await searchParams;
  const next = getSafeRedirectPath(typeof params.next === "string" ? params.next : null);
  const loginHref = next === DEFAULT_REDIRECT ? "/login" : `/login?next=${encodeURIComponent(next)}`;

  return (
    <AuthCard
      title="Creá tu cuenta"
      description="Con una sola cuenta organizás torneos y participás en otros."
      footer={
        <p>
          ¿Ya tenés cuenta?{" "}
          <Link href={loginHref} className="font-medium text-foreground underline underline-offset-4">
            Ingresá
          </Link>
        </p>
      }
    >
      <GoogleSignInButton next={next} />
      <FieldSeparator>o con tu email</FieldSeparator>
      <SignUpForm next={next} />
    </AuthCard>
  );
}
