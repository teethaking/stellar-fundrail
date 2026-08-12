import { defineConfig } from "vitest/config";

// Vitest picks up `vitest.config.ts` over `vite.config.ts`, so the app's Vite
// config (plugins, manual chunks, HMR settings) stays untouched. Tests only
// exercise pure TypeScript modules (stream math, Stellar formatting helpers).
export default defineConfig({
  test: {
    environment: "node",
    include: ["src/**/*.test.ts"],
  },
});
