import { expect, test, type Page } from "@playwright/test";

// Test de fumée du lot 0 : `/jump/?debug` se construit, un canvas est à l'écran et il montre autre chose qu'un fond uni.
// Lot 1 : le personnage bouge (pas à pas, commandes injectées puis clavier), le panneau de réglages marque la partie.

interface JumpDebugView {
  phase: string;
  day: string;
  simVersion: number;
  palette: string;
  probe(): { width: number; height: number; colors: number; background: number };
}
const jump = (page: Page) => page.evaluate(() => {
  const j = (window as unknown as { __jump: JumpDebugView }).__jump;
  return { phase: j.phase, day: j.day, simVersion: j.simVersion, palette: j.palette };
});

const hasWebGL = (page: Page): Promise<boolean> =>
  page.evaluate(() => {
    const c = document.createElement("canvas");
    return !!(c.getContext("webgl2") || c.getContext("webgl"));
  });

test("DailyJump s'ouvre : scène construite, canvas rendu, version et jour en coin", { tag: "@navigateurs" }, async ({ page }) => {
  await page.goto("/?debug");
  test.skip(!(await hasWebGL(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");

  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
  const info = await jump(page);
  expect(info.phase).toBe("ready");
  expect(info.simVersion).toBe(13); // lot 28 : les alternés gardent leur état à la reprise (v12) ; lot 27 : mort avant le premier point = essai à zéro (v11) ; lot 26 : ponts (v10) ; le code joue les niveaux v3, v4 (horloge unique), v5 (plateformes mobiles), v6 (presses), v7 (champignons), v8 (stalactites) et v9 (lasers)
  expect(info.day).toMatch(/^\d{4}-\d{2}-\d{2}$/);

  const canvas = page.locator("canvas");
  await expect(canvas).toHaveCount(1);
  const box = await canvas.boundingBox();
  expect(box!.width).toBeGreaterThan(100);
  expect(box!.height).toBeGreaterThan(100);

  // Le coin affiche la version de la simulation et le jour du jeu (lot I5 : avec ?debug seulement ; sinon, petite, dans la pause).
  await expect(page.locator("#stamp")).toHaveText(`Jump · sim v${info.simVersion} · ${info.day}`);

  // Les pixels : le fond uni, les tuiles, le personnage et l'arrivée font au moins quatre couleurs, et le fond ne couvre pas tout.
  const pixels = await page.evaluate(() => (window as unknown as { __jump: JumpDebugView }).__jump.probe());
  expect(pixels.colors).toBeGreaterThanOrEqual(4);
  expect(pixels.background).toBeGreaterThan(0.2);
  expect(pixels.background).toBeLessThan(0.98);
});

// Lot P0 (plateforme) : DailyJump lit l'identité commune (clés `cdj:*` de DailyTrack, même origine donc même stockage) sans rien afficher ni créer.
test("?debug : __jump.profile dit si une identité de la plateforme existe et son pseudo, sans en créer", { tag: "@regression" }, async ({ page }) => {
  type ProfileView = { exists: boolean; name: string | null };
  const profile = () => page.evaluate(() => (window as unknown as { __jump: { profile: ProfileView } }).__jump.profile);
  await page.goto("/?scenario=bac-a-sable&debug");
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase !== undefined);
  expect(await profile()).toEqual({ exists: false, name: null });
  expect(await page.evaluate(() => localStorage.getItem("cdj:player"))).toBeNull(); // rien n'est créé

  // Une identité écrite par DailyTrack (même origine) : DailyJump la voit.
  await page.evaluate(() => {
    localStorage.setItem("cdj:player", "0123456789abcdef0123456789abcdef");
    localStorage.setItem("cdj:name", "Nowy");
  });
  expect(await profile()).toEqual({ exists: true, name: "Nowy" });
  await expect(page.locator("body")).not.toContainText("Nowy"); // rien n'est affiché
});

test("sans ?debug, aucun accès de débogage n'est exposé", { tag: "@navigateurs" }, async ({ page }) => {
  await page.goto("/");
  await expect(page.locator("#stamp")).toBeHidden();
  expect(await page.evaluate(() => "__jump" in window)).toBe(false);
});

// ——— Lot 1 : le personnage ———

interface PlayerView {
  x: number;
  y: number;
  vx: number;
  vy: number;
  mode: string;
  ground: boolean;
}
interface JumpPlay {
  phase: string;
  player: PlayerView;
  tuned: boolean;
  ticks: number;
  manual(on: boolean): void;
  advance(n: number): PlayerView;
  input(bits: number | null): void;
  restart(): void;
}
const RIGHT = 2;
const JUMP = 4;

async function openSandbox(page: Page, extra = ""): Promise<void> {
  await page.goto(`/?scenario=bac-a-sable&debug${extra}`);
  test.skip(!(await hasWebGL(page)), "WebGL indisponible dans ce navigateur : la scène ne peut pas se construire");
  await page.waitForFunction(() => (window as unknown as { __jump?: { phase: string } }).__jump?.phase === "ready");
  // Pas à pas : le résultat ne dépend plus du nombre d'images par seconde.
  await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.manual(true));
}

const advance = (page: Page, bits: number | null, n: number) =>
  page.evaluate(
    ([b, k]) => {
      const j = (window as unknown as { __jump: JumpPlay }).__jump;
      j.input(b);
      return j.advance(k as number);
    },
    [bits, n] as const,
  );

test("le clavier commande le personnage ; un appui bref entre deux pas n'est pas perdu", async ({ page }) => {
  await openSandbox(page);
  const start = await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.player);
  await page.keyboard.down("ArrowRight");
  const ran = await advance(page, null, 40);
  await page.keyboard.up("ArrowRight");
  expect(ran.x).toBeGreaterThan(start.x + 1);
  await advance(page, null, 30);
  // Espace appuyée puis relâchée avant le pas suivant : le pas suivant saute quand même.
  await page.keyboard.press("Space");
  const p = await advance(page, null, 1);
  expect(p.ground).toBe(false);
  expect(p.vy).toBeLessThan(0);
  // KeyW (Z en AZERTY) saute aussi, une fois revenu au sol.
  await advance(page, null, 150);
  await page.keyboard.press("KeyW");
  expect((await advance(page, null, 1)).vy).toBeLessThan(0);
});

test("Réglages › Commandes : Sauter sur Z, puis Z saute en partie et « Comment jouer » dit Z (lot M2)", async ({ page }) => {
  await openSandbox(page);
  await page.evaluate(() => localStorage.removeItem("cdj:commandes:jump"));
  await page.locator("#pausebtn").click();
  await page.locator("#menu-settings").click();
  // La case de la première touche de « Sauter » attend la nouvelle touche ; KeyZ (la touche physique : Z sur un AZERTY, Z sur un QWERTZ) la remplace.
  await page.locator('#settings-commandes [data-focus="k:sauter:0"]').click();
  await expect(page.locator("#settings-commandes .dj-commande__touche--attente")).toContainText("…");
  await page.keyboard.press("KeyZ");
  await expect(page.locator('#settings-commandes [data-action="sauter"]')).toContainText("Z");
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("cdj:commandes:jump")!).clavier.sauter[0])).toBe("KeyZ");
  // Retour à la partie (Échap ferme Réglages puis la pause), pas à pas : Z fait sauter, comme l'Espace avant.
  await page.keyboard.press("Escape");
  await page.locator("#menu-resume").click();
  await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.manual(true));
  await advance(page, null, 60);
  await page.keyboard.press("KeyZ");
  const p = await advance(page, null, 1);
  expect(p.ground).toBe(false);
  expect(p.vy).toBeLessThan(0);
  // « Comment jouer » dit la touche choisie.
  await expect(page.locator('[data-t="commandes.clavier.sauter"]')).toContainText("Z");
  await expect(page.locator('[data-t="commandes.clavier.sauter"]')).not.toContainText("{");
  await page.evaluate(() => localStorage.removeItem("cdj:commandes:jump"));
});

test("?debug&tune : un curseur par réglage, un réglage modifié marque la partie, « Réinitialiser » l'enlève", { tag: "@regression" }, async ({ page }) => {
  await openSandbox(page, "&tune");
  await page.evaluate(() => localStorage.removeItem("jump:tune"));
  const sliders = page.locator("#tune input[type=range]");
  await expect(sliders).toHaveCount(42); // 7 de la caméra (lot 14) + 1 « Prêt… » (lot 15) + 1 opacité des dangers à horloge du carnage (lot 17) + 4 durées d'annonce des éléments à horloge (lot 18) + 18 réglages du personnage + 2 du lot 2 (friable, ressort) + 3 de l'essai d'élan (lot 8b) + 3 des surfaces (lot 11 : tapis, glace) + 3 du vent (lot 13)
  await expect(page.locator("#tuned")).toBeEmpty();
  await expect(page.locator("#debug")).toContainText("vitesse");
  const gravity = page.locator('#tune input[data-key="gravity"]');
  await gravity.evaluate((el: HTMLInputElement) => {
    el.value = "30";
    el.dispatchEvent(new Event("input", { bubbles: true }));
  });
  await advance(page, 0, 1);
  await expect(page.locator("#tuned")).toHaveText("réglages modifiés : rien n'est enregistré");
  expect(await page.evaluate(() => (window as unknown as { __jump: { tuned: boolean; params: { gravity: number } } }).__jump.params.gravity)).toBe(30);
  expect(await page.evaluate(() => JSON.parse(localStorage.getItem("jump:tune") ?? "{}").gravity)).toBe(30);
  await page.getByRole("button", { name: "Réinitialiser" }).click();
  expect(await page.evaluate(() => localStorage.getItem("jump:tune"))).toBeNull();
  // La partie en cours reste marquée (elle a été jouée avec un autre réglage) ; recommencer l'efface.
  expect(await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.tuned)).toBe(true);
  await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.restart());
  await page.evaluate(() => (window as unknown as { __jump: JumpPlay }).__jump.advance(1));
  await expect(page.locator("#tuned")).toBeEmpty();
});
