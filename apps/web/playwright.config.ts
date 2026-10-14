import { defineConfig, devices, type Project } from "@playwright/test";

// Tests de navigateur : ils portent sur le jeu construit (`npm run build`) servi par `vite preview`.
//   npm run test:e2e                       → Chromium
//   E2E_ALL_BROWSERS=1 npm run test:e2e    → + Firefox et WebKit (la CI le fait ; il faut les installer :
//                                            npx playwright install --with-deps chromium firefox webkit)
// CHROMIUM_PATH : chemin d'un Chromium déjà installé (utile dans un conteneur sans accès au téléchargement).
const projects: Project[] = [
  {
    name: "chromium",
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
if (process.env.E2E_ALL_BROWSERS) {
  projects.push({ name: "firefox", use: { ...devices["Desktop Firefox"] } }, { name: "webkit", use: { ...devices["Desktop Safari"] } });
}

// Horloge de test commune aux serveurs et aux navigateurs (e2e/fixtures.ts) : « maintenant » = midi UTC le 20/10/2026, puis le temps passe
// normalement. Le décalage est calculé une fois (ici, dans le processus principal) puis hérité par les workers.
process.env.E2E_CLOCK_OFFSET_MS ??= String(Date.parse("2026-10-20T12:00:00Z") - Date.now());
const TEST_CLOCK_OFFSET_MS = process.env.E2E_CLOCK_OFFSET_MS;
const CI = !!process.env.CI;

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  // CI : une seule relance, et une réussite à la relance est SIGNALÉE (« instable », voir scripts/flaky-report.mjs et le résumé du run), jamais cachée.
  retries: CI ? 1 : 0,
  // CI : rapport « blob » par part, fusionné ensuite en un seul rapport (job `e2e-rapport`). En local : liste.
  // (`E2E_BLOB_NAME` : un nom de fichier propre à chaque part, sinon « chromium 1/8 » et « firefox 1/2 » s'écraseraient à la fusion.)
  reporter: CI ? [["blob", { fileName: process.env.E2E_BLOB_NAME || undefined }], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    // CI : la trace (actions, réseau, console — sans captures, qui alourdiraient des pages déjà lentes) de tout essai raté est gardée, y compris
    // celui d'un test qui réussit ensuite à la relance : c'est ce qui permet de trouver la cause d'une instabilité.
    trace: CI ? { mode: "retain-on-failure", screenshots: false, snapshots: false } : "off",
  },
  projects,
  webServer: [
    {
      command: "npx vite preview --port 4173 --strictPort",
      url: "http://localhost:4173",
      reuseExistingServer: true,
    },
    {
      // Le vrai serveur du classement (celui du conteneur Docker), avec une base SQLite en mémoire : neuve à
      // chaque lancement, pour que les tests de classement partent d'un jour vierge.
      command: "node ../api/dist/server.mjs",
      url: "http://127.0.0.1:8787/api/health",
      reuseExistingServer: false,
      env: { PORT: "8787", DB_PATH: ":memory:", ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", ADMIN_TOKEN: "e2e-admin-token-0123456789", TEST_CLOCK_OFFSET_MS },
    },
    {
      // Le même serveur avec des sessions du Salon de trois minutes (`SALON_MINUTES`, tests et essais locaux seulement) : e2e/salon-serveur.spec.ts.
      // Un serveur par spec : sur un serveur commun, les présents de l'un s'ajoutent aux comptes de l'autre.
      command: "node ../api/dist/server.mjs",
      url: "http://127.0.0.1:8788/api/health",
      reuseExistingServer: false,
      env: { PORT: "8788", DB_PATH: ":memory:", ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", SALON_MINUTES: "3", TEST_CLOCK_OFFSET_MS },
    },
    {
      // Réservé à e2e/watch-serveur.spec.ts (présence du Salon : un spectateur n'est pas compté).
      command: "node ../api/dist/server.mjs",
      url: "http://127.0.0.1:8789/api/health",
      reuseExistingServer: false,
      env: { PORT: "8789", DB_PATH: ":memory:", ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", SALON_MINUTES: "2", TEST_CLOCK_OFFSET_MS },
    },
  ],
});
