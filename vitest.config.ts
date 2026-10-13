import { defineConfig } from "vitest/config";

// Deux projets : tout tourne sur SQLite ; les tests de l'API tournent aussi sur libSQL (le moteur de Turso, ici un fichier local),
// avec les mêmes tests (`CDJ_TEST_DB`, voir apps/api/test/helpers.ts). `npx vitest run --project sqlite|libsql` pour n'en lancer qu'un.
export default defineConfig({
  test: {
    projects: [
      { test: { name: "sqlite", include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"] } },
      { test: { name: "libsql", include: ["apps/api/test/**/*.test.ts"], env: { CDJ_TEST_DB: "libsql" } } },
    ],
  },
});
