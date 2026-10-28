import { mkdirSync } from "node:fs";
import { join } from "node:path";
import { expect, test, type Browser, type BrowserContext, type Page } from "@playwright/test";
import { FIXED_NOW, shiftDate } from "./clock";
import { hasWebGL } from "./phone";

// Captures du lot N2 (le message en direct, côté Jump ; outil, pas un test) : `CAPTURES=1 npx playwright test captures-lot-n2-jump --project=chromium` (dans `apps/jump` ;
// `OUT=…` change le dossier). Chromium, français, paysage 844 × 390 : l'accueil avec un bandeau « information » et un « important » (la réponse de `GET /api/annonce` est
// interceptée : aucun serveur), puis la pause. **Vérifie aussi, en passant** (jamais en CI) : aucun bandeau ni aucune lecture pendant un niveau, le bandeau à la pause, la croix
// de « Important » qui n'apparaît qu'après 10 s, et aucun bandeau sans serveur.
test.skip(!process.env.CAPTURES, "outil de capture : CAPTURES=1");
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(300_000);

const OUT = process.env.OUT ?? join(import.meta.dirname, "../../../docs/plateforme/lots/img");
mkdirSync(OUT, { recursive: true });

interface J {
  phase: string;
  home: { ready: boolean; open: boolean };
  messageEnDirect: { branche: boolean; ecran: string | null; id: number | null; ton: string | null; dessine: boolean; lectures: number };
}
const etat = (page: Page) => page.evaluate(() => (window as unknown as { __jump: J }).__jump.messageEnDirect);

async function telephone(browser: Browser): Promise<BrowserContext> {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, isMobile: true, hasTouch: true, deviceScaleFactor: 2, locale: "fr-FR" });
  await shiftDate(context, FIXED_NOW);
  await context.addInitScript(() => localStorage.setItem("jump:aide", "1"));
  return context;
}

/** Le serveur dit : ce message (`ton`), destiné à Jump ; on compte les lectures. */
async function messageDuServeur(page: Page, ton: "information" | "important"): Promise<{ lectures: () => number }> {
  let n = 0;
  await page.route("**/api/annonce", async (route) => {
    n++;
    const annonce = {
      id: ton === "important" ? 12 : 11,
      fr: ton === "important" ? "Maintenance ce soir à 23 h : le classement sera indisponible une vingtaine de minutes." : "Nouveau : le carnage de tout le monde est à l'arrivée.",
      en: "Live message",
      ou: ["jump"],
      ton,
      fin: FIXED_NOW + 3_600_000,
    };
    await route.fulfill({ status: 200, contentType: "application/json", body: JSON.stringify({ annonce, maintenant: new Date(FIXED_NOW).toISOString() }) });
  });
  return { lectures: () => n };
}

for (const ton of ["information", "important"] as const) {
  test(`accueil, niveau, pause : ${ton}`, async ({ browser }) => {
    const context = await telephone(browser);
    try {
      const page = await context.newPage();
      const serveur = await messageDuServeur(page, ton);
      await page.goto("/?debug&api=/");
      test.skip(!(await hasWebGL(page)), "WebGL indisponible");
      await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
      const bandeau = page.locator("#home .dj-bandeau");
      await expect(bandeau).toBeVisible();
      await expect(bandeau).toHaveAttribute("data-ton", ton);
      await expect(bandeau).toHaveAttribute("role", "status");
      await page.addStyleTag({ content: "#debug, #stamp, #tuned { display: none !important; }" });
      expect((await etat(page)).ecran).toBe("accueil");
      // « Important » : la croix n'apparaît qu'après 10 s ; « Information » : tout de suite.
      const croix = bandeau.locator(".dj-bandeau__fermer");
      if (ton === "important") await expect(croix).toBeHidden();
      else await expect(croix).toBeVisible();
      await page.screenshot({ path: join(OUT, `lot-N2-jump-accueil-${ton}.png`) });
      if (ton === "important") await expect(croix).toBeVisible({ timeout: 15_000 });

      // JOUER : un niveau commence, plus de bandeau, plus aucune lecture.
      await page.locator("#home-play").click();
      await expect(page.locator("#home")).toBeHidden();
      await expect(page.locator(".dj-bandeau")).toHaveCount(0);
      expect((await etat(page)).ecran).toBeNull();
      const lectures = serveur.lectures();
      await page.waitForTimeout(1500);
      expect(serveur.lectures()).toBe(lectures);

      // La pause : un écran où le bandeau a le droit d'être, sans voler le focus de REPRENDRE.
      await page.locator("#pausebtn").click();
      await expect(page.locator("#menu .dj-bandeau")).toBeVisible();
      await expect(page.locator("#menu-resume")).toBeFocused();
      expect((await etat(page)).ecran).toBe("pause");
      if (ton === "information") await page.screenshot({ path: join(OUT, "lot-N2-jump-pause-information.png") });
      await page.locator("#menu-resume").click();
      await expect(page.locator(".dj-bandeau")).toHaveCount(0);
      expect((await etat(page)).ecran).toBeNull();
      const apres = serveur.lectures();
      await page.waitForTimeout(1500);
      expect(serveur.lectures()).toBe(apres);
    } finally {
      await context.close();
    }
  });
}

test("arrivée : pas de bandeau pendant le carnage, le bandeau à l'arrivée", async ({ browser }) => {
  const context = await telephone(browser);
  try {
    const page = await context.newPage();
    const serveur = await messageDuServeur(page, "important");
    await page.goto("/?debug&api=/");
    test.skip(!(await hasWebGL(page)), "WebGL indisponible");
    await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
    await page.locator("#home-play").click();
    // La preuve de l'auteur, pas à pas, jusqu'au carnage : un niveau, puis une rediffusion — jamais de bandeau ni de lecture.
    const lecturesAvant = serveur.lectures();
    await page.evaluate(() => {
      const j = window as unknown as { __jump: { manual(on: boolean): void; autoplay(): number; advance(n: number): void; phase: string; input(b: number | null): void } };
      j.__jump.manual(true);
      const n = j.__jump.autoplay();
      for (let t = 1; t <= n + 10 && j.__jump.phase !== "carnage"; t++) j.__jump.advance(1);
    });
    expect((await page.evaluate(() => (window as unknown as { __jump: J & { phase: string } }).__jump.phase))).toBe("carnage");
    expect((await etat(page)).ecran).toBeNull();
    await expect(page.locator(".dj-bandeau")).toHaveCount(0);
    expect(serveur.lectures()).toBe(lecturesAvant);
    // Un appui passe le carnage : l'arrivée s'ouvre, le bandeau y est.
    await page.evaluate(() => {
      const j = (window as unknown as { __jump: { input(b: number | null): void; advance(n: number): void } }).__jump;
      j.input(0);
      j.advance(1);
      j.input(2);
      j.advance(1);
      j.input(null);
    });
    await expect(page.locator("#arrival")).toBeVisible();
    await expect(page.locator("#arrival .dj-bandeau")).toBeVisible();
    expect((await etat(page)).ecran).toBe("arrivee");
    await page.screenshot({ path: join(OUT, "lot-N2-jump-arrivee-important.png") });
    await page.locator("#arrival-replay").click();
    await expect(page.locator(".dj-bandeau")).toHaveCount(0);
    expect((await etat(page)).ecran).toBeNull();
  } finally {
    await context.close();
  }
});

test("sans serveur : aucun bandeau, rien ne casse", async ({ browser }) => {
  const context = await telephone(browser);
  try {
    const page = await context.newPage();
    let lu = 0;
    await page.route("**/api/annonce", (route) => (lu++, route.abort()));
    await page.goto("/?debug");
    test.skip(!(await hasWebGL(page)), "WebGL indisponible");
    await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.home.ready === true);
    await expect(page.locator(".dj-bandeau")).toHaveCount(0);
    expect((await etat(page)).branche).toBe(false);
    expect(lu).toBe(0);
  } finally {
    await context.close();
  }
});
