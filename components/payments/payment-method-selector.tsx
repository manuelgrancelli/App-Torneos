"use client";

import { ArrowUpRight, Banknote, Building2, Check, Copy, ExternalLink, Info, Sparkles, Wallet } from "lucide-react";
import { useState } from "react";
import { toast } from "sonner";
import { Button } from "@/components/ui/button";
import { Spinner } from "@/components/ui/spinner";
import {
  type PaymentConfig,
  type PaymentMethodType,
  formatCurrency,
  getEffectiveTransferDetails,
  getPlayablePaymentMethods,
  pricingTypeLabel,
} from "@/lib/domain/payment";
import { launchMercadoPagoPayment } from "@/lib/payments/mercadopago-client";

export function PaymentMethodSelector({
  tournamentId,
  teamName,
  paymentConfig,
  selectedMethod,
  onChange,
  disabled = false,
  isIndividual = false,
}: {
  tournamentId?: string;
  teamName?: string;
  paymentConfig?: PaymentConfig | null;
  selectedMethod: PaymentMethodType | null;
  onChange: (method: PaymentMethodType) => void;
  disabled?: boolean;
  isIndividual?: boolean;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isOpeningMp, setIsOpeningMp] = useState(false);

  if (!paymentConfig || !paymentConfig.enabled) {
    return null;
  }

  const playableMethods = getPlayablePaymentMethods(paymentConfig);
  if (playableMethods.length === 0) {
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

  const handleOpenMp = async (e: React.MouseEvent) => {
    e.stopPropagation();
    onChange("mercadopago");

    if (tournamentId) {
      setIsOpeningMp(true);
      await launchMercadoPagoPayment({
        tournamentId,
        teamName,
        openInNewTab: true,
      });
      setIsOpeningMp(false);
      return;
    }

    // Fallback directo si no se pasó tournamentId
    const mp = paymentConfig.methods.mercadopago;
    if (mp.paymentLink) {
      window.open(mp.paymentLink, "_blank", "noopener,noreferrer");
      return;
    }
    const targetAlias = mp.alias || mp.cvu || paymentConfig.methods.transfer.alias || paymentConfig.methods.transfer.cbuOrCvu;
    if (targetAlias && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(targetAlias).catch(() => {});
      toast.success(`¡Alias "${targetAlias}" copiado! Abriendo Mercado Pago...`);
    }
    window.open("https://www.mercadopago.com.ar/money-out/transfer", "_blank", "noopener,noreferrer");
  };

  const mp = paymentConfig.methods.mercadopago;
  const cash = paymentConfig.methods.cash;
  const hasTransferOption = playableMethods.includes("transfer");
  const transferDetails = getEffectiveTransferDetails(paymentConfig);

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
        {/* 1. Pagar desde Mercado Pago (Checkout API / Abrir MP) */}
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
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span className="flex size-8 items-center justify-center rounded-lg bg-sky-500/15 text-sky-600 dark:text-sky-400 shrink-0 mt-0.5">
                  <Wallet className="size-4" />
                </span>
                <div className="min-w-0 space-y-1.5 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-foreground">
                      Pagar desde Mercado Pago
                    </span>
                    <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-sky-500/15 text-sky-700 dark:text-sky-300 inline-flex items-center gap-1">
                      <Sparkles className="size-2.5" />
                      Abre Mercado Pago
                    </span>
                  </div>

                  <p className="text-xs text-muted-foreground leading-relaxed">
                    Te abre Mercado Pago directamente para abonar con dinero en cuenta, débito o crédito.
                  </p>

                  <div className="pt-1 flex flex-wrap items-center gap-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={disabled || isOpeningMp}
                      onClick={handleOpenMp}
                      className="h-8 px-3 text-xs font-bold bg-[#009EE3] hover:bg-[#008ACA] text-white shadow-xs cursor-pointer gap-1.5"
                    >
                      {isOpeningMp ? (
                        <Spinner className="size-3.5" />
                      ) : (
                        <ExternalLink className="size-3.5" />
                      )}
                      Abrir Mercado Pago para pagar {paymentConfig.amount ? formatCurrency(paymentConfig.amount) : ""}
                      <ArrowUpRight className="size-3.5" />
                    </Button>
                  </div>
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

        {/* 2. Opción de Transferir (por Alias o CBU/CVU desde cualquier banco o billetera) */}
        {hasTransferOption && (
          <div
            onClick={() => !disabled && onChange("transfer")}
            className={`rounded-xl border p-3.5 transition-all cursor-pointer ${
              selectedMethod === "transfer"
                ? "border-indigo-500 bg-indigo-500/10 shadow-xs ring-1 ring-indigo-500/40"
                : "border-border/80 bg-card hover:bg-muted/40"
            }`}
          >
            <div className="flex items-start justify-between gap-3">
              <div className="flex items-start gap-3 min-w-0 flex-1">
                <span className="flex size-8 items-center justify-center rounded-lg bg-indigo-500/15 text-indigo-600 dark:text-indigo-400 shrink-0 mt-0.5">
                  <Building2 className="size-4" />
                </span>
                <div className="min-w-0 space-y-1 flex-1">
                  <div className="flex flex-wrap items-center gap-2">
                    <span className="text-xs sm:text-sm font-bold text-foreground">
                      Transferencia por Alias / CVU / CBU
                    </span>
                    {transferDetails.bank && (
                      <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-indigo-500/15 text-indigo-700 dark:text-indigo-300 truncate max-w-[180px]">
                        {transferDetails.bank}
                      </span>
                    )}
                  </div>

                  <p className="text-xs text-muted-foreground">
                    Copiá el Alias o CBU/CVU para transferir desde tu banco o billetera virtual.
                  </p>

                  {transferDetails.accountHolder && (
                    <p className="text-xs text-muted-foreground">
                      Titular: <strong className="text-foreground">{transferDetails.accountHolder}</strong>
                    </p>
                  )}

                  <div className="pt-1.5 flex flex-wrap gap-2 text-xs">
                    {transferDetails.alias && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChange("transfer");
                          handleCopy(transferDetails.alias!, "Alias", "b-alias");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-mono hover:bg-muted/80 border border-border/80 transition-colors cursor-pointer"
                      >
                        <span className="text-muted-foreground font-sans">Alias:</span>
                        <strong className="text-foreground">{transferDetails.alias}</strong>
                        {copiedKey === "b-alias" ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-sans font-bold text-emerald-600">
                            <Check className="size-3" /> Copiado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-sans font-semibold text-indigo-600 dark:text-indigo-400">
                            <Copy className="size-3" /> Copiar
                          </span>
                        )}
                      </button>
                    )}

                    {transferDetails.cbuOrCvu && (
                      <button
                        type="button"
                        onClick={(e) => {
                          e.stopPropagation();
                          onChange("transfer");
                          handleCopy(transferDetails.cbuOrCvu!, "CBU/CVU", "b-cbu");
                        }}
                        className="inline-flex items-center gap-1.5 rounded-lg bg-muted px-2.5 py-1.5 text-xs font-mono hover:bg-muted/80 border border-border/80 transition-colors cursor-pointer"
                      >
                        <span className="text-muted-foreground font-sans">CBU/CVU:</span>
                        <strong className="text-foreground">{transferDetails.cbuOrCvu}</strong>
                        {copiedKey === "b-cbu" ? (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-sans font-bold text-emerald-600">
                            <Check className="size-3" /> Copiado
                          </span>
                        ) : (
                          <span className="inline-flex items-center gap-0.5 text-[10px] font-sans font-semibold text-indigo-600 dark:text-indigo-400">
                            <Copy className="size-3" /> Copiar
                          </span>
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
