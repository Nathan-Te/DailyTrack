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
  fingers: { id: number; zone: string; x: number; y: number }[];
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
  // Points de pose (sous la bande haute) : ← contre le bord gauche, → entre les flèches et la moitié (la frontière suit les flèches), saut dans la moitié droite.
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
        expect(closed.filter((t) => t.name.startsWith("tbtn"))).toHaveLength(3); // ←, →, saut
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

  test("Réglages › Taille des boutons : les boutons changent tout de suite, la frontière ← / → les suit, le choix est gardé", async ({ browser }) => {
    await withPhone(browser, LANDSCAPE, async (page) => {
      test.skip(!(await open(page, "&touch=1")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
      const largeur = async (sel: string) => (await page.locator(sel).boundingBox())!.width;
      expect(await largeur(".tbtn--left")).toBe(76);
      expect(await largeur(".tbtn--jump")).toBe(110);
      await page.locator("#pausebtn").tap();
      await page.locator("#menu-settings").tap();
      const taille = (v: string) => page.locator(`#settings [data-setting="buttonSize"] [data-value="${v}"]`);
      await expect(taille("medium")).toHaveAttribute("aria-pressed", "true");
      await taille("large").tap();
      await expect.poll(() => largeur(".tbtn--left")).toBe(99);
      expect(await largeur(".tbtn--jump")).toBe(143);
      await taille("small").tap();
      await expect.poll(() => largeur(".tbtn--left")).toBe(55);
      // Le choix est écrit pour le prochain chargement ; les zones de toucher suivent les flèches (le doigt entre les deux boutons).
      expect(await page.evaluate(() => JSON.parse(localStorage.getItem("jump:settings") ?? "{}").buttonSize)).toBe("small");
      const right = (await page.locator(".tbtn--right").boundingBox())!;
      expect(right.x).toBe(24 + 55 + 24);
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

// Lot 29 — commandes tactiles fiables : aucune touche ne reste tenue sans un doigt posé dessus. Doigts émulés (Chromium : vrais touchers du protocole, avec leurs
// pointer events **et** leurs touch events ; Firefox et WebKit : pointer events sur la couche), état lu dans la page : les bits de commande que le jeu reçoit
// et la ligne de `?debug` (`#touchdebug`), toujours après chaque geste. La logique fine (zones, doigts qui glissent, lever perdu) est dans `test/touch.test.ts`, qui
// garde chaque PR. **Famille « Régression »** : le budget de 900 s de la CI de PR n'a plus de marge (`apps/web/test/ciZones.test.ts` : une PR large reporterait un spec),
// ces e2e (≈ 30 s) tournent la nuit, par « Run workflow » et dans la CI complète du bouton « Mettre en production ».
test.describe("commandes tactiles fiables (lot 29)", { tag: "@regression" }, () => {
  const { width: W, height: H } = LANDSCAPE;
  const at = { left: [W * 0.12, H * 0.75], right: [W * 0.37, H * 0.75], jump: [W * 0.75, H * 0.75], band: [W * 0.5, 20] } as const;
  const AUCUNE = "doigts 0 · aucune touche tenue";

  /** Ce que le jeu reçoit : les bits de commande, le nombre de doigts suivis, la ligne de `?debug`. */
  const held = async (page: Page) => {
    const view = await touchView(page);
    return { bits: view.bits, fingers: view.fingers.length, line: (await page.locator("#touchdebug").textContent()) ?? "" };
  };
  /** Un événement de pointeur sur la couche tactile (une souris, un doigt fantôme, une perte de capture…). */
  const fire = (page: Page, type: string, init: Record<string, unknown>) =>
    page.evaluate(([t, i]) => document.getElementById("touch")!.dispatchEvent(new PointerEvent(t as string, { bubbles: true, cancelable: true, ...(i as object) })), [type, init] as const);
  const phone = async (browser: Parameters<typeof withPhone>[0], run: (page: Page) => Promise<void>) =>
    withPhone(browser, LANDSCAPE, async (page) => {
      test.skip(!(await open(page, "&touch=1")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
      await run(page);
    });

  test("glisser de ← à → sans lever le doigt : ← se relâche, → s'enfonce ; lever : aucune touche tenue", async ({ browser }) => {
    await phone(browser, async (page) => {
      const fingers = await Fingers.on(page);
      await fingers.down(1, ...at.left);
      expect(await held(page)).toEqual({ bits: LEFT, fingers: 1, line: "doigts 1 · ← tenue" });
      await fingers.move(1, ...at.right);
      expect(await held(page)).toEqual({ bits: RIGHT, fingers: 1, line: "doigts 1 · → tenue" });
      await fingers.move(1, ...at.jump);
      expect(await held(page)).toEqual({ bits: JUMP, fingers: 1, line: "doigts 1 · SAUT tenue" });
      await fingers.move(1, ...at.left);
      expect((await held(page)).bits).toBe(LEFT);
      await fingers.up(1);
      expect(await held(page)).toEqual({ bits: 0, fingers: 0, line: AUCUNE });
    });
  });

  test("glisser du bouton vers l'extérieur (la bande haute) le relâche ; revenir l'enfonce de nouveau ; lever : rien", async ({ browser }) => {
    await phone(browser, async (page) => {
      const fingers = await Fingers.on(page);
      await fingers.down(1, ...at.right);
      expect((await held(page)).bits).toBe(RIGHT);
      await fingers.move(1, ...at.band);
      expect(await held(page)).toEqual({ bits: 0, fingers: 1, line: "doigts 1 · aucune touche tenue" });
      await fingers.move(1, ...at.left);
      expect((await held(page)).bits).toBe(LEFT);
      await fingers.up(1);
      expect(await held(page)).toEqual({ bits: 0, fingers: 0, line: AUCUNE });
    });
  });

  test("annulation par le système (centre de contrôle, notification, appel) : tout est relâché", async ({ browser }) => {
    await phone(browser, async (page) => {
      const fingers = await Fingers.on(page);
      await fingers.down(1, ...at.left);
      await fingers.down(2, ...at.jump);
      expect((await held(page)).bits).toBe(LEFT | JUMP);
      await fingers.cancel();
      expect(await held(page)).toEqual({ bits: 0, fingers: 0, line: `${AUCUNE} · dernier relâchement : annulation` });
      // Le doigt posé ensuite est tenu normalement.
      await fingers.down(3, ...at.right);
      expect((await held(page)).bits).toBe(RIGHT);
      await fingers.up(3);
      expect((await held(page)).bits).toBe(0);
    });
  });

  test("`touchcancel` seul (le `pointercancel` s'est perdu) et lever perdu : la liste des touchers du système rattrape le doigt fantôme", async ({ browser, browserName }) => {
    test.skip(browserName !== "chromium", "Firefox et WebKit n'émulent pas les événements tactiles : la réconciliation se teste en unitaire (test/touch.test.ts)");
    await phone(browser, async (page) => {
      // Un doigt fantôme : posé, jamais levé (le lever s'est perdu).
      await fire(page, "pointerdown", { pointerId: 555, pointerType: "touch", clientX: at.left[0], clientY: at.left[1] });
      expect((await held(page)).bits).toBe(LEFT);
      await page.evaluate(() => window.dispatchEvent(new TouchEvent("touchcancel", { touches: [], bubbles: true })));
      expect(await held(page)).toEqual({ bits: 0, fingers: 0, line: `${AUCUNE} · dernier relâchement : annulation` });
      // Le même fantôme, rattrapé par le toucher suivant : dès que le système n'en compte plus qu'un (ou aucun), le fantôme part.
      await fire(page, "pointerdown", { pointerId: 556, pointerType: "touch", clientX: at.left[0], clientY: at.left[1] });
      const fingers = await Fingers.on(page);
      await fingers.down(1, ...at.jump);
      await fingers.up(1);
      const apres = await held(page);
      expect({ bits: apres.bits, fingers: apres.fingers }).toEqual({ bits: 0, fingers: 0 });
      expect(apres.line).toContain(AUCUNE);
    });
  });

  test("perte de capture du pointeur : le doigt est relâché ; l'événement tardif d'un identifiant réutilisé ne lève pas le doigt suivant", async ({ browser, browserName }) => {
    await phone(browser, async (page) => {
      const fingers = await Fingers.on(page);
      // La capture est libérée (Chromium : une vraie, que la couche tenait) puis l'événement arrive, comme au bout d'un geste du système. Chromium ne l'envoie
      // pas toujours de lui-même pour le toucher (la capture implicite se libère sans) : le doigt reste de toute façon suivi par la fenêtre.
      const perdre = (id: number) =>
        page.evaluate((i) => {
          const layer = document.getElementById("touch")!;
          try {
            layer.releasePointerCapture(i);
          } catch {
            /* le doigt émulé (Firefox, WebKit) n'a jamais eu de capture */
          }
          layer.dispatchEvent(new PointerEvent("lostpointercapture", { pointerId: i }));
        }, id);
      await fingers.down(1, ...at.right);
      const id = (await touchView(page)).fingers[0]!.id;
      await perdre(id);
      expect(await held(page)).toEqual({ bits: 0, fingers: 0, line: `${AUCUNE} · dernier relâchement : perte de capture` });
      await fingers.up(1);
      if (browserName !== "chromium") return;
      // Un doigt levé puis reposé (même identifiant côté système) : la couche tient ce pointeur, l'ancien événement de perte ne dit rien du nouveau.
      await fingers.down(1, ...at.left);
      const neuf = (await touchView(page)).fingers[0]!.id;
      await fire(page, "lostpointercapture", { pointerId: neuf });
      expect((await held(page)).bits).toBe(LEFT);
      await fingers.up(1);
      expect((await held(page)).bits).toBe(0);
    });
  });

  test("perte de focus, changement de visibilité, pagehide, rotation : tout est relâché, chaque fois", async ({ browser }) => {
    await phone(browser, async (page) => {
      const fingers = await Fingers.on(page);
      const causes: [string, () => Promise<unknown>][] = [
        ["focus", () => page.evaluate(() => window.dispatchEvent(new Event("blur")))],
        ["visibilité", () => page.evaluate(() => document.dispatchEvent(new Event("visibilitychange")))],
        ["pagehide", () => page.evaluate(() => window.dispatchEvent(new Event("pagehide")))],
        ["rotation", () => page.evaluate(() => window.dispatchEvent(new Event("orientationchange")))],
      ];
      for (const [cause, fire_] of causes) {
        await fingers.down(1, ...at.left);
        await fingers.down(2, ...at.jump);
        expect((await held(page)).bits, cause).toBe(LEFT | JUMP);
        await fire_();
        expect(await held(page), cause).toEqual({ bits: 0, fingers: 0, line: `${AUCUNE} · dernier relâchement : ${cause}` });
        await fingers.up(2); // le lever qui arrive ensuite est sans effet
        await fingers.up(1);
        expect((await held(page)).bits, cause).toBe(0);
      }
    });
  });

  test("deux doigts : l'un levé puis l'autre, dans les deux ordres, rien ne reste tenu", async ({ browser }) => {
    await phone(browser, async (page) => {
      const fingers = await Fingers.on(page);
      for (const order of [[1, 2], [2, 1]] as const) {
        await fingers.down(1, ...at.left);
        await fingers.down(2, ...at.jump);
        expect(await held(page)).toEqual({ bits: LEFT | JUMP, fingers: 2, line: "doigts 2 · ← et SAUT tenues" });
        await fingers.move(1, ...at.right); // le premier glisse sur →
        expect((await held(page)).bits).toBe(RIGHT | JUMP);
        await fingers.up(order[0]);
        expect((await held(page)).bits).toBe(order[0] === 1 ? JUMP : RIGHT);
        await fingers.up(order[1]);
        expect(await held(page)).toEqual({ bits: 0, fingers: 0, line: AUCUNE });
      }
    });
  });

  test("événement de souris émulé après un toucher : ignoré, il n'enfonce rien une seconde fois ; la souris seule simule toujours le doigt", async ({ browser }) => {
    await phone(browser, async (page) => {
      // Une souris sans toucher avant : elle simule le doigt (`?touch=1`).
      await fire(page, "pointerdown", { pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, clientX: at.left[0], clientY: at.left[1] });
      expect((await held(page)).bits).toBe(LEFT);
      await fire(page, "pointerup", { pointerId: 1, pointerType: "mouse", button: 0, buttons: 0, clientX: at.left[0], clientY: at.left[1] });
      expect((await held(page)).bits).toBe(0);
      // Un toucher, puis l'écho de souris que le navigateur envoie : rien.
      const fingers = await Fingers.on(page);
      await fingers.down(1, ...at.right);
      await fingers.up(1);
      await fire(page, "pointerdown", { pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, clientX: at.jump[0], clientY: at.jump[1] });
      expect(await held(page)).toEqual({ bits: 0, fingers: 0, line: `${AUCUNE} · dernier relâchement : souris ignorée` });
    });
  });

  test("la souris dont le bouton est lâché hors de la page ne laisse pas de touche tenue", async ({ browser }) => {
    await phone(browser, async (page) => {
      await fire(page, "pointerdown", { pointerId: 1, pointerType: "mouse", button: 0, buttons: 1, clientX: at.left[0], clientY: at.left[1] });
      expect((await held(page)).bits).toBe(LEFT);
      await fire(page, "pointermove", { pointerId: 1, pointerType: "mouse", buttons: 0, clientX: at.left[0] + 5, clientY: at.left[1] });
      expect(await held(page)).toEqual({ bits: 0, fingers: 0, line: AUCUNE });
    });
  });
});
