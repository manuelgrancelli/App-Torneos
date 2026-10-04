import { CircleAlert } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { GoogleSignInButton } from "@/components/auth/google-sign-in-button";
import { LoginForm } from "@/components/auth/login-form";
import { Alert, AlertDescription } from "@/components/ui/alert";
import { FieldSeparator } from "@/components/ui/field";
import { DEFAULT_REDIRECT, getSafeRedirectPath } from "@/lib/utils/redirect";

export const metadata: Metadata = { title: "Ingresar" };

/** Mensajes para los errores que llegan desde /auth/callback y /auth/confirm (?error=...). */
const ERROR_MESSAGES: Record<string, string> = {
  auth: "No pudimos completar el inicio de sesión. Probá de nuevo.",
  link: "El link es inválido o ya expiró. Pedí uno nuevo.",
};

function firstParam(value: string | string[] | undefined): string | null {
  return typeof value === "string" ? value : null;
}

export default async function LoginPage({ searchParams }: PageProps<"/login">) {
  const params = await searchParams;
  const next = getSafeRedirectPath(firstParam(params.next));
  const errorCode = firstParam(params.error);
  const errorMessage = errorCode ? ERROR_MESSAGES[errorCode] : undefined;
  const signUpHref = next === DEFAULT_REDIRECT ? "/registro" : `/registro?next=${encodeURIComponent(next)}`;

  return (
    <AuthCard
      title="Ingresá a tu cuenta"
      description="Organizá tus torneos o seguí tus partidos."
      footer={
        <p>
          ¿No tenés cuenta?{" "}
          <Link href={signUpHref} className="font-medium text-foreground underline underline-offset-4">
            Registrate
          </Link>
        </p>
      }
    >
      {errorMessage ? (
        <Alert variant="destructive">
          <CircleAlert aria-hidden="true" />
          <AlertDescription>{errorMessage}</AlertDescription>
        </Alert>
      ) : null}
      <GoogleSignInButton next={next} />
      <FieldSeparator>o con tu email</FieldSeparator>
      <LoginForm next={next} />
    </AuthCard>
  );
}
