import { defineConfig, devices, type Project } from "@playwright/test";

// Tests de navigateur de Tower (lot T0) : ils portent sur l'essai construit (`npm run build -w @cdj/tower`) servi par `vite preview`, port 4175 (Track 4173, Jump 4174).
//   npm run e2e -w @cdj/tower                       → Chromium
//   E2E_ALL_BROWSERS=1 npm run e2e -w @cdj/tower    → + Firefox et WebKit (petit ensemble `@navigateurs`)
// CHROMIUM_PATH : chemin d'un Chromium déjà installé. Même nommage que Jump : en CI le projet porte le jeu (`tower-chromium`…).
const CI = !!process.env.CI;
const name = (browser: string) => (CI ? `tower-${browser}` : browser);
const projects: Project[] = [
  {
    name: name("chromium"),
    use: { ...devices["Desktop Chrome"], launchOptions: { executablePath: process.env.CHROMIUM_PATH || undefined, args: ["--use-gl=angle", "--use-angle=swiftshader", "--enable-unsafe-swiftshader", "--no-sandbox"] } },
  },
];
if (process.env.E2E_ALL_BROWSERS) {
  projects.push({ name: name("firefox"), grep: /@navigateurs/, use: { ...devices["Desktop Firefox"] } }, { name: name("webkit"), grep: /@navigateurs/, use: { ...devices["Desktop Safari"] } });
}

export default defineConfig({
  testDir: "e2e",
  timeout: 180_000,
  retries: CI ? 1 : 0,
  reporter: CI ? [["blob", { fileName: process.env.E2E_BLOB_NAME || undefined }], ["list"]] : "list",
  use: { baseURL: "http://localhost:4175", locale: "fr-FR", trace: CI ? { mode: "retain-on-failure", screenshots: false, snapshots: false } : "off" },
  projects,
  webServer: { command: "npx vite preview --port 4175 --strictPort", url: "http://localhost:4175", reuseExistingServer: true },
});
