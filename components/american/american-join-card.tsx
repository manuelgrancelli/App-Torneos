"use client";

import { CheckCircle2, Sparkles, Trophy, UserPlus, Users } from "lucide-react";
import { useState, useTransition } from "react";
import { useRouter } from "next/navigation";
import { toast } from "sonner";
import { joinAmericanParticipant } from "@/app/(app)/torneos/[id]/americano/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Input } from "@/components/ui/input";
import { Spinner } from "@/components/ui/spinner";
import { getEnabledPaymentMethods, type PaymentConfig, type PaymentMethodType } from "@/lib/domain/payment";
import { PaymentMethodSelector } from "@/components/payments/payment-method-selector";

export function AmericanJoinCard({
  code,
  tournamentName,
  isIndividual,
  defaultName,
  userEmail,
  paymentConfig,
}: {
  code: string;
  tournamentName: string;
  isIndividual: boolean;
  defaultName: string;
  userEmail: string;
  paymentConfig?: PaymentConfig | null;
}) {
  const router = useRouter();
  const [displayName, setDisplayName] = useState(defaultName || "");
  const [secondaryName, setSecondaryName] = useState("");
  const [selectedPaymentMethod, setSelectedPaymentMethod] = useState<PaymentMethodType | null>(() => {
    const enabled = getEnabledPaymentMethods(paymentConfig);
    return enabled[0] ?? null;
  });
  const [isPending, startTransition] = useTransition();
  const [isRegistered, setIsRegistered] = useState(false);

  const handleSubmit = (e: React.FormEvent) => {
    e.preventDefault();
    if (!displayName.trim()) {
      toast.error("Ingresá tu nombre para inscribirte.");
      return;
    }
    if (!isIndividual && !secondaryName.trim()) {
      toast.error("Ingresá el nombre de tu compañero de dupla.");
      return;
    }

    startTransition(async () => {
      const res = await joinAmericanParticipant({
        code,
        displayName: displayName.trim(),
        secondaryDisplayName: !isIndividual ? secondaryName.trim() : undefined,
        paymentMethod: selectedPaymentMethod,
      });

      if (!res.ok) {
        toast.error(res.error);
        return;
      }

      toast.success(res.message);
      setIsRegistered(true);
      router.refresh();
    });
  };

  if (isRegistered) {
    return (
      <Card size="sm" className="shadow-2xs border-emerald-500/30 bg-emerald-500/[0.04]">
        <CardContent className="pt-6 pb-6 text-center space-y-3">
          <div className="mx-auto flex size-12 items-center justify-center rounded-full bg-emerald-500/20 text-emerald-600 dark:text-emerald-400">
            <CheckCircle2 className="size-6" />
          </div>
          <div className="space-y-1">
            <h3 className="text-base font-bold text-foreground">¡Inscripción confirmada!</h3>
            <p className="text-xs text-muted-foreground max-w-sm mx-auto">
              Ya estás anotado en <strong>{tournamentName}</strong>. El organizador generará el fixture y podrás ver tus cruces y la tabla en vivo.
            </p>
          </div>
        </CardContent>
      </Card>
    );
  }

  return (
    <Card size="sm" className="shadow-2xs border-emerald-500/30">
      <CardHeader className="pb-2">
        <div className="flex items-center gap-2">
          <span className="flex size-7 items-center justify-center rounded-lg bg-emerald-500/15 text-emerald-600 dark:text-emerald-400">
            <Trophy className="size-4" />
          </span>
          <CardTitle>
            <h2 className="text-sm sm:text-base font-bold uppercase tracking-wider text-foreground">
              Inscripción al Torneo Americano
            </h2>
          </CardTitle>
          <span className="ml-auto inline-flex items-center gap-1 rounded-full bg-emerald-500/10 px-2 py-0.5 text-[11px] font-semibold text-emerald-700 dark:text-emerald-300 border border-emerald-500/20">
            <Sparkles className="size-3" />
            {isIndividual ? "Individual Rotativo" : "Parejas Fijas"}
          </span>
        </div>
        <p className="text-xs text-muted-foreground leading-snug pt-1">
          {isIndividual
            ? "En cada ronda rotarás de compañero y rivales sumando puntos individuales a la tabla general."
            : "Competirán en dupla en partidos todos contra todos sumando puntos para la tabla."}
        </p>
      </CardHeader>

      <CardContent className="pt-2">
        <form onSubmit={handleSubmit} className="space-y-4">
          <div className="space-y-3">
            <div className="space-y-1.5">
              <label className="text-xs font-semibold text-foreground">
                {isIndividual ? "Tu nombre y apellido:" : "Tu nombre (Jugador 1):"}
              </label>
              <Input
                value={displayName}
                onChange={(e) => setDisplayName(e.target.value)}
                disabled={isPending}
                placeholder="Ej. Lucas Gómez"
                className="text-xs h-9 bg-card"
                required
              />
            </div>

            {!isIndividual && (
              <div className="space-y-1.5">
                <label className="text-xs font-semibold text-foreground">
                  Nombre de tu compañero (Jugador 2):
                </label>
                <Input
                  value={secondaryName}
                  onChange={(e) => setSecondaryName(e.target.value)}
                  disabled={isPending}
                  placeholder="Ej. Martín Pérez"
                  className="text-xs h-9 bg-card"
                  required
                />
              </div>
            )}

            <div className="rounded-lg bg-muted/40 p-2.5 text-[11px] text-muted-foreground flex items-center justify-between">
              <span>Tu cuenta y correo asociado:</span>
              <strong className="text-foreground">{userEmail}</strong>
            </div>

            {paymentConfig?.enabled ? (
              <PaymentMethodSelector
                paymentConfig={paymentConfig}
                selectedMethod={selectedPaymentMethod}
                onChange={setSelectedPaymentMethod}
                disabled={isPending}
                isIndividual={isIndividual}
              />
            ) : null}
          </div>

          <Button
            type="submit"
            disabled={isPending || !displayName.trim()}
            className="w-full h-10 text-xs font-bold bg-emerald-600 hover:bg-emerald-500 text-white shadow-xs cursor-pointer"
          >
            {isPending ? <Spinner /> : <UserPlus className="size-4 mr-1.5" />}
            Confirmar mi inscripción
          </Button>
        </form>
      </CardContent>
    </Card>
  );
}

