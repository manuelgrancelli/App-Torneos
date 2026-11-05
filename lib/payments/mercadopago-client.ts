"use client";

import { toast } from "sonner";

export type LaunchMercadoPagoOptions = {
  tournamentId: string;
  teamId?: string | null;
  participantId?: string | null;
  teamName?: string | null;
  returnPath?: string | null;
  openInNewTab?: boolean;
};

/**
 * Inicia el flujo de pago con Mercado Pago:
 * 1. Invoca `/api/payments/mercadopago/preference`.
 * 2. Si el torneo tiene Checkout Pro API (`accessToken`) o Link de Pago (`paymentLink`),
 *    redirige o abre el Checkout oficial de Mercado Pago con el monto cargado.
 * 3. Si el torneo utiliza Alias/CVU de Mercado Pago, copia automáticamente el Alias/CVU
 *    al portapapeles y abre la aplicación o web de Mercado Pago para transferir en 1 toque.
 */
export async function launchMercadoPagoPayment(options: LaunchMercadoPagoOptions): Promise<boolean> {
  try {
    const res = await fetch("/api/payments/mercadopago/preference", {
      method: "POST",
      headers: { "Content-Type": "application/json" },
      body: JSON.stringify({
        tournamentId: options.tournamentId,
        teamId: options.teamId ?? null,
        participantId: options.participantId ?? null,
        teamName: options.teamName ?? null,
        returnPath: options.returnPath ?? window.location.pathname,
      }),
    });

    const data = (await res.json()) as {
      ok: boolean;
      error?: string;
      mode?: "checkout_pro" | "payment_link" | "mp_app_transfer";
      initPoint?: string;
      deepLink?: string;
      alias?: string | null;
      cvu?: string | null;
      amount?: number;
    };

    if (!res.ok || !data.ok || !data.initPoint) {
      toast.error(data.error ?? "No se pudo abrir Mercado Pago.");
      return false;
    }

    if (data.mode === "checkout_pro") {
      toast.success("Abriendo Checkout de Mercado Pago...");
      if (options.openInNewTab) {
        window.open(data.initPoint, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = data.initPoint;
      }
      return true;
    }

    if (data.mode === "payment_link") {
      toast.success("Abriendo link de cobro de Mercado Pago...");
      if (options.openInNewTab) {
        window.open(data.initPoint, "_blank", "noopener,noreferrer");
      } else {
        window.location.href = data.initPoint;
      }
      return true;
    }

    // Modo mp_app_transfer: copiar Alias/CVU y abrir Mercado Pago
    const targetToCopy = data.alias || data.cvu;
    if (targetToCopy && navigator.clipboard?.writeText) {
      await navigator.clipboard.writeText(targetToCopy).catch(() => {});
      toast.success(
        `¡Copiamos "${targetToCopy}"! Abriendo Mercado Pago para completar el pago...`,
        { duration: 5000 },
      );
    } else {
      toast.info("Abriendo Mercado Pago...");
    }

    const isMobile = /Android|iPhone|iPad|iPod/i.test(navigator.userAgent);
    if (isMobile && data.deepLink) {
      // Intentar abrir la app nativa de Mercado Pago y respaldar con web
      window.location.href = data.deepLink;
      setTimeout(() => {
        window.open(data.initPoint, "_blank", "noopener,noreferrer");
      }, 1200);
    } else {
      window.open(data.initPoint, "_blank", "noopener,noreferrer");
    }

    return true;
  } catch (err) {
    console.error("[launchMercadoPagoPayment] Error:", err);
    toast.error("No se pudo conectar con Mercado Pago. Intentá nuevamente.");
    return false;
  }
}

