import { defineConfig } from "vitest/config";

// Deux projets : tout tourne sur SQLite ; les tests de l'API tournent aussi sur libSQL (le moteur de Turso, ici un fichier local),
// avec les mêmes tests (`CDJ_TEST_DB`, voir apps/api/test/helpers.ts). `npx vitest run --project sqlite|libsql` pour n'en lancer qu'un.
export default defineConfig({
  test: {
    projects: [
      { test: { name: "sqlite", include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"] } },
      // Lot R13 (docs/tests.md) : les jeux de données fictives de la recette (joueur démo du portail, joueurs fictifs de Jump et du classement) ne tournent que
      // sur SQLite : ils passent par les mêmes routes et les mêmes requêtes que les tests du serveur, qui, eux, tournent aussi sur libSQL (doublon, 105 s par run).
      {
        test: {
          name: "libsql",
          include: ["apps/api/test/**/*.test.ts"],
          exclude: ["apps/api/test/portailDemo.test.ts", "apps/api/test/jumpHistory.test.ts", "apps/api/test/classementDemo.test.ts"],
          env: { CDJ_TEST_DB: "libsql" },
        },
      },
    ],
  },
});
