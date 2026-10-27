import { expect, test, type Page } from "@playwright/test";
import { Fingers, hasWebGL, withPhone } from "./phone";

// Lot 1b : DailyJump jouable sur téléphone. Téléphone émulé (écran tactile, portrait et paysage), doigts posés un par un.
// Chromium : vrais événements tactiles par le protocole (`Input.dispatchTouchEvent`, ils deviennent des pointer events comme sur un téléphone) ;
// Firefox et WebKit n'ont pas ce protocole : les mêmes doigts sont envoyés en pointer events sur la couche tactile (la logique testée est la même).
// Pas à pas (`manual` + `advance`), jamais sur une durée.

interface PlayerView {
  x: number;
  y: number;
  vx: number;
  vy: number;
  ground: boolean;
}
interface TouchView {
  active: boolean;
  fingers: { id: number; role: string; x: number; y: number }[];
  bits: number;
  paused: boolean;
  panelOpen: boolean;
  viewTiles: number;
}
interface JumpPlay {
  phase: string;
  player: PlayerView;
  touch: TouchView;
  ticks: number;
  manual(on: boolean): void;
  advance(n: number): PlayerView;
  input(bits: number | null): void;
}
const jumpOf = (page: Page) => page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump);
const player = (page: Page) => page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.player);
const touchView = (page: Page) => page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.touch);
const advance = (page: Page, n: number) => page.evaluate((k) => (window as unknown as { __jump: JumpPlay }).__jump.advance(k), n);

const LEFT = 1;
const RIGHT = 2;
const JUMP = 4;

const PORTRAIT = { width: 390, height: 844 };
const LANDSCAPE = { width: 844, height: 390 };
// Lot R13 (docs/tests.md) : le paysage (Jump s'y joue) et le portrait (l'écran qu'on ouvre, avec l'invitation à tourner) ; le petit écran en portrait est
// retiré, et la logique des doigts (toucher, glisser, bande haute, cadrage) est dans test/touch.test.ts.
const FORMATS = [
  { name: "portrait", viewport: PORTRAIT },
  { name: "paysage", viewport: LANDSCAPE },
] as const;

/** Ouvre le bac à sable en pas à pas. `extra` : paramètres d'adresse en plus (ex. `&touch=1`). Rend faux si WebGL manque. */
async function open(page: Page, extra: string): Promise<boolean> {
  await page.goto(`/?scenario=bac-a-sable&debug${extra}`);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
  await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.manual(true));
  return true;
}

for (const format of FORMATS) {
  const { width: W, height: H } = format.viewport;
  // Points de pose (sous la bande haute) : ← dans le premier quart, → dans le deuxième, saut dans la moitié droite.
  const at = { left: [W * 0.12, H * 0.75], right: [W * 0.37, H * 0.75], jump: [W * 0.75, H * 0.75], band: [W * 0.5, 20] } as const;

  test.describe(format.name, { tag: "@regression" }, () => {

    test("toutes les cibles font au moins 44 px, réglages ouverts compris", async ({ browser }) => {
      await withPhone(browser, format.viewport, async (page) => {
        test.skip(!(await open(page, "&touch=1&tune")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
        const targets = async (selector: string) => {
          const found: { name: string; w: number; h: number }[] = [];
          for (const el of await page.locator(selector).all()) {
            if (!(await el.isVisible())) continue;
            const b = (await el.boundingBox())!;
            found.push({ name: (await el.getAttribute("id")) ?? (await el.getAttribute("class")) ?? selector, w: b.width, h: b.height });
          }
          return found;
        };
        const closed = await targets("button, .tbtn");
        expect(closed.map((t) => t.name)).toEqual(expect.arrayContaining(["pausebtn", "gear"]));
        expect(closed.filter((t) => t.name.includes("tbtn"))).toHaveLength(3); // ←, →, saut
        for (const t of closed) {
          expect(t.w, `${t.name} largeur`).toBeGreaterThanOrEqual(44);
          expect(t.h, `${t.name} hauteur`).toBeGreaterThanOrEqual(44);
        }
        await page.locator("#gear").tap();
        await expect(page.locator("#tune")).toBeVisible();
        const panel = await targets("#tune button, #tune input[type=range]");
        expect(panel.length).toBeGreaterThan(20); // 20 curseurs, fermer, copier, réinitialiser
        for (const t of panel) {
          expect(t.w, `${t.name} largeur`).toBeGreaterThanOrEqual(44);
          expect(t.h, `${t.name} hauteur`).toBeGreaterThanOrEqual(44);
        }
      });
    });

    test("la page ne défile pas, ne rebondit pas, ne se zoome pas", async ({ browser }) => {
      await withPhone(browser, format.viewport, async (page) => {
        test.skip(!(await open(page, "&touch=1&tune")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
        const geometry = () =>
          page.evaluate(() => {
            const d = document.documentElement;
            return { scrollW: d.scrollWidth, clientW: d.clientWidth, scrollH: d.scrollHeight, clientH: d.clientHeight, bodyH: document.body.scrollHeight };
          });
        const g = await geometry();
        expect(g.scrollW).toBeLessThanOrEqual(g.clientW);
        expect(g.scrollH).toBeLessThanOrEqual(g.clientH);
        expect(g.bodyH).toBeLessThanOrEqual(g.clientH);
        // Un balayage vertical sur le jeu, puis une demande de défilement : la page reste en place.
        const fingers = await Fingers.on(page);
        await fingers.down(1, ...at.jump);
        await fingers.move(1, at.jump[0], H * 0.4);
        await fingers.move(1, at.jump[0], H * 0.65);
        await fingers.up(1);
        await page.evaluate(() => window.scrollTo(0, 500));
        const scrolled = await page.evaluate(() => ({ y: window.scrollY, x: window.scrollX, vv: window.visualViewport?.scale ?? 1 }));
        expect(scrolled).toEqual({ y: 0, x: 0, vv: 1 });
        const styles = await page.evaluate(() => {
          const b = getComputedStyle(document.body);
          const h = getComputedStyle(document.documentElement);
          return {
            bodyTouchAction: b.touchAction,
            htmlTouchAction: h.touchAction,
            overscrollBody: b.overscrollBehaviorY,
            overscrollHtml: h.overscrollBehaviorY,
            select: b.userSelect || (b as CSSStyleDeclaration & { webkitUserSelect?: string }).webkitUserSelect || "",
            layerTouchAction: getComputedStyle(document.getElementById("touch")!).touchAction,
            viewport: document.querySelector('meta[name="viewport"]')?.getAttribute("content") ?? "",
          };
        });
        expect(styles).toMatchObject({ bodyTouchAction: "none", htmlTouchAction: "none", overscrollBody: "none", overscrollHtml: "none", select: "none", layerTouchAction: "none" });
        expect(styles.viewport).toContain("viewport-fit=cover");
        // Appui long : pas de menu contextuel ni de sélection.
        const prevented = await page.evaluate(() => {
          const e = new MouseEvent("contextmenu", { bubbles: true, cancelable: true });
          document.getElementById("touch")!.dispatchEvent(e);
          return e.defaultPrevented;
        });
        expect(prevented).toBe(true);
        expect(await page.evaluate(() => String(getSelection()))).toBe("");
      });
    });

    test("l'invitation à tourner le téléphone n'apparaît qu'en portrait, sans rien bloquer", async ({ browser }) => {
      await withPhone(browser, format.viewport, async (page) => {
        test.skip(!(await open(page, "&touch=1")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
        const notice = page.locator("#rotate");
        if (W < H) {
          await expect(notice).toBeVisible();
          await expect(notice).toHaveText("Tourne ton téléphone : Jump se joue mieux en paysage"); // lot I5 : hud.tourner du catalogue
          expect(await notice.evaluate((e) => getComputedStyle(e.parentElement!).pointerEvents)).toBe("none");
          // Le jeu reste jouable : le premier toucher de jeu la retire.
          const fingers = await Fingers.on(page);
          await fingers.down(1, ...at.right);
          await expect(notice).toBeHidden();
          await fingers.up(1);
        } else await expect(notice).toBeHidden();
      });
    });
  });
}

test.describe("réglages au doigt (?debug&tune)", { tag: "@regression" }, () => {
  test("le panneau est replié derrière ⚙ ; ouvert, il met la partie en pause et la couche de jeu ne capte plus rien", async ({ browser }) => {
    await withPhone(browser, LANDSCAPE, async (page) => {
      test.skip(!(await open(page, "&touch=1&tune")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
      await page.evaluate(() => localStorage.removeItem("jump:tune"));
      await expect(page.locator("#tune")).toBeHidden();
      await expect(page.locator("#gear")).toBeVisible();
      // Hors du pas à pas : la boucle joue tant que le panneau est fermé.
      await page.evaluate(() => {
        const j = (window as unknown as { __jump: JumpPlay }).__jump;
        j.manual(false);
        j.input(2);
      });
      await page.waitForFunction(() => (window as unknown as { __jump: JumpPlay }).__jump.ticks > 10);
      await page.locator("#gear").tap();
      await expect(page.locator("#tune")).toBeVisible();
      expect((await touchView(page)).paused).toBe(true);
      const frozen = (await jumpOf(page)).ticks;
      await page.waitForTimeout(400); // « rien ne doit changer pendant 400 ms »
      expect((await jumpOf(page)).ticks).toBe(frozen);
      // La couche tactile est coupée : un doigt qui lui arrive quand même n'est pas pris.
      expect(await page.locator("#touch").evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
      const fingers = await Fingers.on(page);
      await fingers.down(1, LANDSCAPE.width * 0.75, 300);
      expect((await touchView(page)).fingers).toHaveLength(0);
      // Fermer : la partie reprend.
      await page.getByRole("button", { name: "Fermer les réglages" }).tap();
      await expect(page.locator("#tune")).toBeHidden();
      await page.waitForFunction((t) => (window as unknown as { __jump: JumpPlay }).__jump.ticks > t, frozen);
      expect((await touchView(page)).paused).toBe(false);
    });
  });

  test("un curseur se règle au doigt ; « Copier les valeurs » donne le JSON dans une zone sélectionnée si le presse-papiers refuse", async ({ browser }) => {
    await withPhone(browser, PORTRAIT, async (page) => {
      await page.addInitScript(() => {
        // Presse-papiers refusé et copie classique impossible : le repli doit s'afficher.
        Object.defineProperty(navigator, "clipboard", { value: { writeText: () => Promise.reject(new Error("refusé")) }, configurable: true });
        document.execCommand = () => false;
      });
      test.skip(!(await open(page, "&touch=1&tune")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
      await page.evaluate(() => localStorage.removeItem("jump:tune"));
      await page.locator("#gear").tap();
      const slider = page.locator('#tune input[data-key="gravity"]');
      await slider.scrollIntoViewIfNeeded();
      const before = await slider.inputValue();
      const box = (await slider.boundingBox())!;
      const fingers = await Fingers.on(page);
      if (page.context().browser()?.browserType().name() === "chromium") {
        // Vrai glissement du doigt sur le curseur (la poignée est au pourcentage de la valeur).
        await fingers.down(1, box.x + box.width * 0.1, box.y + box.height / 2);
        await fingers.move(1, box.x + box.width * 0.5, box.y + box.height / 2);
        await fingers.move(1, box.x + box.width * 0.8, box.y + box.height / 2);
        await fingers.up(1);
        expect(Number(await slider.inputValue())).not.toBe(Number(before));
      } else {
        await slider.fill("33");
        expect(await slider.inputValue()).toBe("33");
      }
      expect(await page.evaluate(() => (window as unknown as { __jump: { params: { gravity: number } } }).__jump.params.gravity)).toBe(Number(await slider.inputValue()));
      await page.getByRole("button", { name: "Copier les valeurs" }).tap();
      const area = page.locator("#tune textarea.json");
      await expect(area).toBeVisible();
      const json = JSON.parse(await area.inputValue()) as Record<string, number>;
      expect(Object.keys(json)).toContain("gravity");
      const selected = await area.evaluate((t: HTMLTextAreaElement) => t.selectionEnd - t.selectionStart === t.value.length && t.value.length > 0);
      expect(selected).toBe(true);
    });
  });

  test("la surimpression de debug est lisible : sous la bande haute, dans l'écran, sans toucher les boutons", async ({ browser }) => {
    for (const viewport of [LANDSCAPE]) {
      await withPhone(browser, viewport, async (page) => {
        test.skip(!(await open(page, "&touch=1&tune")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
        const debug = (await page.locator("#debug").boundingBox())!;
        expect(debug.y, "sous la bande haute").toBeGreaterThanOrEqual(60);
        expect(debug.x).toBeGreaterThanOrEqual(0);
        expect(debug.x + debug.width, "dans l'écran").toBeLessThanOrEqual(viewport.width);
        expect(debug.y + debug.height).toBeLessThanOrEqual(viewport.height);
        expect(await page.locator("#debug").evaluate((e) => Number.parseFloat(getComputedStyle(e).fontSize))).toBeGreaterThanOrEqual(10);
        expect(await page.locator("#debug").evaluate((e) => getComputedStyle(e).pointerEvents)).toBe("none");
        for (const sel of ["#pausebtn", "#gear"]) {
          const b = (await page.locator(sel).boundingBox())!;
          const overlap = Math.min(debug.x + debug.width, b.x + b.width) > Math.max(debug.x, b.x) && Math.min(debug.y + debug.height, b.y + b.height) > Math.max(debug.y, b.y);
          expect(overlap, `${sel} chevauche la surimpression`).toBe(false);
        }
      });
    }
  });
});

test.describe("détection de l'écran tactile", () => {
  test("sur un téléphone (pointeur grossier), l'interface tactile s'installe d'elle-même ; les boutons attendent le premier toucher", async ({ browser, browserName }) => {
    test.skip(browserName !== "chromium", "Seul Chromium émule `pointer: coarse` : Firefox et WebKit passent par ?touch=1 dans les autres tests");
    await withPhone(browser, LANDSCAPE, async (page) => {
      test.skip(!(await open(page, "")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
      expect((await touchView(page)).active).toBe(true);
      await expect(page.locator("#pausebtn")).toBeVisible();
      await expect(page.locator(".tbtn").first()).toBeHidden();
      await page.touchscreen.tap(700, 300);
      await expect(page.locator(".tbtn")).toHaveCount(3);
      await expect(page.locator(".tbtn").first()).toBeVisible();
    });
  });

  test("?zones=1 dessine les zones et un point par doigt", { tag: "@regression" }, async ({ browser }) => {
    await withPhone(browser, LANDSCAPE, async (page) => {
      test.skip(!(await open(page, "&touch=1&zones=1")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
      await expect(page.locator("#zones .zone")).toHaveCount(4); // bande, ←, →, saut
      const fingers = await Fingers.on(page);
      await fingers.down(1, 100, 300);
      await expect(page.locator("#zones .dot")).toHaveCount(1);
      await fingers.up(1);
      await expect(page.locator("#zones .dot")).toHaveCount(0);
    });
  });
});
