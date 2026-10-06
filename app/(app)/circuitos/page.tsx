import { Award, Layers, Plus } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CircuitCard } from "@/components/circuits/circuit-card";
import { EmptyState } from "@/components/shared/empty-state";
import { PageHeader } from "@/components/shared/page-header";
import { Button } from "@/components/ui/button";
import { getCurrentUser } from "@/lib/auth";
import { listOrganizedCircuits } from "@/lib/data/circuits";

export const metadata: Metadata = { title: "Circuitos y torneos anuales" };

export default async function CircuitsPage() {
  const user = await getCurrentUser();
  if (!user) return null;

  const { circuits, migrationPending } = await listOrganizedCircuits(user.id);

  return (
    <>
      <PageHeader
        title="Circuitos y torneos con fechas"
        description="Agrupá torneos en un circuito anual y gestioná un ranking individual acumulado por puntos."
        actions={
          !migrationPending ? (
            <Button asChild>
              <Link href="/circuitos/nuevo">
                <Plus aria-hidden="true" />
                Crear circuito
              </Link>
            </Button>
          ) : undefined
        }
      />

      <div className="space-y-6">
        {migrationPending ? (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/10 p-6 text-sm">
            <h2 className="text-base font-semibold text-amber-500 mb-2">
              ⚠️ Migración pendiente en la base de datos de Supabase
            </h2>
            <p className="text-muted-foreground mb-4">
              La funcionalidad de circuitos multifecha requiere crear la tabla <code className="text-foreground font-mono font-semibold">circuits</code> y
              agregar columnas en <code className="text-foreground font-mono font-semibold">tournaments</code>.
              Como la app está conectada a tu proyecto remoto de Supabase, tenés que ejecutar la migración SQL
              en tu <strong>Supabase Dashboard &gt; SQL Editor</strong>.
            </p>
            <p className="text-xs text-muted-foreground">
              El archivo listo para copiar está en: <code className="font-mono text-foreground font-semibold">supabase/migrations/20261006000100_circuits.sql</code>
            </p>
          </div>
        ) : circuits.length === 0 ? (
          <EmptyState
            icon={Layers}
            title="No creaste circuitos todavía"
            description="Creá un circuito para agrupar varias fechas de torneo y consolidar una tabla general con puntos por jugador."
            action={
              <Button asChild variant="outline">
                <Link href="/circuitos/nuevo">Crear circuito</Link>
              </Button>
            }
          />
        ) : (
          <div className="grid gap-4 sm:grid-cols-2 lg:grid-cols-3">
            {circuits.map((circuit) => (
              <CircuitCard key={circuit.id} circuit={circuit} />
            ))}
          </div>
        )}
      </div>
    </>
  );
}
