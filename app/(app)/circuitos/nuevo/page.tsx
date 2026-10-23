import type { Metadata } from "next";
import { redirect } from "next/navigation";
import { CircuitForm } from "@/components/circuits/circuit-form";
import { PageHeader } from "@/components/shared/page-header";
import { isAccountOrganizer } from "@/lib/auth";
import { getSports } from "@/lib/data/tournaments";

export const metadata: Metadata = { title: "Nuevo circuito" };

export default async function NewCircuitPage() {
  if (!(await isAccountOrganizer())) redirect("/circuitos");
  const sports = await getSports();

  return (
    <div className="space-y-6">
      <PageHeader
        title="Crear circuito o torneo anual"
        description="Configurá el torneo por fechas y la escala de puntos que sumará cada jugador por ronda alcanzada."
      />
      <CircuitForm sports={sports} />
    </div>
  );
}
