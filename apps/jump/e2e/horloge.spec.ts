import { expect, test, type Page } from "@playwright/test";
import { parseDay } from "@cdj/core";
import { ATTEMPT_DEAD, DEFAULT_JUMP_PARAMS, INPUT_JUMP, INPUT_RIGHT, attemptReplay, dailyLevel, encodeReplay, fromRuns, initialAttempt, jumpThemeForDay, stepAttempt } from "@cdj/jump-sim";
import { FROZEN_DATES, generatedDay, pageLevel } from "./jours";
import { hasWebGL } from "./phone";

// Lot 15 — l'horloge unique dans le jeu. Un niveau du jour en v4 (généré : un jour sans fichier figé) : le « Prêt… » (lot 27 : le décompte « 3, 2, 1, Partez ! », 1,5 s) pendant lequel les
// dangers bougent déjà (dessinés au chrono négatif), puis le chrono part à heure fixe, que le joueur bouge ou non ; la pause fige tout. Un
// jour figé en v3 garde l'ancien départ (le monde attend la première commande). Tout se lit en pas à pas, sauf la pause (« rien ne change »).

interface J {
  phase: string;
  pret: { ticks: number; total: number; level: number };
  attempt: { status: string; time: number; saws: { x: number; y: number }[] };
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
  setMenu(open: boolean): void;
}

const jump = (page: Page) =>
  page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    return { phase: j.phase, pret: j.pret, attempt: j.attempt };
  });

/**
 * Un jour dont le niveau, de la version demandée, a au moins une scie mobile : de quoi voir un danger bouger avant le départ. La v4 (horloge unique, générateurs
 * g10 à g14) ne se génère plus depuis le lot 20 : on prend un jour **figé** en v4 ; la v9 (lasers, g19 ; v8 : stalactites, g18 ; v7 : champignons, g17 ; v6 : presses, g16 ; v5 : plateformes mobiles, g15) est celle d'un jour sans fichier figé.
 */
function dayWithSaw(version: 4 | 12): string {
  const movingSaw = (date: string) => pageLevel(date).level.saws.some((s) => s.cycle > 0);
  if (version === 4) {
    const date = FROZEN_DATES.filter((d) => pageLevel(d).level.simVersion === 4).find(movingSaw);
    if (!date) throw new Error("aucun jour figé en v4 avec une scie mobile");
    return date;
  }
  let day = parseDay(generatedDay())!;
  for (let k = 0; k < 30; k++, day++) if (dailyLevel(day).level.saws.some((s) => s.cycle > 0)) return dailyLevel(day).date;
  throw new Error("aucun jour généré avec une scie mobile");
}

async function open(page: Page, date: string): Promise<boolean> {
  await page.goto(`./?seed=${date}&debug&accueil=0`);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: J }).__jump?.phase ?? ""));
  return true;
}

for (const version of [4, 12] as const) test(`niveau v${version} : pendant le « Prêt… » les dangers bougent déjà, puis le chrono part à heure fixe sans commande ; « recommencer » relance le « Prêt… »`, async ({ page }) => {
  const date = dayWithSaw(version);
  test.skip(!(await open(page, date)), "pas de WebGL dans ce navigateur");
  // Un « Prêt… » neuf : jusqu'à `manual(true)` la boucle tourne en temps réel et a pu en consommer une partie en se chargeant (WebKit : 20 pas).
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    j.restart();
  });
  const s0 = await jump(page);
  expect(s0.pret.level).toBe(version);
  expect(s0.pret.ticks).toBe(s0.pret.total);
  expect(s0.pret.total).toBe(180); // lot 27 : le décompte « 3, 2, 1, Partez ! » dure 1,5 s (1 s avant : « Prêt… »)
  expect(s0.attempt.time).toBe(-s0.pret.total);
  // Avant le départ : le chrono (de l'état montré) est négatif, la partie n'a pas commencé, mais au moins une scie a bougé.
  await page.evaluate(() => (window as unknown as { __jump: J }).__jump.advance(30));
  const s1 = await jump(page);
  expect(s1.attempt.time).toBe(-s0.pret.total + 30);
  expect(s1.attempt.status).toBe("attend");
  expect(s1.phase).toBe("ready");
  expect(s1.attempt.saws).not.toEqual(s0.attempt.saws);
  // Fin du « Prêt… » : le chrono part, sans aucune commande.
  await page.evaluate((n) => (window as unknown as { __jump: J }).__jump.advance(n), s0.pret.total - 30);
  const s2 = await jump(page);
  expect([s2.pret.ticks, s2.attempt.time]).toEqual([0, 0]);
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.input(0);
    j.advance(12);
  });
  const s3 = await jump(page);
  expect([s3.attempt.status, s3.attempt.time]).toEqual(["course", 12]);
  // Recommencer : un nouveau « Prêt… » (chrono négatif), l'horloge repart de là.
  await page.evaluate(() => (window as unknown as { __jump: J }).__jump.restart());
  const s4 = await jump(page);
  expect([s4.pret.ticks, s4.attempt.time]).toEqual([s0.pret.total, -s0.pret.total]);
});

// Lot R13 : la pause sur le niveau du jour seulement (v8 depuis le lot 24) (la même règle qu'en v4 ; le « Prêt… » du v4 figé est vérifié plus haut).
for (const version of [12] as const) test(`niveau v${version} : la pause fige tout, « Prêt… » compris ; le « Prêt… » reprend à la fermeture`, { tag: "@regression" }, async ({ page }) => {
  const date = dayWithSaw(version);
  test.skip(!(await open(page, date)), "pas de WebGL dans ce navigateur");
  // Un « Prêt… » neuf (la page a pu le consommer en se chargeant), puis la pause tout de suite, boucle en temps réel.
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    j.restart();
    j.setMenu(true);
    j.manual(false);
  });
  const before = await jump(page);
  expect(before.pret.ticks).toBe(before.pret.total);
  // « Rien ne doit changer pendant N ms » : la seule attente sur une durée permise.
  await page.waitForTimeout(500);
  const after = await jump(page);
  expect(after.pret.ticks).toBe(before.pret.ticks);
  expect(after.attempt.saws).toEqual(before.attempt.saws);
  expect(after.attempt.time).toBe(before.attempt.time);
  await page.evaluate(() => (window as unknown as { __jump: J }).__jump.setMenu(false));
  await page.waitForFunction((t) => (window as unknown as { __jump: J }).__jump.pret.ticks < t, before.pret.ticks);
});

test("jour figé en v3 : pas de « Prêt… », le monde attend la première commande (comportement d'avant le lot 15)", async ({ page }) => {
  // Lot 16 : le dernier jour figé peut être en v4 (un jour figé par un générateur g10 ou plus) : on prend le dernier figé en v3.
  const date = FROZEN_DATES.filter((d) => pageLevel(d).level.simVersion === 3).at(-1)!;
  test.skip(!(await open(page, date)), "pas de WebGL dans ce navigateur");
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J }).__jump;
    j.manual(true);
    j.input(0);
    j.advance(60);
  });
  const s = await jump(page);
  expect(s.pret).toMatchObject({ ticks: 0, level: 3 });
  expect([s.attempt.status, s.attempt.time]).toEqual(["attend", 0]);
});

// ——— Lot 27 — les ajustements de jeu, dans la vraie page (niveau du jour généré : version 11) : le décompte « 3, 2, 1, Partez ! » (1,5 s, au premier départ et à « recommencer à zéro », jamais
// après une mort), une mort avant le premier point de passage = un nouvel essai à zéro tout de suite, la reprise volontaire (touche R) qui ne compte pas comme une mort, les mêmes touches que
// DailyTrack, les plaques tactiles à côté de la pause, le résultat posé sur la scène pendant la rediffusion et le carnage. Tout se joue pas à pas (`manual` + `advance`). ———
interface J27 {
  phase: string;
  simVersion: number;
  pret: { ticks: number; total: number; level: number };
  attempt: { status: string; time: number; deaths: number; attempts: number; checkpoint: number; checkpoints: number; deathTicks: number; respawnTicks: number };
  player: { x: number; y: number };
  manual(on: boolean): void;
  advance(n: number): unknown;
  input(bits: number | null): void;
  restart(): void;
  respawn(): void;
  autoplay(code?: string): number;
}

const jump27 = (page: Page) =>
  page.evaluate(() => {
    const j = (window as unknown as { __jump: J27 }).__jump;
    return { phase: j.phase, simVersion: j.simVersion, pret: { ...j.pret }, attempt: { ...j.attempt, raw: undefined }, x: j.player.x };
  });

/**
 * Le premier jour généré où courir à droite, sans sauter, tue avant le premier point de passage (le niveau de chaque jour est différent : le lendemain du
 * dernier jour figé n'a pas toujours un danger sur le chemin droit ; les jours figés par la mise en production déplacent ce jour-là).
 */
function dayWhereRunningRightDies(): string {
  let day = parseDay(generatedDay())!;
  for (let k = 0; k < 30; k++, day++) {
    const { level } = dailyLevel(day);
    let s = initialAttempt(level);
    for (let n = 0; n < 3000 && s.status !== ATTEMPT_DEAD; n++) s = stepAttempt(s, INPUT_RIGHT, level, DEFAULT_JUMP_PARAMS);
    if (s.status === ATTEMPT_DEAD && s.checkpoint < 0) return dailyLevel(day).date;
  }
  throw new Error("aucun jour généré où courir à droite tue avant le premier point de passage");
}

async function open27(page: Page, extra = "", date = generatedDay()): Promise<boolean> {
  await page.goto(`./?seed=${date}&debug&accueil=0${extra}`);
  if (!(await hasWebGL(page))) return false;
  await page.waitForFunction(() => ["ready", "playing"].includes((window as unknown as { __jump?: J27 }).__jump?.phase ?? ""));
  await page.addStyleTag({ content: "#debug, #stamp, #tuned { display: none !important; }" });
  return true;
}

test("le décompte : 3, 2, 1, puis « Partez ! » ; 1,5 s ; au premier départ et à « recommencer à zéro » (Entrée), jamais après une mort", async ({ page }) => {
  test.skip(!(await open27(page)), "pas de WebGL dans ce navigateur");
  expect((await jump27(page)).simVersion).toBeGreaterThanOrEqual(11);
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J27 }).__jump;
    j.manual(true);
    j.restart();
  });
  const s0 = await jump27(page);
  expect(s0.pret.total, "1,5 s = 180 pas").toBe(180);
  expect(s0.pret.ticks).toBe(180);
  const texte = async () => ((await page.locator("#decompte").isVisible()) ? await page.locator("#decompte").textContent() : "");
  const at = async (n: number) => {
    await page.evaluate(() => (window as unknown as { __jump: J27 }).__jump.advance(1));
    void n;
  };
  void at;
  const lu: string[] = [];
  for (const n of [10, 60, 60]) {
    await page.evaluate((k) => (window as unknown as { __jump: J27 }).__jump.advance(k), n);
    lu.push((await texte()) ?? "");
  }
  // Chaque tiers (60 pas) montre son chiffre : 3 (pas 10), 2 (pas 70), 1 (pas 130).
  expect(lu).toEqual(["3", "2", "1"]);
  await page.evaluate(() => (window as unknown as { __jump: J27 }).__jump.advance(49));
  expect(await texte()).toBe("1");
  // Le dernier pas donne le départ : « Partez ! », le chrono part à 0.
  await page.evaluate(() => (window as unknown as { __jump: J27 }).__jump.advance(1));
  expect(await texte()).toBe("Partez !");
  const s1 = await jump27(page);
  expect([s1.pret.ticks, s1.attempt.time]).toEqual([0, 0]);
  // Entrée : recommencer à zéro, avec décompte.
  await page.keyboard.press("Enter");
  await page.waitForFunction(() => (window as unknown as { __jump: J27 }).__jump.pret.ticks > 0);
  expect((await jump27(page)).attempt.time).toBeLessThan(0);
});

test("mort avant le premier point de passage : l'essai recommence à zéro tout de suite, sans décompte ; la mort est la sienne, l'essai d'avant est clos", async ({ page }) => {
  test.skip(!(await open27(page, "", dayWhereRunningRightDies())), "pas de WebGL dans ce navigateur");
  const r = await page.evaluate(() => {
    const j = (window as unknown as { __jump: J27 }).__jump;
    j.manual(true);
    j.restart();
    j.advance(180); // le décompte
    j.input(2);
    let n = 0;
    while (j.attempt.deaths === 0 && n++ < 3000) j.advance(1);
    const dead = { deaths: j.attempt.deaths, checkpoint: j.attempt.checkpoint, status: j.attempt.status };
    j.input(0);
    j.advance(j.attempt.respawnTicks);
    return { dead, after: { time: j.attempt.time, status: j.attempt.status, deaths: j.attempt.deaths, attempts: j.attempt.attempts, pret: j.pret.ticks, checkpoint: j.attempt.checkpoint } };
  });
  expect(r.dead).toMatchObject({ deaths: 1, checkpoint: -1, status: "mort" });
  expect(r.after).toMatchObject({ time: 0, status: "attend", deaths: 1, pret: 0, checkpoint: -1 });
  expect(r.after.attempts).toBeGreaterThanOrEqual(2);
  await expect(page.locator("#decompte")).toBeHidden();
});

test("R reprend au dernier point de passage (le chrono continue, pas une mort) ; avant le premier point R recommence à zéro, avec décompte", async ({ page }) => {
  test.skip(!(await open27(page)), "pas de WebGL dans ce navigateur");
  // Avant le premier point : R = recommencer à zéro (décompte).
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J27 }).__jump;
    j.manual(true);
    j.restart();
    j.advance(180);
    j.input(0);
    j.advance(20);
  });
  await page.keyboard.press("KeyR");
  await page.waitForFunction(() => (window as unknown as { __jump: J27 }).__jump.pret.ticks > 0);
  // Jusqu'au premier point : la preuve de l'auteur, pas à pas.
  const before = await page.evaluate(() => {
    const j = (window as unknown as { __jump: J27 }).__jump;
    j.autoplay();
    let n = 0;
    while (j.attempt.checkpoint < 0 && n++ < 6000) j.advance(1);
    j.advance(40);
    return { x: j.player.x, time: j.attempt.time, deaths: j.attempt.deaths, checkpoint: j.attempt.checkpoint };
  });
  expect(before.checkpoint).toBe(0);
  await page.keyboard.press("KeyR");
  // La demande est lue à l'image suivante (la boucle d'affichage) ; elle se joue au pas suivant.
  await page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  const after = await page.evaluate(() => {
    const j = (window as unknown as { __jump: J27 }).__jump;
    j.advance(1);
    return { x: j.player.x, time: j.attempt.time, deaths: j.attempt.deaths, checkpoint: j.attempt.checkpoint, pret: j.pret.ticks };
  });
  expect(after.x, "reposé sur le point, en arrière").toBeLessThan(before.x);
  expect(after.time, "le chrono continue").toBe(before.time + 1);
  expect(after.deaths, "pas une mort").toBe(before.deaths);
  expect([after.checkpoint, after.pret]).toEqual([0, 0]);
});

test("résultat posé sur la scène pendant la rediffusion et le carnage : le temps, la médaille, les morts ; REJOUER recommence à zéro avec le décompte", async ({ page }) => {
  test.skip(!(await open27(page)), "pas de WebGL dans ce navigateur");
  const n = await page.evaluate(() => {
    const j = (window as unknown as { __jump: J27 }).__jump;
    j.manual(true);
    j.restart();
    const n = j.autoplay();
    for (let t = 1; t <= n + 10; t++) {
      j.advance(1);
      if (j.phase === "carnage") return t;
    }
    return -1;
  });
  expect(n).toBeGreaterThan(0);
  const L = pageLevel(generatedDay());
  await expect(page.locator("#carnage")).toBeVisible();
  await expect(page.locator("#resultat")).toBeVisible();
  await expect(page.locator("#arrival")).toBeHidden();
  const secondes = (L.authorTicks / 120).toFixed(3).replace(".", ",");
  await expect(page.locator("#resultat .resultat__temps")).toContainText(secondes);
  await expect(page.locator("#resultat")).toContainText(/sans faute|mort/);
  await expect(page.locator("#resultat-rejouer")).toBeVisible();
  // Compact : il ne couvre ni le milieu (le héros) ni la droite (l'arrivée).
  const box = (await page.locator("#resultat").boundingBox())!;
  const vw = page.viewportSize()!.width;
  expect(box.x + box.width, "à gauche de l'écran").toBeLessThan(vw * 0.4);
  // Le carnage tourne (le résultat y est resté posé) ; REJOUER recommence à zéro.
  await page.evaluate(() => (window as unknown as { __jump: J27 }).__jump.advance(60));
  await expect(page.locator("#resultat")).toBeVisible();
  await page.locator("#resultat-rejouer").click();
  await page.waitForFunction(() => (window as unknown as { __jump: J27 }).__jump.pret.ticks > 0);
  await expect(page.locator("#resultat")).toBeHidden();
  await expect(page.locator("#carnage")).toBeHidden();
});

test("au doigt : le drapeau (dernier point de passage) et « recommencer » à côté de la pause, cibles de 44 px, en haut à gauche", async ({ browser }) => {
  const context = await browser.newContext({ viewport: { width: 844, height: 390 }, hasTouch: true, isMobile: true, locale: "fr-FR" });
  try {
    const page = await context.newPage();
    test.skip(!(await open27(page, "&touch=1")), "pas de WebGL dans ce navigateur");
    const boxes = {} as Record<string, { x: number; y: number; width: number; height: number }>;
    for (const id of ["pausebtn", "btn-respawn", "btn-restart"]) {
      const b = await page.locator(`#${id}`).boundingBox();
      expect(b, id).not.toBeNull();
      expect(b!.width, id).toBeGreaterThanOrEqual(44);
      expect(b!.height, id).toBeGreaterThanOrEqual(44);
      expect(b!.x + b!.width, id).toBeLessThan(844 * 0.3);
      boxes[id] = b!;
    }
    // Dans l'ordre de DailyTrack : pause, drapeau, recommencer ; sans chevauchement avec la bande du centre.
    expect(boxes.pausebtn!.x).toBeLessThan(boxes["btn-respawn"]!.x);
    expect(boxes["btn-respawn"]!.x).toBeLessThan(boxes["btn-restart"]!.x);
    const bande = (await page.locator("#chrono").boundingBox())!;
    expect(boxes["btn-restart"]!.x + boxes["btn-restart"]!.width).toBeLessThan(bande.x);
    // Recommencer : le décompte repart.
    await page.evaluate(() => {
    const j = (window as unknown as { __jump: J27 }).__jump;
      j.manual(true);
      j.restart();
      j.advance(180);
    });
    await page.locator("#btn-restart").tap();
    await page.waitForFunction(() => (window as unknown as { __jump: J27 }).__jump.pret.ticks > 0);
  } finally {
    await context.close();
  }
});

// ——— Lot 28 — les blocs alternés gardent leur état à la reprise (niveau du jour généré : version 12) ———
interface J28 extends J27 {
  blocks: { alt: number; alts: number; blinks: number; next?: number; pips?: number; marks?: number; states: boolean[]; phases: number[] } | null;
}

/**
 * Un jour généré du thème voulu où la preuve de l'auteur, puis (si `hop`) un saut juste après le premier point de passage et la course droite tenue, meurt avant le point suivant :
 * les commandes de l'essai, jouées par `autoplay`. Avec le saut, les blocs alternés sont en B à la mort ; sans, A (une nuit : pas d'alternés).
 */
function dayDyingAfterFirstPoint(theme: "neon" | "nuit", hop: boolean): { date: string; code: string } {
  let day = parseDay(generatedDay())!;
  for (let k = 0; k < 60; k++, day++) {
    if (jumpThemeForDay(day) !== theme) continue;
    const L = dailyLevel(day);
    const proof = fromRuns(L.replay.runs);
    let s = initialAttempt(L.level);
    const inputs: number[] = [];
    for (let t = 0; t < proof.length && s.checkpoint < 0; t++) {
      s = stepAttempt(s, proof[t]!, L.level, DEFAULT_JUMP_PARAMS);
      inputs.push(proof[t]!);
    }
    if (s.checkpoint < 0) continue;
    // Un saut en courant (il inverse les jeux), puis la droite tenue jusqu'à la mort.
    for (let t = 0; t < 6 && hop; t++) {
      s = stepAttempt(s, INPUT_RIGHT | INPUT_JUMP, L.level, DEFAULT_JUMP_PARAMS);
      inputs.push(INPUT_RIGHT | INPUT_JUMP);
    }
    if (hop && (s.alt ?? 0) !== 1) continue;
    for (let t = 0; t < 2500 && s.status !== ATTEMPT_DEAD && s.checkpoint === 0; t++) {
      s = stepAttempt(s, INPUT_RIGHT, L.level, DEFAULT_JUMP_PARAMS);
      inputs.push(INPUT_RIGHT);
    }
    if (s.status === ATTEMPT_DEAD && s.checkpoint === 0 && (!hop || s.alt === 1)) return { date: L.date, code: encodeReplay(attemptReplay(L.id, inputs, 0, 0, L.level.simVersion)) };
  }
  throw new Error(`aucun jour de ${theme} généré où l'on meurt après le premier point de passage`);
}

test("néon : un nombre impair de sauts, la mort : les blocs alternés restent dans leur état à la reprise (ni remise à A, ni bascule), et le repère annonce toujours le jeu suivant", { tag: "@regression" }, async ({ page }) => {
  const { date, code } = dayDyingAfterFirstPoint("neon", true);
  test.skip(!(await open27(page, "", date)), "pas de WebGL dans ce navigateur");
  const frame = () => page.evaluate(() => new Promise<void>((done) => requestAnimationFrame(() => requestAnimationFrame(() => done()))));
  const read = () =>
    page.evaluate(() => {
      const j = (window as unknown as { __jump: J28 }).__jump;
      return { status: j.attempt.status, checkpoint: j.attempt.checkpoint, alt: j.blocks!.alt, states: [...j.blocks!.states], next: j.blocks!.next, pips: j.blocks!.pips, simVersion: j.simVersion };
    });
  await page.evaluate((replay) => {
    const j = (window as unknown as { __jump: J28 }).__jump;
    j.manual(true);
    j.restart();
    j.advance(180); // le décompte
    j.autoplay(replay);
    let n = 0;
    while (j.attempt.deaths === 0 && n++ < 6000) j.advance(1);
  }, code);
  await frame(); // le dessin lit l'état de la mort
  const dead = await read();
  await page.evaluate(() => {
    const j = (window as unknown as { __jump: J28 }).__jump;
    j.input(0);
    j.advance(j.attempt.respawnTicks);
  });
  await frame();
  const back = await read();
  const r = { dead, back };
  // Un saut : B plein ; le prochain saut rendrait A (le repère le dit), et la reprise n'y change rien.
  expect(r.dead).toMatchObject({ status: "mort", checkpoint: 0, alt: 1, next: 0 });
  expect(r.back).toMatchObject({ status: "course", checkpoint: 0, alt: 1, next: 0, simVersion: 12 });
  expect(r.back.states, "les blocs sont dans le même état qu'à la mort").toEqual(r.dead.states);
  expect(r.back.pips, "une pastille « jeu suivant » par bloc plein").toBe(r.dead.pips);
  expect(r.back.pips).toBeGreaterThan(0);
});

test("nuit : aucun alterné ; les clignotants ne bougent pas à la reprise (l'horloge continue sans à-coup)", { tag: "@regression" }, async ({ page }) => {
  const { date, code } = dayDyingAfterFirstPoint("nuit", false);
  test.skip(!(await open27(page, "", date)), "pas de WebGL dans ce navigateur");
  const r = await page.evaluate((replay) => {
    const j = (window as unknown as { __jump: J28 }).__jump;
    j.manual(true);
    j.restart();
    j.advance(180);
    j.autoplay(replay);
    let n = 0;
    while (j.attempt.deaths === 0 && n++ < 6000) j.advance(1);
    j.advance(1);
    const dead = { time: j.attempt.time, phases: [...j.blocks!.phases], blinks: j.blocks!.blinks, alts: j.blocks!.alts, alt: j.blocks!.alt };
    j.input(0);
    j.advance(j.attempt.respawnTicks);
    j.advance(1);
    const back = { time: j.attempt.time, phases: [...j.blocks!.phases], status: j.attempt.status, checkpoint: j.attempt.checkpoint };
    return { dead, back };
  }, code);
  expect(r.dead.alts, "pas de bloc alterné hors du néon").toBe(0);
  expect(r.dead.alt).toBe(-1);
  expect(r.dead.blinks).toBeGreaterThan(0);
  expect(r.back).toMatchObject({ status: "course", checkpoint: 0 });
  // Chaque horloge a avancé exactement du temps écoulé : la reprise ne la remet pas à zéro.
  const elapsed = r.back.time - r.dead.time;
  expect(elapsed).toBeGreaterThan(0);
  r.dead.phases.forEach((p, i) => expect(r.back.phases[i], `section ${i}`).toBe(p + elapsed));
});
