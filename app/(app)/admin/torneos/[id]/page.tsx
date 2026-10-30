import type { Metadata } from "next";
import { notFound, redirect } from "next/navigation";
import { isSuperAdmin } from "@/lib/auth";
import { getAdminTournamentDetails } from "@/lib/data/admin";
import { getCompetition } from "@/lib/data/competition";
import { AdminTournamentReadOnly } from "@/components/admin/admin-tournament-read-only";

export const metadata: Metadata = {
  title: "Auditoría de Torneo · Panel Superadmin",
  robots: { index: false, follow: false },
};

export default async function AdminTournamentDetailPage({
  params,
}: {
  params: Promise<{ id: string }>;
}) {
  const authorized = await isSuperAdmin();
  if (!authorized) {
    redirect("/");
  }

  const { id } = await params;
  const [details, competition] = await Promise.all([
    getAdminTournamentDetails(id),
    getCompetition(id),
  ]);

  if (!details || !details.tournament) {
    notFound();
  }

  return (
    <AdminTournamentReadOnly
      tournament={details.tournament}
      competition={competition}
      courts={details.courts}
      timeSlots={details.timeSlots}
    />
  );
}

