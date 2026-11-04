import { defineConfig, devices, type Project } from "@playwright/test";

// Tests de navigateur de « Cibles » (lot K4f) : ils portent sur l'essai construit (`npm run build -w @cdj/cibles`) servi par `vite preview`, port 4176 (Track 4173, Jump 4174, Tower 4175).
//   npm run e2e -w @cdj/cibles                       → Chromium
//   E2E_ALL_BROWSERS=1 npm run e2e -w @cdj/cibles    → + Firefox et WebKit (petit ensemble `@navigateurs`)
// Un second serveur : le VRAI serveur de l'API monté par le registre des fiches (`apps/api/scripts/cibles-serveur-essai.ts`, SQLite en mémoire, port 8793, refus des copies actif), dont le jour est le 06/11/2026
// (la page prend la même horloge : `e2e/classement.spec.ts`). Même nommage des projets que les autres jeux : en CI le projet porte le jeu (`cibles-chromium`…).
const CI = !!process.env.CI;
const name = (browser: string) => (CI ? `cibles-${browser}` : browser);
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
  reporter: CI ? [["blob", { fileName: process.env.E2E_BLOB_NAME || undefined }], ["list"]] : "list",
  use: { baseURL: "http://localhost:4176", locale: "fr-FR", trace: CI ? { mode: "retain-on-failure", screenshots: false, snapshots: false } : "off" },
  projects,
  webServer: [
    { command: "npx vite preview --port 4176 --strictPort", url: "http://localhost:4176", reuseExistingServer: true },
    {
      command:
        "npx esbuild scripts/cibles-serveur-essai.ts --bundle --platform=node --format=esm --target=node22 --outfile=dist/cibles-serveur-essai.mjs --log-level=warning \"--banner:js=import { createRequire as __cdjRequire } from 'node:module'; const require = __cdjRequire(import.meta.url);\" && node dist/cibles-serveur-essai.mjs",
      cwd: "../api",
      url: "http://127.0.0.1:8793/api/health",
      reuseExistingServer: false,
      env: { PORT: "8793", NODE_NO_WARNINGS: "1", CIBLES_AUJOURDHUI: "2026-11-06" },
    },
  ],
});
