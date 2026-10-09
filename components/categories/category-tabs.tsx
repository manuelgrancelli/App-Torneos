import Link from "next/link";
import { cn } from "@/lib/utils";

export type CategoryTabItem = {
  id: string;
  name: string;
  count?: number;
  status?: string;
};

export function CategoryTabs({
  categories,
  activeId,
  baseUrl,
  paramName = "cat",
  allOption = false,
  allLabel = "Todas las categorías",
  extraParams = {},
}: {
  categories: CategoryTabItem[];
  activeId: string | null;
  baseUrl: string;
  paramName?: string;
  allOption?: boolean;
  allLabel?: string;
  extraParams?: Record<string, string | undefined>;
}) {
  if (categories.length === 0) return null;

  function buildUrl(catId: string | null) {
    const params = new URLSearchParams();
    for (const [k, v] of Object.entries(extraParams)) {
      if (v) params.set(k, v);
    }
    if (catId) {
      params.set(paramName, catId);
    } else {
      params.delete(paramName);
    }
    const qs = params.toString();
    return qs ? `${baseUrl}?${qs}` : baseUrl;
  }

  return (
    <nav aria-label="Categorías del torneo" className="flex items-center gap-2 overflow-x-auto pb-1">
      {allOption && (
        <Link
          href={buildUrl(null)}
          className={cn(
            "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors md:h-8",
            activeId === null
              ? "border-primary bg-primary text-primary-foreground shadow-sm"
              : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
          )}
        >
          {allLabel}
        </Link>
      )}
      {categories.map((cat) => {
        const isActive = activeId === cat.id;
        return (
          <Link
            key={cat.id}
            href={buildUrl(cat.id)}
            className={cn(
              "inline-flex h-9 shrink-0 items-center gap-1.5 rounded-full border px-3.5 text-xs font-medium transition-colors md:h-8",
              isActive
                ? "border-primary bg-primary text-primary-foreground shadow-sm"
                : "border-border bg-background text-muted-foreground hover:bg-muted hover:text-foreground"
            )}
          >
            <span>{cat.name}</span>
            {cat.count !== undefined && (
              <span
                className={cn(
                  "rounded-full px-1.5 py-0.2 text-[10px]",
                  isActive ? "bg-primary-foreground/20 text-primary-foreground" : "bg-muted text-muted-foreground"
                )}
              >
                {cat.count}
              </span>
            )}
          </Link>
        );
      })}
    </nav>
  );
}
