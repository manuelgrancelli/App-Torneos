"use client";

import { Banknote, Building2, Check, Copy, ExternalLink, Info, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import {
  type PaymentConfig,
  type PaymentMethodType,
  formatCurrency,
  getEnabledPaymentMethods,
  pricingTypeLabel,
} from "@/lib/domain/payment";

export function PaymentMethodSelector({
  paymentConfig,
  selectedMethod,
  onChange,
  disabled = false,
  isIndividual = false,
}: {
  paymentConfig?: PaymentConfig | null;
  selectedMethod: PaymentMethodType | null;
  onChange: (method: PaymentMethodType) => void;
  disabled?: boolean;
  isIndividual?: boolean;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);

  if (!paymentConfig || !paymentConfig.enabled) {
    return null;
  }

  const enabledMethods = getEnabledPaymentMethods(paymentConfig);
  if (enabledMethods.length === 0) {
    return null;
  }

  const handleCopy = (text: string, label: string, key: string) => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success(`${label} copiado al portapapeles`);
      setTimeout(() => setCopiedKey(null), 2500);
    } else {
      toast.info(`${label}: ${text}`);
    }
  };

  const mp = paymentConfig.methods.mercadopago;
  const transfer = paymentConfig.methods.transfer;
  const cash = paymentConfig.methods.cash;

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4 sm:p-5 space-y-4">
      {/* Resumen del arancel */}
      <div className="flex flex-col sm:flex-row sm:items-center justify-between gap-2 border-b border-emerald-500/20 pb-3.5">
        <div>
          <span className="text-[11px] font-bold uppercase tracking-wider text-emerald-600 dark:text-emerald-400 block">
            Arancel de inscripción
          </span>
          <div className="flex items-baseline gap-2 mt-0.5">
            <span className="text-xl sm:text-2xl font-black text-foreground">
              {formatCurrency(paymentConfig.amount)}
            </span>
            <span className="text-xs text-muted-foreground font-medium">
              ({pricingTypeLabel(paymentConfig.pricingType, isIndividual)})
            </span>
          </div>
        </div>
        <div className="rounded-lg bg-emerald-500/10 border border-emerald-500/20 px-2.5 py-1 text-[11px] font-medium text-emerald-800 dark:text-emerald-300 self-start sm:self-auto">
          Elegí cómo vas a abonar:
        </div>
      </div>

      {/* Tarjetas de Métodos de Pago */}
      <div className="space-y-2.5">
        {/* 1. Mercado Pago */}
        {mp?.enabled && (
          <div
            onClick={() => !disabled && onChange("mercadopago")}
            className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
              selectedMethod === "mercadopago"
                ? "border-sky-500 bg-sky-500/10 shadow-xs ring-1 ring-sky-500/40"
                : "border-border/80 bg-card hover:bg-muted/40"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="flex size-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5">
                  <Wallet className="size-4" />
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-foreground">
                      Mercado Pago
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300">
                      Dinero en cuenta / Débito
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Transferí por Alias, CVU o mediante link de cobro.
                  </p>

                  {(mp.alias || mp.cvu) && (
                    <div className="pt-2 flex flex-wrap gap-2 text-xs">
                      {mp.alias && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(mp.alias!, "Alias MP", "mp-alias");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-mono hover:bg-muted/80 border border-border/60 transition-colors"
                        >
                          <span className="text-muted-foreground font-sans">Alias:</span>
                          <strong className="text-foreground">{mp.alias}</strong>
                          {copiedKey === "mp-alias" ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3 text-muted-foreground" />
                          )}
                        </button>
                      )}

                      {mp.cvu && (
                        <button
                          type="button"
                          onClick={(e) => {
                            e.stopPropagation();
                            handleCopy(mp.cvu!, "CVU MP", "mp-cvu");
                          }}
                          className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-mono hover:bg-muted/80 border border-border/60 transition-colors"
                        >
                          <span className="text-muted-foreground font-sans">CVU:</span>
                          <strong className="text-foreground">{mp.cvu}</strong>
                          {copiedKey === "mp-cvu" ? (
                            <Check className="size-3 text-emerald-600" />
                          ) : (
                            <Copy className="size-3 text-muted-foreground" />
                          )}
                        </button>
                      )}
                    </div>
                  )}

                  {mp.paymentLink && (
                    <div className="pt-2">
                      <Button
                        type="button"
                        size="sm"
                        variant="outline"
                        asChild
                        className="h-7 text-xs gap-1.5 border-sky-500/40 hover:bg-sky-500/10 text-sky-700 dark:text-sky-300"
                        onClick={(e) => e.stopPropagation()}
                      >
                        <a href={mp.paymentLink} target="_blank" rel="noopener noreferrer">
                          <ExternalLink className="size-3" />
                          Pagar ahora por link de Mercado Pago
                        </a>
                      </Button>
                    </div>
                  )}
                </div>
              </div>

              <div className="shrink-0 pt-0.5">
                <div
                  className={`size-4 rounded-full border flex items-center justify-center transition-colors ${
                    selectedMethod === "mercadopago"
                      ? "border-sky-600 bg-sky-600 text-white"
                      : "border-muted-foreground/40 bg-transparent"
                  }`}
                >
                  {selectedMethod === "mercadopago" && <div className="size-1.5 rounded-full bg-white" />}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 2. Transferencia bancaria */}
        {transfer?.enabled && (
          <div
            onClick={() => !disabled && onChange("transfer")}
            className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
              selectedMethod === "transfer"
                ? "border-indigo-500 bg-indigo-500/10 shadow-xs ring-1 ring-indigo-500/40"
                : "border-border/80 bg-card hover:bg-muted/40"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                  <Building2 className="size-4" />
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-foreground">
                      Transferencia bancaria
                    </span>
                    {transfer.bank && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 truncate max-w-[150px]">
                        {transfer.bank}
                      </span>
                    )}
                  </div>

                  {transfer.accountHolder && (
                    <p className="text-xs text-muted-foreground">
                      Titular: <strong className="text-foreground">{transfer.accountHolder}</strong>
                    </p>
                  )}

                  <div className="pt-1.5 flex flex-wrap gap-2 text-xs">
                    {transfer.alias && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(transfer.alias!, "Alias bancario", "b-alias");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-mono hover:bg-muted/80 border border-border/60 transition-colors"
                      >
                        <span className="text-muted-foreground font-sans">Alias:</span>
                        <strong className="text-foreground">{transfer.alias}</strong>
                        {copiedKey === "b-alias" ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3 text-muted-foreground" />
                        )}
                      </button>
                    )}

                    {transfer.cbuOrCvu && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          handleCopy(transfer.cbuOrCvu!, "CBU/CVU", "b-cbu");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-md bg-muted px-2 py-1 text-[11px] font-mono hover:bg-muted/80 border border-border/60 transition-colors"
                      >
                        <span className="text-muted-foreground font-sans">CBU/CVU:</span>
                        <strong className="text-foreground">{transfer.cbuOrCvu}</strong>
                        {copiedKey === "b-cbu" ? (
                          <Check className="size-3 text-emerald-600" />
                        ) : (
                          <Copy className="size-3 text-muted-foreground" />
                        )}
                      </button>
                    )}
                  </div>
                </div>
              </div>

              <div className="shrink-0 pt-0.5">
                <div
                  className={`size-4 rounded-full border flex items-center justify-center transition-colors ${
                    selectedMethod === "transfer"
                      ? "border-indigo-600 bg-indigo-600 text-white"
                      : "border-muted-foreground/40 bg-transparent"
                  }`}
                >
                  {selectedMethod === "transfer" && <div className="size-1.5 rounded-full bg-white" />}
                </div>
              </div>
            </div>
          </div>
        )}

        {/* 3. Efectivo en el torneo */}
        {cash?.enabled && (
          <div
            onClick={() => !disabled && onChange("cash")}
            className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
              selectedMethod === "cash"
                ? "border-amber-500 bg-amber-500/10 shadow-xs ring-1 ring-amber-500/40"
                : "border-border/80 bg-card hover:bg-muted/40"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0">
                <span className="flex size-8 items-center justify-center rounded-lg bg-amber-500/15 text-amber-600 dark:text-amber-400 shrink-0 mt-0.5">
                  <Banknote className="size-4" />
                </span>
                <div className="min-w-0 space-y-1">
                  <div className="flex items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-foreground">
                      Efectivo en el torneo
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-amber-500/15 text-amber-700 dark:text-amber-300">
                      Presencial en el club
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-snug">
                    {cash.instructions || "Abonás en la recepción / mesa de control el día del torneo antes de jugar."}
                  </p>
                </div>
              </div>

              <div className="shrink-0 pt-0.5">
                <div
                  className={`size-4 rounded-full border flex items-center justify-center transition-colors ${
                    selectedMethod === "cash"
                      ? "border-amber-600 bg-amber-600 text-white"
                      : "border-muted-foreground/40 bg-transparent"
                  }`}
                >
                  {selectedMethod === "cash" && <div className="size-1.5 rounded-full bg-white" />}
                </div>
              </div>
            </div>
          </div>
        )}
      </div>

      {/* Instrucciones adicionales del comprobante */}
      {paymentConfig.instructions && (
        <div className="rounded-xl bg-card border border-border/80 p-3 text-xs flex items-start gap-2.5">
          <Info className="size-4 text-emerald-600 shrink-0 mt-0.5" />
          <div className="space-y-0.5">
            <span className="font-semibold text-foreground block">
              Envío de comprobante de pago:
            </span>
            <p className="text-muted-foreground leading-relaxed whitespace-pre-line">
              {paymentConfig.instructions}
            </p>
          </div>
        </div>
      )}
    </div>
  );
}
