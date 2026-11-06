"use server";

import { revalidatePath } from "next/cache";
import { type ActionResult, actionError, actionOk } from "@/lib/actions/safe-action";
import { getCurrentUser } from "@/lib/auth";
import { strictPaymentConfigSchema, type PaymentConfig } from "@/lib/domain/payment";
import { createClient } from "@/lib/supabase/server";

/**
 * Guarda los datos de cobro del organizador como predeterminados en su perfil
 * (`user_metadata.default_payment_config`) para que se pre-carguen cada vez que
 * cree un nuevo torneo.
 */
export async function saveOrganizerPaymentDefaults(
  input: unknown,
): Promise<ActionResult<{ paymentConfig: PaymentConfig }>> {
  const user = await getCurrentUser();
  if (!user) return actionError("Tenés que iniciar sesión.");

  const parsed = strictPaymentConfigSchema.safeParse(input);
  if (!parsed.success) {
    const firstMsg = parsed.error.issues[0]?.message ?? "Revisá los datos de cobro antes de guardarlos en tu perfil.";
    return actionError(firstMsg);
  }

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: {
      default_payment_config: parsed.data,
    },
  });

  if (error) {
    return actionError("No se pudieron guardar los datos en tu perfil. Intentá nuevamente.");
  }

  revalidatePath("/perfil");
  revalidatePath("/torneos/nuevo");

  return actionOk(
    { paymentConfig: parsed.data },
    "Tus datos de cobro quedaron guardados en tu perfil como predeterminados.",
  );
}

/**
 * Elimina los datos de cobro predeterminados guardados en el perfil del organizador.
 */
export async function clearOrganizerPaymentDefaults(): Promise<ActionResult<undefined>> {
  const user = await getCurrentUser();
  if (!user) return actionError("Tenés que iniciar sesión.");

  const supabase = await createClient();
  const { error } = await supabase.auth.updateUser({
    data: {
      default_payment_config: null,
    },
  });

  if (error) {
    return actionError("No se pudieron borrar los datos guardados. Intentá nuevamente.");
  }

  revalidatePath("/perfil");
  revalidatePath("/torneos/nuevo");

  return actionOk(undefined, "Se quitaron los datos de cobro predeterminados de tu perfil.");
}

