import { Globe } from "lucide-react";
import Link from "next/link";
import type { TournamentStatus } from "@/lib/domain/tournament-status";

/** Link a la página pública del torneo (los borradores no tienen). */
export function PublicPageLink({ slug, status }: { slug: string; status: TournamentStatus }) {
  if (status === "draft") return null;
  return (
    <Link
      href={`/t/${slug}`}
      target="_blank"
      rel="noopener"
      className="inline-flex items-center gap-1 text-sm underline-offset-4 hover:underline"
    >
      <Globe className="size-4" aria-hidden="true" />
      Página pública
      <span className="sr-only">(se abre en una pestaña nueva)</span>
    </Link>
  );
}
