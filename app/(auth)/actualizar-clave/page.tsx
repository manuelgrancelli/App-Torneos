import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AuthCard } from "@/components/auth/auth-card";
import { UpdatePasswordForm } from "@/components/auth/update-password-form";
import { getCurrentUser } from "@/lib/auth";

export const metadata: Metadata = { title: "Nueva contraseña" };

/**
 * Se llega desde el link de recuperación (que crea la sesión en /auth/confirm)
 * o desde el perfil. Sin sesión no hay nada que actualizar.
 */
export default async function UpdatePasswordPage() {
  const user = await getCurrentUser();
  if (!user) redirect("/login?next=/actualizar-clave");

  return (
    <AuthCard title="Elegí una nueva contraseña" description={`Cuenta: ${user.email}`}>
      <UpdatePasswordForm />
    </AuthCard>
  );
}
