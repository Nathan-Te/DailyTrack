import { expect, test, type Page } from "@playwright/test";
import { FIXED_NOW, atInstant } from "./clock";
import { SURIMPRESSIONS, boxes, expectCentreLibre, expectNoOverlap } from "./layout";
import { hasWebGL } from "./phone";

// Lot I5 (charte rév. 7, § 9 ; maquette jump-hud.html) : les surimpressions en partie sont compactes et le centre reste libre. Téléphone émulé en paysage
// (le format du jeu) et en portrait, au doigt (`?touch=1`) ; le niveau du jour à l'horloge fixe ; pas à pas (`manual` + `advance`), jamais sur une durée.
//   - une seule bande de 30 px au centre en haut (chrono · point de passage · écart), la pause de 44 px en haut à gauche, l'objectif et l'autocollant des morts
//     en haut à droite ; les boutons tactiles aux bords (les boutons par défaut, comme au lot 1b) ; rien ne se chevauche, rien n'entre dans la zone du personnage ;
//   - le titre du niveau seulement au départ ; le chrono ne fait jamais bouger la bande ; le DOM du HUD n'est écrit que quand un texte change ;
//   - la pause : REPRENDRE, les actions rares (fantôme, son…), les Réglages dans le cadre crème, « ‹ JUMP » y ramène.

interface J {
  phase: string;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
  attempt: { deaths: number; time: number; checkpoints: number };
  menu: { open: boolean };
  settings: { sound: boolean; firstGhost: boolean };
  ghost: { enabled: boolean };
}
const jump = (page: Page) => page.evaluate(() => (window as unknown as { __jump: J }).__jump);
const RIGHT = 2;
const JUMP = 4;

// Lot R13 (docs/tests.md) : deux formats (téléphone en paysage, ordinateur) et le portrait là où l'écran s'y affiche ; 740×360 et 360×640 sont retirés.
const FORMATS = [
  { name: "paysage 844 × 390", viewport: { width: 844, height: 390 } },
  { name: "portrait 390 × 844", viewport: { width: 390, height: 844 } },
] as const;

async function open(page: Page, extra = ""): Promise<boolean> {
  await page.goto(`/?accueil=0&debug&touch=1${extra}`);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => (window as unknown as { __jump?: J }).__jump?.phase === "ready");
  await page.evaluate(() => (window as unknown as { __jump: J }).__jump.manual(true));
  return true;
}

for (const f of FORMATS) {
  test(`HUD compact (${f.name}) : la bande, la pause, l'objectif, les morts, les boutons aux bords ; rien ne se chevauche, le centre reste libre`, async ({ browser }) => {
    await atInstant(
      browser,
      FIXED_NOW,
      async (page) => {
        test.skip(!(await open(page)), "WebGL indisponible");
        // La surimpression `?debug` n'est pas l'interface : on la cache pour mesurer.
        await page.addStyleTag({ content: "#debug, #stamp, #tuned { display: none !important; }" });
        // Une mort pour que l'autocollant change, puis la course : la bande et les plaques à leur place de partie.
        await page.evaluate(([right]) => {
          const j = (window as unknown as { __jump: J }).__jump;
          j.input(right);
          j.advance(240);
          j.input(0);
        }, [RIGHT] as const);
        const bande = (await page.locator("#chrono").boundingBox())!;
        expect(Math.round(bande.height), "la bande fait 30 px de haut").toBe(30);
        expect(Math.abs(bande.x + bande.width / 2 - f.viewport.width / 2), "la bande est centrée").toBeLessThan(2);
        expect(bande.y, "en haut").toBeLessThan(16);
        const pause = (await page.locator("#pausebtn").boundingBox())!;
        expect(pause.width).toBeGreaterThanOrEqual(44);
        expect(pause.height).toBeGreaterThanOrEqual(44);
        expect(pause.x, "la pause en haut à gauche").toBeLessThan(f.viewport.width * 0.1);
        const morts = (await page.locator("#morts").boundingBox())!;
        expect(morts.x + morts.width, "les morts en haut à droite").toBeGreaterThan(f.viewport.width * 0.9);
        await expect(page.locator("#objectif")).toBeVisible();
        await expect(page.locator("#objectif .dj-medaille")).toHaveCount(1);
        // Les boutons tactiles : ceux du lot 1b (gauche, droite, saut), aux bords ; le saut en bas à droite, gros et jaune.
        await expect(page.locator(".tbtn")).toHaveCount(3);
        const saut = (await page.locator(".tbtn--jump").boundingBox())!;
        expect(saut.x + saut.width, "SAUT contre le bord droit").toBeGreaterThan(f.viewport.width - 20);
        for (const sel of [".tbtn--left", ".tbtn--right"]) expect((await page.locator(sel).boundingBox())!.x, `${sel} à gauche`).toBeLessThan(f.viewport.width * 0.5);
        for (const b of await boxes(page, ["#pausebtn", ".tbtn"])) {
          expect(b.w, `${b.name} : cible de 44 px`).toBeGreaterThanOrEqual(44);
          expect(b.h, `${b.name} : cible de 44 px`).toBeGreaterThanOrEqual(44);
        }
        const list = await boxes(page, SURIMPRESSIONS.filter((s) => s !== "#dayline" && s !== "#toast" && s !== "#rotate"));
        expectNoOverlap(list, f.viewport);
        expectCentreLibre(await boxes(page, SURIMPRESSIONS), f.viewport);
      },
      { viewport: f.viewport, hasTouch: true, isMobile: browser.browserType().name() === "chromium", deviceScaleFactor: 1 },
    );
  });
}

test("le titre du niveau seulement au départ ; le chrono ne fait jamais bouger la bande ; le DOM du HUD n'est écrit que quand un texte change", async ({ browser }) => {
  await atInstant(
    browser,
    FIXED_NOW,
    async (page) => {
      test.skip(!(await open(page)), "WebGL indisponible");
      await expect(page.locator("#dayline")).toBeVisible();
      await expect(page.locator("#dayline")).toContainText("Jump n° 5");
      const avant = (await page.locator("#chrono").boundingBox())!;
      // Aucun changement : aucune écriture dans le HUD pendant une seconde d'images (la partie attend la première commande).
      const ecritures = await page.evaluate(
        () =>
          new Promise<number>((done) => {
            let n = 0;
            const obs = new MutationObserver((m) => (n += m.length));
            for (const id of ["chrono", "hud-droite", "hud-gauche"]) obs.observe(document.getElementById(id)!, { subtree: true, childList: true, characterData: true, attributes: true });
            setTimeout(() => (obs.disconnect(), done(n)), 1000);
          }),
      );
      expect(ecritures, "le HUD n'est pas réécrit quand rien ne change").toBe(0);
      // La course commence : le titre s'efface (2,5 s d'horloge de la page), le chrono change sans que la bande change de taille.
      await page.evaluate(([right, jumpBit]) => {
        const j = (window as unknown as { __jump: J }).__jump;
        j.input(right | jumpBit);
        j.advance(30);
        j.input(right);
        j.advance(90);
      }, [RIGHT, JUMP] as const);
      await page.waitForFunction(() => document.getElementById("dayline")!.hidden, undefined, { timeout: 15_000 });
      const apres = (await page.locator("#chrono").boundingBox())!;
      expect(apres.width, "la bande garde sa largeur quand le chrono change").toBeCloseTo(avant.width, 0);
      await expect(page.locator("#chrono .time")).toHaveAttribute("aria-label", /^\d+,\d{3}$/);
    },
    { viewport: { width: 844, height: 390 }, hasTouch: true },
  );
});

test("la pause : sur la scène sous le voile à rayures ; REPRENDRE, fantôme, son ; Réglages dans le cadre crème, « ‹ JUMP » y ramène", async ({ browser }) => {
  await atInstant(
    browser,
    FIXED_NOW,
    async (page) => {
      test.skip(!(await open(page)), "WebGL indisponible");
      await page.locator("#pausebtn").tap();
      await expect(page.locator("#menu")).toBeVisible();
      expect((await jump(page)).menu.open).toBe(true);
      await expect(page.locator("#menu .dialogue__titre")).toHaveText("PAUSE");
      await expect(page.locator("#menu-resume")).toBeFocused();
      // Le fantôme et le son : des réglages mémorisés, le bouton dit l'état.
      const ghost = (await jump(page)).ghost.enabled;
      await page.locator("#menu-ghost").tap();
      expect((await jump(page)).ghost.enabled).toBe(!ghost);
      await expect(page.locator("#menu-ghost")).toHaveText(ghost ? "Fantôme : non" : "Fantôme : oui");
      await page.locator("#menu-sound").tap();
      expect((await jump(page)).settings.sound).toBe(false);
      await expect(page.locator("#menu-sound")).toHaveText("Son : non");
      // Toutes les actions : des cibles de 44 px, dans l'écran.
      for (const b of await boxes(page, ["#menu button:visible", "#menu a:visible"])) {
        expect(b.h, `${b.name} : 44 px`).toBeGreaterThanOrEqual(44);
        expect(b.y + b.h, `${b.name} : dans l'écran (ou le dialogue défile)`).toBeGreaterThan(0);
      }
      // Les Réglages : un écran du cadre crème, au-dessus de la pause ; « ‹ JUMP » le ferme et la pause revient.
      await page.locator("#menu-settings").tap();
      await expect(page.locator("#settings")).toBeVisible();
      await expect(page.locator("#settings .dj-barre-jeu__retour")).toContainText("JUMP");
      await expect(page.locator("#settings-profil")).toHaveAttribute("href", "../profil/?retour=%2F");
      await page.locator("#settings .dj-barre-jeu__retour").tap();
      await expect(page.locator("#settings")).toBeHidden();
      await expect(page.locator("#menu")).toBeVisible();
      await page.locator("#menu-resume").tap();
      await expect(page.locator("#menu")).toBeHidden();
      expect((await jump(page)).menu.open).toBe(false);
    },
    { viewport: { width: 844, height: 390 }, hasTouch: true },
  );
});
