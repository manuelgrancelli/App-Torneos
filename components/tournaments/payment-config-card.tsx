"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { Check, DollarSign } from "lucide-react";
import { useRouter } from "next/navigation";
import { useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { updateTournamentPaymentConfig } from "@/app/(app)/torneos/[id]/actions";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import type { PaymentConfig } from "@/lib/domain/payment";
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

  const form = useForm<UpdateTournamentPaymentConfigInput>({
    resolver: zodResolver(updateTournamentPaymentConfigSchema),
    defaultValues: {
      tournamentId,
      paymentConfig: initialConfig,
    },
  });

  const onSubmit = form.handleSubmit((values) => {
    startTransition(async () => {
      const result = await updateTournamentPaymentConfig(values);
      if (!result.ok) {
        toast.error(result.error);
        return;
      }
      toast.success(result.message ?? "Configuración de pagos guardada.");
      router.refresh();
    });
  });

  return (
    <Card>
      <CardHeader>
        <CardTitle>
          <h2 className="text-base font-semibold">Formas de pago y arancel</h2>
        </CardTitle>
      </CardHeader>
      <CardContent>
        <form onSubmit={onSubmit} className="space-y-4">
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
    </Card>
  );
}
