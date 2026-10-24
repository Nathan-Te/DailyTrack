import { expect, test, type Page } from "./fixtures";
import { readFileSync } from "node:fs";

// Lot 47 : le post-traitement du palier 3 dans le vrai jeu (halo, étalonnage, FXAA ; ordinateur seulement). Rendu logiciel de la CI : `?appareil=ordinateur` impose
// l'appareil (sans lui, un navigateur piloté part du palier 1 et la chaîne ne s'allume pas) ; les demi-flottants rendables y sont (SwiftShader). Ce qui se juge
// ici : qui a la chaîne (jamais un téléphone, jamais sans demi-flottants), quand elle s'allume et s'éteint (jamais en course), ses garde-fous (perte du contexte,
// deux images ratées : retour au palier 2 avec la vie et le ciel, la course continue), la mémoire de ses cibles, et que le halo laisse la peinture claire de jour.
test.skip(({ browserName }) => browserName !== "chromium", "WebGL : Chromium seulement");
test.setTimeout(180_000);

const ORDINATEUR = "/?debug&home=0&ghost=off&fx=off&fps=0&quality=2&appareil=ordinateur";
const post = (page: Page) => page.evaluate(() => { const { chaine, echouer, ...p } = window.__cdj.post; return { ...p, taille: chaine?.scene ? [chaine.scene.width, chaine.scene.height] : null }; });
const scene = (page: Page) => page.evaluate(() => ({ palier: window.__cdj.socle.palier(), plus: window.__cdj.socle.plus() }));
/** Les morceaux du post-traitement chargés par la page. */
const morceaux = (page: Page) => page.evaluate(() => performance.getEntriesByType("resource").map((e) => /\/(postJeu)-[^/]*\.js$/.exec(e.name)?.[1]).filter(Boolean) as string[]);
const chaineAllumee = (page: Page) => page.waitForFunction(() => window.__cdj?.post?.actif && window.__cdj.render.renderFrames > 3, undefined, { timeout: 90_000 });

/** Les erreurs de la page (aucune ne doit sortir d'une panne de la chaîne). */
function erreurs(page: Page): string[] {
  const e: string[] = [];
  page.on("pageerror", (x) => e.push(x.message));
  return e;
}

test("ordinateur, ?palier=3 : la chaîne est chargée à la demande avant la course, avec le multi-échantillonnage, ses parties et sa mémoire calculée", async ({ page }) => {
  const e = erreurs(page);
  await page.setViewportSize({ width: 480, height: 270 });
  await page.goto(`${ORDINATEUR}&seed=2026-10-14&palier=3`);
  await page.waitForFunction(() => window.__cdj?.phase);
  expect(await page.evaluate(() => window.__cdj.phase), "la scène est au palier 3 avec la chaîne dès le décompte (la page vient de se charger)").toBe("countdown");
  await chaineAllumee(page);
  expect(await scene(page)).toEqual({ palier: "P3", plus: ["post"] });
  expect(await morceaux(page)).toEqual(["postJeu"]);
  const p = await post(page);
  expect(p).toMatchObject({ demande: true, permis: true, actif: true, coupe: null, parties: { halo: true, etalonnage: true, anticrenelage: true }, echantillons: 4, echecs: 0 });
  const [w, h] = p.taille!;
  expect([w, h], "les cibles ont la taille réelle de l'image (tampon de dessin)").toEqual(await page.evaluate(() => [window.innerWidth * devicePixelRatio, window.innerHeight * devicePixelRatio]));
  // La scène (8 + 4 × 12 octets par pixel), deux cibles de passes (2 × 8) et le halo (8 × 0,95).
  expect(p.octets).toBe(Math.round(w! * h! * (8 + 4 * 12 + 16 + 7.6)));
  expect(await page.evaluate(() => window.__cdj.render.calls), "la scène et ses passes").toBeGreaterThan(p.appels);
  expect(e).toEqual([]);
});

test("?reglages=3-post et ses parties : sans la chaîne, rien n'est chargé ; le halo, l'étalonnage et le FXAA se coupent un à un ; jamais avec ?prod", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 270 });
  await page.goto(`${ORDINATEUR}&seed=2026-10-14&reglages=3-post`);
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.waitForFunction(() => window.__cdj.render.renderFrames > 3);
  expect(await scene(page)).toEqual({ palier: "P3", plus: [] });
  expect(await post(page)).toMatchObject({ demande: false, actif: false, parties: null });
  expect(await morceaux(page), "le palier 3 sans post-traitement ne charge pas son module").toEqual([]);

  await page.goto(`${ORDINATEUR}&seed=2026-10-14&reglages=3-halo-fxaa`);
  await chaineAllumee(page);
  expect((await post(page)).parties).toEqual({ halo: false, etalonnage: true, anticrenelage: false });

  // `?reglages=2+post` : la chaîne n'est que du palier 3.
  await page.goto(`${ORDINATEUR}&seed=2026-10-14&reglages=2%2Bpost`);
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.waitForFunction(() => window.__cdj.render.renderFrames > 3);
  expect(await post(page)).toMatchObject({ demande: false, actif: false });
  expect(await morceaux(page)).toEqual([]);

  await page.goto(`${ORDINATEUR}&seed=2026-10-14&palier=3&prod`); // le mode restreint de la production : le paramètre est ignoré
  await page.waitForFunction(() => window.__cdj?.phase);
  expect(await scene(page)).toEqual({ palier: "P1", plus: [] });
  expect(await post(page)).toMatchObject({ demande: false, actif: false });
});

test("jamais de passe plein écran sur un téléphone, même au palier 3 imposé ou au réglage « Maximale »", async ({ page, browser }) => {
  await page.setViewportSize({ width: 480, height: 270 });
  // Un téléphone (profil imposé), palier 3 demandé par l'adresse : la scène du palier 3, aucune passe plein écran, le module n'est même pas demandé.
  await page.goto(`/?debug&home=0&ghost=off&fx=off&fps=0&quality=2&seed=2026-10-14&appareil=telephone&palier=3`);
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.waitForFunction(() => window.__cdj.render.renderFrames > 3);
  expect(await scene(page)).toEqual({ palier: "P3", plus: [] });
  expect(await post(page)).toMatchObject({ permis: false, demande: false, actif: false });
  expect(await morceaux(page)).toEqual([]);

  // « Maximale » choisi sur un téléphone : le palier 3, jamais la chaîne.
  const contexte = await browser.newContext({ viewport: { width: 480, height: 270 } });
  try {
    const tel = await contexte.newPage();
    await tel.addInitScript(() => localStorage.setItem("cdj:settings", JSON.stringify({ graphismes: "maximale", version: 1 })));
    await tel.goto(`/?debug&home=0&ghost=off&fx=off&fps=0&quality=2&seed=2026-10-14&appareil=telephone`);
    await tel.waitForFunction(() => window.__cdj?.phase);
    await tel.waitForFunction(() => window.__cdj.render.renderFrames > 3);
    expect((await tel.evaluate(() => window.__cdj.qualite)).choix).toBe("maximale");
    // Le réglage attend ses modules (1,5 s au plus au chargement), puis s'applique à la prochaine pause : la pause.
    await tel.keyboard.press("KeyP");
    await tel.waitForFunction(() => window.__cdj.socle.palier() === "P3", undefined, { timeout: 60_000 });
    expect(await scene(tel)).toEqual({ palier: "P3", plus: [] });
    expect(await post(tel)).toMatchObject({ permis: false, actif: false });
    expect(await morceaux(tel)).toEqual([]);
  } finally {
    await contexte.close();
  }

});

test("jamais sans demi-flottants rendables : un ordinateur qui ne les a pas n'a pas la chaîne, même au réglage « Maximale »", async ({ browser }) => {
  const sans = await browser.newContext({ viewport: { width: 480, height: 270 } });
  try {
    const p = await sans.newPage();
    await p.addInitScript(() => {
      const proto = WebGL2RenderingContext.prototype as unknown as { getExtension(this: WebGL2RenderingContext, nom: string): unknown };
      const getExtension = proto.getExtension;
      proto.getExtension = function (this: WebGL2RenderingContext, nom: string) {
        return /EXT_color_buffer_(half_)?float/.test(nom) ? null : getExtension.call(this, nom);
      };
      localStorage.setItem("cdj:settings", JSON.stringify({ graphismes: "maximale", version: 1 }));
    });
    await p.goto(`${ORDINATEUR}&seed=2026-10-14`);
    await p.waitForFunction(() => window.__cdj?.phase);
    await p.waitForFunction(() => window.__cdj.render.renderFrames > 3);
    const q = await p.evaluate(() => window.__cdj.qualite);
    expect(q.appareil).toMatchObject({ ordinateur: true, logiciel: false, demiFlottants: false });
    expect(q.passes).toBe(false);
    // (Sans demi-flottants, le palier 2 lui-même ne tient pas — la carte d'environnement des reflets est dessinée dans une cible en demi-flottants, lot 45 : on ne juge ici
    // que la chaîne, qui ne se demande ni ne se charge.)
    expect((await scene(p)).plus, "la chaîne n'est pas demandée").not.toContain("post");
    expect(await post(p)).toMatchObject({ permis: false, actif: false });
    expect(await morceaux(p)).toEqual([]);
  } finally {
    await sans.close();
  }
});

/** Lance la course en pas à pas jusqu'au départ. */
async function enCourse(page: Page) {
  await page.evaluate(() => window.__cdj.manual(true));
  for (let i = 0; i < 60 && (await page.evaluate(() => window.__cdj.phase)) !== "racing"; i++) await page.evaluate(() => window.__cdj.advance(60));
  expect(await page.evaluate(() => window.__cdj.phase)).toBe("racing");
}

test("la chaîne ne s'allume ni ne s'éteint en course : demandée ou retirée en pleine course, elle attend la pause", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 270 });
  await page.goto(`${ORDINATEUR}&seed=2026-10-14&palier=1`);
  await page.waitForFunction(() => window.__cdj?.phase);
  await enCourse(page);
  // Le palier 3 et sa chaîne demandés en course : le module se charge, la scène et la chaîne ne changent pas.
  await page.evaluate(() => window.__cdj.socle.demander("P3", ["post"]));
  await expect.poll(() => morceaux(page), { timeout: 60_000 }).toEqual(["postJeu"]);
  for (let i = 0; i < 8; i++) await page.evaluate(() => window.__cdj.advance(20));
  await page.waitForTimeout(500);
  expect(await scene(page)).toEqual({ palier: "P1", plus: [] });
  expect(await post(page)).toMatchObject({ actif: false, demande: false });
  // À la pause : le palier 3 et la chaîne.
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.__cdj.socle.palier() === "P3" && window.__cdj.post.actif, undefined, { timeout: 60_000 });
  expect(await scene(page)).toEqual({ palier: "P3", plus: ["post"] });
  await page.keyboard.press("KeyP"); // reprend la course
  await page.waitForFunction(() => !window.__cdj.paused);

  // L'inverse : le palier 2 demandé en course, la chaîne reste jusqu'à la pause.
  await page.evaluate(() => window.__cdj.socle.demander("P2", ["vie", "ciel"]));
  for (let i = 0; i < 8; i++) await page.evaluate(() => window.__cdj.advance(20));
  await page.waitForTimeout(500);
  expect(await post(page)).toMatchObject({ actif: true, demande: true });
  expect((await scene(page)).palier).toBe("P3");
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.__cdj.socle.palier() === "P2" && !window.__cdj.post.actif, undefined, { timeout: 60_000 });
  expect(await post(page)).toMatchObject({ actif: false, demande: false, coupe: null });
});

test("perte du contexte WebGL (simulée) : la chaîne est coupée à l'instant, la course continue, le palier 2 avec la vie et le ciel arrive à la pause, rien n'est cassé", async ({ page }) => {
  const e = erreurs(page);
  await page.setViewportSize({ width: 480, height: 270 });
  await page.goto(`${ORDINATEUR}&seed=2026-10-14&palier=3`);
  await chaineAllumee(page);
  await page.evaluate(() => window.__cdj.manual(true));
  for (let i = 0; i < 60 && (await page.evaluate(() => window.__cdj.phase)) !== "racing"; i++) await page.evaluate(() => window.__cdj.advance(60));
  await page.evaluate(() => window.__cdj.advance(30));
  const tick0 = await page.evaluate(() => window.__cdj.car.tick);
  await page.evaluate(() => window.__cdj.manual(false));

  // Le contexte est perdu en pleine course.
  await page.evaluate(() => {
    const gl = (document.querySelector("canvas") as HTMLCanvasElement).getContext("webgl2")!;
    (window as unknown as { __perte: unknown }).__perte = gl.getExtension("WEBGL_lose_context");
    (window as unknown as { __perte: { loseContext(): void } }).__perte.loseContext();
  });
  await page.waitForFunction(() => window.__cdj.post.coupe === "contexte", undefined, { timeout: 30_000 });
  expect(await post(page)).toMatchObject({ actif: false, contexteHS: true, coupe: "contexte" });
  // La course continue : la simulation n'attend pas l'image.
  await page.waitForFunction((t) => window.__cdj.car.tick > t + 20 && window.__cdj.phase === "racing", tick0, { timeout: 30_000 });
  expect(await scene(page), "la scène ne change pas en course").toEqual({ palier: "P3", plus: ["post"] });

  // Le contexte revient : on dessine à l'écran direct (la chaîne reste coupée), le palier 2 attend la pause.
  await page.evaluate(() => (window as unknown as { __perte: { restoreContext(): void } }).__perte.restoreContext());
  await page.waitForFunction(() => !window.__cdj.post.contexteHS, undefined, { timeout: 30_000 });
  // Le moteur dessine de nouveau, directement (son compteur d'images repart de zéro à la restauration).
  const images = await page.evaluate(() => window.__cdj.render.moteurImages);
  await page.waitForFunction((n) => window.__cdj.render.moteurImages > n + 5, images, { timeout: 30_000 });
  expect(await post(page)).toMatchObject({ actif: false, coupe: "contexte" });
  expect((await scene(page)).palier).toBe("P3");
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.__cdj.socle.palier() === "P2", undefined, { timeout: 60_000 });
  expect(await scene(page)).toEqual({ palier: "P2", plus: ["vie", "ciel"] });
  expect(await post(page)).toMatchObject({ actif: false, demande: false, coupe: "contexte" });
  // On s'en souvient : le palier 2, un plafond durable.
  const garde = JSON.parse((await page.evaluate(() => localStorage.getItem("cdj:qualite")))!);
  expect(garde).toMatchObject({ palier: 2, plafond: 2, durable: true });
  expect(e).toEqual([]);
});

test("deux images ratées de suite : la chaîne se coupe, on dessine directement, le palier 2 avec la vie et le ciel arrive à la pause", async ({ page }) => {
  const e = erreurs(page);
  await page.setViewportSize({ width: 480, height: 270 });
  await page.goto(`${ORDINATEUR}&seed=2026-10-14&palier=3`);
  await chaineAllumee(page);
  const images = await page.evaluate(() => window.__cdj.render.moteurImages);
  await page.evaluate(() => window.__cdj.post.echouer(2));
  await page.waitForFunction(() => window.__cdj.post.coupe === "echecs", undefined, { timeout: 30_000 });
  expect(await post(page)).toMatchObject({ actif: false, coupe: "echecs" });
  await page.waitForFunction((n) => window.__cdj.render.moteurImages > n + 5, images, { timeout: 30_000 }); // on dessine directement, sans image noire
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.__cdj.socle.palier() === "P2", undefined, { timeout: 60_000 });
  expect(await scene(page)).toEqual({ palier: "P2", plus: ["vie", "ciel"] });
  expect(e).toEqual([]);
});

// --- Le halo laisse la peinture claire de jour -----------------------------------------------------------------------------------------------------------------

/** La luminance (lumière linéaire) de chaque pixel de la cible de la scène de la chaîne, lue sur la carte graphique (demi-flottants) : combien dépassent un seuil. */
async function luminances(page: Page): Promise<{ n: number; sup: (s: number) => number }> {
  const lum = await page.evaluate(() => {
    const c = window.__cdj.post.chaine as unknown as { scene: { width: number; height: number }; renderer: { readRenderTargetPixels(rt: unknown, x: number, y: number, w: number, h: number, b: Uint16Array): void } };
    const { width: w, height: h } = c.scene;
    const buf = new Uint16Array(w * h * 4);
    c.renderer.readRenderTargetPixels(c.scene, 0, 0, w, h, buf);
    const f16 = (x: number) => {
      const e = (x >> 10) & 0x1f;
      const m = x & 0x3ff;
      return (x & 0x8000 ? -1 : 1) * (e === 0 ? 2 ** -14 * (m / 1024) : e === 31 ? Infinity : 2 ** (e - 15) * (1 + m / 1024));
    };
    const lum: number[] = [];
    for (let i = 0; i < w * h; i++) lum.push(0.2126 * f16(buf[i * 4]!) + 0.7152 * f16(buf[i * 4 + 1]!) + 0.0722 * f16(buf[i * 4 + 2]!));
    return lum;
  });
  return { n: lum.length, sup: (s) => lum.filter((x) => x > s).length };
}

/** Le seuil du halo d'un thème, lu dans la table du jeu (`src/scene/themesPost.ts`, `POST_3` : l'étalonnage et le halo de chaque thème). */
const seuil = (palette: string): number => Number(new RegExp(`\\n  ${palette}: \\{[\\s\\S]*?halo: \\{ force: [\\d.]+, seuil: ([\\d.]+)`).exec(readFileSync(new URL("../src/scene/themesPost.ts", import.meta.url), "utf8"))![1]);
const THEMES: readonly [theme: string, palette: string][] = [["stade", "stade"], ["rallye", "desert"], ["banquise", "neige"], ["campagne", "campagne"], ["canyon", "canyon"], ["col", "alpin"], ["ville", "ville"]];

test("le halo respecte la peinture claire de jour : au départ de chaque thème de jour, rien de la route, des rebords ni d'une voiture claire n'atteint le seuil du halo ; la Nuit allume ses lumières", async ({ page }) => {
  test.setTimeout(420_000);
  await page.setViewportSize({ width: 480, height: 270 });
  const lire = async (theme: string) => {
    // La voiture la plus claire de la palette (« Lagon »), à damier : le plus de blanc possible dans l'image.
    await page.goto(`${ORDINATEUR}&seed=2026-10-14&theme=${theme}&voiture=civile&couleur=5&motif=damier&palier=3`);
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.waitForFunction(() => window.__cdj.post.actif && window.__cdj.render.renderFrames > 6 && window.__cdj.decor.dansScene, undefined, { timeout: 90_000 });
    await page.waitForTimeout(500);
    return luminances(page);
  };
  for (const [theme, palette] of THEMES) {
    const { n, sup } = await lire(theme);
    // Au plus quelques pixels du disque du soleil (mesuré : 0 à 7 sur 230 400 au Stade, au Rallye, au Canyon et à la Ville) ; la peinture claire reste sous le seuil.
    expect(sup(seuil(palette)), `${theme} : pixels au-dessus du seuil du halo (${seuil(palette)})`).toBeLessThanOrEqual(Math.ceil(n * 0.0005));
    expect(sup(1.8), `${theme} : de la lumière, pas du blanc brûlé`).toBeLessThanOrEqual(Math.ceil(n * 0.0005));
  }
  const nuit = await lire("nuit");
  expect(nuit.sup(seuil("nuit")), "les lampadaires et les plaques de la Nuit dépassent le seuil du halo").toBeGreaterThan(10);
});
