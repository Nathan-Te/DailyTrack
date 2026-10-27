import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { Fingers, hasWebGL, withPhone } from "./phone";

// Lot 3 : mémoire du jour, fantôme, carnage, taches, lecture du meilleur essai. Toujours en pas à pas (`manual` + `advance`), jamais sur
// une durée. Chaque test a son propre contexte de navigateur, donc un stockage vide au départ.

const SOLUTION = JSON.parse(readFileSync(new URL("../../../packages/jump-sim/test/fixtures/essai-solution.json", import.meta.url), "utf8")) as { ticks: number; inputs: [number, number][] };
const GOLDEN = JSON.parse(readFileSync(new URL("../../../packages/jump-sim/test/fixtures/replay-golden.json", import.meta.url), "utf8")) as { solution: { code: string } };

interface CarnageView {
  active: boolean;
  demo: boolean;
  lives: number;
  arrivals: number;
  deaths: number;
  running: number;
  tick: number;
  heroTicks: number;
  label: string;
}
interface Jump {
  phase: string;
  attempt: { status: string; time: number; deaths: number; lastDeath: { x: number; y: number } | null; bestText: string | null };
  carnage: { state: CarnageView; start(): boolean; demo(lives?: number): boolean; skip(): void };
  storage: { clear(): number; size(): number; memory: { best: number | null; lives: number; deaths: number; positions: { x: number; y: number }[] } };
  ghost: { enabled: boolean; available: boolean; visible: boolean; tick: number; status: string; x: number; y: number };
  stains: { count: number; discs: number; added: number };
  replays: { list(): { kind: string }[]; export(which?: "best" | number): string | null; import(code: string): { ok: boolean } };
  watching: boolean;
  banner: boolean;
  tuned: boolean;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  toggleGhost(): boolean;
}
const J = (page: Page) => page.evaluate(() => {
  const j = (window as unknown as { __jump: Jump }).__jump;
  return { phase: j.phase, attempt: j.attempt, carnage: j.carnage.state, memory: j.storage.memory, ghost: j.ghost, stains: j.stains, watching: j.watching, banner: j.banner };
});
const step = (page: Page, n: number, bits: number | null = null) =>
  page.evaluate(
    ([k, b]) => {
      const j = (window as unknown as { __jump: Jump }).__jump;
      if (b !== null) j.input(b);
      j.advance(k as number);
    },
    [n, bits] as const,
  );

async function open(page: Page, query: string): Promise<boolean> {
  await page.goto(`/?scenario=essai&debug${query}`);
  if (!(await hasWebGL(page))) return false;
  // `ready`, ou déjà en route : la démonstration et la lecture démarrent seules (quelques images passent avant le pas à pas).
  await page.waitForFunction(() => {
    const p = (window as unknown as { __jump?: { phase: string } }).__jump?.phase;
    return p !== undefined && p !== "loading";
  });
  await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.manual(true));
  return true;
}

/** Court à droite jusqu'à mourir dans les pics du début, puis attend la réapparition. Rend le lieu de la mort (tuiles). */
async function dieOnce(page: Page): Promise<{ x: number; y: number }> {
  return page.evaluate(() => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    j.input(2);
    for (let t = 0; t < 400 && j.phase !== "dead"; t++) j.advance(1);
    const d = j.attempt.lastDeath!;
    j.input(0);
    for (let t = 0; t < 60 && j.phase === "dead"; t++) j.advance(1);
    return { x: d.x, y: d.y };
  });
}

/** Joue la solution de l'essai jusqu'à l'arrivée. */
async function playSolution(page: Page): Promise<void> {
  await page.evaluate((runs) => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    for (const [bits, n] of runs) {
      j.input(bits);
      j.advance(n);
    }
    j.input(0);
  }, SOLUTION.inputs);
}

test("?carnage=demo démarre tout seul, compte ses vies, les fait mourir (éclats et taches), et une commande le passe", { tag: "@regression" }, async ({ page }) => {
  test.skip(!(await open(page, "&carnage=demo")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  const start = await J(page);
  expect(start.phase).toBe("carnage");
  expect(start.carnage).toMatchObject({ active: true, demo: true, arrivals: 0 });
  expect(start.carnage.lives).toBeGreaterThan(30);
  await expect(page.locator("#carnage")).toBeVisible();
  await expect(page.locator("#carnage .count")).toHaveText(`${start.carnage.lives} vies · 0 arrivée`);
  expect(start.stains.count).toBe(0); // les taches du carnage apparaissent avec ses morts

  // Les premières vagues (jusqu'au pas 1 600 du héros, compté depuis le départ du carnage) : des vies partent, meurent, tachent.
  // (Lot 4 : les points de passage se prennent en franchissant leur colonne, les essais fictifs ont changé ; 9 morts au pas 1 500,
  // 11 au pas 1 600 : on regarde au pas 1 600, même seuil.)
  await step(page, 1600 - start.carnage.tick, 0);
  const mid = await J(page);
  expect(mid.carnage.tick).toBe(1600);
  expect(mid.carnage.deaths).toBeGreaterThanOrEqual(10);
  expect(mid.stains.count).toBe(mid.carnage.deaths); // chaque mort laisse sa tache
  expect(mid.phase).toBe("carnage");
  const fx = await page.evaluate(() => (window as unknown as { __jump: { fx: { enabled: boolean } } }).__jump.fx.enabled);
  expect(fx).toBe(true);

  // Une commande (un appui) le passe : fin de la démonstration, retour au départ ; rien n'a été enregistré.
  await step(page, 1, 4);
  await step(page, 1, 0);
  const after = await J(page);
  expect(after.carnage.active).toBe(false);
  expect(after.phase).toBe("ready");
  await expect(page.locator("#carnage")).toBeHidden();
  expect(after.memory).toMatchObject({ best: null, lives: 0, deaths: 0 });
  await expect(page.locator("#toast")).toHaveText("Fin de la démonstration");
});

test("?carnage=demo va au bout tout seul : le héros arrive (1 arrivée au moins), puis le jeu reprend", { tag: "@regression" }, async ({ page }) => {
  test.skip(!(await open(page, "&carnage=demo&fx=off")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  const { heroTicks, tick } = (await J(page)).carnage;
  expect(heroTicks).toBe(SOLUTION.ticks);
  await step(page, heroTicks - tick, 0);
  const end = await J(page);
  expect(end.carnage.active).toBe(true); // il reste un instant après l'arrivée du héros
  expect(end.carnage.arrivals).toBeGreaterThanOrEqual(1);
  await expect(page.locator("#carnage .count")).toContainText("arrivée");
  // ?fx=off : pas d'éclats, mais les taches restent (elles portent une information).
  expect(end.stains.count).toBeGreaterThan(0);
  await step(page, 400, 0);
  expect((await J(page)).phase).toBe("ready");
});

test("en pas à pas : mourir, finir, carnage de ses propres vies ; au rechargement, le fantôme et les taches sont là", { tag: "@regression" }, async ({ page }) => {
  test.setTimeout(120_000);
  test.skip(!(await open(page, "")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  const deaths = [await dieOnce(page), await dieOnce(page), await dieOnce(page)];
  const afterDeaths = await J(page);
  expect(afterDeaths.memory.deaths).toBe(3);
  expect(afterDeaths.stains.count).toBe(3);
  expect(afterDeaths.memory.lives).toBe(3); // trois essais morts sans point de passage : trois vies
  expect(afterDeaths.ghost.available).toBe(false);

  await playSolution(page);
  const carnage = await J(page);
  expect(carnage.phase).toBe("carnage");
  // Le héros (1 vie) et les trois vies du jour, qui partent avec lui ; l'essai héros n'est pas compté deux fois.
  expect(carnage.carnage.lives).toBe(4);
  expect(carnage.memory.best).toBe(SOLUTION.ticks);
  // Les trois vies meurent aux mêmes pics qu'avant.
  await step(page, 200, 0);
  expect((await J(page)).carnage.deaths).toBe(3);
  await step(page, 1, 2);
  const done = await J(page);
  expect(done.phase).toBe("finished");
  expect(done.banner).toBe(true);
  await expect(page.locator("#finish .best")).toHaveText(/Meilleur du jour : 21,625\ss/);
  expect(done.stains.count).toBe(3); // les taches de la journée reviennent

  // Rechargement : meilleur essai, vies, morts relus ; le fantôme est prêt, les taches sont aux mêmes endroits.
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
  await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.manual(true));
  const back = await J(page);
  expect(back.memory).toMatchObject({ best: SOLUTION.ticks, lives: 4, deaths: 3 });
  expect(back.stains.count).toBe(3);
  back.memory.positions.forEach((p, i) => {
    expect(p.x).toBeCloseTo(deaths[i]!.x, 6);
    expect(p.y).toBeCloseTo(deaths[i]!.y, 6);
  });
  expect(back.attempt.bestText).toBe("21,625 s");
  expect(back.ghost).toMatchObject({ enabled: true, available: true, tick: 0 });

  // Le fantôme est calé sur le chrono : il part à la première commande, pas avant.
  await step(page, 30, 0);
  expect((await J(page)).ghost.tick).toBe(0);
  await step(page, 60, 2);
  const run = await J(page);
  expect(run.attempt.time).toBe(60);
  expect(run.ghost.tick).toBe(60);
  expect(run.ghost.x).toBeGreaterThan(5);
  await page.waitForFunction(() => (window as unknown as { __jump: Jump }).__jump.ghost.visible);

  // G le cache, et c'est mémorisé.
  await page.keyboard.press("KeyG");
  await step(page, 1, 2);
  expect((await J(page)).ghost.enabled).toBe(false);
  await page.waitForFunction(() => !(window as unknown as { __jump: Jump }).__jump.ghost.visible);
  // Lot I5 : plus de bouton 👻 dans le HUD (le fantôme est dans la pause) ; la touche G le dit par un message court.
  await expect(page.locator("#toast")).toHaveText("Fantôme : caché");
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
  expect((await J(page)).ghost.enabled).toBe(false);
});

test("?ghost=off cache le fantôme sans toucher au réglage ; ?watch=best rejoue le meilleur essai seul, sans pouvoir jouer", { tag: "@regression" }, async ({ page }) => {
  test.skip(!(await open(page, "")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  // Un meilleur essai importé (validé par le rejeu), sans avoir à jouer.
  const imported = await page.evaluate((code) => (window as unknown as { __jump: Jump }).__jump.replays.import(code), GOLDEN.solution.code);
  expect(imported.ok).toBe(true);
  expect(await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.replays.export("best"))).toBe(GOLDEN.solution.code);

  await open(page, "&ghost=off");
  expect((await J(page)).ghost).toMatchObject({ enabled: false, available: true });

  await open(page, "&watch=best");
  expect((await J(page)).watching).toBe(true);
  // Le clavier ne commande rien : seule la rediffusion joue.
  await page.keyboard.down("ArrowLeft");
  await step(page, SOLUTION.ticks);
  await page.keyboard.up("ArrowLeft");
  const end = await J(page);
  expect(end.attempt.status).toBe("arrivé");
  expect(end.attempt.time).toBe(SOLUTION.ticks);
  expect(end.carnage.active).toBe(false);
  await expect(page.locator("#finish .title")).toHaveText("Rediffusion");
  // Rien n'a été enregistré par la lecture.
  expect(end.memory.lives).toBe(0);
});

test("sans stockage (localStorage qui lève) : le jeu se joue, finit, lance son carnage et le bandeau", async ({ page }) => {
  await page.addInitScript(() => {
    const fail = () => {
      throw new DOMException("refusé", "SecurityError");
    };
    for (const name of ["getItem", "setItem", "removeItem", "key", "clear"] as const) Object.defineProperty(Storage.prototype, name, { configurable: true, value: fail });
    Object.defineProperty(Storage.prototype, "length", { configurable: true, get: fail });
  });
  test.skip(!(await open(page, "")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  expect(await page.evaluate(() => {
    try {
      localStorage.getItem("jump:jour:essai");
      return "lisible";
    } catch {
      return "refusé";
    }
  })).toBe("refusé");
  await dieOnce(page);
  await playSolution(page);
  const c = await J(page);
  expect(c.phase).toBe("carnage");
  expect(c.carnage.lives).toBe(2);
  await step(page, 1, 4);
  expect((await J(page)).phase).toBe("finished");
  await expect(page.locator("#finish")).toBeVisible();
});

