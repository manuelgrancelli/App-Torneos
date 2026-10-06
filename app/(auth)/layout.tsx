import Link from "next/link";
import { TrophyLogo } from "@/components/brand/trophy-logo";
import { SkipLink } from "@/components/layout/skip-link";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { APP_NAME } from "@/lib/config";

/** Layout de las pantallas de autenticación: tarjeta centrada, mobile-first. */
export default function AuthLayout({ children }: { children: React.ReactNode }) {
  return (
    <div className="flex min-h-dvh flex-col bg-muted/40">
      <SkipLink />
      <header className="flex items-center justify-between px-4 py-4">
        <Link
          href="/"
          className="group inline-flex items-center gap-2.5 rounded-md font-semibold focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <TrophyLogo />
          <span>{APP_NAME}</span>
        </Link>
        <ThemeToggle />
      </header>
      <main id="contenido" className="flex flex-1 items-start justify-center px-4 pb-10 sm:items-center">
        <div className="w-full max-w-sm">{children}</div>
      </main>
    </div>
  );
}
