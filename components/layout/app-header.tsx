import Link from "next/link";
import type { CurrentUser } from "@/lib/auth";
import { APP_NAME } from "@/lib/config";
import { TrophyLogo } from "@/components/brand/trophy-logo";
import { ThemeToggle } from "@/components/theme/theme-toggle";
import { MainNav } from "./main-nav";
import { UserMenu } from "./user-menu";

/** Header del área privada: marca, navegación (desktop) y menú de usuario. */
export function AppHeader({ user }: { user: CurrentUser }) {
  return (
    <header className="sticky top-0 z-40 border-b bg-background/95 backdrop-blur supports-[backdrop-filter]:bg-background/80">
      <div className="mx-auto flex h-14 w-full max-w-5xl items-center gap-4 px-4">
        <Link
          href="/torneos"
          title="Torneos"
          aria-label="Torneos"
          className="group flex items-center gap-2.5 rounded-md font-semibold transition-opacity hover:opacity-90 focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring"
        >
          <TrophyLogo />
          <span>{APP_NAME}</span>
        </Link>
        <MainNav className="hidden md:flex" />
        <div className="ml-auto flex items-center gap-2">
          <ThemeToggle />
          <UserMenu user={user} />
        </div>
      </div>
    </header>
  );
}
