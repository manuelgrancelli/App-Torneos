"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, Pencil, Plus, Trash2, X } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { Controller, useForm } from "react-hook-form";
import { toast } from "sonner";
import { addCourt, deleteCourt, updateCourt } from "@/app/(app)/torneos/[id]/canchas-franjas/actions";
import { ConfirmActionButton } from "@/components/shared/confirm-action-button";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Field, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import type { CourtRow } from "@/lib/data/tournaments";
import { applyServerErrors } from "@/lib/forms";
import { createCourtSchema } from "@/lib/validation/tournament";

type CourtsManagerProps = {
  tournamentId: string;
  courts: CourtRow[];
  /** Las canchas se borran solo antes de que empiece el torneo (D-029). */
  canDelete: boolean;
};

/** Formulario de nombre + sede (alta o edición). */
function CourtForm({
  tournamentId,
  court,
  onDone,
}: {
  tournamentId: string;
  court?: CourtRow;
  onDone: () => void;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const form = useForm({
    resolver: zodResolver(createCourtSchema),
    defaultValues: { tournamentId, name: court?.name ?? "", venue: court?.venue ?? "" },
  });
  const idPrefix = court ? `court-${court.id}` : "court-new";

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = court ? await updateCourt({ ...values, courtId: court.id }) : await addCourt(values);
      if (!result.ok) {
        applyServerErrors(form.setError, result.fieldErrors);
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Listo.");
      form.reset({ tournamentId, name: "", venue: "" });
      onDone();
      router.refresh();
    });
  });

  return (
    <form onSubmit={onSubmit} noValidate className="grid gap-3 sm:grid-cols-[1fr_1fr_auto] sm:items-end">
      <Controller
        name="name"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-name`}>Nombre</FieldLabel>
            <Input {...field} id={`${idPrefix}-name`} placeholder="Cancha 3" aria-invalid={fieldState.invalid} />
            {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
          </Field>
        )}
      />
      <Controller
        name="venue"
        control={form.control}
        render={({ field, fieldState }) => (
          <Field data-invalid={fieldState.invalid}>
            <FieldLabel htmlFor={`${idPrefix}-venue`}>Sede (opcional)</FieldLabel>
            <Input {...field} id={`${idPrefix}-venue`} placeholder="Club Centro" aria-invalid={fieldState.invalid} />
            {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
          </Field>
        )}
      />
      <div className="flex gap-2">
        <Button type="submit" disabled={isPending} className="flex-1 sm:flex-none">
          {isPending ? <Spinner /> : court ? <Check aria-hidden="true" /> : <Plus aria-hidden="true" />}
          {court ? "Guardar" : "Agregar"}
        </Button>
        {court ? (
          <Button type="button" variant="ghost" size="icon" onClick={onDone} aria-label="Cancelar edición">
            <X aria-hidden="true" />
          </Button>
        ) : null}
      </div>
    </form>
  );
}

export function CourtsManager({ tournamentId, courts, canDelete }: CourtsManagerProps) {
  const router = useRouter();
  const [editingId, setEditingId] = useState<string | null>(null);

  async function remove(court: CourtRow) {
    const result = await deleteCourt({ tournamentId, courtId: court.id });
    if (!result.ok) {
      toast.error(result.error);
      return false;
    }
    toast.success(result.message ?? "Borramos la cancha.");
    router.refresh();
  }

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Canchas y sedes</h2>
        </CardTitle>
        <CardDescription>
          {canDelete
            ? "Ponele nombre a cada cancha y, si se juega en varios lugares, la sede."
            : "Con el torneo en curso podés renombrar o agregar canchas, pero no borrarlas."}
        </CardDescription>
      </CardHeader>
      <CardContent className="space-y-4">
        <ul className="divide-y rounded-lg border">
          {courts.map((court) => (
            <li key={court.id} className="p-3">
              {editingId === court.id ? (
                <CourtForm tournamentId={tournamentId} court={court} onDone={() => setEditingId(null)} />
              ) : (
                <div className="flex items-center gap-2">
                  <div className="min-w-0 flex-1">
                    <p className="truncate font-medium">{court.name}</p>
                    {court.venue ? <p className="truncate text-sm text-muted-foreground">{court.venue}</p> : null}
                  </div>
                  <Button
                    type="button"
                    variant="ghost"
                    size="icon"
                    onClick={() => setEditingId(court.id)}
                    aria-label={`Editar ${court.name}`}
                  >
                    <Pencil aria-hidden="true" />
                  </Button>
                  {canDelete && courts.length > 1 ? (
                    <ConfirmActionButton
                      variant="ghost"
                      size="icon"
                      destructive
                      aria-label={`Borrar ${court.name}`}
                      title={`¿Borrar "${court.name}"?`}
                      description={<p>También se borran las franjas que son solo de esta cancha.</p>}
                      confirmLabel="Borrar cancha"
                      onConfirm={() => remove(court)}
                    >
                      <Trash2 aria-hidden="true" />
                    </ConfirmActionButton>
                  ) : null}
                </div>
              )}
            </li>
          ))}
        </ul>
        <div className="space-y-2">
          <h3 className="text-sm font-medium">Agregar cancha</h3>
          <CourtForm tournamentId={tournamentId} onDone={() => undefined} />
        </div>
      </CardContent>
    </Card>
  );
}
