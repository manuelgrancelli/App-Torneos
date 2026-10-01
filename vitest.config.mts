import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    // Mismo alias que tsconfig ("@/*" → raíz del proyecto).
    alias: { "@": fileURLToPath(new URL("./", import.meta.url)) },
  },
  test: {
    // La lógica de dominio es TypeScript puro: no hace falta DOM.
    environment: "node",
    include: ["lib/**/*.test.ts"],
    coverage: {
      include: ["lib/domain/**/*.ts"],
      exclude: ["lib/domain/**/*.test.ts"],
      // La lógica de negocio tiene que estar cubierta (plan F3: >= 90 %).
      thresholds: { lines: 90, statements: 90, functions: 90, branches: 90 },
    },
  },
});
