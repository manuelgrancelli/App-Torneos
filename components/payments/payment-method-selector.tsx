"use client";

import { Banknote, Building2, Check, ChevronLeft, ChevronRight, Copy, Info, Sparkles, Wallet } from "lucide-react";
import { useRef, useState } from "react";
import { toast } from "sonner";
import {
  type PaymentConfig,
  type PaymentMethodType,
  formatCurrency,
  getEffectiveTransferDetails,
  getPlayablePaymentMethods,
  pricingTypeLabel,
} from "@/lib/domain/payment";

export function PaymentMethodSelector({
  tournamentId: _tournamentId,
  teamName: _teamName,
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
  const scrollRef = useRef<HTMLDivElement>(null);

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

  const scrollCards = (dir: "left" | "right") => {
    if (!scrollRef.current) return;
    const offset = dir === "left" ? -260 : 260;
    scrollRef.current.scrollBy({ left: offset, behavior: "smooth" });
  };

  const mp = paymentConfig.methods.mercadopago;
  const cash = paymentConfig.methods.cash;
  const hasTransferOption = playableMethods.includes("transfer");
  const transferDetails = getEffectiveTransferDetails(paymentConfig);

  return (
    <div className="rounded-2xl border border-emerald-500/30 bg-emerald-500/[0.04] p-4 sm:p-5 space-y-3.5">
      {/* Resumen del arancel */}
      <div className="flex items-center justify-between gap-2 border-b border-emerald-500/20 pb-3">
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

        {playableMethods.length > 1 && (
          <div className="flex items-center gap-1">
            <span className="text-[11px] text-muted-foreground mr-1 hidden sm:inline">
              Elegí medio de pago:
            </span>
            <button
              type="button"
              onClick={() => scrollCards("left")}
              className="flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Anterior tarjeta"
            >
              <ChevronLeft className="size-4" />
            </button>
            <button
              type="button"
              onClick={() => scrollCards("right")}
              className="flex size-7 items-center justify-center rounded-full border border-border bg-card text-muted-foreground hover:text-foreground cursor-pointer"
              aria-label="Siguiente tarjeta"
            >
              <ChevronRight className="size-4" />
            </button>
          </div>
        )}
      </div>

      {/* Carrusel de Tarjetas de Pago */}
      <div
        ref={scrollRef}
        className="flex gap-3 overflow-x-auto snap-x snap-mandatory pb-1.5 pt-0.5 scrollbar-thin"
      >
        {/* 1. Tarjeta Mercado Pago */}
        {mp?.enabled && (
          <div
            onClick={() => !disabled && onChange("mercadopago")}
            className={`snap-center shrink-0 w-[250px] sm:w-[260px] rounded-2xl border p-4 transition-all cursor-pointer flex flex-col justify-between min-h-[148px] select-none ${
              selectedMethod === "mercadopago"
                ? "border-sky-500 bg-gradient-to-br from-sky-500/20 via-sky-500/10 to-transparent shadow-sm ring-2 ring-sky-500/50"
                : "border-border/80 bg-card/80 hover:bg-muted/40 opacity-80 hover:opacity-100"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-[#009EE3]/20 text-[#009EE3] shrink-0">
                <Wallet className="size-5" />
              </span>
              <div
                className={`size-5 rounded-full border flex items-center justify-center transition-colors ${
                  selectedMethod === "mercadopago"
                    ? "border-sky-500 bg-sky-500 text-white"
                    : "border-muted-foreground/40 bg-transparent"
                }`}
              >
                {selectedMethod === "mercadopago" && <Check className="size-3 stroke-[3]" />}
              </div>
            </div>

            <div className="space-y-1 pt-3">
              <div className="flex items-center gap-1.5">
                <span className="text-sm font-bold text-foreground">Mercado Pago</span>
                <span className="text-[10px] uppercase font-bold px-1.5 py-0.5 rounded bg-sky-500/20 text-sky-600 dark:text-sky-300 inline-flex items-center gap-0.5">
                  <Sparkles className="size-2.5" />
                  Directo
                </span>
              </div>
              <p className="text-[11px] text-muted-foreground leading-snug">
                Al confirmar te abre Mercado Pago con el monto ({formatCurrency(paymentConfig.amount)}) para elegir tarjeta o dinero en cuenta.
              </p>
            </div>
          </div>
        )}

        {/* 2. Tarjeta Transferencia */}
        {hasTransferOption && (
          <div
            onClick={() => !disabled && onChange("transfer")}
            className={`snap-center shrink-0 w-[250px] sm:w-[260px] rounded-2xl border p-4 transition-all cursor-pointer flex flex-col justify-between min-h-[148px] select-none ${
              selectedMethod === "transfer"
                ? "border-indigo-500 bg-gradient-to-br from-indigo-500/20 via-indigo-500/10 to-transparent shadow-sm ring-2 ring-indigo-500/50"
                : "border-border/80 bg-card/80 hover:bg-muted/40 opacity-80 hover:opacity-100"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-indigo-500/20 text-indigo-500 shrink-0">
                <Building2 className="size-5" />
              </span>
              <div
                className={`size-5 rounded-full border flex items-center justify-center transition-colors ${
                  selectedMethod === "transfer"
                    ? "border-indigo-500 bg-indigo-500 text-white"
                    : "border-muted-foreground/40 bg-transparent"
                }`}
              >
                {selectedMethod === "transfer" && <Check className="size-3 stroke-[3]" />}
              </div>
            </div>

            <div className="space-y-1.5 pt-3">
              <span className="text-sm font-bold text-foreground block">
                Transferencia Alias / CVU
              </span>
              {transferDetails.alias ? (
                <button
                  type="button"
                  onClick={(e) => {
                    e.stopPropagation();
                    onChange("transfer");
                    handleCopy(transferDetails.alias!, "Alias", "b-alias");
                  }}
                  className="inline-flex items-center gap-1.5 rounded-lg bg-background/80 px-2 py-1 text-[11px] font-mono border border-border/80 hover:bg-background cursor-pointer w-full justify-between"
                >
                  <span className="truncate">
                    Alias: <strong className="text-foreground">{transferDetails.alias}</strong>
                  </span>
                  {copiedKey === "b-alias" ? (
                    <Check className="size-3 text-emerald-500 shrink-0" />
                  ) : (
                    <Copy className="size-3 text-indigo-400 shrink-0" />
                  )}
                </button>
              ) : (
                <p className="text-[11px] text-muted-foreground leading-snug">
                  Transferí desde cualquier banco o billetera virtual por Alias o CBU/CVU.
                </p>
              )}
            </div>
          </div>
        )}

        {/* 3. Tarjeta Efectivo */}
        {cash?.enabled && (
          <div
            onClick={() => !disabled && onChange("cash")}
            className={`snap-center shrink-0 w-[250px] sm:w-[260px] rounded-2xl border p-4 transition-all cursor-pointer flex flex-col justify-between min-h-[148px] select-none ${
              selectedMethod === "cash"
                ? "border-amber-500 bg-gradient-to-br from-amber-500/20 via-amber-500/10 to-transparent shadow-sm ring-2 ring-amber-500/50"
                : "border-border/80 bg-card/80 hover:bg-muted/40 opacity-80 hover:opacity-100"
            }`}
          >
            <div className="flex items-start justify-between gap-2">
              <span className="flex size-9 items-center justify-center rounded-xl bg-amber-500/20 text-amber-500 shrink-0">
                <Banknote className="size-5" />
              </span>
              <div
                className={`size-5 rounded-full border flex items-center justify-center transition-colors ${
                  selectedMethod === "cash"
                    ? "border-amber-500 bg-amber-500 text-white"
                    : "border-muted-foreground/40 bg-transparent"
                }`}
              >
                {selectedMethod === "cash" && <Check className="size-3 stroke-[3]" />}
              </div>
            </div>

            <div className="space-y-1 pt-3">
              <span className="text-sm font-bold text-foreground block">
                Efectivo en el torneo
              </span>
              <p className="text-[11px] text-muted-foreground leading-snug line-clamp-2">
                {cash.instructions || "Abonás presencialmente en el club antes de tu primer partido."}
              </p>
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
