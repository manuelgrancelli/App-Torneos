import { ArrowLeft, ArrowRight, CheckCircle2 } from "lucide-react";
import type { Metadata } from "next";
import Link from "next/link";
import { CourtsManager } from "@/components/tournaments/courts-manager";
import { SlotsManager } from "@/components/tournaments/slots-manager";
import { TournamentSetupStepper } from "@/components/tournaments/tournament-setup-stepper";
import { Button } from "@/components/ui/button";
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

      {showWizard ? (
        <div className="flex flex-col sm:flex-row items-center justify-between gap-3 rounded-xl border border-primary/20 bg-muted/40 p-4">
          <div className="space-y-0.5">
            <div className="flex items-center gap-2">
              <p className="text-sm font-semibold text-foreground">¿Listo con las franjas horarias?</p>
              {slots.length > 0 ? (
                <span className="inline-flex items-center gap-1 text-xs text-emerald-700 dark:text-emerald-300 font-medium">
                  <CheckCircle2 className="size-3.5" />
                  {slots.length} turnos listos
                </span>
              ) : null}
            </div>
            <p className="text-xs text-muted-foreground">
              {slots.length > 0
                ? "Las canchas y turnos ya están listos. El siguiente paso es abrir las inscripciones y anotar parejas."
                : "Cargá al menos una franja horaria arriba para que los participantes puedan indicar su disponibilidad."}
            </p>
          </div>

          <div className="flex flex-wrap items-center gap-2 w-full sm:w-auto">
            <Button asChild variant="outline" size="default" className="w-full sm:w-auto">
              <Link href={`/torneos/${tournament.id}/categorias?asistente=1`}>
                <ArrowLeft className="size-4 mr-1.5" />
                <span>Volver a Categorías</span>
              </Link>
            </Button>

            <Button asChild size="default" className="w-full sm:w-auto shrink-0 shadow-xs">
              <Link href={`/torneos/${tournament.id}/inscripciones?asistente=1`}>
                <span>Siguiente paso: Inscripciones</span>
                <ArrowRight className="size-4 ml-1.5" />
              </Link>
            </Button>
          </div>
        </div>
      ) : null}
    </div>
  );
}
