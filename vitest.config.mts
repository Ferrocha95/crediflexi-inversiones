import { fileURLToPath } from "node:url";
import { defineConfig } from "vitest/config";

export default defineConfig({
  resolve: {
    alias: {
      // Fuera de Next (sin la condición "react-server"), server-only lanza al
      // importarse. En las pruebas se sustituye por su módulo vacío.
      "server-only": fileURLToPath(new URL("./node_modules/server-only/empty.js", import.meta.url)),
    },
  },
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
