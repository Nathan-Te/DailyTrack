import { defineConfig, devices, type Project } from "@playwright/test";

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
if (process.env.E2E_ALL_BROWSERS) {
  projects.push({ name: name("firefox"), use: { ...devices["Desktop Firefox"] } }, { name: name("webkit"), use: { ...devices["Desktop Safari"] } });
}

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  // CI : une seule relance, comme DailyTrack ; une réussite à la relance est SIGNALÉE (« instable », résumé du job `e2e`), jamais cachée.
  retries: CI ? 1 : 0,
  // CI : rapport « blob » par part (`E2E_BLOB_NAME` : un nom propre à chaque part), fusionné avec ceux de DailyTrack par le job `e2e`.
  reporter: CI ? [["blob", { fileName: process.env.E2E_BLOB_NAME || undefined }], ["list"]] : "list",
  use: {
    baseURL: "http://localhost:4174",
    // CI : trace de tout essai raté (même celui d'un test réussi à la relance), sans captures : de quoi trouver la cause d'une instabilité.
    trace: CI ? { mode: "retain-on-failure", screenshots: false, snapshots: false } : "off",
  },
  projects,
  webServer: {
    command: "npx vite preview --port 4174 --strictPort",
    url: "http://localhost:4174",
    reuseExistingServer: true,
  },
});
