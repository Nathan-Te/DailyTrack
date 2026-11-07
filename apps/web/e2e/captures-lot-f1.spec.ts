import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { expect, newClockedContext, test } from "./fixtures";
import { startSite } from "./domaine-serveurs";

// Captures du README du lot F1 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-f1 --project=chromium` (`OUT=…` change le dossier).
// L'accueil du portail AVEC favoris (le joueur de démonstration : Track sous « Mes jeux », Jump dessous en cartouche compacte) et SANS favori (un visiteur : tous les jeux en
// cartouches pleines, la ligne qui invite à épingler), en portrait (390 × 844) et en paysage (844 × 390), en français et en anglais : 8 images. Le site est celui de la recette
// (vitrine et lien de démonstration compris), le serveur le vrai, la base garnie par `recette:seed --demo-seulement`. Ports réservés : site 4200, API 8820.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "Chromium seulement");
test.setTimeout(240_000);
test.describe.configure({ mode: "serial" });

const ROOT = resolve("../..");
const OUT = process.env.OUT ?? join(ROOT, "docs/plateforme/lots/img");
mkdirSync(OUT, { recursive: true });
const FORMATS = [
  { slug: "portrait", viewport: { width: 390, height: 844 } },
  { slug: "paysage", viewport: { width: 844, height: 390 } },
] as const;

let tmp = "";
let serveur: Server | null = null;
let api: ChildProcess | null = null;
const SITE = 4200;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  tmp = mkdtempSync(join(tmpdir(), "captures-f1-"));
  execFileSync("npx", ["vite", "build", "-c", "apps/portail/vite.config.ts", "--logLevel", "error", "--outDir", join(tmp, "site"), "--emptyOutDir"], {
    cwd: ROOT,
    env: { ...process.env, PORTAIL_VITRINE: "1", VITE_CONFIG_NATIVE_IGNORE_WARNING: "true" },
    stdio: "inherit",
  });
  execFileSync("npm", ["run", "recette:seed", "--", "--demo-seulement", "--today", "2026-10-20"], {
    cwd: ROOT,
    env: { ...process.env, ENVIRONMENT: "recette", DB_PATH: join(tmp, "recette.sqlite"), TURSO_DATABASE_URL: "" },
    stdio: "inherit",
  });
  api = spawn("node", ["../api/dist/server.mjs"], {
    env: { ...process.env, PORT: "8820", DB_PATH: join(tmp, "recette.sqlite"), ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: process.env.E2E_CLOCK_OFFSET_MS ?? "0" },
    stdio: "ignore",
  });
  for (let i = 0; i < 100; i++) {
    if (await fetch("http://127.0.0.1:8820/api/health").then((r) => r.ok, () => false)) break;
    await new Promise((r) => setTimeout(r, 100));
  }
  serveur = await startSite(join(tmp, "site"), SITE, 8820);
});

test.afterAll(async () => {
  await new Promise((r) => (serveur ? serveur.close(r) : r(null)));
  api?.kill();
  if (tmp && existsSync(tmp)) rmSync(tmp, { recursive: true, force: true });
});

for (const format of FORMATS) {
  for (const langue of ["fr", "en"] as const) {
    test(`accueil avec et sans favoris — ${format.slug} ${langue}`, async ({ browser }) => {
      for (const avec of [true, false]) {
        const context = await newClockedContext(browser, { viewport: format.viewport, hasTouch: true, isMobile: true, locale: langue === "fr" ? "fr-FR" : "en-GB" });
        await context.addInitScript((l) => localStorage.setItem("cdj:langue", l), langue); // lot U1 : la langue n'est plus dans la barre d'un téléphone
        const page = await context.newPage();
        await page.goto(`http://localhost:${SITE}/${avec ? "?demo=joueur" : ""}`);
        if (avec) {
          await expect(page.locator('[data-jeu="track"] .portail-statut')).toHaveAttribute("data-statut", "fini");
          await expect(page.locator("#jeux [data-jeu]")).toHaveCount(2); // lot U1 : plus de « Les autres jeux », les épinglés en tête
        } else {
          await expect(page.locator("#favoris-invite")).toBeVisible();
        }
        await page.evaluate(() => document.fonts.ready);
        await page.screenshot({ fullPage: true, path: join(OUT, `lot-F1-${avec ? "avec" : "sans"}-favoris-${format.slug}-${langue}.png`) });
        await context.close();
      }
    });
  }
}
