import { defineConfig } from "vitest/config";

// Deux projets : tout tourne sur SQLite ; les tests de l'API tournent aussi sur libSQL (le moteur de Turso, ici un fichier local),
// avec les mêmes tests (`CDJ_TEST_DB`, voir apps/api/test/helpers.ts). `npx vitest run --project sqlite|libsql` pour n'en lancer qu'un.
// Délai d'un test : 30 s au lieu des 5 s de Vitest. La CI fait tourner les tests unitaires sur 2 cœurs, plusieurs fichiers à la fois : un test qui génère et rejoue
// des niveaux ou des circuits y prend deux à trois fois sa durée locale (mesuré : `planning.test.ts` 2,5 s en local, `surfaces.test.ts` de Jump 1,9 s, tous deux
// au-delà de 5 s en CI — runs 41402149309 et 41405852969 —, comme les neuf tests réglés un par un avant). Ce n'est pas une mesure de vitesse (les tests de durée
// gardent leurs propres seuils, par exemple le pire jour de génération) : un test bloqué échoue toujours, à 30 s.
const DELAI_TEST_MS = 30_000;

// Lot T1 (économie de jetons) : en local, un résumé et les échecs (rapporteur « agent » de Vitest : ni une ligne par fichier, ni les tests réussis) ;
// l'échec garde son message complet. Le détail se demande : `CDJ_BAVARD=1 npm test` (ou `npx vitest run --reporter=default|verbose`, qui l'emporte).
// En CI (`CI` vaut `true` sur GitHub Actions) rien ne change : les rapporteurs par défaut, dont celui des annotations.
const REPORTERS = process.env.CI || process.env.CDJ_BAVARD ? undefined : ["agent"];

export default defineConfig({
  test: {
    testTimeout: DELAI_TEST_MS,
    ...(REPORTERS ? { reporters: REPORTERS } : {}),
    projects: [
      { test: { name: "sqlite", testTimeout: DELAI_TEST_MS, include: ["packages/*/test/**/*.test.ts", "apps/*/test/**/*.test.ts"] } },
      // Lot R13 (docs/tests.md) : les jeux de données fictives de la recette (joueur démo du portail, joueurs fictifs de Jump et du classement) ne tournent que
      // sur SQLite : ils passent par les mêmes routes et les mêmes requêtes que les tests du serveur, qui, eux, tournent aussi sur libSQL (doublon, 105 s par run).
      {
        test: {
          name: "libsql",
          testTimeout: DELAI_TEST_MS,
          include: ["apps/api/test/**/*.test.ts"],
          exclude: ["apps/api/test/portailDemo.test.ts", "apps/api/test/jumpHistory.test.ts", "apps/api/test/classementDemo.test.ts"],
          env: { CDJ_TEST_DB: "libsql" },
        },
      },
    ],
  },
});
