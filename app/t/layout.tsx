import { Trophy } from "lucide-react";
import Link from "next/link";
import { SkipLink } from "@/components/layout/skip-link";
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
          <Link href="/" className="inline-flex items-center gap-2 font-semibold">
            <Trophy className="size-5" aria-hidden="true" />
            {APP_NAME}
          </Link>
          <Button variant="outline" size="sm" asChild>
            <Link href="/login">Ingresar</Link>
          </Button>
        </div>
      </header>
      <main id="contenido" className="mx-auto w-full max-w-5xl flex-1 px-4 py-6">
        {children}
      </main>
    </div>
  );
}
