import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { Fingers, hasWebGL, withPhone } from "./phone";

// Lot 2 : dangers, mort, réapparition, chrono, arrivée, sur `?scenario=essai&debug`, toujours en pas à pas (`manual` + `advance`).
// On meurt sur les deux pics du début, on vérifie la réapparition (≤ 24 pas, soit 0,2 s) et la remise à zéro, puis on rejoue la solution
// stockée (`packages/jump-sim/test/fixtures/essai-solution.json`) jusqu'au bandeau d'arrivée. Deux fois : commandes injectées et clavier,
// puis au doigt sur un téléphone en paysage.

const SOLUTION = JSON.parse(readFileSync(new URL("../../../packages/jump-sim/test/fixtures/essai-solution.json", import.meta.url), "utf8")) as { ticks: number; inputs: [number, number][] };
const AUTHOR_TEXT = (() => {
  const ms = Math.round((SOLUTION.ticks * 1000) / 120);
  return `${Math.floor(ms / 1000)},${String(ms % 1000).padStart(3, "0")} s`;
})();

const LEFT = 1;
const RIGHT = 2;
const JUMP = 4;

interface AttemptView {
  status: string;
  time: number;
  timeText: string;
  deathTicks: number;
  respawnTicks: number;
  deaths: number;
  attempts: number;
  best: number | null;
  bestText: string | null;
  lastDeath: { cause: string; x: number; y: number; time: number } | null;
  checkpoint: number;
  checkpoints: number;
  saws: { x: number; y: number }[];
  crumbles: number[];
  sections: number[];
  raw: Record<string, unknown> & { player: Record<string, number> };
}
interface JumpPlay {
  phase: string;
  attempt: AttemptView;
  fx: { enabled: boolean; emitted: number; alive: number; shaking: boolean };
  banner: boolean;
  ticks: number;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
}
/** Exécute `f(window.__jump)` dans la page (la fonction est envoyée comme texte : elle ne doit rien capturer). */
const jump = <T>(page: Page, f: (j: JumpPlay) => T) => page.evaluate(`(${f.toString()})(window.__jump)`) as Promise<T>;
const attempt = (page: Page) => page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.attempt);
const phase = (page: Page) => page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.phase);
const step = (page: Page, n = 1) => page.evaluate((k) => (window as unknown as { __jump: JumpPlay }).__jump.advance(k), n);

async function openEssai(page: Page, extra = ""): Promise<boolean> {
  await page.goto(`/?scenario=essai&debug${extra}`);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
  await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.manual(true));
  return true;
}

/** Avance pas à pas jusqu'à la mort (au plus `max` pas) ; rend le nombre de pas. */
async function untilDead(page: Page, max = 400): Promise<number> {
  return page.evaluate((m) => {
    const j = (window as unknown as { __jump: JumpPlay }).__jump;
    for (let t = 1; t <= m; t++) {
      j.advance(1);
      if (j.phase === "dead") return t;
    }
    return -1;
  }, max);
}

/** Pas à pas jusqu'au nouvel essai ; rend le nombre de pas depuis la mort. */
async function untilRespawn(page: Page): Promise<number> {
  return page.evaluate(() => {
    const j = (window as unknown as { __jump: JumpPlay }).__jump;
    for (let t = 1; t <= 200; t++) {
      j.advance(1);
      if (j.phase !== "dead") return t;
    }
    return -1;
  });
}

/** Ce qui doit revenir à l'identique après la mort : l'état de l'essai (sans la grille). */
const fresh = (a: AttemptView) => ({ raw: a.raw, crumbles: a.crumbles, sections: a.sections, saws: a.saws, time: a.time, status: a.status });

test("essai, commandes injectées puis clavier : mourir sur un pic, réapparaître en ≤ 24 pas, tout remis à zéro, puis finir avec la solution", async ({ page }) => {
  test.skip(!(await openEssai(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  const start = await attempt(page);
  expect(start.status).toBe("attend");
  expect(start.respawnTicks).toBeLessThanOrEqual(24);
  await expect(page.locator("#chrono .time")).toHaveText("0,000 s");

  // Le monde attend : sans commande, ni chrono ni scie ne bougent.
  await jump(page, (j) => j.input(0));
  await step(page, 120);
  expect(fresh(await attempt(page))).toEqual(fresh(start));
  expect(await phase(page)).toBe("ready");

  // Courir droit dans les deux pics du début.
  await jump(page, (j) => j.input(2));
  const ticks = await untilDead(page);
  expect(ticks).toBeGreaterThan(0);
  const dead = await attempt(page);
  expect(dead.status).toBe("mort");
  expect(dead.lastDeath?.cause).toBe("pic");
  expect(dead.lastDeath!.x).toBeGreaterThan(10);
  expect(dead.lastDeath!.x).toBeLessThan(14);
  expect(dead.deaths).toBe(1);
  expect((await jump(page, (j) => j.fx)).emitted).toBeGreaterThan(0); // l'éclatement est parti
  await expect(page.locator("#debug")).toContainText("pic");

  // Réapparition : au plus 24 pas (0,2 s), commandes ignorées entre-temps ; tout l'essai revient à l'état initial.
  const wait = await untilRespawn(page);
  expect(wait).toBeGreaterThan(0);
  expect(wait).toBeLessThanOrEqual(24);
  await jump(page, (j) => j.input(0));
  const again = await attempt(page);
  expect(fresh(again)).toEqual(fresh(start));
  expect(again.deaths).toBe(1);
  expect(again.attempts).toBe(2);
  await expect(page.locator("#chrono .deaths")).toHaveText("Morts 1");

  // Au clavier : → dans les pics, le jeu lit bien les touches (mort de nouveau).
  await jump(page, (j) => j.input(null));
  await page.keyboard.down("ArrowRight");
  expect(await untilDead(page)).toBeGreaterThan(0);
  await page.keyboard.up("ArrowRight");
  expect((await attempt(page)).deaths).toBe(2);
  expect(await untilRespawn(page)).toBeLessThanOrEqual(24);

  // R pendant la course : nouvel essai, pas une mort.
  await jump(page, (j) => j.input(2));
  await step(page, 30);
  await jump(page, (j) => j.input(null));
  await page.keyboard.press("KeyR");
  await page.waitForFunction(() => (window as unknown as { __jump: JumpPlay }).__jump.phase === "ready");
  expect((await attempt(page)).deaths).toBe(2);

  // La solution : elle arrive au bout, le temps est celui de l'auteur.
  await page.evaluate((runs) => {
    const j = (window as unknown as { __jump: JumpPlay }).__jump;
    for (const [bits, n] of runs) {
      j.input(bits);
      j.advance(n);
    }
    j.input(0);
  }, SOLUTION.inputs);
  const done = await attempt(page);
  expect(done.status).toBe("arrivé");
  expect(done.time).toBe(SOLUTION.ticks);
  expect(done.bestText).toBe(AUTHOR_TEXT);
  expect(done.deaths).toBe(2);
  await expect(page.locator("#finish")).toBeVisible();
  await expect(page.locator("#finish .time")).toHaveText(AUTHOR_TEXT);
  await expect(page.locator("#finish .deaths")).toHaveText("Morts : 2 · essai sans faute");
  await expect(page.locator("#chrono .time")).toHaveText(AUTHOR_TEXT);
  // Le temps est figé.
  await step(page, 60);
  expect((await attempt(page)).time).toBe(SOLUTION.ticks);

  // R relance un essai ; le bandeau s'en va, le meilleur temps reste.
  await jump(page, (j) => j.input(null));
  await page.keyboard.press("KeyR");
  await page.waitForFunction(() => (window as unknown as { __jump: JumpPlay }).__jump.phase === "ready");
  await expect(page.locator("#finish")).toBeHidden();
  await expect(page.locator("#chrono .best")).toHaveText(`Meilleur ${AUTHOR_TEXT}`);
});

test("point de passage : l'atteindre, mourir après, reprendre dessus dans le même essai, chrono qui continue", async ({ page }) => {
  test.skip(!(await openEssai(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  expect((await attempt(page)).checkpoints).toBe(5);
  // Le début de la solution, pas à pas, jusqu'au premier point de passage (colonne 51, après les pics).
  const reached = await page.evaluate((runs) => {
    const j = (window as unknown as { __jump: JumpPlay }).__jump;
    for (const [bits, n] of runs) {
      j.input(bits);
      for (let k = 0; k < n; k++) {
        j.advance(1);
        if (j.attempt.checkpoint >= 0) return j.attempt.checkpoint;
      }
    }
    return -1;
  }, SOLUTION.inputs);
  expect(reached).toBe(0);
  await expect(page.locator("#toast")).toHaveText("Point de passage");
  // Revenir à gauche dans le champ de pics.
  await jump(page, (j) => j.input(1));
  expect(await untilDead(page)).toBeGreaterThan(0);
  const dead = await attempt(page);
  expect(dead.lastDeath?.cause).toBe("pic");
  // Reprise sur le point : même essai (pas un nouvel essai), chrono qui a continué pendant l'attente.
  await jump(page, (j) => j.input(0));
  expect(await untilRespawn(page)).toBeLessThanOrEqual(24);
  const back = await attempt(page);
  expect(back.status).toBe("course");
  expect(back.checkpoint).toBe(0);
  expect(back.attempts).toBe(1);
  expect(back.deaths).toBe(1);
  expect(back.time).toBeGreaterThan(dead.time);
  expect(Math.floor(back.raw.player.x! / 4096)).toBe(51);
  // R oublie le point : départ, chrono à zéro.
  await jump(page, (j) => j.input(null));
  await page.keyboard.press("KeyR");
  await page.waitForFunction(() => (window as unknown as { __jump: JumpPlay }).__jump.phase === "ready");
  const fresh = await attempt(page);
  expect(fresh.checkpoint).toBe(-1);
  expect(fresh.time).toBe(0);
});

test("?fx=off : la mort n'éclate pas et l'écran ne tremble pas ; ?hitbox ne change rien à la simulation", async ({ page }) => {
  test.skip(!(await openEssai(page, "&fx=off&hitbox")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  await jump(page, (j) => j.input(2));
  expect(await untilDead(page)).toBeGreaterThan(0);
  expect(await jump(page, (j) => j.fx)).toEqual({ enabled: false, emitted: 0, alive: 0, shaking: false });
  await expect(page.locator("#debug")).toContainText("boîtes justes");
  const pixels = await page.evaluate(() => (window as unknown as { __jump: { probe(): { colors: number } } }).__jump.probe());
  expect(pixels.colors).toBeGreaterThanOrEqual(4);
});

test("?scenario=dangers : la galerie s'ouvre, chaque danger est là", async ({ page }) => {
  await page.goto("/?scenario=dangers&debug&hitbox");
  test.skip(!(await hasWebGL(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
  const a = await attempt(page);
  expect(a.saws).toHaveLength(4); // petite et grande scie fixes, aller-retour, boucle
  expect(a.sections.length).toBeGreaterThanOrEqual(5);
  expect(a.crumbles.length).toBeGreaterThan(0);
});

test.describe("au doigt (téléphone en paysage)", () => {
  const VIEW = { width: 844, height: 390 };
  const W = VIEW.width;
  const H = VIEW.height;
  const at = { left: [W * 0.12, H * 0.75], right: [W * 0.37, H * 0.75], jump: [W * 0.75, H * 0.75] } as const;

  test("mourir sur un pic au doigt, réapparaître, puis finir l'essai au doigt et recommencer en touchant le bandeau", async ({ browser }) => {
    test.setTimeout(120_000);
    await withPhone(browser, VIEW, async (page) => {
      test.skip(!(await openEssai(page, "&touch=1")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
      const start = await attempt(page);
      const fingers = await Fingers.on(page);

      // HUD lisible : sous la bande haute, dans l'écran, sans toucher les boutons.
      const chrono = (await page.locator("#chrono").boundingBox())!;
      expect(chrono.y).toBeGreaterThanOrEqual(60);
      expect(chrono.x).toBeGreaterThanOrEqual(0);
      expect(chrono.x + chrono.width).toBeLessThanOrEqual(W);
      for (const sel of ["#restart", ".tbtn"]) {
        for (const el of await page.locator(sel).all()) {
          if (!(await el.isVisible())) continue;
          const b = (await el.boundingBox())!;
          const overlap = Math.min(chrono.x + chrono.width, b.x + b.width) > Math.max(chrono.x, b.x) && Math.min(chrono.y + chrono.height, b.y + b.height) > Math.max(chrono.y, b.y);
          expect(overlap, `${sel} chevauche le chrono`).toBe(false);
        }
      }

      // → au doigt jusqu'aux pics.
      await fingers.down(1, ...at.right);
      expect(await untilDead(page)).toBeGreaterThan(0);
      expect((await attempt(page)).lastDeath?.cause).toBe("pic");
      // Doigt toujours posé : la réapparition arrive en ≤ 24 pas et la direction compte tout de suite ensuite.
      expect(await untilRespawn(page)).toBeLessThanOrEqual(24);
      await fingers.up(1);
      expect(fresh(await attempt(page))).toEqual(fresh(start));

      // La solution, doigt par doigt : un doigt de direction (glissé de ← à → sans lever), un doigt de saut.
      let dir = 0;
      let jumping = false;
      for (const [bits, n] of SOLUTION.inputs) {
        const want = bits & RIGHT ? 1 : bits & LEFT ? -1 : 0;
        if (want !== dir) {
          if (want === 0) await fingers.up(1);
          else if (dir === 0) await fingers.down(1, ...(want > 0 ? at.right : at.left));
          else await fingers.move(1, ...(want > 0 ? at.right : at.left));
          dir = want;
        }
        const j = (bits & JUMP) !== 0;
        if (j !== jumping) {
          if (j) await fingers.down(2, ...at.jump);
          else await fingers.up(2);
          jumping = j;
        }
        // Les doigts doivent donner exactement ces commandes avant de jouer la série (état attendu, pas une durée).
        await page.waitForFunction((b) => (window as unknown as { __jump: { touch: { bits: number } } }).__jump.touch.bits === b, bits);
        await step(page, n);
      }
      if (dir !== 0) await fingers.up(1);
      if (jumping) await fingers.up(2);
      const done = await attempt(page);
      expect(done.status).toBe("arrivé");
      expect(done.time).toBe(SOLUTION.ticks);
      await expect(page.locator("#finish")).toBeVisible();
      await expect(page.locator("#finish .time")).toHaveText(AUTHOR_TEXT);
      const button = (await page.locator("#finish button").boundingBox())!;
      expect(button.height).toBeGreaterThanOrEqual(44);
      expect(button.width).toBeGreaterThanOrEqual(44);

      // Toucher « Recommencer » sur le bandeau : nouvel essai, pas une mort.
      await page.locator("#finish button").tap();
      await page.waitForFunction(() => (window as unknown as { __jump: JumpPlay }).__jump.phase === "ready");
      await expect(page.locator("#finish")).toBeHidden();
      expect((await attempt(page)).deaths).toBe(1);
    });
  });
});
