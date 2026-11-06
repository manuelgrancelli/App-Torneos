"use client";

import { zodResolver } from "@hookform/resolvers/zod";
import { BookmarkCheck, Check, ChevronDown, Trash2, Wallet } from "lucide-react";
import { useRouter } from "next/navigation";
import { useState, useTransition } from "react";
import { useForm } from "react-hook-form";
import { toast } from "sonner";
import { z } from "zod";
import { clearOrganizerPaymentDefaults, saveOrganizerPaymentDefaults } from "@/app/(app)/perfil/actions";
import { PaymentConfigFields } from "@/components/tournaments/payment-config-fields";
import { Badge } from "@/components/ui/badge";
import { Button } from "@/components/ui/button";
import { Card, CardContent, CardDescription, CardHeader, CardTitle } from "@/components/ui/card";
import { Spinner } from "@/components/ui/spinner";
import { DEFAULT_PAYMENT_CONFIG, strictPaymentConfigSchema, type PaymentConfig } from "@/lib/domain/payment";

const profilePaymentSchema = z.object({
  paymentConfig: strictPaymentConfigSchema,
});

export function OrganizerPaymentDefaultsCard({
  initialConfig,
  initialHasSavedDefaults,
}: {
  initialConfig: PaymentConfig;
  initialHasSavedDefaults: boolean;
}) {
  const router = useRouter();
  const [isPending, startTransition] = useTransition();
  const [hasSaved, setHasSaved] = useState(initialHasSavedDefaults);
  const [isOpen, setIsOpen] = useState(false);

  const form = useForm<
    z.input<typeof profilePaymentSchema>,
    unknown,
    z.output<typeof profilePaymentSchema>
  >({
    resolver: zodResolver(profilePaymentSchema),
    defaultValues: {
      paymentConfig: initialConfig,
    },
  });

  const onSubmit = form.handleSubmit(
    (values) => {
      startTransition(async () => {
        const res = await saveOrganizerPaymentDefaults(values.paymentConfig);
        if (!res.ok) {
          toast.error(res.error);
          return;
        }
        setHasSaved(true);
        toast.success(res.message);
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

  const handleClear = () => {
    startTransition(async () => {
      const res = await clearOrganizerPaymentDefaults();
      if (!res.ok) {
        toast.error(res.error);
        return;
      }
      setHasSaved(false);
      form.reset({ paymentConfig: DEFAULT_PAYMENT_CONFIG });
      toast.info(res.message);
      router.refresh();
    });
  };

  return (
    <Card className="rounded-2xl border-border/80 shadow-xs overflow-hidden">
      <CardHeader
        onClick={() => setIsOpen((prev) => !prev)}
        className="cursor-pointer select-none hover:bg-muted/40 transition-colors py-4"
      >
        <div className="flex items-center justify-between gap-3">
          <div className="space-y-1 min-w-0 flex-1">
            <div className="flex flex-wrap items-center gap-2">
              <CardTitle className="flex items-center gap-2 text-base font-semibold">
                <Wallet className="size-4 text-emerald-600 dark:text-emerald-400" aria-hidden="true" />
                Formas de pago y cobro predeterminadas
              </CardTitle>
              {hasSaved ? (
                <Badge className="bg-emerald-500/15 text-emerald-700 dark:text-emerald-300 border-emerald-500/30 gap-1">
                  <BookmarkCheck className="size-3.5" />
                  Guardadas en tu perfil
                </Badge>
              ) : (
                <Badge variant="outline" className="text-muted-foreground">
                  Opcional · Sin configurar
                </Badge>
              )}
            </div>
            <CardDescription className="text-xs leading-relaxed">
              Tocá para desplegar y dejar guardados tus datos de Mercado Pago, Transferencia y Efectivo para tus próximos torneos.
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
            <PaymentConfigFields
              form={form}
              disabled={isPending}
              hideProfileDefaultControls
            />

            <div className="flex flex-wrap items-center justify-end gap-2 pt-1">
              {hasSaved && (
                <Button
                  type="button"
                  variant="outline"
                  size="sm"
                  disabled={isPending}
                  onClick={handleClear}
                  className="h-9 text-xs text-muted-foreground hover:text-destructive hover:border-destructive/40 cursor-pointer"
                >
                  <Trash2 className="size-3.5 mr-1.5" />
                  Borrar datos guardados
                </Button>
              )}

              <Button
                type="submit"
                size="sm"
                disabled={isPending}
                className="h-9 text-xs font-semibold bg-emerald-600 hover:bg-emerald-500 text-white cursor-pointer"
              >
                {isPending ? <Spinner className="mr-1.5" /> : <Check className="size-4 mr-1.5" />}
                Guardar como predeterminado en mi perfil
              </Button>
            </div>
          </form>
        </CardContent>
      )}
    </Card>
  );
}

