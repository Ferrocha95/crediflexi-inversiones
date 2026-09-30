import { defineConfig } from "vitest/config";

export default defineConfig({
  test: {
    projects: [
      {
        test: {
          name: "unit",
          environment: "node",
          include: ["tests/unit/**/*.test.ts", "src/**/*.test.ts"],
        },
      },
      {
        test: {
          name: "rls",
          environment: "node",
          include: ["tests/rls/**/*.rls.test.ts"],
          globalSetup: ["tests/rls/setup-global.ts"],
          // Las pruebas de RLS comparten la base local: una a la vez.
          fileParallelism: false,
          testTimeout: 30_000,
          hookTimeout: 30_000,
        },
      },
    ],
  },
});
