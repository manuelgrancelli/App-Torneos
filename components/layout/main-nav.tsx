"use client";

import Link from "next/link";
import { usePathname } from "next/navigation";
import { cn } from "@/lib/utils";
import type { AccountRole } from "@/lib/auth";
import { isNavItemActive, mainNavItems } from "./nav-items";

/** Navegación principal en el header (solo desktop). */
export function MainNav({ className, role }: { className?: string; role: AccountRole }) {
  const pathname = usePathname();

  return (
    <nav aria-label="Secciones" className={cn("flex items-center gap-1.5", className)}>
      {mainNavItems(role).map((item) => {
        const active = isNavItemActive(pathname, item.href);
        return (
          <Link
            key={item.href}
            href={item.href}
            aria-current={active ? "page" : undefined}
            className={cn(
              "flex h-9 items-center justify-center rounded-xl px-3.5 text-sm font-medium transition-all duration-150 border border-transparent",
              "focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-ring",
              active ? "text-amber-600 dark:text-amber-400 font-semibold" : "text-muted-foreground",
              "hover:bg-amber-500/15 hover:text-amber-900 dark:hover:text-amber-200 hover:border-amber-500/30",
            )}
          >
            {item.label}
          </Link>
        );
      })}
    </nav>
  );
}

