"use client";

import { AlertCircle, Banknote, Building2, CheckCircle2, Clock, Copy, ExternalLink, ShieldCheck, Wallet } from "lucide-react";
import { useState, useTransition } from "react";
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
  pricingTypeLabel,
} from "@/lib/domain/payment";

export function TeamPaymentCard({
  teamId,
  isCaptain,
  paymentStatus,
  paymentMethod,
  paidAt,
  paymentNotes,
  paymentConfig,
}: {
  teamId: string;
  isCaptain: boolean;
  paymentStatus: PaymentStatus;
  paymentMethod?: PaymentMethodType | null;
  paidAt?: string | null;
  paymentNotes?: string | null;
  paymentConfig?: PaymentConfig | null;
}) {
  const [copiedKey, setCopiedKey] = useState<string | null>(null);
  const [isChangingMethod, setIsChangingMethod] = useState(false);
  const [isPending, startTransition] = useTransition();

  if (!paymentConfig || !paymentConfig.enabled) {
    return null;
  }

  const handleCopy = (text: string, label: string, key: string) => {
    if (navigator.clipboard?.writeText) {
      void navigator.clipboard.writeText(text);
      setCopiedKey(key);
      toast.success(`${label} copiado`);
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

  const isPaid = paymentStatus === "paid";
  const isCash = paymentStatus === "cash_on_arrival" || paymentMethod === "cash";
  const isPendingPay = paymentStatus === "pending";

  const mp = paymentConfig.methods.mercadopago;
  const transfer = paymentConfig.methods.transfer;

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

        {/* 3. Si está pendiente (o si quiere ver datos para transferir) */}
        {(isPendingPay || isChangingMethod) && (
          <div className="space-y-3 pt-1">
            <p className="text-xs text-muted-foreground">
              Podés realizar la transferencia a las siguientes cuentas del organizador:
            </p>

            <div className="grid grid-cols-1 sm:grid-cols-2 gap-3 text-xs">
              {/* Mercado Pago */}
              {mp?.enabled && (
                <div className="rounded-xl border border-sky-500/30 bg-sky-500/[0.04] p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded bg-sky-500/20 text-sky-600 dark:text-sky-400">
                      <Wallet className="size-3.5" />
                    </span>
                    <strong className="text-foreground">Mercado Pago</strong>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {mp.alias && (
                      <div className="flex items-center justify-between gap-1 rounded bg-muted/60 px-2 py-1">
                        <span className="text-[11px] text-muted-foreground">Alias:</span>
                        <div className="flex items-center gap-1.5">
                          <strong className="font-mono text-foreground">{mp.alias}</strong>
                          <button
                            type="button"
                            onClick={() => handleCopy(mp.alias!, "Alias MP", "mp-alias")}
                            className="p-1 hover:text-primary cursor-pointer"
                          >
                            <Copy className="size-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {mp.cvu && (
                      <div className="flex items-center justify-between gap-1 rounded bg-muted/60 px-2 py-1">
                        <span className="text-[11px] text-muted-foreground">CVU:</span>
                        <div className="flex items-center gap-1.5">
                          <strong className="font-mono text-[10px] text-foreground">{mp.cvu}</strong>
                          <button
                            type="button"
                            onClick={() => handleCopy(mp.cvu!, "CVU MP", "mp-cvu")}
                            className="p-1 hover:text-primary cursor-pointer"
                          >
                            <Copy className="size-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {mp.paymentLink && (
                      <div className="pt-1.5">
                        <Button
                          size="sm"
                          variant="outline"
                          asChild
                          className="w-full h-7 text-xs border-sky-500/40 text-sky-700 dark:text-sky-300"
                        >
                          <a href={mp.paymentLink} target="_blank" rel="noopener noreferrer">
                            <ExternalLink className="size-3 mr-1" />
                            Pagar por link de Mercado Pago
                          </a>
                        </Button>
                      </div>
                    )}
                  </div>
                </div>
              )}

              {/* Transferencia Bancaria */}
              {transfer?.enabled && (
                <div className="rounded-xl border border-indigo-500/30 bg-indigo-500/[0.04] p-3.5 space-y-2.5">
                  <div className="flex items-center gap-2">
                    <span className="flex size-6 items-center justify-center rounded bg-indigo-500/20 text-indigo-600 dark:text-indigo-400">
                      <Building2 className="size-3.5" />
                    </span>
                    <strong className="text-foreground">Transferencia bancaria</strong>
                  </div>

                  <div className="space-y-1.5 pt-1">
                    {transfer.bank && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Banco:</span>
                        <strong className="text-foreground">{transfer.bank}</strong>
                      </div>
                    )}

                    {transfer.accountHolder && (
                      <div className="flex items-center justify-between text-[11px]">
                        <span className="text-muted-foreground">Titular:</span>
                        <strong className="text-foreground">{transfer.accountHolder}</strong>
                      </div>
                    )}

                    {transfer.alias && (
                      <div className="flex items-center justify-between gap-1 rounded bg-muted/60 px-2 py-1">
                        <span className="text-[11px] text-muted-foreground">Alias:</span>
                        <div className="flex items-center gap-1.5">
                          <strong className="font-mono text-foreground">{transfer.alias}</strong>
                          <button
                            type="button"
                            onClick={() => handleCopy(transfer.alias!, "Alias bancario", "b-alias")}
                            className="p-1 hover:text-primary cursor-pointer"
                          >
                            <Copy className="size-3" />
                          </button>
                        </div>
                      </div>
                    )}

                    {transfer.cbuOrCvu && (
                      <div className="flex items-center justify-between gap-1 rounded bg-muted/60 px-2 py-1">
                        <span className="text-[11px] text-muted-foreground">CBU:</span>
                        <div className="flex items-center gap-1.5">
                          <strong className="font-mono text-[10px] text-foreground">{transfer.cbuOrCvu}</strong>
                          <button
                            type="button"
                            onClick={() => handleCopy(transfer.cbuOrCvu!, "CBU", "b-cbu")}
                            className="p-1 hover:text-primary cursor-pointer"
                          >
                            <Copy className="size-3" />
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
