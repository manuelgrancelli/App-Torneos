import { redirect } from "next/navigation";
import type { Metadata } from "next";

export const metadata: Metadata = { title: "Inscripciones" };

export default async function AvailabilityPage({ params }: PageProps<"/torneos/[id]/disponibilidad">) {
  const { id } = await params;
  redirect(`/torneos/${id}/inscripciones`);
}
