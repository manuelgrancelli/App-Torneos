import Link from "next/link";
import { TrophyLogo } from "@/components/brand/trophy-logo";
import { SkipLink } from "@/components/layout/skip-link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { Button } from "@/components/ui/button";
import { APP_NAME } from "@/lib/config";

/**
 * Layout de las páginas públicas de torneos: sin sesión ni navegación privada.
 * "Ingresar" lleva al área privada (con sesión, la portada redirige sola).
 */
export default function PublicLayout({ children }: LayoutProps<"/t">) {
  return (
    <div className="flex min-h-dvh flex-col">
      <SkipLink />
      <header className="border-b">
        <div className="mx-auto flex h-14 w-full max-w-5xl items-center justify-between px-4">
          <Link href="/" className="group inline-flex items-center gap-2.5 font-semibold">
            <TrophyLogo />
            <span>{APP_NAME}</span>
          </Link>
          <div className="flex items-center gap-2">
            <ThemeToggle />
            <Button variant="outline" size="sm" asChild>
              <Link href="/login">Ingresar</Link>
            </Button>
          </div>
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
