"use server";

import { revalidatePath } from "next/cache";
import { z } from "zod";
import { isSuperAdmin } from "@/lib/auth";
import { actionError, actionOk, createAction } from "@/lib/actions/safe-action";
import { createClient } from "@/lib/supabase/server";

const manageSuperAdminSchema = z.object({
  email: z.string().trim().email({ message: "Ingresá un correo electrónico válido." }),
  action: z.enum(["add", "remove"]),
});

export const manageSuperAdminAction = createAction(
  manageSuperAdminSchema,
  async ({ email, action }) => {
    const authorized = await isSuperAdmin();
    if (!authorized) {
      return actionError("No tenés permisos de superadministrador.");
    }

    const supabase = await createClient();
    const isAdding = action === "add";

    // eslint-disable-next-line @typescript-eslint/no-explicit-any
    const { data, error } = await (supabase as any).rpc("set_user_superadmin", {
      p_email: email,
      p_is_superadmin: isAdding,
    });

    if (error) {
      return actionError(error.message || "Error al actualizar permisos de superadministrador.");
    }

    if (data && typeof data === "object" && !data.success) {
      return actionError(data.error || "No se pudo actualizar el rol.");
    }

    revalidatePath("/admin");
    return actionOk({
      message: isAdding
        ? `Se asignó el rol de Superadministrador a ${email}.`
        : `Se removió el rol de Superadministrador de ${email}.`,
      action,
      user: {
        id: (data as any)?.userId || email,
        fullName: (data as any)?.fullName || email,
        email: email,
        createdAt: new Date().toISOString(),
      },
    });
  },
);

