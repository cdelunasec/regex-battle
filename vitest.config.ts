import path from "node:path";
import { defineConfig } from "vitest/config";

/**
 * Vitest runs from its own config on purpose.
 *
 * `vite.config.ts` carries the whole app pipeline (TanStack Start, nitro,
 * Tailwind). The tests here cover
 * pure logic (the regex engine, the challenge bank, the solo run reducer), so
 * they need nothing from the app's build pipeline beyond the @ alias.
 */
export default defineConfig({
  resolve: {
    alias: {
      "@": path.resolve(import.meta.dirname, "./src"),
    },
  },
  test: {
    environment: "node",
    include: ["src/**/*.test.ts", "src/**/*.test.tsx"],
  },
});
