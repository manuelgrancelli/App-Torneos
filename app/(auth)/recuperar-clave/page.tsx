import type { Metadata } from "next";
import Link from "next/link";
import { AuthCard } from "@/components/auth/auth-card";
import { RecoverPasswordForm } from "@/components/auth/recover-password-form";

export const metadata: Metadata = { title: "Recuperar contraseña" };

export default function RecoverPasswordPage() {
  return (
    <AuthCard
      title="Recuperá tu contraseña"
      description="Te enviamos un link para elegir una nueva."
      footer={
        <Link href="/login" className="font-medium text-foreground underline underline-offset-4">
          Volver a ingresar
        </Link>
      }
    >
      <RecoverPasswordForm />
    </AuthCard>
  );
}
