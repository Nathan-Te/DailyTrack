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
/** Lot I5 : le bandeau écrit le temps comme le socle (`formatTemps` : espace insécable avant l'unité) ; la bande du HUD, sans unité (maquette jump-hud.html). */
const AUTHOR_SHOWN = AUTHOR_TEXT.replace(" ", "\u00a0");
const AUTHOR_CHRONO = AUTHOR_TEXT.replace(" s", "");

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

test("essai, commandes injectées puis clavier : mourir sur un pic, réapparaître en ≤ 24 pas, tout remis à zéro, puis finir avec la solution", { tag: "@navigateurs" }, async ({ page }) => {
  test.skip(!(await openEssai(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  const start = await attempt(page);
  expect(start.status).toBe("attend");
  expect(start.respawnTicks).toBeLessThanOrEqual(24);
  await expect(page.locator("#chrono .time")).toHaveText("0,000");

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
  await expect(page.locator("#morts .count")).toHaveText("1");

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
  // Lot 3 : à l'arrivée, le carnage démarre de lui-même ; une commande le passe et mène au bandeau.
  // Seul un appui compte (la direction tenue à l'arrivée ne le passe pas) : on relâche, puis on appuie sur saut.
  expect(await phase(page)).toBe("carnage");
  await step(page, 1);
  expect(await phase(page)).toBe("carnage");
  await jump(page, (j) => j.input(4));
  await step(page, 1);
  await jump(page, (j) => j.input(0));
  expect(await phase(page)).toBe("finished");
  const done = await attempt(page);
  expect(done.status).toBe("arrivé");
  expect(done.time).toBe(SOLUTION.ticks);
  expect(done.bestText).toBe(AUTHOR_TEXT);
  expect(done.deaths).toBe(2);
  await expect(page.locator("#finish")).toBeVisible();
  await expect(page.locator("#finish .time")).toHaveText(AUTHOR_SHOWN);
  await expect(page.locator("#finish .deaths")).toHaveText("Morts : 2 · essai sans faute");
  await expect(page.locator("#chrono .time")).toHaveText(AUTHOR_CHRONO);
  // Le temps est figé.
  await step(page, 60);
  expect((await attempt(page)).time).toBe(SOLUTION.ticks);

  // R relance un essai ; le bandeau s'en va, le meilleur temps reste.
  await jump(page, (j) => j.input(null));
  await page.keyboard.press("KeyR");
  await page.waitForFunction(() => (window as unknown as { __jump: JumpPlay }).__jump.phase === "ready");
  await expect(page.locator("#finish")).toBeHidden();
  // Lot I5 : la bande ne montre plus le meilleur temps (l'écart au record le remplace, charte § 9) ; il reste celui de la session.
  expect((await attempt(page)).bestText).toBe(AUTHOR_TEXT);
});

test("point de passage : l'atteindre, mourir après, reprendre dessus dans le même essai, chrono qui continue", { tag: "@regression" }, async ({ page }) => {
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

test("?fx=off : la mort n'éclate pas et l'écran ne tremble pas ; ?hitbox ne change rien à la simulation", { tag: "@regression" }, async ({ page }) => {
  test.skip(!(await openEssai(page, "&fx=off&hitbox")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  await jump(page, (j) => j.input(2));
  expect(await untilDead(page)).toBeGreaterThan(0);
  expect(await jump(page, (j) => j.fx)).toEqual({ enabled: false, emitted: 0, alive: 0, shaking: false });
  await expect(page.locator("#debug")).toContainText("boîtes justes");
  const pixels = await page.evaluate(() => (window as unknown as { __jump: { probe(): { colors: number } } }).__jump.probe());
  expect(pixels.colors).toBeGreaterThanOrEqual(4);
});

