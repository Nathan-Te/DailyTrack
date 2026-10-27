import { defineConfig, devices, type Project } from "@playwright/test";
import { FIXED_NOW } from "./e2e/clock";

// Tests de navigateur de DailyJump : ils portent sur le jeu construit (`npm run build -w @cdj/jump`) servi par `vite preview`.
//   npm run e2e -w @cdj/jump                       → Chromium
//   E2E_ALL_BROWSERS=1 npm run e2e -w @cdj/jump    → + Firefox et WebKit (la CI le fait)
// CHROMIUM_PATH : chemin d'un Chromium déjà installé. Port 4174 : celui de DailyTrack (4173) peut tourner en même temps.
// Lot 3c : mêmes règles de CI que DailyTrack (matrice, rapport « blob » fusionné, une relance, instables nommés). Le NOM de projet
// porte le jeu en CI (`jump-chromium`…) : dans le rapport fusionné des deux jeux, `chromium` ne dirait pas de quel jeu vient un test.
// Hors CI les noms restent `chromium` / `firefox` / `webkit` (`--project=chromium`, comme avant).
const CI = !!process.env.CI;
const name = (browser: string) => (CI ? `jump-${browser}` : browser);
const projects: Project[] = [
  {
    name: name("chromium"),
    use: {
      ...devices["Desktop Chrome"],
      launchOptions: {
        executablePath: process.env.CHROMIUM_PATH || undefined,
        // Rendu logiciel : pas de GPU dans la CI.
        args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"],
      },
    },
  },
];
// Lot R13 (docs/tests.md) : Firefox et WebKit ne lancent que le petit ensemble étiqueté `@navigateurs` ; Chromium porte le reste.
if (process.env.E2E_ALL_BROWSERS) {
  projects.push(
    { name: name("firefox"), grep: /@navigateurs/, use: { ...devices["Desktop Firefox"] } },
    { name: name("webkit"), grep: /@navigateurs/, use: { ...devices["Desktop Safari"] } },
  );
}
// Lot R13 : les outils (captures, mesures) ne sont jamais dans la CI : ils ne sont même pas listés sans leur variable.
const OUTIL = ["CAPTURES", "MESURE", "PLANCHES", "COMPARER", "AVANT"].some((v) => process.env[v]);

export default defineConfig({
  testDir: "e2e",
  testIgnore: OUTIL ? [] : ["**/captures*.spec.ts", "**/mesure*.spec.ts"],
  timeout: 60_000,
  // CI : une seule relance, comme DailyTrack ; une réussite à la relance est SIGNALÉE (« instable », résumé du job `e2e`), jamais cachée.
  retries: CI ? 1 : 0,
  // CI : rapport « blob » par part (`E2E_BLOB_NAME` : un nom propre à chaque part), fusionné avec ceux de DailyTrack par le job `e2e`.
  reporter: CI ? [["blob", { fileName: process.env.E2E_BLOB_NAME || undefined }], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:4174",
    // Lot I5 : Jump suit la langue de la plateforme (`cdj:langue`, sinon celle du navigateur) ; les tests tournent en français (comme Track au lot I4) ; un
    // test de l'anglais ouvre un contexte `locale: "en-US"` (ou choisit EN dans les Réglages).
    locale: "fr-FR",
    // CI : trace de tout essai raté (même celui d'un test réussi à la relance), sans captures : de quoi trouver la cause d'une instabilité.
    trace: CI ? { mode: "retain-on-failure", screenshots: false, snapshots: false } : "off",
  },
  projects,
  webServer: [
    {
      command: "npx vite preview --port 4174 --strictPort",
      url: "http://localhost:4174",
      reuseExistingServer: true,
    },
    // Lot P2 (plateforme) : le vrai serveur de la plateforme (SQLite en mémoire), port 8791 réservé à `e2e/profil-commun.spec.ts` (deux appareils,
    // un code de transfert). Construit ici (`build-node.mjs`, ≈ 1 s) : la part DailyJump de la CI ne construit que le jeu. Son horloge est celle des
    // pages (`TEST_CLOCK_OFFSET_MS` : midi UTC le 20/10/2026, `e2e/clock.ts`), refusée en production par `config.ts`.
    {
      command: "node scripts/build-node.mjs && node dist/server.mjs",
      cwd: "../api",
      url: "http://127.0.0.1:8791/api/health",
      reuseExistingServer: true,
      timeout: 120_000,
      env: { PORT: "8791", DB_PATH: ":memory:", ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: String(FIXED_NOW - Date.now()) },
    },
  ],
});
