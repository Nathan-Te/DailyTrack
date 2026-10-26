import { readFileSync, readdirSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { decodeReplay, fromRuns, moduleSolutions } from "@cdj/jump-sim";
import { FIXED_NOW, PUBLISHED, TODAY, atInstant, servePublished } from "./clock";
import { Fingers, hasWebGL, withPhone } from "./phone";
import { dayId } from "./jours";

// Lot 11 (partie jeu) : tapis roulants et glace. (a) un niveau du jour **usine** et un niveau **glace**, joués par leur rediffusion d'auteur
// (`&solution`), finissent au temps de l'auteur, avec les événements de surface, les chevrons construits et aucune erreur de shader ;
// (b) un morceau à tapis et un morceau à glace se jouent **au doigt, en paysage**, la solution stockée posée doigt par doigt (pas à pas) ;
// (c) un thème forcé (`?theme=`) est un essai : rien n'est enregistré (ni historique, ni série, ni mémoire du jour) ; (d) le ronronnement des
// tapis est spatialisé (voix, distance) et se tait en pause ; les chevrons sont figés avec `?fx=off`.
// Horloge maîtrisée par décalage de `Date` (`clock.ts`), jamais `page.clock.install` ; tout résultat qui dépend du nombre de pas se lit en pas à pas.

const SKIP = "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire";
const GENERATOR = (JSON.parse(readFileSync(new URL("../../../packages/jump-sim/test/fixtures/daily-golden-v6.json", import.meta.url), "utf8")) as { jumpGeneratorVersion: number }).jumpGeneratorVersion;

/** Les thèmes des 400 premières dates du lot 9 (le thème d'une date ne change pas : fixture de `jump-sim`). */
const THEMES = JSON.parse(readFileSync(new URL("../../../packages/jump-sim/test/fixtures/themes-lot9.json", import.meta.url), "utf8")) as { first: number; count: number; names: string };
const NAMES = THEMES.names.split(" ");
/** Les jours figés (`public/levels/`) : leur niveau est celui d'un générateur d'avant, jamais celui de cette version. */
const FROZEN = new Set(readdirSync(new URL("../public/levels", import.meta.url)).map((f) => f.slice(0, 10)));
/** La première date (AAAA-MM-JJ) à partir du 18/10/2026 dont le thème naturel est `theme`, hors des jours figés. */
function dayWith(theme: string, from = "2026-10-18"): string {
  for (let d = Date.parse(from) / 86_400_000; d < THEMES.first + THEMES.count; d++) {
    const date = new Date(d * 86_400_000).toISOString().slice(0, 10);
    if (NAMES[d - THEMES.first] === theme && !FROZEN.has(date)) return date;
  }
  throw new Error(`aucune date de thème ${theme}`);
}

interface Jump {
  phase: string;
  daily: { date: string; id: string; mode: string; theme: string; forcedTheme: boolean; authorTicks: number; pieces: { id: string; mechanic: string | null }[]; code: string; lastMedal: string | null } | null;
  theme: { name: string; ofDay: string; forced: boolean; stats: { beltTiles: number; beltTriangles: number; beltPhase: number } | null };
  module: { id: string; variant: number; reference: number | null } | null;
  attempt: { status: string; time: number; deaths: number };
  history: unknown[];
  streak: number;
  arrival: { shown: boolean };
  storage: { memory: { best: number | null; lives: number; deaths: number } };
  audio: { belts: { index: number; gain: number; pan: number }[]; saws: unknown[] };
  events: { kind: string; side?: number }[];
  touch: { bits: number };
  tuned: boolean;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
  autoplay(code?: string): number;
  setMenu(open: boolean): void;
}
const J = (page: Page) => page.evaluate(() => {
  const j = (window as unknown as { __jump: Jump }).__jump;
  return { phase: j.phase, daily: j.daily, theme: j.theme, module: j.module, attempt: j.attempt, history: j.history, streak: j.streak, arrival: j.arrival, memory: j.storage.memory, audio: j.audio, tuned: j.tuned };
});
const ready = (page: Page) => page.waitForFunction(() => ["ready", "playing", "finished"].includes((window as unknown as { __jump?: { phase: string } }).__jump?.phase ?? ""));
/** Deux images de la page : ce que le dessin et le son d'une image calculent est alors à jour. */
const frames = (page: Page, n = 2) => page.evaluate((k) => new Promise<void>((done) => {
  let left = k;
  const tick = () => (--left <= 0 ? done() : requestAnimationFrame(tick));
  requestAnimationFrame(tick);
}), n);

/** Les erreurs de la console et de la page (un shader qui ne compile pas s'y voit : « THREE.WebGLProgram: Shader Error »). */
function watchErrors(page: Page): string[] {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(`pageerror: ${e.message}`));
  page.on("console", (m) => {
    if (m.type() === "error" || /shader error|WebGLProgram/i.test(m.text())) errors.push(`console: ${m.text()}`);
  });
  return errors;
}

/** Ouvre une adresse en `?debug`, pas à pas, repartie du départ (une lecture démarre d'elle-même : on la relance, comme R) ; faux sans WebGL. */
async function open(page: Page, url: string): Promise<boolean> {
  await page.goto(url);
  if (!(await hasWebGL(page))) return false;
  await ready(page);
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    j.manual(true);
    j.restart();
  });
  await page.waitForFunction(() => (window as unknown as { __jump: Jump }).__jump.phase === "ready");
  return true;
}

/** Avance pas à pas jusqu'à `finished` (ou `carnage`) ; chaque pas lit le journal d'événements : rend les noms vus et le nombre de pas. */
async function playToEnd(page: Page, max = 6000): Promise<{ ticks: number; kinds: string[] }> {
  return page.evaluate((limit) => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    const kinds = new Set<string>();
    for (let t = 1; t <= limit; t++) {
      j.advance(1);
      // Le journal garde les 200 derniers événements : un pas en produit quelques-uns, on lit les derniers à chaque pas.
      const list = j.events;
      for (const e of list.slice(-6)) kinds.add(e.kind);
      if (j.phase === "finished" || j.phase === "carnage") return { ticks: t, kinds: [...kinds] };
    }
    return { ticks: -1, kinds: [...kinds] };
  }, max);
}

test("niveau du jour usine : sa rediffusion d'auteur finit au temps de l'auteur, avec ses tapis (chevrons construits, événements, aucune erreur de shader)", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    const errors = watchErrors(page);
    const date = dayWith("usine");
    test.skip(!(await open(page, `/?seed=${date}&solution&debug`)), SKIP);
    const start = await J(page);
    expect(start.theme).toMatchObject({ name: "usine", ofDay: "usine", forced: false });
    expect(start.daily).toMatchObject({ date, theme: "usine", forcedTheme: false, id: `jour-${date}-g${GENERATOR}` });
    expect(start.daily!.pieces.filter((p) => p.mechanic === "tapis").length).toBeGreaterThanOrEqual(2);
    expect(start.theme.stats!.beltTiles).toBeGreaterThan(0);
    expect(start.theme.stats!.beltTriangles).toBe(start.theme.stats!.beltTiles * 2);
    const { ticks, kinds } = await playToEnd(page);
    expect(ticks).toBe(start.daily!.authorTicks);
    const end = await J(page);
    expect(end.attempt).toMatchObject({ status: "arrivé", time: start.daily!.authorTicks, deaths: 0 });
    expect(end.daily!.lastMedal).toBe("author");
    expect(kinds).toContain("tapisDebut");
    await frames(page);
    expect(errors).toEqual([]);
  });
});

test("niveau du jour glace : sa rediffusion d'auteur finit au temps de l'auteur, avec de la glace (début et fin de contact)", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    const errors = watchErrors(page);
    const date = dayWith("glace");
    test.skip(!(await open(page, `/?seed=${date}&solution&debug`)), SKIP);
    const start = await J(page);
    expect(start.theme).toMatchObject({ name: "glace", ofDay: "glace", forced: false });
    expect(start.daily).toMatchObject({ date, theme: "glace", forcedTheme: false, id: `jour-${date}-g${GENERATOR}` });
    expect(start.daily!.pieces.filter((p) => p.mechanic === "glace").length).toBeGreaterThanOrEqual(2);
    // La glace est dessinée dans les tuiles pleines (aucun chevron : pas de tapis dans ce thème).
    expect(start.theme.stats!.beltTiles).toBe(0);
    const { ticks, kinds } = await playToEnd(page);
    expect(ticks).toBe(start.daily!.authorTicks);
    expect((await J(page)).attempt).toMatchObject({ status: "arrivé", time: start.daily!.authorTicks, deaths: 0 });
    expect(kinds).toContain("glaceDebut");
    await frames(page);
    expect(errors).toEqual([]);
  });
});

/** Lit les commandes de la solution stockée d'un morceau (`arrêt`) : la liste des 3 bits de chaque pas, et son temps. */
function solutionBits(id: string, variant: number): { bits: number[]; ticks: number } {
  const s = moduleSolutions(id, variant)!.arret!;
  return { bits: fromRuns(decodeReplay(s.code).runs), ticks: s.ticks };
}

/** Compresse les commandes en séries [bits, nombre de pas]. */
function runsOf(bits: readonly number[]): [number, number][] {
  const out: [number, number][] = [];
  for (const b of bits) {
    const last = out[out.length - 1];
    if (last && last[0] === b) last[1]++;
    else out.push([b, 1]);
  }
  return out;
}

test.describe("au doigt (téléphone en paysage)", () => {
  const VIEW = { width: 844, height: 390 };
  // Zones : ← dans le premier quart, → dans le deuxième, saut dans la moitié droite (voir `touch.ts` et `mobile.spec.ts`).
  const at = { left: [VIEW.width * 0.12, VIEW.height * 0.75], right: [VIEW.width * 0.37, VIEW.height * 0.75], jump: [VIEW.width * 0.75, VIEW.height * 0.75] } as const;
  const LEFT = 1;
  const RIGHT = 2;
  const JUMP = 4;

  /** Pose la solution doigt par doigt : un doigt de direction (glissé d'une zone à l'autre), un doigt de saut ; chaque série est jouée pas à pas. */
  async function playByFingers(page: Page, bits: readonly number[]): Promise<void> {
    const fingers = await Fingers.on(page);
    let dir = 0;
    let jump = false;
    for (const [b, n] of runsOf(bits)) {
      const wantDir = b & LEFT && !(b & RIGHT) ? LEFT : b & RIGHT && !(b & LEFT) ? RIGHT : 0;
      if (wantDir !== dir) {
        if (dir === 0) await fingers.down(1, ...(wantDir === LEFT ? at.left : at.right));
        else if (wantDir === 0) await fingers.up(1);
        else await fingers.move(1, ...(wantDir === LEFT ? at.left : at.right));
        dir = wantDir;
      }
      const wantJump = (b & JUMP) !== 0;
      if (wantJump !== jump) {
        if (wantJump) await fingers.down(2, ...at.jump);
        else await fingers.up(2);
        jump = wantJump;
      }
      expect((await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.touch.bits)), "les doigts donnent les commandes de la solution").toBe(b === (LEFT | RIGHT) ? 0 : b);
      const phase = await page.evaluate((k) => {
        const j = (window as unknown as { __jump: Jump }).__jump;
        for (let t = 0; t < k; t++) {
          j.advance(1);
          if (j.phase === "finished" || j.phase === "carnage") break;
        }
        return j.phase;
      }, n);
      if (phase === "finished" || phase === "carnage") break;
    }
    if (dir !== 0) await fingers.up(1);
    if (jump) await fingers.up(2);
  }

  for (const [id, mechanic, theme] of [
    ["tapis-respiration", "tapis", "usine"],
    ["glace-promenade", "glace", "glace"],
  ] as const) {
    test(`?module=${id} (${mechanic}) se joue au doigt : la solution posée doigt par doigt finit au temps de la solution, dans le thème ${theme}`, async ({ browser }) => {
      test.setTimeout(180_000);
      await withPhone(browser, VIEW, async (page) => {
        const errors = watchErrors(page);
        const { bits, ticks } = solutionBits(id, 0);
        test.skip(!(await open(page, `/?module=${id}&variante=0&touch=1&debug`)), SKIP);
        const start = await J(page);
        // Le morceau d'une mécanique s'ouvre dans son thème, même sans `&theme=` dans l'adresse.
        expect(start.theme.name).toBe(theme);
        expect(start.module).toMatchObject({ id, variant: 0, reference: ticks });
        if (mechanic === "tapis") expect(start.theme.stats!.beltTiles).toBeGreaterThan(0);
        await playByFingers(page, bits);
        const end = await J(page);
        expect(end.attempt.status).toBe("arrivé");
        expect(end.attempt.deaths).toBe(0);
        expect(end.attempt.time).toBe(ticks);
        expect(end.tuned).toBe(false);
        await frames(page);
        expect(errors).toEqual([]);
      });
    });
  }
});

test("un thème forcé est un essai : autre niveau (identifiant -t<thème>), arrivée jouée jusqu'au bout, et rien n'est enregistré (ni historique, ni série, ni mémoire du jour)", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page) => {
    // Aujourd'hui (20/10/2026), thème forcé « usine » (ou « glace » si c'est déjà celui du jour).
    const natural = await (async () => {
      await page.goto("/?debug&accueil=0");
      if (!(await hasWebGL(page))) return null;
      await ready(page);
      return (await J(page)).theme.ofDay;
    })();
    test.skip(natural === null, SKIP);
    const forced = natural === "usine" ? "glace" : "usine";
    expect(await open(page, `/?theme=${forced}&debug`)).toBe(true);
    const start = await J(page);
    expect(start.daily).toMatchObject({ date: TODAY, mode: "essai", theme: forced, forcedTheme: true, id: `jour-${TODAY}-g${GENERATOR}-t${forced}` });
    expect(start.theme).toMatchObject({ name: forced, forced: true, ofDay: natural });
    await expect(page.locator("#dayline")).toContainText("essai de thème");
    await expect(page.locator("#modetag")).toContainText(`Essai`);
    // Jouée comme un joueur (l'essai est « enregistré » par le jeu : c'est la mémoire qui doit le refuser).
    const n = await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.autoplay());
    expect(n).toBe(start.daily!.authorTicks);
    const end = await playToEnd(page, n + 50);
    expect(end.ticks).toBeGreaterThan(0);
    await frames(page, 3);
    const after = await J(page);
    expect(after.attempt).toMatchObject({ status: "arrivé", deaths: 0 });
    expect(after.history).toEqual([]);
    expect(after.streak).toBe(0);
    expect(after.memory).toMatchObject({ best: null, lives: 0, deaths: 0 });
    expect(after.arrival.shown).toBe(false); // pas d'écran d'arrivée du jour : le bandeau d'essai
    await expect(page.locator("#finish .title")).toContainText("essai");
    await expect(page.locator("#finish .ref")).toContainText("rien n'est enregistré");
    // Rien dans le stockage : ni historique, ni meilleur essai, ni vies, ni morts, ni jour.
    const keys = await page.evaluate(() => Object.keys(localStorage));
    for (const k of keys) {
      expect(k, k).not.toMatch(/^jump:(historique|meilleur|vies|morts)/);
    }
    // Recharger : le niveau ordinaire de la même date n'a rien gardé non plus, le meilleur du jour est vide.
    await page.goto("/?debug&accueil=0");
    await ready(page);
    const reloaded = await J(page);
    expect(reloaded.daily).toMatchObject({ mode: "jour", forcedTheme: false, id: dayId(TODAY) });
    expect(reloaded.history).toEqual([]);
    expect(reloaded.memory.best).toBeNull();
  });
});

test("?theme= avec le thème de la date donne le niveau ordinaire (pas un essai) ; sur le site publié, un essai s'ouvre pour aujourd'hui, une date future reste refusée", async ({ browser }) => {
  await atInstant(browser, FIXED_NOW, async (page, context) => {
    await servePublished(context);
    await page.goto("/?debug&accueil=0");
    test.skip(!(await hasWebGL(page)), SKIP);
    await ready(page);
    const natural = (await J(page)).theme.ofDay;
    expect(await open(page, `/?theme=${natural}&debug`)).toBe(true);
    expect((await J(page)).daily).toMatchObject({ mode: "jour", forcedTheme: false, id: dayId(TODAY) });
    const other = natural === "foret" ? "nuit" : "foret";
    expect(await open(page, `${PUBLISHED}?theme=${other}&debug`)).toBe(true);
    expect((await J(page)).daily).toMatchObject({ mode: "essai", forcedTheme: true });
    expect((await J(page)).tuned).toBe(false);
    // Une date future reste refusée sur le site publié, thème forcé ou non.
    expect(await open(page, `${PUBLISHED}?seed=2026-10-23&theme=${other}&debug`)).toBe(true);
    const refused = await J(page);
    expect(refused.daily!.date).toBe(TODAY);
  });
});

test("ronronnement des tapis : une voix par plage proche (au plus trois), plus faible quand on s'éloigne, muette en pause", async ({ page }) => {
  test.skip(!(await open(page, "/?module=tapis-respiration&variante=0&debug")), SKIP);
  // Du départ jusqu'au tapis : le personnage court vers la droite.
  const reachedBelt = await page.evaluate(() => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    j.input(2);
    for (let t = 0; t < 600; t++) {
      j.advance(1);
      if (j.events.some((e) => e.kind === "tapisDebut")) return true;
    }
    return false;
  });
  expect(reachedBelt).toBe(true);
  await frames(page);
  const near = (await J(page)).audio.belts;
  expect(near.length).toBeGreaterThanOrEqual(1);
  expect(near.length).toBeLessThanOrEqual(3);
  expect(near[0]!.gain).toBeGreaterThan(0.005);
  expect(Math.abs(near[0]!.pan)).toBeLessThanOrEqual(1);
  // En pause (menu ouvert) : plus aucune voix.
  await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.setMenu(true));
  await frames(page);
  expect((await J(page)).audio.belts).toEqual([]);
  await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.setMenu(false));
  await frames(page);
  expect((await J(page)).audio.belts.length).toBeGreaterThanOrEqual(1);
});

test("les chevrons défilent avec les effets, figés avec ?fx=off ; ?debug&hitbox montre les surfaces sans erreur", async ({ page }) => {
  const errors = watchErrors(page);
  test.skip(!(await open(page, "/?module=tapis-respiration&variante=0&debug&hitbox")), SKIP);
  await frames(page, 6);
  const moving = (await J(page)).theme.stats!;
  expect(moving.beltTiles).toBeGreaterThan(0);
  expect(moving.beltPhase).toBeGreaterThan(0);
  const before = moving.beltPhase;
  await frames(page, 6);
  expect((await J(page)).theme.stats!.beltPhase).toBeGreaterThan(before);
  expect(await open(page, "/?module=tapis-respiration&variante=0&debug&fx=off")).toBe(true);
  await frames(page, 6);
  const still = (await J(page)).theme.stats!;
  expect(still.beltTiles).toBeGreaterThan(0); // les chevrons restent dessinés
  expect(still.beltPhase).toBe(0); // mais immobiles
  expect(errors).toEqual([]);
});

test("?debug&tune : la section « Tapis et glace » a ses trois curseurs ; en modifier un marque la partie (rien n'est enregistré), « Réinitialiser » le retire", async ({ page }) => {
  test.skip(!(await open(page, "/?scenario=bac-a-sable&debug&tune")), SKIP);
  await page.evaluate(() => localStorage.removeItem("jump:tune"));
  await page.reload();
  await ready(page);
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: Jump }).__jump;
    j.manual(true);
    j.restart();
  });
  await expect(page.locator("#tune .surfaces")).toContainText("Tapis et glace");
  for (const key of ["beltSpeed", "iceAccel", "iceDecel"]) await expect(page.locator(`#tune .surfaces input[data-key="${key}"]`)).toHaveCount(1);
  // Les valeurs par défaut sont montrées (réglages absents de `DEFAULT_JUMP_PARAMS`) et la partie n'est pas marquée.
  await expect(page.locator('#tune input[data-key="beltSpeed"]').locator("xpath=ancestor::label[1]")).toContainText("(171)");
  await expect(page.locator("#tuned")).toBeEmpty();
  const speed = page.locator('#tune input[data-key="beltSpeed"]');
  await speed.evaluate((el: HTMLInputElement) => {
    el.value = "260";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await page.evaluate(() => (window as unknown as { __jump: Jump }).__jump.advance(1));
  await expect(page.locator("#tuned")).toHaveText("réglages modifiés : rien n'est enregistré");
  expect(await page.evaluate(() => (window as unknown as { __jump: { params: { beltSpeed?: number } } }).__jump.params.beltSpeed)).toBe(260);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("jump:tune") ?? "{}").beltSpeed)).toBe(260);
  await page.getByRole("button", { name: "Réinitialiser" }).click();
  expect(await page.evaluate(() => localStorage.getItem("jump:tune"))).toBeNull();
  expect(await page.evaluate(() => (window as unknown as { __jump: { params: { beltSpeed?: number } } }).__jump.params.beltSpeed)).toBeUndefined();
  await expect(page.locator('#tune input[data-key="beltSpeed"]').locator("xpath=ancestor::label[1]")).toContainText("(171)");
});

test("?modules (téléphone) : le filtre « Thème » (cible ≥ 44 px) isole les morceaux de mécanique, et leurs liens portent &theme=<nom> ; « Jouer » ouvre le morceau dans son thème", async ({ browser }) => {
  await withPhone(browser, { width: 390, height: 844 }, async (page) => {
    await page.goto("/?modules&debug");
    await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "gallery");
    const select = page.locator("#gallery select[name=theme]");
    const box = (await select.boundingBox())!;
    expect(box.height).toBeGreaterThanOrEqual(44);
    const all = await page.locator("#gallery .card").count();
    await select.selectOption("usine");
    const usine = await page.locator("#gallery .card:not([hidden])").count();
    expect(usine).toBeGreaterThanOrEqual(5);
    expect(usine).toBeLessThan(all);
    await expect(page.locator("#gallery .count")).toContainText(`sur ${all}`);
    for (const card of await page.locator("#gallery .card:not([hidden])").all()) {
      // Un morceau de mécanique a (au moins) une variante de ce thème ; ses liens portent le thème, ceux d'une variante sans mécanique non.
      await expect(card.locator(".tag.theme[data-theme=usine]").first()).toBeVisible();
      for (const row of await card.locator(".variant").all()) {
        const themed = (await row.locator(".tag.theme").count()) > 0 ? await row.locator(".tag.theme").first().getAttribute("data-theme") : null;
        for (const a of await row.locator("a.play, a.watch").all()) {
          if (themed) expect(await a.getAttribute("href")).toContain(`theme=${themed}`);
          else expect(await a.getAttribute("href")).not.toContain("theme=");
        }
      }
    }
    await select.selectOption("glace");
    expect(await page.locator("#gallery .card:not([hidden])").count()).toBeGreaterThanOrEqual(5);
    // Lot 19 : un morceau générique peut avoir une variante glace (`corniches` v6) : la première carte n'est plus forcément un morceau de glace,
    // et sa première variante n'a pas de thème. Le lien d'une variante de glace, lui, porte le thème.
    await expect(page.locator("#gallery .card:not([hidden]) .variant:has(.tag.theme[data-theme=glace]) a.play").first()).toHaveAttribute("href", /theme=glace/);
    // « sans mécanique » : les morceaux de tous les thèmes ; aucun lien ne force de thème pour une variante sans mécanique.
    await select.selectOption("sans");
    const plain = page.locator("#gallery .card:not([hidden])").first();
    const href = await plain.locator("a.play").first().getAttribute("href");
    expect(href).not.toMatch(/theme=/);
    // « Jouer » sur un morceau à tapis ouvre le niveau dans le thème usine.
    await select.selectOption("usine");
    await page.locator("#gallery .card:not([hidden]) .variant:has(.tag.theme[data-theme=usine]) a.play").first().tap();
    await page.waitForURL(/theme=usine/);
    test.skip(!(await hasWebGL(page)), SKIP);
    await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
    expect((await J(page)).theme.name).toBe("usine");
    expect((await J(page)).module).not.toBeNull();
  });
});
