import { defineConfig, devices, type Project } from "@playwright/test";

// Tests de navigateur de « Blocks » (lot K4f) : ils portent sur l'essai construit (`npm run build -w @cdj/blocks`) servi par `vite preview`, port 4179 (Track 4173, Jump 4174, Tower 4175).
//   npm run e2e -w @cdj/blocks                       → Chromium
//   E2E_ALL_BROWSERS=1 npm run e2e -w @cdj/blocks    → + Firefox et WebKit (petit ensemble `@navigateurs`)
// Un second serveur : le VRAI serveur de l'API monté par le registre des fiches (`apps/api/scripts/blocks-serveur-essai.ts`, SQLite en mémoire, port 8794, refus des copies actif ; lot B4 : port 8800, Blocks en `preview`), dont le jour est le 06/11/2026
// (la page prend la même horloge : `e2e/classement.spec.ts`). Même nommage des projets que les autres jeux : en CI le projet porte le jeu (`blocks-chromium`…).
const CI = !!process.env.CI;
const name = (browser: string) => (CI ? `blocks-${browser}` : browser);
const projects: Project[] = [
  {
    name: name("chromium"),
    use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--no-sandbox"] } },
  },
];
if (process.env.E2E_ALL_BROWSERS) {
  projects.push({ name: name("firefox"), grep: /@navigateurs/, use: { ...devices["Desktop Firefox"] } }, { name: name("webkit"), grep: /@navigateurs/, use: { ...devices["Desktop Safari"] } });
}

export default defineConfig({
  testDir: "e2e",
  // Un outil (captures) ne tourne jamais en CI (lot R13) : `CAPTURES=1 npx playwright test captures-lot-k4f` les produit pour Nathan.
  testIgnore: process.env.CAPTURES ? [] : ["**/captures-*.spec.ts"],
  timeout: 120_000,
  retries: CI ? 1 : 0,
  reporter: CI ? [["blob", { fileName: process.env.E2E_BLOB_NAME || undefined }], ["list"]] : process.env.CDJ_BAVARD ? "list" : "dot", // lot T1 : en local, des points et les échecs en entier ; `CDJ_BAVARD=1` ou `--reporter=list` pour une ligne par test
  use: { baseURL: "http://localhost:4179", locale: "fr-FR", trace: CI ? { mode: "retain-on-failure", screenshots: false, snapshots: false } : "off" },
  projects,
  webServer: [
    { command: "npx vite preview --port 4179 --strictPort", url: "http://localhost:4179", reuseExistingServer: true },
    {
      command:
        "npx esbuild scripts/blocks-serveur-essai.ts --bundle --platform=node --format=esm --target=node22 --outfile=dist/blocks-serveur-essai.mjs --log-level=warning \"--banner:js=import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);\" && node dist/blocks-serveur-essai.mjs",
      cwd: "../api",
      url: "http://127.0.0.1:8794/api/health",
      reuseExistingServer: false,
      env: { PORT: "8794", NODE_NO_WARNINGS: "1", BLOCKS_AUJOURDHUI: "2026-11-06" },
    },
    // Lot B4 : un troisième serveur, le même mais Blocks y est en `preview` (clé d'aperçu `CLE_APERCU` de `e2e/apercu.spec.ts`) : le jeu jouable par son lien, absent de l'accueil.
    {
      command:
        "npx esbuild scripts/blocks-serveur-essai.ts --bundle --platform=node --format=esm --target=node22 --outfile=dist/blocks-serveur-apercu.mjs --log-level=warning \"--banner:js=import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);\" && node dist/blocks-serveur-apercu.mjs",
      cwd: "../api",
      url: "http://127.0.0.1:8800/api/health",
      reuseExistingServer: false,
      env: { PORT: "8800", NODE_NO_WARNINGS: "1", BLOCKS_AUJOURDHUI: "2026-11-06", BLOCKS_APERCU: "cle-apercu-blocks-essai-0123456789" },
    },
  ],
});
