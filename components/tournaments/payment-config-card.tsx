"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, ChevronDown, DollarSign } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateTournamentPaymentConfig } from "@/app/(app)/torneos/[id]/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { formatCurrency, type PaymentConfig } from "@/lib/domain/payment";
import {
  type UpdateTournamentPaymentConfigInput,
  updateTournamentPaymentConfigSchema,
} from "@/lib/validation/tournament";
import { PaymentConfigFields } from "./payment-config-fields";

export function TournamentPaymentConfigCard({
  tournamentId,
  initialConfig,
}: {
  tournamentId: string;
  initialConfig: PaymentConfig;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<UpdateTournamentPaymentConfigInput>({
    resolver: zodResolver(updateTournamentPaymentConfigSchema),
    defaultValues: {
      tournamentId,
      paymentConfig: initialConfig,
    },
  });

  const watchedEnabled = form.watch("paymentConfig.enabled");
  const watchedAmount = form.watch("paymentConfig.amount");

  const onSubmit = form.handleSubmit(
    (values) => {
      startTransition(async () => {
        const result = await updateTournamentPaymentConfig(values);
        if (!result.ok) {
          toast.error(result.error);
          return;
        }
        toast.success(result.message ?? "Configuración de pagos guardada.");
        router.refresh();
      });
    },
    (errors) => {
      const pcErr = errors.paymentConfig;
      const msg =
        pcErr?.amount?.message ||
        pcErr?.methods?.message ||
        pcErr?.methods?.transfer?.alias?.message ||
        pcErr?.methods?.mercadopago?.alias?.message ||
        "Completá los datos obligatorios de las formas de pago que activaste.";
      toast.error(String(msg));
    },
  );

  return (
    <Card className="overflow-hidden">
      <CardHeader
        onClick={() => setIsOpen((prev) => !prev)}
        className="cursor-pointer select-none hover:bg-muted/40 transition-colors py-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <CardTitle>
              <h2 className="text-base font-semibold flex items-center gap-2">
                <DollarSign className="size-4 text-emerald-600 dark:text-emerald-400" />
                Formas de pago y arancel
              </h2>
            </CardTitle>
            <CardDescription className="text-xs">
              {watchedEnabled
                ? `Con arancel (${watchedAmount ? formatCurrency(Number(watchedAmount)) : "Monto sin definir"}) · Tocá para ${isOpen ? "plegar" : "editar"}`
                : `Gratuito / Sin arancel · Tocá para ${isOpen ? "plegar" : "configurar"}`}
            </CardDescription>
          </div>
          <ChevronDown
            className={`size-5 shrink-0 text-muted-foreground transition-transform duration-200 ${
              isOpen ? "rotate-180" : ""
            }`}
            aria-hidden="true"
          />
        </div>
      </CardHeader>

      {isOpen && (
        <CardContent className="border-t border-border/60 pt-4 animate-in fade-in-50 duration-150">
          <form onSubmit={onSubmit} noValidate className="space-y-4">
            <PaymentConfigFields form={form} disabled={isPending} />

            <div className="flex justify-end pt-2">
              <Button
                type="submit"
                disabled={isPending}
                className="font-semibold text-xs h-9 cursor-pointer"
              >
                {isPending ? <Spinner /> : <Check className="size-4 mr-1.5" />}
                Guardar formas de pago
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}

