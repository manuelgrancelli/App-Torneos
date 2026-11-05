"use client";

import { Banknote, Building2, Check, CheckCircle2, Clock, Copy, ExternalLink, ShieldCheck, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useEffect, useState, useTransition } from "react";
import { toast } from "sonner";
import { setTeamPaymentMethod } from "@/app/(app)/torneos/[id]/inscripciones/actions";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import {
  type PaymentConfig,
  type PaymentMethodType,
  type PaymentStatus,
  formatCurrency,
  getEffectiveTransferDetails,
  pricingTypeLabel,
} from "@/lib/domain/payment";
import { launchMercadoPagoPayment } from "@/lib/payments/mercadopago-client";

export function TeamPaymentCard({
  teamId,
  tournamentId,
  teamName,
  isCaptain,
  paymentStatus,
  paymentMethod,
  paidAt,
  paymentNotes,
  paymentConfig,
}: {
  teamId: string;
  tournamentId?: string;
  teamName?: string;
  isCaptain: boolean;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethodType | null;
  paidAt?: string | null;
  paymentNotes?: string | null;
  paymentConfig?: PaymentConfig | null;
}) {
  const router = useRouter();
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isChangingMethod, setIsChangingMethod] = useState(false);
  const [isLaunchingMp, setIsLaunchingMp] = useState(false);
  const [isPending, startTransition] = useTransition();

  useEffect(() => {
    if (typeof window === "undefined" || paymentStatus === "paid") return;
    const params = new URLSearchParams(window.location.search);
    const mpStatus = params.get("mp_status") || params.get("collection_status") || params.get("status");
    const paymentId = params.get("payment_id") || params.get("collection_id");

    if (mpStatus === "approved" && paymentId) {
      void fetch("/api/payments/mercadopago/verify", {
        method: "POST",
        headers: { "Content-Type": "application/json" },
        body: JSON.stringify({
          paymentId,
          tournamentId,
          teamId,
        }),
      })
        .then((r) => r.json())
        .then((res) => {
          if (res?.ok && res?.verified) {
            toast.success("¡Pago de Mercado Pago acreditado automáticamente!");
            router.refresh();
          }
        })
        .catch(() => null);
    }
  }, [paymentStatus, router, teamId, tournamentId]);

  if (!paymentConfig || !paymentConfig.enabled) {
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

  const handleSelectMethod = (method: PaymentMethodType) => {
    startTransition(async () => {
      const res = await setTeamPaymentMethod({ teamId, paymentMethod: method });
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      toast.success(res.message);
      setIsChangingMethod(false);
    });
  };

  const handleOpenMercadoPago = async () => {
    if (!tournamentId) {
      if (paymentConfig.methods.mercadopago?.paymentLink) {
        window.open(paymentConfig.methods.mercadopago.paymentLink, "_blank", "noopener,noreferrer");
      }
      return;
    }
    setIsLaunchingMp(true);
    try {
      await launchMercadoPagoPayment({
        tournamentId,
        teamId,
        teamName,
        returnPath: `/inscripciones/${teamId}`,
        openInNewTab: true,
      });
    } finally {
      setIsLaunchingMp(false);
    }
  };

  const isPaid = paymentStatus === "paid";
  const isCash = paymentStatus === "cash_on_arrival" || paymentMethod === "cash";
  const isPendingPay = paymentStatus === "pending";

  const mp = paymentConfig.methods.mercadopago;
  const effectiveTransfer = getEffectiveTransferDetails(paymentConfig);
  const hasTransferOption = Boolean(
    paymentConfig.methods.transfer?.enabled || effectiveTransfer.alias || effectiveTransfer.cbuOrCvu,
  );

  return (
    <Card className="border-border/80 shadow-xs">
      <CardHeader className="pb-3">
        <div className="flex flex-wrap items-center justify-between gap-2">
          <div className="flex items-center gap-2">
            <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
              <ShieldCheck className="size-4" />
            </span>
            <CardTitle>
              <h2 className="text-sm sm:text-base font-bold text-foreground">
                Arancel e Inscripción
              </h2>
            </CardTitle>
          </div>

          <div>
            {isPaid ? (
              <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1.5 py-1">
                <CheckCircle2 className="size-3.5" />
                Inscripción pagada
              </Badge>
            ) : isCash ? (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1.5 py-1">
                <Banknote className="size-3.5" />
                Abonás en efectivo en el club
              </Badge>
            ) : (
              <Badge className="bg-amber-500/15 text-amber-700 dark:text-amber-300 border-amber-500/30 gap-1.5 py-1">
                <Clock className="size-3.5" />
                Pago pendiente
              </Badge>
            )}
          </div>
        </div>
      </CardHeader>

      <CardContent className="space-y-4 pt-1">
        {/* Detalle del monto */}
        <div className="flex items-baseline justify-between rounded-xl bg-muted/40 p-3 border border-border/60">
          <span className="text-xs text-muted-foreground font-medium">
            Monto a abonar ({pricingTypeLabel(paymentConfig.pricingType)}):
          </span>
          <span className="text-lg sm:text-xl font-black text-foreground">
            {formatCurrency(paymentConfig.amount)}
          </span>
        </div>

        {/* 1. Si está pagado */}
        {isPaid && (
          <div className="rounded-xl border border-emerald-500/30 bg-emerald-500/5 p-3.5 text-xs text-emerald-900 dark:text-emerald-200 flex items-start gap-2.5">
            <CheckCircle2 className="size-4 shrink-0 text-emerald-600 dark:text-emerald-400 mt-0.5" />
            <div className="space-y-0.5">
              <p className="font-semibold">¡El pago está confirmado!</p>
              <p className="text-[11px] text-muted-foreground">
                {paidAt
                  ? `Acreditado el ${new Date(paidAt).toLocaleDateString("es-AR")}. Ya contás con el cupo asegurado.`
                  : "El organizador acreditó el arancel de tu inscripción."}
              </p>
              {paymentNotes && (
                <p className="text-[11px] text-foreground font-mono pt-1">Nota: {paymentNotes}</p>
              )}
            </div>
          </div>
        )}

        {/* 2. Si acordó abonar en efectivo */}
        {isCash && !isPaid && (
          <div className="rounded-xl border border-amber-500/30 bg-amber-500/5 p-3.5 text-xs text-amber-900 dark:text-amber-200 space-y-2">
            <div className="flex items-start gap-2.5">
              <Banknote className="size-4 shrink-0 text-amber-600 dark:text-amber-400 mt-0.5" />
              <div className="space-y-1">
                <p className="font-semibold">Abonás el día del torneo de forma presencial</p>
                <p className="text-[11px] text-muted-foreground leading-snug">
                  {paymentConfig.methods.cash?.instructions ||
                    "Por favor acércate a la mesa de control o recepción del club antes de tu primer partido para abonar el arancel."}
                </p>
              </div>
            </div>

            {isCaptain && (
              <div className="pt-1">
                <button
                  type="button"
                  onClick={() => setIsChangingMethod(!isChangingMethod)}
                  className="text-[11px] text-primary hover:underline font-semibold cursor-pointer"
                >
                  {isChangingMethod ? "Ocultar opciones" : "¿Preferís transferir ahora por Mercado Pago o Banco?"}
                </button>
              </div>
            )}
          </div>
        )}

        {/* 3. Si está pendiente (o si quiere ver datos para transferir / pagar con MP) */}
        {(isPendingPay || isChangingMethod) && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Elegí si querés abrir Mercado Pago para abonar o transferir por Alias / CVU / CBU:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Opción 1: Pagar desde Mercado Pago */}
              {mp?.enabled && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.04] p-3.5 space-y-2.5 flex flex-col justify-between">
                  <div className="space-y-1.5">
                    <div className="flex items-center gap-2">
                      <span className="flex size-6 items-center justify-center rounded bg-sky-500/20 text-sky-600 dark:text-sky-400">
                        <Wallet className="size-3.5" />
                      </span>
                      <strong className="text-foreground">Pagar desde Mercado Pago</strong>
                    </div>
                    <p className="text-[11px] text-muted-foreground leading-snug">
                      {mp.accessToken || mp.paymentLink
                        ? "Abrí el checkout de Mercado Pago para abonar con dinero en cuenta o tarjeta."
                        : "Te copiamos el Alias del organizador y te abrimos Mercado Pago directamente."}
                    </p>
                  </div>

                  <div className="pt-2">
                    <Button
                      type="button"
                      size="sm"
                      disabled={isLaunchingMp || isPending}
                      onClick={() => void handleOpenMercadoPago()}
                      className="w-full h-8 text-xs font-bold bg-[#009EE3] hover:bg-[#0089C7] text-white cursor-pointer"
                    >
                      {isLaunchingMp ? (
                        <Spinner className="mr-1.5" />
                      ) : (
                        <ExternalLink className="size-3.5 mr-1.5" />
                      )}
                      Abrir Mercado Pago ({formatCurrency(paymentConfig.amount)})
                    </Button>
                  </div>
                </div>
              )}

              {/* Opción 2: Transferencia por Alias / CVU / CBU */}
              {hasTransferOption && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/[0.04] p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                      <Building2 className="size-3.5" />
                    </span>
                    <strong className="text-foreground">Transferir por Alias / CVU / CBU</strong>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {effectiveTransfer.bank && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Entidad:</span>
                        <strong className="text-foreground">{effectiveTransfer.bank}</strong>
                      </div>
                    )}

                    {effectiveTransfer.accountHolder && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Titular:</span>
                        <strong className="text-foreground">{effectiveTransfer.accountHolder}</strong>
                      </div>
                    )}

                    {effectiveTransfer.alias && (
                      <div className="flex items-center justify-between gap-1 rounded bg-muted/60 px-2.5 py-1.5">
                        <span className="text-[11px] text-muted-foreground">Alias:</span>
                        <div className="flex items-center gap-1.5">
                          <strong className="font-mono text-foreground">{effectiveTransfer.alias}</strong>
                          <button
                            type="button"
                            onClick={() => handleCopy(effectiveTransfer.alias!, "Alias", "b-alias")}
                            className="inline-flex items-center gap-1 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/25 cursor-pointer"
                          >
                            {copiedKey === "b-alias" ? <Check className="size-3" /> : <Copy className="size-3" />}
                            {copiedKey === "b-alias" ? "Copiado" : "Copiar"}
                          </button>
                        </div>
                      </div>
                    )}

                    {effectiveTransfer.cbuOrCvu && (
                      <div className="flex items-center justify-between gap-1 rounded bg-muted/60 px-2.5 py-1.5">
                        <span className="text-[11px] text-muted-foreground">CBU/CVU:</span>
                        <div className="flex items-center gap-1.5">
                          <strong className="font-mono text-[10px] text-foreground">{effectiveTransfer.cbuOrCvu}</strong>
                          <button
                            type="button"
                            onClick={() => handleCopy(effectiveTransfer.cbuOrCvu!, "CBU/CVU", "b-cbu")}
                            className="inline-flex items-center gap-1 rounded bg-indigo-500/15 px-1.5 py-0.5 text-[10px] font-semibold text-indigo-600 dark:text-indigo-300 hover:bg-indigo-500/25 cursor-pointer"
                          >
                            {copiedKey === "b-cbu" ? <Check className="size-3" /> : <Copy className="size-3" />}
                            {copiedKey === "b-cbu" ? "Copiado" : "Copiar"}
                          </button>
                        </div>
                      </div>
                    )}
                  </div>
                </div>
              )}
            </div>

            {/* Si el capitán quiere cambiar a efectivo */}
            {isCaptain && paymentConfig.methods.cash?.enabled && !isCash && (
              <div className="pt-2 text-center">
                <Button
                  type="button"
                  size="sm"
                  variant="outline"
                  disabled={isPending}
                  onClick={() => handleSelectMethod("cash")}
                  className="text-xs h-8 text-amber-700 dark:text-amber-300 border-amber-500/30 hover:bg-amber-500/10"
                >
                  {isPending ? <Spinner /> : <Banknote className="size-3.5 mr-1" />}
                  Prefiero pagar en efectivo el día del torneo en el club
                </Button>
              </div>
            )}
          </div>
        )}

        {/* Instrucciones adicionales */}
        {paymentConfig.instructions && (
          <div className="rounded-xl border border-border/70 bg-card p-3 text-xs space-y-1">
            <span className="font-semibold text-foreground block">
              Comprobante de pago:
            </span>
            <p className="text-muted-foreground whitespace-pre-line leading-relaxed">
              {paymentConfig.instructions}
            </p>
          </div>
        )}
      </CardContent>
    </Card>
  );
}

