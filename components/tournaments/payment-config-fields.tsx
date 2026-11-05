"use client";

import { Banknote, Building2, CreditCard, DollarSign, HelpCircle, QrCode, Wallet } from "lucide-react";
import type { UseFormReturn } from "react-hook-form";
import { Controller } from "react-hook-form";
import { Field, FieldDescription, FieldGroup, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import type { CreateTournamentInput } from "@/lib/validation/tournament";

export function PaymentConfigFields({
  form,
  disabled = false,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  disabled?: boolean;
}) {
  const isEnabled = form.watch("paymentConfig.enabled");
  const isAmerican = form.watch("isAmerican");
  const mpEnabled = form.watch("paymentConfig.methods.mercadopago.enabled");
  const transferEnabled = form.watch("paymentConfig.methods.transfer.enabled");
  const cashEnabled = form.watch("paymentConfig.methods.cash.enabled");

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 space-y-5">
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-3 border-b border-border/50 pb-4">
        <div className="space-y-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <DollarSign className="size-4" />
            </span>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Arancel e Inscripciones
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-snug">
            Activá si el torneo requiere pago de inscripción y elegí qué formas de pago aceptás.
          </p>
        </div>

        <Controller
          name="paymentConfig.enabled"
          control={form.control}
          render={({ field }) => (
            <div className="flex items-center gap-2.5 shrink-0">
              <span className="text-xs font-semibold text-foreground">
                {field.value ? "Con arancel" : "Gratuito / Sin costo"}
              </span>
              <Switch
                checked={field.value}
                onCheckedChange={field.onChange}
                disabled={disabled}
                aria-label="Cobro de inscripción"
              />
            </div>
          )}
        />
      </div>

      {isEnabled && (
        <div className="space-y-5 animate-in fade-in-50 duration-200">
          {/* Monto y Modalidad */}
          <div className="grid grid-cols-1 sm:grid-cols-2 gap-4">
            <Field>
              <FieldLabel className="text-xs font-semibold">
                Costo del arancel ($ ARS) *
              </FieldLabel>
              <Controller
                name="paymentConfig.amount"
                control={form.control}
                render={({ field, fieldState }) => (
                  <div className="space-y-1">
                    <div className="relative">
                      <span className="absolute left-3 top-1/2 -translate-y-1/2 text-xs font-bold text-muted-foreground">
                        $
                      </span>
                      <Input
                        type="number"
                        min="1"
                        step="100"
                        placeholder="Ej: 15000"
                        value={field.value ?? ""}
                        onChange={(e) => {
                          const val = e.target.value === "" ? null : Number(e.target.value);
                          field.onChange(val);
                        }}
                        disabled={disabled}
                        className="pl-7 text-xs h-9"
                      />
                    </div>
                    {fieldState.error && (
                      <p className="text-[11px] text-destructive">{fieldState.error.message}</p>
                    )}
                  </div>
                )}
              />
              <FieldDescription className="text-[11px]">
                Monto que abonará el inscripto en pesos argentinos.
              </FieldDescription>
            </Field>

            <Field>
              <FieldLabel className="text-xs font-semibold">
                Modalidad del cobro *
              </FieldLabel>
              <Controller
                name="paymentConfig.pricingType"
                control={form.control}
                render={({ field }) => (
                  <div className="grid grid-cols-2 gap-2 pt-0.5">
                    <button
                      type="button"
                      onClick={() => field.onChange("per_team")}
                      disabled={disabled}
                      className={`h-9 rounded-lg border text-xs font-semibold px-2.5 transition-colors cursor-pointer ${
                        field.value === "per_team"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      {isAmerican ? "Por dupla / participante" : "Por pareja / equipo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange("per_player")}
                      disabled={disabled}
                      className={`h-9 rounded-lg border text-xs font-semibold px-2.5 transition-colors cursor-pointer ${
                        field.value === "per_player"
                          ? "border-primary bg-primary/10 text-primary"
                          : "border-border hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      Por jugador individual
                    </button>
                  </div>
                )}
              />
              <FieldDescription className="text-[11px]">
                Aclara si el monto cubre a todo el equipo o es por integrante.
              </FieldDescription>
            </Field>
          </div>

          {/* Formas de Pago admitidas */}
          <div className="space-y-3 pt-2">
            <span className="text-xs font-bold text-foreground block">
              Formas de pago que permitís (activá las que quieras ofrecer):
            </span>

            {/* 1. Mercado Pago */}
            <div className={`rounded-xl border p-3.5 space-y-3 transition-colors ${
              mpEnabled ? "border-sky-500/40 bg-sky-500/[0.03]" : "border-border/70 bg-muted/20"
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                    <Wallet className="size-4" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-foreground block">Mercado Pago</span>
                    <span className="text-[11px] text-muted-foreground">Alias, CVU o link directo de pago</span>
                  </div>
                </div>
                <Controller
                  name="paymentConfig.methods.mercadopago.enabled"
                  control={form.control}
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={disabled}
                      aria-label="Habilitar Mercado Pago"
                    />
                  )}
                />
              </div>

              {mpEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-sky-500/20">
                  <div className="sm:col-span-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-3 space-y-2">
                    <Field>
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <FieldLabel className="text-xs font-bold text-sky-950 dark:text-sky-200">
                          🔑 Access Token de Mercado Pago (para cobro directo con monto y tarjetas)
                        </FieldLabel>
                        <a
                          href="https://www.mercadopago.com.ar/developers/panel/app"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 underline hover:opacity-80"
                        >
                          Obtener mi Access Token en Mercado Pago Developers ↗
                        </a>
                      </div>
                      <Controller
                        name="paymentConfig.methods.mercadopago.accessToken"
                        control={form.control}
                        render={({ field }) => (
                          <Input
                            type="password"
                            autoComplete="off"
                            placeholder="Pegá acá tu token: APP_USR-..."
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                            disabled={disabled}
                            className="text-xs h-8 bg-card font-mono"
                          />
                        )}
                      />
                      <FieldDescription className="text-[11px] text-sky-900/80 dark:text-sky-200/80 leading-snug">
                        Con tu <strong>Access Token</strong> (<code>APP_USR-...</code>), cuando el jugador toca pagar se le abre <strong>Mercado Pago One-Tap</strong> directamente con el monto exacto ya cargado y el carrusel de sus tarjetas / dinero en cuenta para elegir y confirmar.
                      </FieldDescription>
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel className="text-[11px] font-semibold">Alias de Mercado Pago (para quien elija transferir)</FieldLabel>
                    <Controller
                      name="paymentConfig.methods.mercadopago.alias"
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          placeholder="Ej: mi.torneo.mp"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          disabled={disabled}
                          className="text-xs h-8 bg-card"
                        />
                      )}
                    />
                  </Field>

                  <Field>
                    <FieldLabel className="text-[11px] font-semibold">CVU de Mercado Pago (opcional)</FieldLabel>
                    <Controller
                      name="paymentConfig.methods.mercadopago.cvu"
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          placeholder="Ej: 0000003100012345678901"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          disabled={disabled}
                          className="text-xs h-8 bg-card"
                        />
                      )}
                    />
                  </Field>

                  <div className="sm:col-span-2">
                    <Field>
                      <FieldLabel className="text-[11px] font-semibold">
                        Link de pago de Mercado Pago (alternativa sin Access Token)
                      </FieldLabel>
                      <Controller
                        name="paymentConfig.methods.mercadopago.paymentLink"
                        control={form.control}
                        render={({ field }) => (
                          <Input
                            placeholder="https://mpago.la/..."
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                            disabled={disabled}
                            className="text-xs h-8 bg-card"
                          />
                        )}
                      />
                      <FieldDescription className="text-[11px]">
                        Si no usás Access Token, podés pegar acá un link de cobro creado en tu app de Mercado Pago.
                      </FieldDescription>
                    </Field>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Transferencia Bancaria */}
            <div className={`rounded-xl border p-3.5 space-y-3 transition-colors ${
              transferEnabled ? "border-indigo-500/40 bg-indigo-500/[0.03]" : "border-border/70 bg-muted/20"
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <Building2 className="size-4" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-foreground block">Transferencia bancaria</span>
                    <span className="text-[11px] text-muted-foreground">CBU / CVU, Alias y Titular de cuenta</span>
                  </div>
                </div>
                <Controller
                  name="paymentConfig.methods.transfer.enabled"
                  control={form.control}
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={disabled}
                      aria-label="Habilitar Transferencia bancaria"
                    />
                  )}
                />
              </div>

              {transferEnabled && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-1 border-t border-indigo-500/20">
                  <Field>
                    <FieldLabel className="text-[11px] font-semibold">Banco o Entidad</FieldLabel>
                    <Controller
                      name="paymentConfig.methods.transfer.bank"
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          placeholder="Ej: Banco Santander, Galicia, Brubank"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          disabled={disabled}
                          className="text-xs h-8 bg-card"
                        />
                      )}
                    />
                  </Field>

                  <Field>
                    <FieldLabel className="text-[11px] font-semibold">Titular de la cuenta</FieldLabel>
                    <Controller
                      name="paymentConfig.methods.transfer.accountHolder"
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          placeholder="Ej: Martín Rodríguez"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          disabled={disabled}
                          className="text-xs h-8 bg-card"
                        />
                      )}
                    />
                  </Field>

                  <Field>
                    <FieldLabel className="text-[11px] font-semibold">CBU o CVU</FieldLabel>
                    <Controller
                      name="paymentConfig.methods.transfer.cbuOrCvu"
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          placeholder="22 dígitos"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          disabled={disabled}
                          className="text-xs h-8 bg-card"
                        />
                      )}
                    />
                  </Field>

                  <Field>
                    <FieldLabel className="text-[11px] font-semibold">Alias bancario</FieldLabel>
                    <Controller
                      name="paymentConfig.methods.transfer.alias"
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          placeholder="Ej: TORNEO.PADEL.2026"
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          disabled={disabled}
                          className="text-xs h-8 bg-card"
                        />
                      )}
                    />
                  </Field>
                </div>
              )}
            </div>

            {/* 3. Efectivo en el torneo */}
            <div className={`rounded-xl border p-3.5 space-y-3 transition-colors ${
              cashEnabled ? "border-amber-500/40 bg-amber-500/[0.03]" : "border-border/70 bg-muted/20"
            }`}>
              <div className="flex items-center justify-between gap-2">
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400">
                    <Banknote className="size-4" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-foreground block">
                      Pago en efectivo el día del torneo
                    </span>
                    <span className="text-[11px] text-muted-foreground">
                      Abonan de manera presencial en mesa de control o recepción del club
                    </span>
                  </div>
                </div>
                <Controller
                  name="paymentConfig.methods.cash.enabled"
                  control={form.control}
                  render={({ field }) => (
                    <Switch
                      checked={field.value}
                      onCheckedChange={field.onChange}
                      disabled={disabled}
                      aria-label="Habilitar Pago en efectivo"
                    />
                  )}
                />
              </div>

              {cashEnabled && (
                <div className="pt-1 border-t border-amber-500/20">
                  <Field>
                    <FieldLabel className="text-[11px] font-semibold">
                      Indicaciones para el pago en efectivo
                    </FieldLabel>
                    <Controller
                      name="paymentConfig.methods.cash.instructions"
                      control={form.control}
                      render={({ field }) => (
                        <Input
                          placeholder="Ej: Abonar en la mesa de control antes del primer partido."
                          value={field.value ?? ""}
                          onChange={(e) => field.onChange(e.target.value || null)}
                          disabled={disabled}
                          className="text-xs h-8 bg-card"
                        />
                      )}
                    />
                  </Field>
                </div>
              )}
            </div>
          </div>

          {/* Instrucciones adicionales para el comprobante */}
          <Field className="pt-2">
            <FieldLabel className="text-xs font-semibold">
              Instrucciones adicionales para el comprobante (opcional)
            </FieldLabel>
            <Controller
              name="paymentConfig.instructions"
              control={form.control}
              render={({ field }) => (
                <Textarea
                  placeholder="Ej: Enviar comprobante de transferencia por WhatsApp al 11-4567-8901 indicando el nombre de la pareja para confirmar el cupo."
                  value={field.value ?? ""}
                  onChange={(e) => field.onChange(e.target.value || null)}
                  disabled={disabled}
                  rows={2}
                  className="text-xs bg-card"
                />
              )}
            />
            <FieldDescription className="text-[11px]">
              Este mensaje le aparecerá al jugador luego de completar su inscripción para saber dónde enviar el comprobante.
            </FieldDescription>
          </Field>
        </div>
      )}
    </div>
  );
}

