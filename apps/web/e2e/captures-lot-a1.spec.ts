import { execFileSync, spawn, type ChildProcess } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { dailyCircuit, encodeReplay, medalFor } from "@cdj/sim";
import { startSite } from "./domaine-serveurs";
import { expect, hasWebGL, newContextAt, test, TODAY, type Page } from "./fixtures";

// Captures du README du lot A1 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-a1`. Chromium, portrait 390 × 844 et paysage 844 × 390,
// **français et anglais** : l'accueil du portail (« Prochains niveaux dans », la tuile en temps cumulé), les trois vues de `/classement/` (Cumulé, Track, Jump)
// sur la recette garnie du 24/10 (le vrai `recette:seed`), puis une arrivée de chaque jeu avec la médaille Diamant (la rediffusion de l'auteur, le 20/10 :
// avant le 28/10 le temps de l'auteur est celui du pilote). Les jeux sont ouverts hors ligne (`api=/`, mais aucun temps n'est envoyé : l'arrivée attend un pseudo).
// Serveurs lancés ici (ports réservés à ce fichier) : sites 4185 (le 24/10, recette garnie) et 4186 (le 20/10), API 8802 et 8803.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.describe.configure({ mode: "serial" });
test.setTimeout(600_000);

const ROOT = resolve("../..");
const OUT = process.env.OUT ?? join(ROOT, "docs/plateforme/lots/img");
const VUES = [
  { slug: "portrait", width: 390, height: 844 },
  { slug: "paysage", width: 844, height: 390 },
] as const;
const LANGUES = [
  { slug: "fr", locale: "fr-FR" },
  { slug: "en", locale: "en-US" },
] as const;
const T24 = Date.parse("2026-10-24T12:00:00Z");
const SITE_24 = "http://localhost:4185";
const SITE_20 = "http://localhost:4186";

let tmp = "";
const servers: Server[] = [];
const apis: ChildProcess[] = [];

async function api(port: number, db: string, instant?: number): Promise<void> {
  const offset = instant === undefined ? process.env.E2E_CLOCK_OFFSET_MS : String(instant - Date.now());
  const child = spawn("node", ["../api/dist/server.mjs"], { env: { ...process.env, PORT: String(port), DB_PATH: db, ALLOW_ORIGIN: "*", NODE_NO_WARNINGS: "1", TEST_CLOCK_OFFSET_MS: offset }, stdio: "ignore" });
  apis.push(child);
  for (let i = 0; i < 100; i++) {
    if (await fetch(`http://127.0.0.1:${port}/api/health`).then((r) => r.ok, () => false)) return;
    await new Promise((r) => setTimeout(r, 100));
  }
  throw new Error(`serveur ${port} injoignable`);
}

test.beforeAll(async () => {
  for (const app of ["web", "jump"]) if (!existsSync(join(ROOT, "apps", app, "dist", "index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  mkdirSync(OUT, { recursive: true });
  tmp = mkdtempSync(join(tmpdir(), "captures-a1-"));
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site")], { cwd: ROOT, stdio: "inherit" });
  execFileSync("npm", ["run", "recette:seed", "--", "--demo-seulement", "--classement", "--today", "2026-10-24"], {
    cwd: ROOT,
    env: { ...process.env, ENVIRONMENT: "recette", DB_PATH: join(tmp, "recette-24.sqlite"), TURSO_DATABASE_URL: "" },
    stdio: "inherit",
  });
  await api(8802, join(tmp, "recette-24.sqlite"), T24);
  await api(8803, ":memory:");
  servers.push(await startSite(join(tmp, "site"), 4185, 8802), await startSite(join(tmp, "site"), 4186, 8803));
});

test.afterAll(async () => {
  await Promise.all(servers.map((s) => new Promise((r) => s.close(r))));
  for (const a of apis) a.kill();
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

const photo = async (page: Page, nom: string, vue: (typeof VUES)[number], langue: (typeof LANGUES)[number], pleinePage = true) => {
  await page.evaluate(() => document.fonts.ready);
  await page.screenshot({ path: join(OUT, `lot-A1-${nom}-${vue.slug}-${langue.slug}.png`), fullPage: pleinePage });
};

for (const vue of VUES) {
  for (const langue of LANGUES) {
    test(`portail : l'accueil et les trois vues du classement (${vue.slug}, ${langue.slug})`, async ({ browser }) => {
      const context = await newContextAt(browser, T24, { viewport: { width: vue.width, height: vue.height }, locale: langue.locale, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      const page = await context.newPage();
      await page.goto(`${SITE_24}/?demo=joueur`);
      await expect(page.locator("#classement .dj-tuile__sous-texte")).not.toHaveText("");
      await photo(page, "accueil", vue, langue);
      for (const [nom, adresse] of [["cumul", ""], ["track", "?vue=track"], ["jump", "?vue=jump"]] as const) {
        await page.goto(`${SITE_24}/classement/${adresse}`);
        await expect(page.locator("#classement-liste li").first()).toBeVisible();
        await photo(page, `classement-${nom}`, vue, langue);
      }
      await context.close();
    });
  }
}

for (const vue of VUES) {
  for (const langue of LANGUES) {
    test(`arrivées avec la médaille Diamant (${vue.slug}, ${langue.slug})`, async ({ browser }) => {
      const context = await newContextAt(browser, TODAY_20(), { viewport: { width: vue.width, height: vue.height }, locale: langue.locale, isMobile: true, hasTouch: true, deviceScaleFactor: 1 });
      const circuit = dailyCircuit(TODAY);
      const auteur = encodeReplay(circuit.authorReplay);
      expect(medalFor(circuit.authorMs, circuit.medals)).toBe("author");
      // DailyTrack : la rediffusion du pilote (le temps de l'auteur) jusqu'à l'arrivée.
      const track = await context.newPage();
      await track.goto(`${SITE_20}/track/?debug&timescale=6&api=/`);
      test.skip(!(await hasWebGL(track)), "ce navigateur n'a pas WebGL : les jeux ne démarrent pas");
      await track.waitForFunction(() => !!(window as unknown as { __cdj?: unknown }).__cdj);
      await track.evaluate((c) => (window as unknown as { __cdj: { autoplay(code: string): void } }).__cdj.autoplay(c), auteur);
      await track.waitForFunction(() => (window as unknown as { __cdj: { phase: string } }).__cdj.phase === "finished", undefined, { timeout: 90_000 });
      await expect(track.locator("#finish")).toBeVisible();
      await track.waitForTimeout(1500);
      await photo(track, "arrivee-track", vue, langue, false);
      // DailyJump : la preuve de l'auteur, pas à pas, jusqu'au carnage, puis un appui : l'écran d'arrivée.
      const jump = await context.newPage();
      await jump.goto(`${SITE_20}/jump/?debug&api=/&accueil=0`);
      await jump.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
      await jump.evaluate(() => {
        type J = { phase: string; manual(on: boolean): void; autoplay(): number; advance(n: number): void; input(d: number | null): void };
        const j = (window as unknown as { __jump: J }).__jump;
        j.manual(true);
        const n = j.autoplay();
        for (let t = 1; t <= n + 10; t++) {
          j.advance(1);
          if (j.phase === "carnage" || j.phase === "finished") break;
        }
        j.input(0);
        j.advance(1);
        j.input(null);
        j.input(2);
        j.advance(1);
        j.input(null);
      });
      await expect(jump.locator("#arrival")).toBeVisible();
      await jump.waitForTimeout(1500);
      await photo(jump, "arrivee-jump", vue, langue, false);
      await context.close();
    });
  }
}

/** Le 20/10/2026, midi UTC : l'horloge des jeux (le jour de TODAY). */
function TODAY_20(): number {
  return Date.parse("2026-10-20T12:00:00Z");
}
