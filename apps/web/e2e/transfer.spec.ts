import { expect, test, type Page } from "@playwright/test";
import { boxes, expectNoOverlap } from "./layout";

// Code de transfert (lot 28) : copier son code sur un navigateur, le coller sur un autre. Tout se passe dans le navigateur.
test.skip(({ browserName }) => browserName !== "chromium", "presse-papiers et rendu : Chromium seulement");
test.setTimeout(120_000);

const ID = "0123456789abcdef0123456789abcdef";
const OTHER = "fedcba9876543210fedcba9876543210";
const G = 15;

async function boot(page: Page, url = "/?debug") {
  await page.goto(url);
  await page.waitForFunction(() => window.__cdj?.phase);
}

async function openSettings(page: Page) {
  await page.keyboard.press("p");
  await expect(page.locator("#pause")).toBeVisible();
  await page.locator("#pause-settings").click();
  await expect(page.locator("#settings")).toBeVisible();
}

test("copier mon code ici, le coller là : l'identité, le pseudo et les records suivent", async ({ browser }) => {
  const a = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const pa = await a.newPage();
  await pa.addInitScript(
    ([id, g]) => {
      if (localStorage.getItem("cdj:player")) return; // pas à chaque rechargement
      localStorage.setItem("cdj:player", id!);
      localStorage.setItem("cdj:name", "Alice");
      localStorage.setItem(`cdj:best:jour-2026-10-13-g${g}`, JSON.stringify({ ms: 41000, splits: [10000, 20000], simVersion: 14, medal: "silver" }));
      localStorage.setItem(`cdj:sub:jour-2026-10-13-g${g}`, "41000");
    },
    [ID, String(G)],
  );
  await boot(pa);
  await openSettings(pa);
  await expect(pa.locator("#settings .who")).toContainText("Alice");
  await pa.screenshot({ path: "../../docs/lots/img/lot-28-reglages.png" });
  await pa.locator("#tr-copy").click();
  await expect(pa.locator("#tr-msg")).toContainText("Code copié");
  const code = await pa.evaluate(() => navigator.clipboard.readText());
  expect(code).toMatch(/^CDJ1\.[A-Za-z0-9_-]+\.[0-9a-f]{8}$/);
  // Le code n'est pas affiché à l'écran quand la copie a marché.
  expect(await pa.locator("#tr-code").inputValue()).toBe("");

  // Autre navigateur : une autre identité, un autre record.
  const b = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const pb = await b.newPage();
  await pb.addInitScript(
    ([id, g]) => {
      if (localStorage.getItem("cdj:player")) return;
      localStorage.setItem("cdj:player", id!);
      localStorage.setItem("cdj:name", "Bob");
      localStorage.setItem(`cdj:best:jour-2026-10-20-g${g}`, JSON.stringify({ ms: 50000, splits: [], simVersion: 14 }));
      localStorage.setItem("cdj:audio", '{"volume":2}');
    },
    [OTHER, String(G)],
  );
  await boot(pb);
  await openSettings(pb);
  await pb.evaluate((c) => navigator.clipboard.writeText(c), code);
  await pb.locator("#tr-paste").click(); // lit le presse-papiers
  await expect(pb.locator("#tr-confirm")).toBeVisible();
  await expect(pb.locator("#tr-confirm")).toContainText("« Alice »");
  await expect(pb.locator("#tr-confirm")).toContainText("« Bob »");
  // Rien n'a encore changé.
  expect(await pb.evaluate(() => localStorage.getItem("cdj:player"))).toBe(OTHER);
  await pb.screenshot({ path: "../../docs/lots/img/lot-28-coller.png" });

  const reloaded = pb.waitForEvent("load");
  await pb.locator("#tr-apply").click();
  await reloaded;
  await pb.waitForFunction(() => window.__cdj?.phase);
  const state = await pb.evaluate(() => ({ ...localStorage }));
  expect(state["cdj:player"]).toBe(ID);
  expect(state["cdj:name"]).toBe("Alice");
  expect(JSON.parse(state[`cdj:best:jour-2026-10-13-g${G}`]!).ms).toBe(41000);
  expect(state[`cdj:sub:jour-2026-10-13-g${G}`]).toBe("41000");
  expect(state[`cdj:best:jour-2026-10-20-g${G}`]).toBeUndefined(); // les anciens records sont remplacés
  expect(state["cdj:audio"]).toBe('{"volume":2}'); // les réglages restent
  await a.close();
  await b.close();
});

test("un code abîmé est refusé sans rien changer ; annuler ne change rien non plus", async ({ browser }) => {
  const ctx = await browser.newContext({ permissions: ["clipboard-read", "clipboard-write"] });
  const page = await ctx.newPage();
  await page.addInitScript(([id]) => {
    if (!localStorage.getItem("cdj:player")) {
      localStorage.setItem("cdj:player", id!);
      localStorage.setItem("cdj:name", "Alice");
    }
  }, [ID]);
  await boot(page);
  await openSettings(page);
  await page.locator("#tr-copy").click();
  const code = await page.evaluate(() => navigator.clipboard.readText());

  await page.locator("#tr-code").fill(code.slice(0, 40) + code.slice(52)); // copie amputée de 12 caractères au milieu
  await page.locator("#tr-paste").click();
  await expect(page.locator("#tr-msg")).toContainText("somme de contrôle");
  await expect(page.locator("#tr-confirm")).toBeHidden();
  await page.locator("#tr-code").fill("bonjour");
  await page.locator("#tr-paste").click();
  await expect(page.locator("#tr-msg")).toContainText("Ce n'est pas un code de transfert");

  // Un code valide, puis « Annuler ».
  await page.locator("#tr-code").fill(code);
  await page.locator("#tr-paste").click();
  await expect(page.locator("#tr-confirm")).toBeVisible();
  await page.locator("#tr-cancel").click();
  await expect(page.locator("#tr-confirm")).toBeHidden();
  expect(await page.evaluate(() => localStorage.getItem("cdj:player"))).toBe(ID);
  // Taper dans la zone ne déclenche aucune commande de jeu (P = pause, R = reprise, Entrée = départ…).
  await page.locator("#tr-code").fill("");
  await page.locator("#tr-code").press("p");
  await page.locator("#tr-code").press("Enter");
  expect(await page.evaluate(() => window.__cdj.paused)).toBe(true);
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings")).toBeHidden();
  await ctx.close();
});

for (const [label, viewport] of [
  ["téléphone en portrait", { width: 390, height: 844 }],
  ["téléphone en paysage", { width: 844, height: 390 }],
  ["petit téléphone", { width: 360, height: 640 }],
] as const) {
  test(`${label} : la pause et les réglages tiennent à l'écran, et l'entrée est dans les réglages tactiles`, async ({ browser }) => {
    const ctx = await browser.newContext({ viewport, hasTouch: true, isMobile: true });
    const page = await ctx.newPage();
    await boot(page, "/?debug&touch=1&zones=1");
    await page.getByRole("button", { name: "Réglages des commandes" }).click();
    await expect(page.locator("#touch-transfer")).toBeVisible();
    await page.locator("#touch-transfer").click();
    await expect(page.locator("#settings")).toBeVisible();
    const panel = await boxes(page, ["#settings .panel"]);
    expectNoOverlap(panel, viewport);
    await page.locator("#settings .close").click();
    await expect(page.locator("#settings")).toBeHidden();
    await ctx.close();
  });
}

test("la fenêtre de pause garde ses boutons côte à côte sans déborder, sur petit écran", async ({ browser }) => {
  const viewport = { width: 360, height: 640 };
  const ctx = await browser.newContext({ viewport });
  const page = await ctx.newPage();
  await boot(page, "/?debug&api=http://127.0.0.1:8787");
  await page.keyboard.press("p");
  await expect(page.locator("#pause")).toBeVisible();
  expectNoOverlap(await boxes(page, ["#pause", "#pause-resume", "#pause-restart", "#pause-settings"]).then((list) => list.filter((b) => b.name === "#pause")), viewport);
  const buttons = await boxes(page, ["#pause-resume", "#pause-restart", "#pause-settings"]);
  expectNoOverlap(buttons, viewport);
  await ctx.close();
});
