import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    environment: "node",
    include: ["tests/**/*_test.ts"],
    globals: true,
    coverage: {
      provider: "v8",
      // Production code only. `prototypes/` is throwaway reference material
      // (directory-structure.md: "Throwaway prototypes (isolated from src/)")
      // and has no tests by design — including it dilutes the number that
      // actually matters and hides regressions in src/.
      include: ["src/**/*.ts"],
      exclude: ["src/**/index.ts"], // barrels re-export only; nothing to cover
      // technical-preferences.md: "Minimum Coverage: 80% for simulation core"
      thresholds: {
        statements: 80,
        branches: 80,
        functions: 80,
        lines: 80,
      },
    },
  },
});
