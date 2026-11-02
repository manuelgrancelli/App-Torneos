"use client";

import { useState } from "react";
import { Building2, MapPin, Plus, Star, Trash2 } from "lucide-react";
import { Controller } from "react-hook-form";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent } from "@/components/ui/card";
import { Field, FieldDescription, FieldError, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { NumberInput } from "@/components/shared/number-input";
import type { TournamentFormApi } from "./tournament-fields";
import type { VenueConfig } from "@/lib/validation/tournament";

export function VenuesAndCourtsField({ form }: { form: TournamentFormApi }) {
  const hasMultiple = form.watch("hasMultipleVenues") ?? false;
  const venues = (form.watch("venues") as VenueConfig[] | undefined) ?? [];

  // Al activar multisede, si no hay sedes inicializadas, creamos 2 por defecto
  const handleToggleMultiple = (enable: boolean) => {
    form.setValue("hasMultipleVenues", enable, { shouldValidate: true });
    if (enable) {
      if (!venues || venues.length < 2) {
        const initialVenues: VenueConfig[] = [
          { name: "Sede Central", courtCount: 2, isMain: true },
          { name: "Sede 2", courtCount: 2, isMain: false },
        ];
        form.setValue("venues", initialVenues, { shouldValidate: true });
        form.setValue("courtCount", 4, { shouldValidate: true });
      }
    } else {
      const singleCount = venues.reduce((acc, v) => acc + (v.courtCount || 0), 0) || 2;
      form.setValue("courtCount", singleCount, { shouldValidate: true });
    }
  };

  const updateVenues = (newVenues: VenueConfig[]) => {
    form.setValue("venues", newVenues, { shouldValidate: true });
    const totalCourts = newVenues.reduce((acc, v) => acc + (v.courtCount || 0), 0);
    form.setValue("courtCount", Math.max(1, totalCourts), { shouldValidate: true });
  };

  const handleAddVenue = () => {
    const nextNum = (venues.length || 0) + 1;
    const updated: VenueConfig[] = [
      ...venues,
      { name: `Sede ${nextNum}`, courtCount: 2, isMain: false },
    ];
    updateVenues(updated);
  };

  const handleRemoveVenue = (index: number) => {
    if (venues.length <= 2) return;
    const removingWasMain = venues[index]?.isMain;
    const updated = venues.filter((_, idx) => idx !== index);
    if (removingWasMain && updated.length > 0) {
      updated[0]!.isMain = true;
    }
    updateVenues(updated);
  };

  const handleSetMain = (index: number) => {
    const updated = venues.map((v, idx) => ({
      ...v,
      isMain: idx === index,
    }));
    updateVenues(updated);
  };

  const handleVenueNameChange = (index: number, name: string) => {
    const updated = venues.map((v, idx) => (idx === index ? { ...v, name } : v));
    updateVenues(updated);
  };

  const handleVenueCourtsChange = (index: number, courtCount: number | undefined) => {
    const updated = venues.map((v, idx) =>
      idx === index ? { ...v, courtCount: Math.max(1, Math.min(30, courtCount ?? 1)) } : v,
    );
    updateVenues(updated);
  };

  return (
    <div className="space-y-4">
      {/* Selector de tipo: 1 Sede vs Múltiples sedes */}
      <div className="rounded-xl border border-border/80 bg-muted/30 p-4 space-y-3">
        <div className="flex flex-col sm:flex-row sm:items-center sm:justify-between gap-3">
          <div className="space-y-0.5">
            <span className="text-sm font-bold text-foreground flex items-center gap-2">
              <Building2 className="size-4 text-emerald-500" />
              Sedes y complejos deportivos
            </span>
            <p className="text-xs text-muted-foreground">
              Indicá si el torneo se disputa en un único club o en varias sedes a la vez.
            </p>
          </div>

          <div className="flex items-center gap-1.5 p-1 bg-background/80 rounded-lg border border-border/60 self-start sm:self-auto">
            <button
              type="button"
              onClick={() => handleToggleMultiple(false)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                !hasMultiple
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              1 Sede (Club único)
            </button>
            <button
              type="button"
              onClick={() => handleToggleMultiple(true)}
              className={`px-3 py-1.5 text-xs font-semibold rounded-md transition-all cursor-pointer ${
                hasMultiple
                  ? "bg-emerald-600 text-white shadow-xs"
                  : "text-muted-foreground hover:text-foreground"
              }`}
            >
              Múltiples sedes (2+)
            </button>
          </div>
        </div>

        {/* Modalidad A: Sede única */}
        {!hasMultiple ? (
          <div className="pt-2 grid gap-4 sm:grid-cols-2 items-end">
            <Controller
              name="venueName"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="min-w-0">
                  <FieldLabel htmlFor="wizard-venue-name" className="text-xs font-semibold">
                    Nombre del club o sede (opcional)
                  </FieldLabel>
                  <Input
                    {...field}
                    id="wizard-venue-name"
                    placeholder="Ej: Club Central Pádel"
                    className="w-full"
                  />
                  <FieldDescription className="text-[11px]">
                    Aparecerá en los fixtures y en los partidos de los deportistas.
                  </FieldDescription>
                </Field>
              )}
            />

            <Controller
              name="courtCount"
              control={form.control}
              render={({ field, fieldState }) => (
                <Field data-invalid={fieldState.invalid} className="min-w-0">
                  <FieldLabel htmlFor="wizard-court-count" className="text-xs font-semibold">
                    Cantidad total de canchas *
                  </FieldLabel>
                  <NumberInput
                    id="wizard-court-count"
                    min={1}
                    max={50}
                    value={field.value ?? 2}
                    onChange={field.onChange}
                    onBlur={field.onBlur}
                  />
                  <FieldDescription className="text-[11px]">
                    El sistema creará Cancha 1, Cancha 2... automáticamente.
                  </FieldDescription>
                  {fieldState.invalid ? <FieldError errors={[fieldState.error]} /> : null}
                </Field>
              )}
            />
          </div>
        ) : (
          /* Modalidad B: Múltiples sedes */
          <div className="pt-2 space-y-3">
            <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/30 p-3 text-xs text-foreground space-y-1">
              <p className="font-semibold text-emerald-600 dark:text-emerald-400">
                ✨ Programación inteligente multisede:
              </p>
              <ul className="list-disc list-inside space-y-0.5 text-muted-foreground text-[11px]">
                <li><strong>Fase de grupos:</strong> Cada zona jugará el 100% de sus partidos en la misma sede física.</li>
                <li><strong>Fase eliminatoria (Playoffs):</strong> La parte alta del cuadro jugará en una sede, la parte baja en la otra, y convergerán en la <strong>Sede Principal</strong> para las semifinales y finales.</li>
              </ul>
            </div>

            <div className="space-y-2.5">
              {venues.map((venue, index) => (
                <Card
                  key={index}
                  className={`border transition-all ${
                    venue.isMain
                      ? "border-amber-500/60 bg-amber-500/5 shadow-xs"
                      : "border-border/80 bg-card/60"
                  }`}
                >
                  <CardContent className="p-3.5 flex flex-col sm:flex-row items-stretch sm:items-center justify-between gap-3">
                    <div className="flex-1 grid grid-cols-1 sm:grid-cols-[1fr_120px] gap-2.5 items-center min-w-0">
                      <div>
                        <div className="flex items-center gap-1.5 mb-1">
                          <MapPin className="size-3 text-muted-foreground" />
                          <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider">
                            Sede {index + 1}
                          </span>
                          {venue.isMain ? (
                            <Badge className="bg-amber-500 text-amber-950 font-bold text-[10px] px-1.5 py-0 h-4 gap-0.5">
                              <Star className="size-2.5 fill-current" />
                              Principal (Finales)
                            </Badge>
                          ) : null}
                        </div>
                        <Input
                          value={venue.name}
                          onChange={(e) => handleVenueNameChange(index, e.target.value)}
                          placeholder={`Nombre de sede ${index + 1}`}
                          className="w-full text-sm font-semibold"
                        />
                      </div>

                      <div>
                        <span className="text-[11px] font-semibold text-muted-foreground uppercase tracking-wider block mb-1">
                          Canchas
                        </span>
                        <NumberInput
                          min={1}
                          max={30}
                          value={venue.courtCount}
                          onChange={(val) => handleVenueCourtsChange(index, val)}
                        />
                      </div>
                    </div>

                    <div className="flex items-center justify-end gap-1.5 shrink-0 pt-1 sm:pt-0 border-t sm:border-t-0 border-border/40">
                      {!venue.isMain ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="sm"
                          onClick={() => handleSetMain(index)}
                          className="text-xs text-muted-foreground hover:text-amber-500 hover:bg-amber-500/10 h-8 px-2 gap-1"
                          title="Fijar como sede principal para jugar las finales"
                        >
                          <Star className="size-3.5" />
                          <span>Hacer Principal</span>
                        </Button>
                      ) : null}

                      {venues.length > 2 ? (
                        <Button
                          type="button"
                          variant="ghost"
                          size="icon"
                          onClick={() => handleRemoveVenue(index)}
                          className="text-muted-foreground hover:text-destructive hover:bg-destructive/10 size-8 shrink-0"
                          title="Eliminar sede"
                        >
                          <Trash2 className="size-3.5" />
                        </Button>
                      ) : null}
                    </div>
                  </CardContent>
                </Card>
              ))}
            </div>

            <div className="flex flex-col sm:flex-row items-start sm:items-center justify-between gap-2 pt-1">
              <Button
                type="button"
                variant="outline"
                size="sm"
                onClick={handleAddVenue}
                className="text-xs gap-1.5 h-8 border-dashed"
              >
                <Plus className="size-3.5 text-emerald-500" />
                <span>Agregar otra sede</span>
              </Button>

              <div className="text-xs text-muted-foreground font-medium">
                Total: <strong className="text-foreground">{venues.reduce((acc, v) => acc + (v.courtCount || 0), 0)} canchas</strong> distribuidas en <strong className="text-foreground">{venues.length} sedes</strong>
              </div>
            </div>
          </div>
        )}
      </div>
    </div>
  );
}
