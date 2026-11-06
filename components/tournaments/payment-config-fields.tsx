"use client";

import {
  Banknote,
  BookmarkCheck,
  Building2,
  CheckCircle2,
  ChevronDown,
  DollarSign,
  ExternalLink,
  Link2,
  Trash2,
  Wallet,
} from "lucide-react";
import { useEffect, useState, useTransition } from "react";
import type { UseFormReturn } from "react-hook-form";
import { Controller } from "react-hook-form";
import { toast } from "sonner";
import { clearOrganizerPaymentDefaults, saveOrganizerPaymentDefaults } from "@/app/(app)/perfil/actions";
import { Button } from "@/components/ui/button";
import { Field, FieldDescription, FieldLabel } from "@/components/ui/field";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { Switch } from "@/components/ui/switch";
import { Textarea } from "@/components/ui/textarea";
import { formatCurrency } from "@/lib/domain/payment";

export function PaymentConfigFields({
  form,
  disabled = false,
  hideProfileDefaultControls = false,
  initialHasSavedDefaults = false,
  defaultCollapsed = false,
}: {
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  form: UseFormReturn<any>;
  disabled?: boolean;
  hideProfileDefaultControls?: boolean;
  initialHasSavedDefaults?: boolean;
  defaultCollapsed?: boolean;
}) {
  const [isSavingProfile, startProfileTransition] = useTransition();
  const [hasSavedInProfile, setHasSavedInProfile] = useState(initialHasSavedDefaults);
  const [isSectionOpen, setIsSectionOpen] = useState(!defaultCollapsed);
  const [openMethods, setOpenMethods] = useState<Record<"mp" | "transfer" | "cash", boolean>>({
    mp: true,
    transfer: true,
    cash: true,
  });

  const isEnabled = form.watch("paymentConfig.enabled");
  const amount = form.watch("paymentConfig.amount");
  const pricingType = form.watch("paymentConfig.pricingType");
  const isAmerican = form.watch("isAmerican");
  const mpEnabled = form.watch("paymentConfig.methods.mercadopago.enabled");
  const mpAccessToken = form.watch("paymentConfig.methods.mercadopago.accessToken");
  const transferEnabled = form.watch("paymentConfig.methods.transfer.enabled");
  const cashEnabled = form.watch("paymentConfig.methods.cash.enabled");

  const toggleMethodOpen = (key: "mp" | "transfer" | "cash") => {
    setOpenMethods((prev) => ({ ...prev, [key]: !prev[key] }));
  };

  const activeMethodsLabels = [
    mpEnabled ? "Mercado Pago" : null,
    transferEnabled ? "Transferencia" : null,
    cashEnabled ? "Efectivo" : null,
  ].filter(Boolean);

  const summaryText = !isEnabled
    ? "Torneo gratuito / Sin costo de inscripción"
    : `${amount ? formatCurrency(Number(amount)) : "Monto sin definir"} (${
        pricingType === "per_player" ? "por jugador" : "por pareja / equipo"
      })${activeMethodsLabels.length > 0 ? ` · ${activeMethodsLabels.join(", ")}` : ""}`;

  const handleSaveToProfile = () => {
    const currentPaymentConfig = form.getValues("paymentConfig");
    startProfileTransition(async () => {
      const res = await saveOrganizerPaymentDefaults(currentPaymentConfig);
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setHasSavedInProfile(true);
      toast.success(res.message);
    });
  };

  const handleClearFromProfile = () => {
    startProfileTransition(async () => {
      const res = await clearOrganizerPaymentDefaults();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setHasSavedInProfile(false);
      toast.info(res.message);
    });
  };

  useEffect(() => {
    if (typeof window === "undefined") return;
    const params = new URLSearchParams(window.location.search);
    const oauthStatus = params.get("mp_oauth");
    if (!oauthStatus) return;

    if (oauthStatus === "connected") {
      toast.success("¡Tu cuenta de Mercado Pago quedó vinculada al torneo!");
    } else if (oauthStatus === "missing_client_id") {
      toast.info(
        "Para usar vinculación con 1 clic agregá MP_CLIENT_ID y MP_CLIENT_SECRET en .env.local, o pegá tu Access Token abajo.",
      );
    } else if (oauthStatus !== "cancelled") {
      toast.error("No se pudo completar la vinculación con Mercado Pago. Probá pegando tu Access Token.");
    }
  }, []);

  const handleConnectMpOAuth = () => {
    if (typeof window === "undefined") return;
    const match = window.location.pathname.match(/\/torneos\/([^/]+)/);
    const tournamentId = match?.[1] ?? "";
    const returnTo = window.location.pathname;
    window.location.href = `/api/payments/mercadopago/connect?tournamentId=${encodeURIComponent(
      tournamentId,
    )}&returnTo=${encodeURIComponent(returnTo)}`;
  };

  return (
    <div className="rounded-2xl border border-border/80 bg-card p-4 sm:p-5 space-y-5">
      <div
        onClick={() => isEnabled && setIsSectionOpen((prev) => !prev)}
        className={`flex flex-col sm:flex-row sm:items-center justify-between gap-3 ${
          isEnabled && isSectionOpen ? "border-b border-border/50 pb-4" : ""
        } ${isEnabled ? "cursor-pointer select-none" : ""}`}
      >
        <div className="space-y-1 min-w-0 flex-1">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400 shrink-0">
              <DollarSign className="size-4" />
            </span>
            <h3 className="text-sm sm:text-base font-bold text-foreground">
              Formas de Pago y Arancel
            </h3>
          </div>
          <p className="text-xs text-muted-foreground leading-snug truncate">
            {isEnabled && !isSectionOpen
              ? summaryText
              : "Activá si el torneo requiere pago de inscripción y elegí qué formas de pago aceptás."}
          </p>
        </div>

        <div
          className="flex items-center gap-3 shrink-0"
          onClick={(e) => e.stopPropagation()}
        >
          <Controller
            name="paymentConfig.enabled"
            control={form.control}
            render={({ field }) => (
              <div className="flex items-center gap-2.5">
                <span className="text-xs font-semibold text-foreground">
                  {field.value ? "Con arancel" : "Gratuito / Sin costo"}
                </span>
                <Switch
                  checked={field.value}
                  onCheckedChange={(checked) => {
                    field.onChange(checked);
                    if (checked) setIsSectionOpen(true);
                  }}
                  disabled={disabled}
                  aria-label="Cobro de inscripción"
                />
              </div>
            )}
          />
          {isEnabled && (
            <button
              type="button"
              onClick={() => setIsSectionOpen((prev) => !prev)}
              className="flex size-7 items-center justify-center rounded-lg hover:bg-muted text-muted-foreground hover:text-foreground transition-colors cursor-pointer"
              aria-label={isSectionOpen ? "Plegar formas de pago" : "Desplegar formas de pago"}
            >
              <ChevronDown
                className={`size-4 transition-transform duration-200 ${
                  isSectionOpen ? "rotate-180" : ""
                }`}
              />
            </button>
          )}
        </div>
      </div>

      {isEnabled && isSectionOpen && (
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
                        min="0"
                        step="any"
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
                      className={`h-9 rounded-lg border text-xs font-bold px-2.5 transition-all cursor-pointer ${
                        field.value === "per_team"
                          ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
                          : "border-border hover:bg-muted/50 text-muted-foreground"
                      }`}
                    >
                      {isAmerican ? "Por dupla / participante" : "Por pareja / equipo"}
                    </button>
                    <button
                      type="button"
                      onClick={() => field.onChange("per_player")}
                      disabled={disabled}
                      className={`h-9 rounded-lg border text-xs font-bold px-2.5 transition-all cursor-pointer ${
                        field.value === "per_player"
                          ? "border-emerald-600 bg-emerald-600 text-white shadow-xs"
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
              <div
                onClick={() => mpEnabled && toggleMethodOpen("mp")}
                className={`flex items-center justify-between gap-2 ${mpEnabled ? "cursor-pointer select-none" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400">
                    <Wallet className="size-4" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-foreground block">Mercado Pago</span>
                    <span className="text-[11px] text-muted-foreground">Alias, CVU o link directo de pago</span>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Controller
                    name="paymentConfig.methods.mercadopago.enabled"
                    control={form.control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) setOpenMethods((prev) => ({ ...prev, mp: true }));
                        }}
                        disabled={disabled}
                        aria-label="Habilitar Mercado Pago"
                      />
                    )}
                  />
                  {mpEnabled && (
                    <button
                      type="button"
                      onClick={() => toggleMethodOpen("mp")}
                      className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label={openMethods.mp ? "Plegar Mercado Pago" : "Desplegar Mercado Pago"}
                    >
                      <ChevronDown className={`size-4 transition-transform ${openMethods.mp ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
              </div>

              {mpEnabled && openMethods.mp && (
                <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 pt-2 border-t border-sky-500/20">
                  <div className="sm:col-span-2 rounded-lg border border-sky-500/30 bg-sky-500/10 p-2.5 space-y-2">
                    <div className="flex flex-wrap items-center justify-between gap-2">
                      <div className="flex items-center gap-1.5">
                        <span className="text-xs font-bold text-sky-950 dark:text-sky-200">
                          Cuenta de Mercado Pago
                        </span>
                        {mpAccessToken ? (
                          <span className="inline-flex items-center gap-1 rounded-full bg-emerald-500/20 px-2 py-0.5 text-[10px] font-bold text-emerald-700 dark:text-emerald-300">
                            <CheckCircle2 className="size-3" /> Vinculada
                          </span>
                        ) : null}
                      </div>

                      <Button
                        type="button"
                        size="sm"
                        onClick={handleConnectMpOAuth}
                        disabled={disabled}
                        className="h-7 px-2.5 text-[11px] font-bold bg-[#009EE3] hover:bg-[#008ACA] text-white cursor-pointer gap-1"
                      >
                        <Link2 className="size-3.5" />
                        Vincular mi Mercado Pago
                      </Button>
                    </div>

                    <Field>
                      <div className="flex flex-wrap items-center justify-between gap-1">
                        <FieldLabel className="text-[11px] font-semibold text-sky-950 dark:text-sky-200">
                          Access Token:
                        </FieldLabel>
                        <a
                          href="https://www.mercadopago.com.ar/developers/panel/app"
                          target="_blank"
                          rel="noopener noreferrer"
                          className="text-[11px] font-semibold text-sky-600 dark:text-sky-400 underline hover:opacity-80 inline-flex items-center gap-0.5"
                        >
                          Mercado Pago Developers <ExternalLink className="size-2.5" />
                        </a>
                      </div>
                      <Controller
                        name="paymentConfig.methods.mercadopago.accessToken"
                        control={form.control}
                        render={({ field }) => (
                          <Input
                            type="password"
                            autoComplete="off"
                            placeholder="APP_USR-..."
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                            disabled={disabled}
                            className="text-xs h-8 bg-card font-mono"
                          />
                        )}
                      />
                    </Field>
                  </div>

                  <Field>
                    <FieldLabel className="text-[11px] font-semibold">Alias de Mercado Pago</FieldLabel>
                    <Controller
                      name="paymentConfig.methods.mercadopago.alias"
                      control={form.control}
                      render={({ field, fieldState }) => (
                        <div className="space-y-1">
                          <Input
                            placeholder="Ej: mi.torneo.mp"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                            disabled={disabled}
                            className="text-xs h-8 bg-card"
                          />
                          {fieldState.error && (
                            <p className="text-[11px] font-medium text-destructive">{fieldState.error.message}</p>
                          )}
                        </div>
                      )}
                    />
                  </Field>

                  <Field>
                    <FieldLabel className="text-[11px] font-semibold">CVU (opcional)</FieldLabel>
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
                        Link de pago (opcional)
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
                    </Field>
                  </div>
                </div>
              )}
            </div>

            {/* 2. Transferencia Bancaria */}
            <div className={`rounded-xl border p-3.5 space-y-3 transition-colors ${
              transferEnabled ? "border-indigo-500/40 bg-indigo-500/[0.03]" : "border-border/70 bg-muted/20"
            }`}>
              <div
                onClick={() => transferEnabled && toggleMethodOpen("transfer")}
                className={`flex items-center justify-between gap-2 ${transferEnabled ? "cursor-pointer select-none" : ""}`}
              >
                <div className="flex items-center gap-2">
                  <span className="flex size-7 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400">
                    <Building2 className="size-4" />
                  </span>
                  <div>
                    <span className="text-xs font-bold text-foreground block">Transferencia bancaria</span>
                    <span className="text-[11px] text-muted-foreground">CBU / CVU, Alias y Titular de cuenta</span>
                  </div>
                </div>
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Controller
                    name="paymentConfig.methods.transfer.enabled"
                    control={form.control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) setOpenMethods((prev) => ({ ...prev, transfer: true }));
                        }}
                        disabled={disabled}
                        aria-label="Habilitar Transferencia bancaria"
                      />
                    )}
                  />
                  {transferEnabled && (
                    <button
                      type="button"
                      onClick={() => toggleMethodOpen("transfer")}
                      className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label={openMethods.transfer ? "Plegar Transferencia" : "Desplegar Transferencia"}
                    >
                      <ChevronDown className={`size-4 transition-transform ${openMethods.transfer ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
              </div>

              {transferEnabled && openMethods.transfer && (
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
                      render={({ field, fieldState }) => (
                        <div className="space-y-1">
                          <Input
                            placeholder="Ej: TORNEO.PADEL.2026"
                            value={field.value ?? ""}
                            onChange={(e) => field.onChange(e.target.value || null)}
                            disabled={disabled}
                            className="text-xs h-8 bg-card"
                          />
                          {fieldState.error && (
                            <p className="text-[11px] font-medium text-destructive">{fieldState.error.message}</p>
                          )}
                        </div>
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
              <div
                onClick={() => cashEnabled && toggleMethodOpen("cash")}
                className={`flex items-center justify-between gap-2 ${cashEnabled ? "cursor-pointer select-none" : ""}`}
              >
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
                <div className="flex items-center gap-2" onClick={(e) => e.stopPropagation()}>
                  <Controller
                    name="paymentConfig.methods.cash.enabled"
                    control={form.control}
                    render={({ field }) => (
                      <Switch
                        checked={field.value}
                        onCheckedChange={(checked) => {
                          field.onChange(checked);
                          if (checked) setOpenMethods((prev) => ({ ...prev, cash: true }));
                        }}
                        disabled={disabled}
                        aria-label="Habilitar Pago en efectivo"
                      />
                    )}
                  />
                  {cashEnabled && (
                    <button
                      type="button"
                      onClick={() => toggleMethodOpen("cash")}
                      className="p-1 text-muted-foreground hover:text-foreground cursor-pointer"
                      aria-label={openMethods.cash ? "Plegar Efectivo" : "Desplegar Efectivo"}
                    >
                      <ChevronDown className={`size-4 transition-transform ${openMethods.cash ? "rotate-180" : ""}`} />
                    </button>
                  )}
                </div>
              </div>

              {cashEnabled && openMethods.cash && (
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

          {!hideProfileDefaultControls && (
            <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/[0.05] p-3.5 flex flex-col sm:flex-row sm:items-center justify-between gap-3">
              <div className="space-y-0.5">
                <div className="flex items-center gap-1.5">
                  <BookmarkCheck className="size-4 text-emerald-600 dark:text-emerald-400 shrink-0" />
                  <span className="text-xs font-bold text-foreground">
                    {hasSavedInProfile
                      ? "Tenés tus datos de cobro guardados en tu perfil"
                      : "Guardar como predeterminado en mi perfil (opcional)"}
                  </span>
                </div>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Si los guardás en tu perfil, cada vez que crees un nuevo torneo ya van a aparecer cargados tus datos de Mercado Pago, Transferencia y Efectivo sin tener que escribirlos de nuevo.
                </p>
              </div>

              <div className="flex items-center gap-2 shrink-0">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={disabled || isSavingProfile}
                  onClick={handleSaveToProfile}
                  className="h-8 text-xs font-semibold border-emerald-500/40 bg-emerald-500/10 hover:bg-emerald-500/20 text-emerald-800 dark:text-emerald-300 cursor-pointer"
                >
                  {isSavingProfile ? <Spinner className="size-3.5 mr-1" /> : <BookmarkCheck className="size-3.5 mr-1" />}
                  {hasSavedInProfile ? "Actualizar en mi perfil" : "Guardar en mi perfil"}
                </Button>

                {hasSavedInProfile && (
                  <Button
                    type="button"
                    size="sm"
                    variant="ghost"
                    disabled={disabled || isSavingProfile}
                    onClick={handleClearFromProfile}
                    title="Dejar de recordar mis datos de cobro por defecto"
                    className="h-8 px-2 text-xs text-muted-foreground hover:text-destructive cursor-pointer"
                  >
                    <Trash2 className="size-3.5" />
                  </Button>
                )}
              </div>
            </div>
          )}
        </div>
      )}
    </div>
  );
}

