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

test("ordinateur, ?palier=3 : la chaîne est chargée à la demande avant la course (l'écran sans multi-échantillonnage), ses parties et sa mémoire calculée", async ({ page }) => {
  const e = erreurs(page);
  await page.setViewportSize({ width: 480, height: 270 });
  await page.goto(`${ORDINATEUR}&seed=2026-10-14&palier=3`);
  await page.waitForFunction(() => window.__cdj?.phase);
  expect(await page.evaluate(() => window.__cdj.phase), "la scène est au palier 3 avec la chaîne dès le décompte (la page vient de se charger)").toBe("countdown");
  await chaineAllumee(page);
  expect(await scene(page)).toEqual({ palier: "P3", plus: ["post"] });
  expect(await morceaux(page)).toEqual(["postJeu"]);
  const p = await post(page);
  // Lot 50 : jamais deux multi-échantillonnages — la chaîne voulue au chargement, le moteur est créé sans celui de l'écran ; la scène n'en a pas non plus (le FXAA).
  expect(p).toMatchObject({ demande: true, permis: true, actif: true, mode: "chaine", ecranMsaa: false, coupe: null, parties: { halo: true, etalonnage: true, anticrenelage: true }, echantillons: 0, echecs: 0 });
  expect(p.halo, "la Nuit (le circuit du 14/10) : le halo").toBe(true);
  const [w, h] = p.taille!;
  expect([w, h], "les cibles ont la taille réelle de l'image (tampon de dessin)").toEqual(await page.evaluate(() => [window.innerWidth * devicePixelRatio, window.innerHeight * devicePixelRatio]));
  // La scène (R11F_G11F_B10F et sa profondeur : 8 octets par pixel, sous le plafond de 2,1 millions), plus de cibles de passes, le halo (≈ 7,3 octets par pixel de l'écran).
  expect(p.octets).toBeGreaterThan(w! * h! * 8);
  expect(p.octets).toBeLessThan(w! * h! * (8 + 8));
  expect(await page.evaluate(() => window.__cdj.render.calls), "la scène et ses passes").toBeGreaterThan(p.appels);
  expect(e).toEqual([]);
});

test("lot 50 : Auto sur un ordinateur donne le post-traitement (prouvé au banc) ; refusé par cet appareil (sansPost), le palier 3 seul, sans son module ; « Maximale » le donne", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 270 });
  await page.goto(`${ORDINATEUR}&seed=2026-10-14`);
  await page.waitForFunction(() => window.__cdj?.phase);
  await chaineAllumee(page);
  expect(await scene(page), "un ordinateur en Auto : le palier 3 et la chaîne").toEqual({ palier: "P3", plus: ["post"] });
  expect(await post(page)).toMatchObject({ ecranMsaa: false, mode: "chaine" });
  // Une mémoire qui dit que cet appareil l'a refusée (une mesure ratée avec elle, une course trop lente) : le palier 3 seul, le module n'est pas chargé.
  await page.evaluate(() => localStorage.setItem("cdj:qualite", JSON.stringify({ palier: 3, date: Date.now(), mediane: 10, pixels: 480 * 270 * devicePixelRatio ** 2, echecs: 0, plafond: null, durable: false, sansPost: true })));
  await page.reload();
  await page.waitForFunction(() => window.__cdj?.phase);
  await page.waitForFunction(() => window.__cdj.render.renderFrames > 3);
  expect(await scene(page)).toEqual({ palier: "P3", plus: [] });
  expect(await post(page)).toMatchObject({ permis: true, demande: false, actif: false, ecranMsaa: true });
  expect(await morceaux(page), "le module du post-traitement n'est pas chargé").toEqual([]);
  await page.evaluate(() => localStorage.setItem("cdj:settings", JSON.stringify({ graphismes: "maximale", version: 1 })));
  await page.reload();
  await page.waitForFunction(() => window.__cdj?.phase);
  await chaineAllumee(page);
  expect(await scene(page)).toEqual({ palier: "P3", plus: ["post"] });
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
  // Lot 50 : le moteur a été créé avec le multi-échantillonnage de l'écran (palier 1 au chargement) : la scène de la chaîne n'en fait pas (jamais deux).
  expect(await post(page)).toMatchObject({ ecranMsaa: true, echantillons: 0, mode: "chaine" });
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
  expect(await post(page)).toMatchObject({ actif: false, demande: false, coupe: null, mode: null });
});

test("lot 50 : mode copie — un moteur créé pour la chaîne qui ne l'a plus dessine quand même par elle, tonalité et FXAA (jamais une image crénelée)", async ({ page }) => {
  await page.setViewportSize({ width: 480, height: 270 });
  await page.goto(`${ORDINATEUR}&seed=2026-10-14&palier=3`);
  await chaineAllumee(page);
  await page.evaluate(() => window.__cdj.socle.demander("P2", ["vie", "ciel"]));
  await page.keyboard.press("KeyP");
  await page.waitForFunction(() => window.__cdj.socle.palier() === "P2" && window.__cdj.post.mode === "copie", undefined, { timeout: 60_000 });
  const p = await post(page);
  expect(p).toMatchObject({ actif: false, demande: false, mode: "copie", ecranMsaa: false, echantillons: 0, halo: false, parties: { halo: false, etalonnage: false, anticrenelage: true } });
  const images = await page.evaluate(() => window.__cdj.render.moteurImages);
  await page.waitForFunction((n) => window.__cdj.render.moteurImages > n + 3, images, { timeout: 30_000 });
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

// --- Lot 50 : le halo seulement la Nuit -------------------------------------------------------------------------------------------------------------------

/** La luminance (lumière linéaire) de chaque pixel de la cible de la scène de la chaîne (R11F_G11F_B10F ou demi-flottants), lue en flottants : combien dépassent un seuil. */
async function luminances(page: Page): Promise<{ n: number; sup: (s: number) => number }> {
  const lum = await page.evaluate(() => {
    type Moteur = { getContext(): WebGL2RenderingContext; properties: { get(o: unknown): { __webglFramebuffer: WebGLFramebuffer } }; setRenderTarget(t: unknown): void };
    const c = window.__cdj.post.chaine as unknown as { scene: { width: number; height: number }; renderer: Moteur };
    const { width: w, height: h } = c.scene;
    const gl = c.renderer.getContext();
    c.renderer.setRenderTarget(c.scene);
    gl.bindFramebuffer(gl.READ_FRAMEBUFFER, c.renderer.properties.get(c.scene).__webglFramebuffer);
    const buf = new Float32Array(w * h * 4);
    gl.readPixels(0, 0, w, h, gl.RGBA, gl.FLOAT, buf);
    c.renderer.setRenderTarget(null);
    const lum: number[] = [];
    for (let i = 0; i < w * h; i++) lum.push(0.2126 * buf[i * 4]! + 0.7152 * buf[i * 4 + 1]! + 0.0722 * buf[i * 4 + 2]!);
    return lum;
  });
  return { n: lum.length, sup: (s) => lum.filter((x) => x > s).length };
}

/** Le seuil du halo d'un thème, lu dans la table du jeu (`src/scene/themesPost.ts`, `POST_3` : l'étalonnage et le halo de chaque thème). */
const seuil = (palette: string): number => Number(new RegExp(`\\n  ${palette}: \\{[\\s\\S]*?halo: \\{ force: [\\d.]+, seuil: ([\\d.]+)`).exec(readFileSync(new URL("../src/scene/themesPost.ts", import.meta.url), "utf8"))![1]);

test("lot 50 : pas de halo le jour (il ne touchait que le disque du soleil) ; la Nuit a le sien et ses lumières dépassent son seuil", async ({ page }) => {
  test.setTimeout(300_000);
  await page.setViewportSize({ width: 480, height: 270 });
  const ouvrir = async (theme: string) => {
    await page.goto(`${ORDINATEUR}&seed=2026-10-14&theme=${theme}&palier=3`);
    await page.waitForFunction(() => window.__cdj?.phase);
    await page.waitForFunction(() => window.__cdj.post.actif && window.__cdj.render.renderFrames > 6, undefined, { timeout: 90_000 });
  };
  for (const theme of ["stade", "ville"]) {
    await ouvrir(theme);
    expect(await post(page), theme).toMatchObject({ actif: true, halo: false, parties: { halo: true } });
  }
  await ouvrir("nuit");
  await page.waitForFunction(() => window.__cdj.decor.dansScene, undefined, { timeout: 90_000 }).catch(() => undefined);
  expect((await post(page)).halo).toBe(true);
  const nuit = await luminances(page);
  expect(nuit.sup(seuil("nuit")), "les lampadaires et les plaques de la Nuit dépassent le seuil du halo").toBeGreaterThan(10);
});

// --- Lot 50 : le banc d'essai du rendu --------------------------------------------------------------------------------------------------------------------------

test("lot 50 : le banc d'essai (?banc=court, rendu logiciel) produit un rapport valide, sans démarrer le jeu ni rien écrire", async ({ page }) => {
  const e = erreurs(page);
  await page.setViewportSize({ width: 480, height: 270 });
  await page.goto("/?banc=court");
  await page.waitForFunction(() => ["fini", "erreur"].includes((window as unknown as { __banc?: { etat: string } }).__banc?.etat ?? ""), undefined, { timeout: 150_000 });
  const b = await page.evaluate(() => (window as unknown as { __banc: { etat: string; erreur: string | null; valide: boolean; rapport: { mesures: { config: string; theme: string; compilations: number }[]; entete: { carteGraphique: string } } } }).__banc);
  expect(b.erreur).toBeNull();
  expect(b.etat).toBe("fini");
  expect(b.valide, "rapport valide").toBe(true);
  expect(b.rapport.mesures.map((m) => `${m.config}:${m.theme}`)).toEqual(["p1:stade", "p3:stade", "p3-50:nuit"]);
  expect(b.rapport.entete.carteGraphique).not.toBe("");
  expect(await page.evaluate(() => typeof (window as unknown as { __cdj?: unknown }).__cdj), "le jeu n'a pas démarré").toBe("undefined");
  // Rien d'écrit par le banc : seulement ce que toute page de la plateforme pose au chargement (langue, génération du « Nouveau départ », révision d'identité).
  expect(await page.evaluate(() => Object.keys(localStorage).filter((k) => k.startsWith("cdj:") && !["cdj:langue", "cdj:generation", "cdj:identite:vue"].includes(k))), "rien d'écrit").toEqual([]);
  await expect(page.getByRole("button", { name: "Copier le rapport" })).toBeVisible();
  expect(e).toEqual([]);
});
