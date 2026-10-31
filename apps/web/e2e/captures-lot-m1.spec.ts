import { execFileSync } from "node:child_process";
import { existsSync, mkdirSync, mkdtempSync, rmSync } from "node:fs";
import type { Server } from "node:http";
import { tmpdir } from "node:os";
import { join, resolve } from "node:path";
import { startSite } from "./domaine-serveurs";
import { hasWebGL, newClockedContext, test, type Page } from "./fixtures";

// Captures du README du lot M1 (outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-m1 --project=chromium` (`OUT=…` change le dossier). Le portail et la
// pause de chaque jeu (Track, Jump, Tower) avec la bande d'aide de la manette, en 844 × 390, sur le site assemblé (ports 4199 et 8819 réservés : le même que manette.spec.ts).
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(300_000);
test.describe.configure({ mode: "serial" });

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");
mkdirSync(OUT, { recursive: true });
const ROOT = resolve("../..");
const PORT = 4199;
const SITE = `http://localhost:${PORT}`;
let tmp = "";
let serveur: Server | null = null;

test.beforeAll(async () => {
  test.setTimeout(240_000);
  for (const app of ["web", "jump", "tower"]) if (!existsSync(join(ROOT, "apps", app, "dist", "index.html"))) throw new Error(`apps/${app} n'est pas construit : npm run build`);
  tmp = mkdtempSync(join(tmpdir(), "captures-m1-"));
  execFileSync("node", ["scripts/site.mjs", "site", "--sortie", join(tmp, "site"), "--origine", SITE], { cwd: ROOT, stdio: "inherit" });
  serveur = await startSite(join(tmp, "site"), PORT, 8819);
});
test.afterAll(async () => {
  serveur?.closeAllConnections();
  if (serveur) await new Promise((r) => serveur!.close(r));
  if (tmp) rmSync(tmp, { recursive: true, force: true });
});

async function brancherManette(page: Page, id: string): Promise<void> {
  await page.evaluate((idManette) => {
    const w = window as unknown as { __pad?: { buttons: { pressed: boolean; touched: boolean; value: number }[]; axes: number[] } };
    w.__pad = { buttons: Array.from({ length: 17 }, () => ({ pressed: false, touched: false, value: 0 })), axes: [0, 0, 0, 0] };
    const pad = { id: idManette, index: 0, connected: true, mapping: "standard", timestamp: 0, get axes() { return w.__pad!.axes; }, get buttons() { return w.__pad!.buttons; } };
    navigator.getGamepads = () => [pad as unknown as Gamepad];
    dispatchEvent(new Event("gamepadconnected"));
  }, id);
}
const appuyer = async (page: Page, i: number) => {
  await page.evaluate((k) => { const b = (window as unknown as { __pad: { buttons: { pressed: boolean; value: number }[] } }).__pad.buttons[k]!; b.pressed = true; b.value = 1; }, i);
};
const relacher = async (page: Page, i: number) => {
  await page.evaluate((k) => { const b = (window as unknown as { __pad: { buttons: { pressed: boolean; value: number }[] } }).__pad.buttons[k]!; b.pressed = false; b.value = 0; }, i);
};
const XBOX = "Xbox Wireless Controller (STANDARD GAMEPAD Vendor: 045e Product: 0b13)";
const PLAYSTATION = "Wireless Controller (STANDARD GAMEPAD Vendor: 054c Product: 09cc)";
const START = 9;

test("portail", async ({ browser }) => {
  const context = await newClockedContext(browser, { viewport: { width: 844, height: 390 }, locale: "fr-FR" });
  const page = await context.newPage();
  await page.goto(`${SITE}/`);
  await page.waitForSelector("#jeux .dj-cartouche[data-jeu]");
  await brancherManette(page, XBOX);
  await page.waitForSelector(".dj-manette-aide:not([hidden])");
  await page.screenshot({ path: join(OUT, "lot-M1-portail.png") });
  await page.goto(`${SITE}/classement/`);
  await brancherManette(page, PLAYSTATION);
  await page.waitForSelector(".dj-manette-aide:not([hidden])");
  await page.screenshot({ path: join(OUT, "lot-M1-classement-playstation.png") });
});

for (const jeu of [
  { slug: "track", url: "/track/?debug&home=0", pret: () => !!(window as unknown as { __cdj?: { phase?: string } }).__cdj?.phase, pause: "#pause-resume" },
  { slug: "jump", url: "/jump/?scenario=essai&accueil=0&debug", pret: () => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready", pause: "#menu-resume" },
  { slug: "tower", url: "/tower/?scenario=essai", pret: () => document.documentElement.dataset.ready === "true", pause: "#pause-reprendre" },
]) {
  test(`pause de ${jeu.slug}`, async ({ browser }) => {
    const context = await newClockedContext(browser, { viewport: { width: 844, height: 390 }, locale: "fr-FR" });
    await context.addInitScript(() => localStorage.setItem("cdj:howto", "1"));
    const page = await context.newPage();
    await page.goto(`${SITE}${jeu.url}`);
    test.skip(!(await hasWebGL(page)), "WebGL");
    await page.waitForFunction(jeu.pret);
    await brancherManette(page, XBOX);
    if (jeu.slug === "tower") await page.keyboard.press("Escape");
    else {
      await appuyer(page, START);
      await page.waitForTimeout(120);
      await relacher(page, START);
    }
    await page.waitForSelector(jeu.pause, { state: "visible" });
    if (jeu.slug === "tower") {
      await appuyer(page, 15); // un premier appui de la manette : la dernière entrée vient d'elle (la bande d'aide)
      await page.waitForTimeout(120);
      await relacher(page, 15);
    }
    await page.waitForSelector(".dj-manette-aide:not([hidden])");
    await page.waitForTimeout(300);
    await page.screenshot({ path: join(OUT, `lot-M1-pause-${jeu.slug}.png`) });
  });
}
