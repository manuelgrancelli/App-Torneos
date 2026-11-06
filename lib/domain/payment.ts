import { z } from "zod";

/**
 * Métodos de pago disponibles para torneos.
 * - mercadopago: Cobro mediante Alias/CVU o link de pago de Mercado Pago.
 * - transfer: Transferencia bancaria directa (CBU/CVU/Alias/Banco/Titular).
 * - cash: Pago presencial en efectivo en el club el día del torneo.
 */
export const paymentMethodTypeSchema = z.enum(["mercadopago", "transfer", "cash"]);
export type PaymentMethodType = z.infer<typeof paymentMethodTypeSchema>;

/**
 * Estados de pago de un equipo o participante:
 * - pending: Pendiente de pago (el torneo tiene arancel y aún no acreditó el pago).
 * - paid: Pago confirmado y acreditado por el organizador.
 * - cash_on_arrival: Acordó pagar en efectivo en la recepción o mesa de control.
 * - not_required: Torneo gratuito o bonificado (sin arancel).
 */
export const paymentStatusSchema = z.enum(["pending", "paid", "cash_on_arrival", "not_required"]);
export type PaymentStatus = z.infer<typeof paymentStatusSchema>;

/**
 * Modalidad del arancel:
 * - per_team: El monto publicado es por equipo o pareja completa.
 * - per_player: El monto publicado es por cada jugador individual.
 */
export const pricingTypeSchema = z.enum(["per_team", "per_player"]);
export type PricingType = z.infer<typeof pricingTypeSchema>;

/**
 * Configuración de Mercado Pago
 */
export const mercadoPagoConfigSchema = z.object({
  enabled: z.boolean().default(false),
  alias: z.string().trim().max(100).nullable().optional().default(null),
  cvu: z.string().trim().max(100).nullable().optional().default(null),
  paymentLink: z.string().trim().url("Ingresá un link válido.").max(500).nullable().optional().or(z.literal("")).default(null),
  accessToken: z.string().trim().max(300).nullable().optional().default(null),
});
export type MercadoPagoConfig = z.infer<typeof mercadoPagoConfigSchema>;

/**
 * Configuración de Transferencia bancaria tradicional
 */
export const transferConfigSchema = z.object({
  enabled: z.boolean().default(false),
  bank: z.string().trim().max(100).nullable().optional().default(null),
  accountHolder: z.string().trim().max(120).nullable().optional().default(null),
  cbuOrCvu: z.string().trim().max(50).nullable().optional().default(null),
  alias: z.string().trim().max(100).nullable().optional().default(null),
});
export type TransferConfig = z.infer<typeof transferConfigSchema>;

/**
 * Configuración de Pago en efectivo en el momento del torneo
 */
export const cashConfigSchema = z.object({
  enabled: z.boolean().default(false),
  instructions: z.string().trim().max(300).nullable().optional().default("Abonar en mesa de control antes del primer partido."),
});
export type CashConfig = z.infer<typeof cashConfigSchema>;

/**
 * Configuración general de pagos de un torneo.
 */
export const paymentConfigSchema = z.object({
  enabled: z.boolean().default(false),
  currency: z.literal("ARS").default("ARS"),
  amount: z
    .number()
    .int("El arancel debe ser un número entero.")
    .min(1, "El arancel debe ser mayor a 0.")
    .max(10_000_000, "El arancel no puede superar $10.000.000.")
    .nullable()
    .optional()
    .default(null),
  pricingType: pricingTypeSchema.default("per_team"),
  methods: z
    .object({
      mercadopago: mercadoPagoConfigSchema.default({ enabled: false, alias: null, cvu: null, paymentLink: null, accessToken: null }),
      transfer: transferConfigSchema.default({ enabled: false, bank: null, accountHolder: null, cbuOrCvu: null, alias: null }),
      cash: cashConfigSchema.default({ enabled: false, instructions: "Abonar en mesa de control antes del primer partido." }),
    })
    .default({
      mercadopago: { enabled: false, alias: null, cvu: null, paymentLink: null, accessToken: null },
      transfer: { enabled: false, bank: null, accountHolder: null, cbuOrCvu: null, alias: null },
      cash: { enabled: false, instructions: "Abonar en mesa de control antes del primer partido." },
    }),
  instructions: z.string().trim().max(1000).nullable().optional().default(null),
});
export type PaymentConfig = z.infer<typeof paymentConfigSchema>;

/**
 * Validación estricta al guardar configuración de pagos:
 * Exige que cada método habilitado tenga sus datos mínimos obligatorios.
 */
export function validatePaymentConfigFields(
  config: PaymentConfig,
  ctx: z.RefinementCtx,
  basePath: (string | number)[] = [],
) {
  if (!config.enabled) return;

  if (!config.amount || config.amount <= 0) {
    ctx.addIssue({
      code: "custom",
      path: [...basePath, "amount"],
      message: "Ingresá el costo del arancel mayor a $0.",
    });
  }

  const mp = config.methods.mercadopago;
  const tr = config.methods.transfer;
  const cash = config.methods.cash;

  if (!mp.enabled && !tr.enabled && !cash.enabled) {
    ctx.addIssue({
      code: "custom",
      path: [...basePath, "methods"],
      message: "Activá al menos una forma de pago (Mercado Pago, Transferencia o Efectivo).",
    });
  }

  if (mp.enabled) {
    const hasMpData = Boolean(
      mp.accessToken?.trim() ||
        mp.paymentLink?.trim() ||
        mp.alias?.trim() ||
        mp.cvu?.trim(),
    );
    if (!hasMpData) {
      ctx.addIssue({
        code: "custom",
        path: [...basePath, "methods", "mercadopago", "alias"],
        message: "Para habilitar Mercado Pago completá al menos tu Access Token, Link de pago, Alias o CVU.",
      });
    }
  }

  if (tr.enabled) {
    const hasTransferData = Boolean(
      tr.alias?.trim() || tr.cbuOrCvu?.trim(),
    );
    if (!hasTransferData) {
      ctx.addIssue({
        code: "custom",
        path: [...basePath, "methods", "transfer", "alias"],
        message: "Para habilitar Transferencia bancaria ingresá al menos el Alias o el CBU/CVU.",
      });
    }
  }
}

export const strictPaymentConfigSchema = paymentConfigSchema.superRefine((val, ctx) => {
  validatePaymentConfigFields(val, ctx, []);
});

export const DEFAULT_PAYMENT_CONFIG: PaymentConfig = {
  enabled: false,
  currency: "ARS",
  amount: null,
  pricingType: "per_team",
  methods: {
    mercadopago: { enabled: false, alias: null, cvu: null, paymentLink: null, accessToken: null },
    transfer: { enabled: false, bank: null, accountHolder: null, cbuOrCvu: null, alias: null },
    cash: { enabled: false, instructions: "Abonar en mesa de control antes del primer partido." },
  },
  instructions: null,
};

/**
 * Normaliza y sanea cualquier valor recibido como payment_config desde la base de datos o JSON.
 */
export function normalizePaymentConfig(raw: unknown): PaymentConfig {
  if (!raw || typeof raw !== "object") {
    return DEFAULT_PAYMENT_CONFIG;
  }
  const result = paymentConfigSchema.safeParse(raw);
  if (!result.success) {
    return DEFAULT_PAYMENT_CONFIG;
  }
  return result.data;
}

/**
 * Extrae la configuración de pagos de una fila de `tournaments`, soportando tanto la columna
 * nativa `payment_config` como el respaldo en `standings_config.payment` o `scoring_config.payment`
 * en caso de que la migración SQL aún no se haya ejecutado en la base de datos.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractTournamentPaymentConfig(row: Record<string, any> | null | undefined): PaymentConfig {
  if (!row || typeof row !== "object") {
    return DEFAULT_PAYMENT_CONFIG;
  }
  const direct = row.payment_config;
  const fromStandings = row.standings_config && typeof row.standings_config === "object" ? row.standings_config.payment : undefined;
  const fromScoring = row.scoring_config && typeof row.scoring_config === "object" ? row.scoring_config.payment : undefined;

  if (direct && typeof direct === "object" && direct.enabled === true) {
    return normalizePaymentConfig(direct);
  }
  if (fromStandings && typeof fromStandings === "object") {
    return normalizePaymentConfig(fromStandings);
  }
  if (fromScoring && typeof fromScoring === "object") {
    return normalizePaymentConfig(fromScoring);
  }
  return normalizePaymentConfig(direct);
}

export type FallbackPaymentRecord = {
  paymentStatus?: PaymentStatus;
  paymentMethod?: PaymentMethodType | null;
  paidAt?: string | null;
  paymentNotes?: string | null;
};

/**
 * Extrae el mapa de pagos de respaldo almacenado en `standings_config.paymentsMap`.
 */
// eslint-disable-next-line @typescript-eslint/no-explicit-any
export function extractFallbackPaymentsMap(tournamentRow: Record<string, any> | null | undefined): Record<string, FallbackPaymentRecord> {
  if (!tournamentRow || typeof tournamentRow !== "object") return {};
  const sc = tournamentRow.standings_config;
  if (sc && typeof sc === "object" && sc.paymentsMap && typeof sc.paymentsMap === "object") {
    return sc.paymentsMap as Record<string, FallbackPaymentRecord>;
  }
  return {};
}

/**
 * Resuelve el estado y método de pago de un equipo o participante combinando las columnas
 * nativas con el mapa de respaldo.
 */
export function resolveEntityPayment(
  // eslint-disable-next-line @typescript-eslint/no-explicit-any
  row: Record<string, any>,
  fallbackMap?: Record<string, FallbackPaymentRecord>,
  paymentEnabled = false,
): {
  paymentStatus: PaymentStatus;
  paymentMethod: PaymentMethodType | null;
  paidAt: string | null;
  paymentNotes: string | null;
} {
  const fb = fallbackMap?.[row.id as string];
  const rawStatus = (row.payment_status as PaymentStatus | undefined) ?? fb?.paymentStatus;
  const defaultStatus: PaymentStatus = paymentEnabled ? "pending" : "not_required";
  const paymentStatus: PaymentStatus =
    rawStatus && ["pending", "paid", "cash_on_arrival", "not_required"].includes(rawStatus)
      ? rawStatus
      : defaultStatus;

  const rawMethod = (row.payment_method as PaymentMethodType | null | undefined) ?? fb?.paymentMethod ?? null;
  const paymentMethod: PaymentMethodType | null =
    rawMethod && ["mercadopago", "transfer", "cash"].includes(rawMethod) ? rawMethod : null;

  return {
    paymentStatus,
    paymentMethod,
    paidAt: (row.paid_at as string | null | undefined) ?? fb?.paidAt ?? null,
    paymentNotes: (row.payment_notes as string | null | undefined) ?? fb?.paymentNotes ?? null,
  };
}

/**
 * Devuelve la lista de métodos de pago habilitados.
 */
export function getEnabledPaymentMethods(config?: PaymentConfig | null): PaymentMethodType[] {
  if (!config || !config.enabled) return [];
  const list: PaymentMethodType[] = [];
  if (config.methods.mercadopago?.enabled) list.push("mercadopago");
  if (config.methods.transfer?.enabled) list.push("transfer");
  if (config.methods.cash?.enabled) list.push("cash");
  return list;
}

/**
 * Devuelve las opciones de pago disponibles para el jugador:
 * Si el organizador activó Mercado Pago y cargó un Alias o CVU (aunque no haya activado
 * por separado el switch de Transferencia), habilita automáticamente tanto la opción de
 * "Pagar desde Mercado Pago (App / Checkout)" como la de "Transferir por Alias / CVU".
 */
export function getPlayablePaymentMethods(config?: PaymentConfig | null): PaymentMethodType[] {
  if (!config || !config.enabled) return [];
  const list: PaymentMethodType[] = [];
  const mp = config.methods.mercadopago;
  const tr = config.methods.transfer;

  if (mp?.enabled) {
    list.push("mercadopago");
  }
  if (tr?.enabled || (mp?.enabled && Boolean(mp.alias || mp.cvu))) {
    list.push("transfer");
  }
  if (config.methods.cash?.enabled) {
    list.push("cash");
  }
  return list;
}

/**
 * Unifica los datos de transferencia (CBU/CVU/Alias/Banco/Titular), tomando los de
 * `transfer` o reutilizando el Alias/CVU cargado en `mercadopago` si corresponde.
 */
export function getEffectiveTransferDetails(config?: PaymentConfig | null): {
  bank: string | null;
  accountHolder: string | null;
  cbuOrCvu: string | null;
  alias: string | null;
} {
  const tr = config?.methods.transfer;
  const mp = config?.methods.mercadopago;
  return {
    bank: tr?.bank || (mp?.enabled && (mp.alias || mp.cvu) ? "Mercado Pago / CVU" : null),
    accountHolder: tr?.accountHolder || null,
    cbuOrCvu: tr?.cbuOrCvu || mp?.cvu || null,
    alias: tr?.alias || mp?.alias || null,
  };
}

/**
 * Formato de moneda para Argentina (ARS).
 * Ejemplo: 15000 -> "$15.000"
 */
export function formatCurrency(amount: number | null | undefined, currency = "ARS"): string {
  if (typeof amount !== "number" || isNaN(amount) || amount <= 0) {
    return "Sin arancel / Gratis";
  }
  try {
    return new Intl.NumberFormat("es-AR", {
      style: "currency",
      currency,
      maximumFractionDigits: 0,
    }).format(amount);
  } catch {
    return `$${amount.toLocaleString("es-AR")}`;
  }
}

/**
 * Etiquetas legibles de los métodos de pago.
 */
export const PAYMENT_METHOD_LABELS: Record<PaymentMethodType, string> = {
  mercadopago: "Mercado Pago",
  transfer: "Transferencia bancaria",
  cash: "Efectivo en el torneo",
};

/**
 * Etiquetas legibles de los estados de pago.
 */
export const PAYMENT_STATUS_LABELS: Record<PaymentStatus, string> = {
  pending: "Pendiente de pago",
  paid: "Pagado",
  cash_on_arrival: "Efectivo en el club",
  not_required: "Sin arancel",
};

/**
 * Etiqueta según la modalidad del costo.
 */
export function pricingTypeLabel(pricingType: PricingType, isIndividual = false): string {
  if (pricingType === "per_player") {
    return "por jugador";
  }
  return isIndividual ? "por participante" : "por pareja / equipo";
}
