import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { AppHeader } from "@/components/layout/app-header";
import { BottomNav } from "@/components/layout/bottom-nav";
import { SkipLink } from "@/components/layout/skip-link";
import { getCurrentUser } from "@/lib/auth";

// Área privada: nunca se indexa (robots.ts también la excluye).
export const metadata: Metadata = { robots: { index: false, follow: false } };

/**
 * Layout del área privada. El proxy ya redirige a /login sin sesión; este
 * chequeo es la segunda barrera (defensa en profundidad).
 */
export default async function AppLayout({ children }: { children: React.ReactNode }) {
  const user = await getCurrentUser();
  if (!user) redirect("/login");

  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <AppHeader user={user} />
      {/* pb-24 deja lugar a la barra inferior en mobile. */}
      <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 pb-24 pt-6 md:pb-10">
        {children}
      </main>
      <BottomNav />
    </div>
  );
}
