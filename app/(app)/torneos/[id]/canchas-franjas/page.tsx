import type { Metadata } from "next";
import { CourtsManager } from "@/components/tournaments/courts-manager";
import { SlotsManager } from "@/components/tournaments/slots-manager";
import { TournamentSetupStepper } from "@/components/tournaments/tournament-setup-stepper";
import { getTournamentCategories } from "@/lib/data/categories";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { getCourtsAndSlots } from "@/lib/data/tournaments";
import { listDates } from "@/lib/dates";

export const metadata: Metadata = { title: "Canchas y franjas" };

export default async function CourtsAndSlotsPage({
  params,
  searchParams,
}: PageProps<"/torneos/[id]/canchas-franjas">) {
  const { id } = await params;
  const { asistente } = await searchParams;
  const tournament = await requireOrganizerTournament(id);
  const [{ courts, slots }, categories] = await Promise.all([
    getCourtsAndSlots(tournament.id),
    getTournamentCategories(tournament.id),
  ]);
  const inSetup = tournament.status === "draft" || tournament.status === "registration_open";
  const showWizard = tournament.status === "draft" || asistente === "1";

  return (
    <div className="space-y-6">
      {showWizard ? (
        <TournamentSetupStepper
          tournamentId={tournament.id}
          currentStep="franjas"
          counts={{
            categories: categories.length,
            slots: slots.length,
            courts: courts.length,
          }}
          isRegistrationOpen={tournament.status === "registration_open"}
        />
      ) : null}

      <div className="grid gap-6 grid-cols-1 xl:grid-cols-[2fr_3fr]">
        <CourtsManager tournamentId={tournament.id} courts={courts} canDelete={inSetup} />
        <SlotsManager
          tournamentId={tournament.id}
          timezone={tournament.timezone}
          days={listDates(tournament.startsOn, tournament.endsOn)}
          courts={courts}
          slots={slots}
        />
      </div>
    </div>
  );
}
