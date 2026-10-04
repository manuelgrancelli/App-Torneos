import Link from "next/link";
import { cn } from "@/lib/utils";

/**
 * Pestañas de la página pública como links con `?vista=`: la URL se puede
 * compartir y funciona sin JavaScript. La activa lleva aria-current.
 */
export function ViewTabs<T extends string>({
  basePath,
  views,
  active,
}: {
  basePath: string;
  views: readonly { value: T; label: string }[];
  active: T;
}) {
  return (
    <nav aria-label="Vistas del torneo" className="-mx-4 overflow-x-auto px-4 [scrollbar-width:none]">
      <ul className="flex min-w-max gap-1 border-b">
        {views.map((view) => {
          const current = view.value === active;
          return (
            <li key={view.value}>
              <Link
                href={`${basePath}?vista=${view.value}`}
                scroll={false}
                aria-current={current ? "page" : undefined}
                className={cn(
                  "-mb-px inline-flex h-11 items-center border-b-2 border-transparent px-3 text-sm font-medium text-muted-foreground transition-colors",
                  "hover:text-foreground focus-visible:outline-none focus-visible:ring-2 focus-visible:ring-inset focus-visible:ring-ring",
                  current && "border-foreground text-foreground",
                )}
              >
                {view.label}
              </Link>
            </li>
          );
        })}
      </ul>
    </nav>
  );
}
