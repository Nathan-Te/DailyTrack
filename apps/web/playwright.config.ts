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

export default defineConfig({
  testDir: "e2e",
  timeout: 90_000,
  reporter: "list",
  use: { baseURL: "http://localhost:4173" },
  projects,
  webServer: {
    command: "npx vite preview --port 4173 --strictPort",
    url: "http://localhost:4173",
    reuseExistingServer: true,
  },
});
