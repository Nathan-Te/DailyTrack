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
// Lot R13 (le tri des tests, docs/tests.md) : Firefox et WebKit ne lancent que le PETIT ENSEMBLE étiqueté `@navigateurs` (rediffusion bit à bit, chargement,
// une partie de chaque jeu) ; Chromium porte tout le reste.
if (process.env.E2E_ALL_BROWSERS) {
  projects.push(
    { name: "firefox", grep: /@navigateurs/, use: { ...devices["Desktop Firefox"] } },
    { name: "webkit", grep: /@navigateurs/, use: { ...devices["Desktop Safari"] } },
  );
}

// Horloge de test commune aux serveurs et aux navigateurs (e2e/fixtures.ts) : « maintenant » = midi UTC le 20/10/2026, puis le temps passe
// normalement. Le décalage est calculé une fois (ici, dans le processus principal) puis hérité par les workers.
process.env.E2E_CLOCK_OFFSET_MS ??= String(Date.parse("2026-10-20T12:00:00Z") - Date.now());
const TEST_CLOCK_OFFSET_MS = process.env.E2E_CLOCK_OFFSET_MS;
// Lot R8 : la date du lancement public (config/lancement.json) est le 26/10/2026, après l'horloge des tests (20/10/2026). Les e2e du portail et du serveur
// (journée n° 2 le 24/10, classement du jour) gardent leur scénario du lot I3 : la journée n° 1 y est le 23/10/2026 (serveurs : `LANCEMENT_PREMIER_JOUR`, portail
// construit par les specs : `VITE_LANCEMENT_PREMIER_JOUR`, tous deux hérités par les processus lancés). Les jeux, eux, sont construits avec le 13/10 (archives) par
// `npm run test:e2e` et la CI, jamais avec cette valeur.
process.env.LANCEMENT_PREMIER_JOUR = "2026-10-23";
process.env.VITE_LANCEMENT_PREMIER_JOUR = "2026-10-23";
const CI = !!process.env.CI;

// Lot R13 : les outils (captures, mesures, planches) ne sont jamais dans la CI : ils ne sont même pas listés sans leur variable (`CAPTURES=1`, `MESURE=1`…).
const OUTIL = ["CAPTURES", "MESURE", "PLANCHES", "COMPARER", "AVANT"].some((v) => process.env[v]);

export default defineConfig({
  testDir: "e2e",
  testIgnore: OUTIL ? [] : ["**/captures*.spec.ts", "**/mesure*.spec.ts"],
  timeout: 90_000,
  // CI : une seule relance, et une réussite à la relance est SIGNALÉE (« instable », voir scripts/flaky-report.mjs et le résumé du run), jamais cachée.
  retries: CI ? 1 : 0,
  // CI : rapport « blob » par part, fusionné ensuite en un seul rapport (job `e2e-rapport`). En local : liste.
  // (`E2E_BLOB_NAME` : un nom de fichier propre à chaque part, sinon « chromium 1/8 » et « firefox 1/2 » s'écraseraient à la fusion.)
  reporter: CI ? [["blob", { fileName: process.env.E2E_BLOB_NAME || undefined }], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:4173",
    // Lot I4 : le jeu est en français ou en anglais selon la langue du navigateur (cdj:langue, @cdj/profile) ; les tests sont écrits pour le français. Un test
    // de l'anglais ouvre un contexte `locale: "en-US"` (ou choisit EN dans les Réglages).
    locale: "fr-FR",
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
    {
      // Réservé à e2e/profil.spec.ts (lot 30 : pseudos réservés, profil synchronisé entre appareils, code changé). Un serveur par spec : ses joueurs et ses
      // pseudos ne doivent pas se mêler à ceux du classement de leaderboard.spec.ts.
      command: "node ../api/dist/server.mjs",
      url: "http://127.0.0.1:8790/api/health",
      reuseExistingServer: false,
      env: { PORT: "8790", DB_PATH: ":memory:", ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS },
    },
    {
      // Lot P4 (plateforme) : les deux jeux construits sur la même origine (`/` et `/jump/`, comme GitHub Pages) : e2e/identite-plateforme.spec.ts.
      command: "node e2e/deux-jeux.mjs 4175",
      url: "http://localhost:4175/",
      reuseExistingServer: false,
    },
    {
      // Lot P4 (plateforme) : réservé à e2e/identite-plateforme.spec.ts (un code chargé dans DailyJump, puis DailyTrack ouvert : le cache des records
      // de l'ancienne identité est vidé). Un serveur par spec : ses joueurs ne se mêlent pas à ceux de profil.spec.ts.
      command: "node ../api/dist/server.mjs",
      url: "http://127.0.0.1:8792/api/health",
      reuseExistingServer: false,
      env: { PORT: "8792", DB_PATH: ":memory:", ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS },
    },
  ],
});
