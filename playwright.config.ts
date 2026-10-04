import { defineConfig } from "@playwright/test";

// E2E_BASE_URL permite correrlos contra un build de producción ya levantado
// (`pnpm build && pnpm start`); sin la variable, se usa `pnpm dev`.
const externalServer = process.env.E2E_BASE_URL;

/**
 * Tests E2E contra `pnpm dev` y el Supabase local con el seed
 * (`supabase start` + `supabase db reset`). Usa el Chrome instalado en el
 * sistema: no hace falta bajar navegadores (D-033).
 */
export default defineConfig({
  testDir: "./tests/e2e",
  // Comparten base local y Mailpit: un worker evita interferencias.
  workers: 1,
  fullyParallel: false,
  timeout: 90_000,
  expect: { timeout: 15_000 },
  reporter: [["list"]],
  outputDir: "test-results",
  use: {
    baseURL: externalServer ?? "http://localhost:3000",
    channel: "chrome",
    locale: "es-AR",
    timezoneId: "America/Argentina/Buenos_Aires",
    // Mobile-first: 360px por defecto; los tests de escritorio cambian el viewport.
    viewport: { width: 360, height: 780 },
    trace: "retain-on-failure",
    screenshot: "only-on-failure",
  },
  webServer: externalServer
    ? undefined
    : {
        command: "pnpm dev",
        url: "http://localhost:3000",
        reuseExistingServer: true,
        timeout: 120_000,
      },
});
