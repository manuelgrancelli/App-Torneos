import { KeyRound, LogOut, Palette } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { signOut } from "@/app/(auth)/actions";
import { PageHeader } from "@/components/shared/page-header";
import { ThemeSelector } from "@/components/theme/theme-selector";
import { Avatar, AvatarFallback, AvatarImage } from "@/components/ui/avatar";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { getCurrentUser } from "@/lib/auth";
import { getInitials } from "@/lib/utils/text";

export const metadata: Metadata = { title: "Mi perfil" };

export default async function ProfilePage() {
  // El layout ya garantiza la sesión; acá solo se leen los datos.
  const user = await getCurrentUser();
  if (!user) return null;

  return (
    <div className="space-y-6">
      <PageHeader title="Mi perfil" />
      <Card>
        <CardContent className="flex flex-col gap-6 sm:flex-row sm:items-center sm:justify-between">
          <div className="flex items-center gap-4">
            <Avatar className="size-14">
              {user.avatarUrl ? <AvatarImage src={user.avatarUrl} alt="" /> : null}
              <AvatarFallback>{getInitials(user.fullName)}</AvatarFallback>
            </Avatar>
            <div className="min-w-0">
              <p className="truncate font-medium">{user.fullName}</p>
              <p className="truncate text-sm text-muted-foreground">{user.email}</p>
            </div>
          </div>
          <div className="flex flex-col gap-2 sm:flex-row">
            <Button variant="outline" asChild>
              <Link href="/actualizar-clave">
                <KeyRound aria-hidden="true" />
                Cambiar contraseña
              </Link>
            </Button>
            <form action={signOut}>
              <Button type="submit" variant="outline" className="w-full">
                <LogOut aria-hidden="true" />
                Cerrar sesión
              </Button>
            </form>
          </div>
        </CardContent>
      </Card>

      <Card>
        <CardHeader>
          <CardTitle className="flex items-center gap-2">
            <Palette className="size-5" aria-hidden="true" />
            Apariencia
          </CardTitle>
          <CardDescription>
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
