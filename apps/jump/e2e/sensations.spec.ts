import { expect, test, type Page } from "@playwright/test";
import { hasWebGL, withPhone } from "./phone";

// Lot 8 : les sensations. Événements de jeu en pas à pas (`__jump.events`), son déverrouillé par un geste sans erreur, menu ⏸ (clavier et
// doigt : pause, chrono figé, réglages gardés au rechargement, cibles ≥ 44 px en portrait et en paysage), `?fx=off` et mouvement réduit
// (ni particule ni secousse, mais les taches restent).

const RIGHT = 2;
const JUMP = 4;

interface Ev {
  kind: string;
  source: string;
  tick: number;
  intensity?: number;
  cause?: string;
  checkpoint?: boolean;
}
interface J {
  phase: string;
  attempt: { time: number; status: string };
  fx: { enabled: boolean; emitted: number; alive: number; shaking: boolean };
  effects: { levels: { particles: number; shake: number; continuous: boolean }; emitted: number; alive: number; shaking: boolean; trail: number };
  stains: { count: number };
  events: Ev[];
  audio: { available: boolean; unlocked: boolean; state: string; requested: Record<string, number>; played: Record<string, number>; errors: number };
  settings: { volume: number; sfx: number; ambience: number; vibration: boolean; shake: string; effects: string; reducedMotion: boolean };
  menu: { open: boolean };
  tuned: boolean;
  clearEvents(): void;
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
}
const get = <T>(page: Page, f: (j: J) => T): Promise<T> => page.evaluate(`(${f.toString()})(window.__jump)`) as Promise<T>;

async function open(page: Page, extra = "", manual = true): Promise<boolean> {
  await page.goto(`/?scenario=essai&debug${extra}`);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
  if (manual) await page.evaluate(() => (window as unknown as { __jump: J }).__jump.manual(true));
  return true;
}

/** Pas à pas avec une commande, jusqu'à `until` (au plus `max` pas) ; rend le nombre de pas joués. */
function run(page: Page, bits: number, max: number, until: "dead" | "ground" | null = null): Promise<number> {
  return page.evaluate(
    ([b, m, u]) => {
      const j = (window as unknown as { __jump: J }).__jump;
      j.input(b as number);
      for (let t = 1; t <= (m as number); t++) {
        j.advance(1);
        if (u === "dead" && j.phase === "dead") return t;
        if (u === "ground" && (j as unknown as { player: { ground: boolean } }).player.ground) return t;
      }
      return m as number;
    },
    [bits, max, until] as const,
  );
}

test("__jump.events en pas à pas : saut, atterrissage, pas, mort par un pic, réapparition ; les sons sont décidés", async ({ page }) => {
  test.skip(!(await open(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  expect(await get(page, (j) => j.events)).toEqual([]);
  // Un saut sur place puis la retombée.
  await run(page, JUMP, 2);
  await run(page, 0, 90, "ground");
  let events = await get(page, (j) => j.events);
  expect(events.map((e) => e.kind)).toEqual(["saut", "atterrissage"]);
  expect(events.every((e) => e.source === "jeu")).toBe(true);
  expect(events[1]!.tick).toBeGreaterThan(events[0]!.tick);
  expect(events[1]!.intensity).toBeGreaterThan(0.3);
  // Courir dans les pics du début : des pas, puis la mort ; attendre la réapparition.
  await get(page, (j) => j.clearEvents());
  expect(await run(page, RIGHT, 400, "dead")).toBeLessThan(400);
  await run(page, 0, 30);
  events = await get(page, (j) => j.events);
  const kinds = events.map((e) => e.kind);
  expect(kinds).toContain("pas");
  expect(events.find((e) => e.kind === "mort")?.cause).toBe("pic");
  expect(kinds.indexOf("reapparition")).toBeGreaterThan(kinds.indexOf("mort"));
  expect(events.find((e) => e.kind === "reapparition")?.checkpoint).toBe(false);
  // Le son a décidé un son par événement (il les joue dès qu'un geste a déverrouillé le contexte).
  const audio = await get(page, (j) => j.audio);
  expect(audio.requested.saut).toBe(1);
  expect(audio.requested.mort).toBe(1);
  expect(audio.requested.reapparition).toBe(1);
  expect(audio.requested.pas).toBeGreaterThan(0);
  // Les réglages du joueur ne rendent jamais la partie « tuned ».
  expect(await get(page, (j) => j.tuned)).toBe(false);
});

test("un geste déverrouille le son, sans aucune erreur ; un saut est alors joué", async ({ page, browserName }) => {
  const errors: string[] = [];
  page.on("pageerror", (e) => errors.push(e.message));
  page.on("console", (m) => {
    if (m.type() === "error") errors.push(m.text());
  });
  test.skip(!(await open(page, "", false)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  const before = await get(page, (j) => j.audio);
  expect(before.state).toBe("aucun"); // rien avant le premier geste
  await page.keyboard.press("KeyD");
  await page.mouse.click(400, 300);
  const audio = await get(page, (j) => j.audio);
  if (audio.available) {
    expect(audio.state).not.toBe("aucun"); // le contexte est créé pendant le geste
    // Chromium sans tête démarre le contexte ; ailleurs, il peut rester suspendu sans périphérique de sortie (sans erreur).
    if (browserName === "chromium") await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.audio.unlocked);
  }
  await page.evaluate(() => (window as unknown as { __jump: J }).__jump.manual(true));
  await run(page, JUMP, 2);
  await run(page, 0, 90, "ground");
  const after = await get(page, (j) => j.audio);
  if (after.unlocked) {
    expect(after.played.saut).toBeGreaterThanOrEqual(1);
    expect(after.played.atterrissage).toBeGreaterThanOrEqual(1);
  }
  expect(after.errors).toBe(0);
  expect(errors).toEqual([]);
});

test("menu ⏸ au clavier : Échap met en pause (chrono figé), P aussi ; les réglages sont gardés au rechargement", async ({ page }) => {
  test.skip(!(await open(page, "", false)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  // Courir en temps réel jusqu'à ce que le chrono tourne.
  await get(page, (j) => j.input(2));
  await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.attempt.time > 20);
  await page.keyboard.press("Escape");
  await expect(page.locator("#menu")).toBeVisible();
  const t1 = await get(page, (j) => j.attempt.time);
  await page.waitForTimeout(600); // rien ne doit bouger pendant la pause
  expect(await get(page, (j) => j.attempt.time)).toBe(t1);
  // Réglages (lot I5 : un écran du cadre crème, ouvert depuis la pause) : effets réduits, volume 30 %, vibrations coupées.
  await page.locator("#menu-settings").click();
  await expect(page.locator("#settings")).toBeVisible();
  await page.locator('#settings [data-setting="effects"] button[data-value="reduit"]').click();
  await page.locator('#settings [data-setting="volume"] input').fill("30");
  await page.locator('#settings [data-setting="vibration"] button[data-value="false"]').click();
  expect(await get(page, (j) => j.settings)).toMatchObject({ effects: "reduit", volume: 0.3, vibration: false });
  expect(await get(page, (j) => j.tuned)).toBe(false);
  // Échap ferme les Réglages (la pause revient), puis la pause : le chrono repart (il change : il avance, ou repart de 0 après une mort sans
  // point de passage).
  await page.keyboard.press("Escape");
  await expect(page.locator("#settings")).toBeHidden();
  await expect(page.locator("#menu")).toBeVisible();
  await page.keyboard.press("Escape");
  await expect(page.locator("#menu")).toBeHidden();
  await page.waitForFunction((t) => (window as unknown as { __jump: J }).__jump.attempt.time !== t, t1);
  // P ouvre et ferme aussi.
  // (le menu s'ouvre à l'image suivante, comme « recommencer »)
  await page.keyboard.press("KeyP");
  await expect.poll(() => get(page, (j) => j.menu.open)).toBe(true);
  await page.keyboard.press("KeyP");
  await expect.poll(() => get(page, (j) => j.menu.open)).toBe(false);
  // Rechargement : les réglages sont relus (`jump:settings`), le menu les montre.
  await page.reload();
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
  expect(await get(page, (j) => j.settings)).toMatchObject({ effects: "reduit", volume: 0.3, vibration: false });
  expect(await get(page, (j) => j.effects.levels.particles)).toBe(0.5);
  await page.keyboard.press("Escape");
  await page.locator("#menu-settings").click();
  await expect(page.locator('#settings [data-setting="volume"] input')).toHaveValue("30");
  await expect(page.locator('#settings [data-setting="effects"] button[data-value="reduit"]')).toHaveAttribute("aria-pressed", "true");
  await page.locator("#settings .dj-barre-jeu__retour").click();
  // « Recommencer » du menu : retour au départ, menu fermé.
  await get(page, (j) => j.input(0));
  await page.locator("#menu-restart").click();
  await expect(page.locator("#menu")).toBeHidden();
  await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.attempt.time === 0);
});

test("?fx=off : ni particule ni secousse à la mort ni à l'atterrissage, mais la tache reste", async ({ page }) => {
  test.skip(!(await open(page, "&fx=off")), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  await run(page, JUMP, 2);
  await run(page, 0, 90, "ground");
  expect(await run(page, RIGHT, 400, "dead")).toBeLessThan(400);
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  const fx = await get(page, (j) => ({ fx: j.fx, effects: j.effects, stains: j.stains.count }));
  expect(fx.fx).toEqual({ enabled: false, emitted: 0, alive: 0, shaking: false });
  expect(fx.effects.emitted).toBe(0);
  expect(fx.effects.shaking).toBe(false);
  expect(fx.stains).toBeGreaterThan(0);
});

test("mouvement réduit demandé par le système : actif par défaut, ni particule ni secousse, la tache reste ; sans lui, les effets partent", async ({ browser }) => {
  const calm = await browser.newContext({ reducedMotion: "reduce" });
  try {
    const page = await calm.newPage();
    test.skip(!(await open(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
    expect((await get(page, (j) => j.settings)).reducedMotion).toBe(true);
    await run(page, JUMP, 2);
    await run(page, 0, 90, "ground");
    expect(await run(page, RIGHT, 400, "dead")).toBeLessThan(400);
    const fx = await get(page, (j) => ({ fx: j.fx, effects: j.effects, stains: j.stains.count }));
    expect(fx.fx.emitted).toBe(0);
    expect(fx.fx.shaking).toBe(false);
    expect(fx.effects.emitted).toBe(0);
    expect(fx.effects.shaking).toBe(false);
    expect(fx.stains).toBeGreaterThan(0);
  } finally {
    await calm.close();
  }
  const normal = await browser.newContext({ reducedMotion: "no-preference" });
  try {
    const page = await normal.newPage();
    test.skip(!(await open(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
    expect((await get(page, (j) => j.settings)).reducedMotion).toBe(false);
    await run(page, JUMP, 2);
    await run(page, 0, 90, "ground");
    expect(await get(page, (j) => j.effects.emitted)).toBeGreaterThan(0); // poussière du saut et de l'atterrissage
    // La secousse de la mort (0,12 s) s'use à chaque image affichée, même en pas à pas : on la lit dans la même évaluation que le pas de la
    // mort, avant qu'une image ne passe (sur WebKit, plus lent, une seule image entre deux évaluations suffisait à l'éteindre).
    const { steps, fx } = await page.evaluate((bits) => {
      const j = (window as unknown as { __jump: J }).__jump;
      j.input(bits);
      for (let t = 1; t <= 400; t++) {
        j.advance(1);
        if (j.phase === "dead") return { steps: t, fx: j.fx };
      }
      return { steps: 400, fx: j.fx };
    }, RIGHT);
    expect(steps).toBeLessThan(400);
    expect(fx.emitted).toBeGreaterThan(0);
    expect(fx.shaking).toBe(true);
  } finally {
    await normal.close();
  }
});

for (const [name, viewport] of [
  ["portrait", { width: 390, height: 844 }],
  ["paysage", { width: 844, height: 390 }],
] as const) {
  test(`menu ⏸ au doigt (${name}) : la partie est en pause, cibles d'au moins 44 px, dans l'écran ; Reprendre`, async ({ browser }) => {
    await withPhone(browser, viewport, async (page) => {
      test.skip(!(await open(page, "&touch=1", false)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
      await get(page, (j) => j.input(2));
      await page.waitForFunction(() => (window as unknown as { __jump: J }).__jump.attempt.time > 20);
      const pause = page.locator("#pausebtn");
      const pb = (await pause.boundingBox())!;
      expect(pb.width).toBeGreaterThanOrEqual(44);
      expect(pb.height).toBeGreaterThanOrEqual(44);
      await pause.tap();
      await expect(page.locator("#menu")).toBeVisible();
      const t1 = await get(page, (j) => j.attempt.time);
      await page.waitForTimeout(500); // rien ne doit bouger pendant la pause
      expect(await get(page, (j) => j.attempt.time)).toBe(t1);
      const box = (await page.locator("#menu").boundingBox())!;
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(viewport.height + 0.5);
      // Lot I5 : la pause porte les actions (reprendre, recommencer, fantôme, son, réglages…) ; les réglages fins sont dans l'écran Réglages, mesuré
      // plus bas.
      const targets = page.locator("#menu button:visible, #menu a:visible");
      const n = await targets.count();
      expect(n).toBeGreaterThanOrEqual(8);
      for (let i = 0; i < n; i++) {
        const t = targets.nth(i);
        await t.scrollIntoViewIfNeeded();
        const b = (await t.boundingBox())!;
        const label = (await t.getAttribute("data-value")) ?? (await t.textContent()) ?? `n° ${i}`;
        expect(b.width, label).toBeGreaterThanOrEqual(44);
        expect(b.height, label).toBeGreaterThanOrEqual(44);
      }
      // Un réglage au doigt (Réglages, depuis la pause : cibles de 44 px, curseurs compris), « ‹ JUMP », puis « Reprendre » : le chrono repart.
      await page.locator("#menu-settings").tap();
      await expect(page.locator("#settings")).toBeVisible();
      const reglages = page.locator("#settings button, #settings input, #settings a");
      const m = await reglages.count();
      expect(m).toBeGreaterThanOrEqual(15);
      for (let i = 0; i < m; i++) {
        const t = reglages.nth(i);
        if (!(await t.isVisible())) continue;
        await t.scrollIntoViewIfNeeded();
        const b = (await t.boundingBox())!;
        const label = (await t.getAttribute("data-value")) ?? (await t.textContent()) ?? `n° ${i}`;
        expect(b.width, label).toBeGreaterThanOrEqual(44);
        expect(b.height, label).toBeGreaterThanOrEqual(44);
      }
      const shake = page.locator('#settings [data-setting="shake"] button[data-value="aucun"]');
      await shake.scrollIntoViewIfNeeded();
      await shake.tap();
      expect((await get(page, (j) => j.settings)).shake).toBe("aucun");
      await page.locator("#settings .dj-barre-jeu__retour").tap();
      await expect(page.locator("#settings")).toBeHidden();
      const resume = page.locator("#menu-resume");
      await resume.scrollIntoViewIfNeeded();
      await resume.tap();
      await expect(page.locator("#menu")).toBeHidden();
      await page.waitForFunction((t) => (window as unknown as { __jump: J }).__jump.attempt.time !== t, t1);
    });
  });
}
