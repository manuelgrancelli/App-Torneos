import { describe, expect, it } from "vitest";
import {
  DEFAULT_PAYMENT_CONFIG,
  formatCurrency,
  getEnabledPaymentMethods,
  normalizePaymentConfig,
  paymentConfigSchema,
  pricingTypeLabel,
} from "./payment";

describe("lib/domain/payment", () => {
  it("normaliza configuraciones vacías o nulas hacia los defaults seguros", () => {
    expect(normalizePaymentConfig(null)).toEqual(DEFAULT_PAYMENT_CONFIG);
    expect(normalizePaymentConfig(undefined)).toEqual(DEFAULT_PAYMENT_CONFIG);
    expect(normalizePaymentConfig("invalido")).toEqual(DEFAULT_PAYMENT_CONFIG);
    expect(normalizePaymentConfig({})).toEqual(DEFAULT_PAYMENT_CONFIG);
  });

  it("permite parsear una configuración con arancel y métodos habilitados", () => {
    const raw = {
      enabled: true,
      currency: "ARS",
      amount: 20000,
      pricingType: "per_team",
      methods: {
        mercadopago: {
          enabled: true,
          alias: "torneos.mp",
          cvu: "0000003100012345678901",
          paymentLink: "https://mpago.la/2abcde",
        },
        transfer: {
          enabled: true,
          bank: "Banco Galicia",
          accountHolder: "Organizador Torneos",
          cbuOrCvu: "0070123420000012345678",
          alias: "TORNEOS.GALICIA",
        },
        cash: {
          enabled: true,
          instructions: "Abonar en el buffet del club",
        },
      },
      instructions: "Enviar comprobante por WhatsApp al 11-1234-5678 indicando nombre de la pareja.",
    };

    const parsed = paymentConfigSchema.parse(raw);
    expect(parsed.enabled).toBe(true);
    expect(parsed.amount).toBe(20000);
    expect(parsed.methods.mercadopago.alias).toBe("torneos.mp");
    expect(parsed.methods.transfer.bank).toBe("Banco Galicia");
    expect(parsed.methods.cash.enabled).toBe(true);
  });

  it("identifica los métodos habilitados correctamente", () => {
    expect(getEnabledPaymentMethods(null)).toEqual([]);
    expect(getEnabledPaymentMethods(DEFAULT_PAYMENT_CONFIG)).toEqual([]);

    const enabledConfig = {
      ...DEFAULT_PAYMENT_CONFIG,
      enabled: true,
      methods: {
        mercadopago: { enabled: true, alias: "mp.alias", cvu: null, paymentLink: null },
        transfer: { enabled: false, bank: null, accountHolder: null, cbuOrCvu: null, alias: null },
        cash: { enabled: true, instructions: null },
      },
    };

    expect(getEnabledPaymentMethods(enabledConfig)).toEqual(["mercadopago", "cash"]);
  });

  it("formatea moneda adecuadamente en pesos argentinos", () => {
    expect(formatCurrency(null)).toBe("Sin arancel / Gratis");
    expect(formatCurrency(0)).toBe("Sin arancel / Gratis");
    expect(formatCurrency(-500)).toBe("Sin arancel / Gratis");
    expect(formatCurrency(15000)).toMatch(/15\.000/);
  });

  it("devuelve etiquetas claras según modalidad", () => {
    expect(pricingTypeLabel("per_player")).toBe("por jugador");
    expect(pricingTypeLabel("per_team", false)).toBe("por pareja / equipo");
    expect(pricingTypeLabel("per_team", true)).toBe("por participante");
  });
});
