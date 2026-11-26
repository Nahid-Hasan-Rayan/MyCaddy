// NHR: test runner config with coverage gate
import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    include: ["**/*.test.ts"],
    exclude: ["node_modules/**"],
    environment: "node",
    coverage: {
      provider: "v8",
      include: ["engine/src/**", "contracts/src/**", "server/relay/src/**", "tools/**/*.ts"],
      exclude: ["**/*.test.ts", "**/index.ts", "tools/pack/cli.ts", "tools/quality/mutate.ts", "tools/evidence/sensitivity.ts"],
      thresholds: { statements: 90, branches: 85, functions: 90, lines: 90 },
    },
  },
});
