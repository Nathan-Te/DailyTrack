import { defineConfig, devices, type Project } from "@playwright/test";

// Tests de navigateur de DailyJump : ils portent sur le jeu construit (`npm run build -w @cdj/jump`) servi par `vite preview`.
//   npm run e2e -w @cdj/jump                       → Chromium
//   E2E_ALL_BROWSERS=1 npm run e2e -w @cdj/jump    → + Firefox et WebKit (la CI le fait)
// CHROMIUM_PATH : chemin d'un Chromium déjà installé. Port 4174 : celui de DailyTrack (4173) peut tourner en même temps.
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

export default defineConfig({
  testDir: "e2e",
  timeout: 60_000,
  // Pas de relance : un test de fumée qui échoue une fois est un vrai échec (une relance cacherait une instabilité sans la signaler).
  retries: 0,
  reporter: "list",
  use: { baseURL: "http://localhost:4174" },
  projects,
  webServer: {
    command: "npx vite preview --port 4174 --strictPort",
    url: "http://localhost:4174",
    reuseExistingServer: true,
  },
});
