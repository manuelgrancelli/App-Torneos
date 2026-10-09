import type { Metadata } from "next";
import { CategoriesManager } from "@/components/categories/categories-manager";
import { getTournamentCategories } from "@/lib/data/categories";
import { requireOrganizerTournament } from "@/lib/data/organizer";

export const metadata: Metadata = { title: "Categorías" };

/** Gestión de categorías para torneos integrados. */
export default async function CategoriesPage({ params }: PageProps<"/torneos/[id]/categorias">) {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);
  const categories = await getTournamentCategories(tournament.id);

  return (
    <div className="space-y-6">
      <CategoriesManager tournamentId={tournament.id} categories={categories} />
    </div>
  );
}
