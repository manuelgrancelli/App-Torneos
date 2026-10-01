import type { Metadata } from "next";
import { CourtsManager } from "@/components/tournaments/courts-manager";
import { SlotsManager } from "@/components/tournaments/slots-manager";
import { requireOrganizerTournament } from "@/lib/data/organizer";
import { getCourtsAndSlots } from "@/lib/data/tournaments";
import { listDates } from "@/lib/dates";

export const metadata: Metadata = { title: "Canchas y franjas" };

export default async function CourtsAndSlotsPage({ params }: PageProps<"/torneos/[id]/canchas-franjas">) {
  const { id } = await params;
  const tournament = await requireOrganizerTournament(id);
  const { courts, slots } = await getCourtsAndSlots(tournament.id);
  const inSetup = tournament.status === "draft" || tournament.status === "registration_open";

  return (
    <div className="grid gap-6 lg:grid-cols-[2fr_3fr]">
      <CourtsManager tournamentId={tournament.id} courts={courts} canDelete={inSetup} />
      <SlotsManager
        tournamentId={tournament.id}
        timezone={tournament.timezone}
        days={listDates(tournament.startsOn, tournament.endsOn)}
        courts={courts}
        slots={slots}
      />
    </div>
  );
}
