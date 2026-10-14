import type { Metadata } from "next";
import { CategoriesManager } from "@/components/categories/categories-manager";
import { TournamentSetupStepper } from "@/components/tournaments/tournament-setup-stepper";
import { getTournamentCategories } from "@/lib/data/categories";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { getTournamentCounts } from "@/lib/data/tournaments";

export const metadata: Metadata = { title: "Categorías" };

/** Gestión de categorías para torneos integrados con Asistente de Preparación (D-069). */
export default async function CategoriesPage({
  params,
  searchParams,
}: PageProps<"/torneos/[id]/categorias">) {
  const { id } = await params;
  const { asistente } = await searchParams;
  const tournament = await requireOrganizerTournament(id);
  const [categories, counts] = await Promise.all([
    getTournamentCategories(tournament.id),
    getTournamentCounts(tournament.id),
  ]);

  const showWizard = tournament.status === "draft" || asistente === "1";

  return (
    <div className="space-y-6">
      {showWizard ? (
        <TournamentSetupStepper
          tournamentId={tournament.id}
          currentStep="categorias"
          counts={{
            categories: categories.length,
            slots: counts.slots,
            courts: counts.courts,
            approvedTeams: counts.approvedTeams,
          }}
          isRegistrationOpen={tournament.status === "registration_open"}
        />
      ) : null}

      <CategoriesManager
        tournamentId={tournament.id}
        categories={categories}
        inSetup={showWizard}
      />
    </div>
  );
}
