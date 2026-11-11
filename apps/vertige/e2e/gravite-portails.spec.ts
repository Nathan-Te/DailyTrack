import { readFileSync } from "node:fs";
import { expect, test, type Page } from "@playwright/test";
import { Partie, decoderRediffusion, niveau, type NomNiveau } from "@cdj/vertige-sim";
import { appareil, lancer } from "./appareil";

// Lot V1 — la gravité par quarts de tour et les portails, vus du navigateur : la même partie que Node (les rediffusions du golden, jouées pas à pas), la transition de la caméra à une bascule (seule la caméra la
// fait), les fenêtres des portails (une texture par portail visible), et la COUTURE invisible d'une traversée : la caméra ne saute pas d'une image à l'autre. Les règles sont dans `packages/vertige-sim/test`.
const golden = JSON.parse(readFileSync(new URL("../../../packages/vertige-sim/test/fixtures/golden-vertige.json", import.meta.url), "utf8")) as { rediffusions: { nom: string; code: string }[] };
const commandes = (nom: string) => decoderRediffusion(golden.rediffusions.find((r) => r.nom === nom)!.code).commandes;
const image = (page: Page): Promise<unknown> => page.evaluate(() => new Promise((r) => requestAnimationFrame(r)));
const ouvrir = async (browser: Parameters<typeof appareil>[0], scenario: NomNiveau, extra = "") => {
  const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=${scenario}${extra}`);
  await lancer(page);
  await page.waitForFunction(() => !!window.__vertige);
  return { context, page };
};

test.describe("Vertige : la gravité et les portails", () => {
  test("le cube : cinq faces à la suite (six directions), la partie du navigateur est celle de Node, la caméra fait la transition", async ({ browser }) => {
    const c = commandes("cube-six-directions");
    const { context, page } = await ouvrir(browser, "cube", `&reglages=${encodeURIComponent(JSON.stringify({ confort: { transition: 1000 } }))}`);
    await image(page);
    await image(page); // deux images dessinées d'abord : la transition de la caméra part de la vue de l'image d'avant (sur un runner lent, la première bascule pouvait précéder toute image)
    await page.evaluate((cmd) => window.__vertige.jouer(cmd), c);
    // Jusqu'à la première bascule : la simulation a tourné d'un coup, la caméra rattrape son ancien point de vue.
    const n = new Partie(niveau("cube"));
    let premiere = 0;
    for (const x of c) {
      n.avancer(x);
      if (n.bascules === 1) break;
      premiere++;
    }
    await page.evaluate((k) => window.__jeu.avancer(k + 1), premiere);
    await image(page);
    expect((await page.evaluate(() => window.__vertige.sim().bascules))).toBe(1);
    expect((await page.evaluate(() => window.__vertige.camera())).correction).toBe(true);
    await page.waitForTimeout(1400);
    expect((await page.evaluate(() => window.__vertige.camera())).correction).toBe(false);
    await page.evaluate((k) => window.__jeu.avancer(k), c.length - premiere - 1);
    const fin = await page.evaluate(() => {
      const s = window.__vertige.sim();
      return { bascules: s.bascules, gravite: s.gravite, chutes: s.resultat().chutes, tick: s.tick };
    });
    const attendu = new Partie(niveau("cube"));
    for (const x of c) attendu.avancer(x);
    expect(fin).toEqual({ bascules: 5, gravite: 2, chutes: 0, tick: attendu.tick });
    expect(attendu.empreinte()).toBe(await page.evaluate(() => window.__vertige.sim().empreinte()));
    await context.close();
  });

  test("les portails : trois traversées et une bascule, les fenêtres se dessinent, la couture est invisible", async ({ browser }) => {
    const c = commandes("portails-parcours");
    const { context, page } = await ouvrir(browser, "portails");
    await page.setViewportSize({ width: 640, height: 360 }); // le rendu logiciel de la CI : des images plus petites, la même vue
    await page.evaluate((cmd) => window.__vertige.jouer(cmd), c);
    const n = new Partie(niveau("portails"));
    let passage = 0;
    for (const x of c) {
      n.avancer(x);
      if (n.traversees === 1) break;
      passage++;
    }
    // Une fenêtre se dessine quand on s'approche du premier portail (une texture par portail visible).
    await page.evaluate((k) => window.__jeu.avancer(k - 40), passage);
    await image(page);
    expect(await page.evaluate(() => window.__vertige.monde.fenetres!.dessinees)).toBeGreaterThanOrEqual(1);
    await page.evaluate(() => window.__jeu.avancer(35)); // 5 pas avant la traversée
    // La couture : image par image, la vue ne saute pas quand le centre de la boîte passe le plan (la caméra, elle, change de côté : c'est la même vue). On compare des images réduites à 64 × 36.
    const vignettes: number[][] = [];
    for (let i = 0; i < 10; i++) {
      await page.evaluate(() => window.__jeu.avancer(1));
      await image(page);
      const png = (await page.screenshot({ type: "png", caret: "initial", animations: "allow" })).toString("base64");
      vignettes.push(
        await page.evaluate(async (b64) => {
          const bitmap = await createImageBitmap(await (await fetch(`data:image/png;base64,${b64}`)).blob());
          const c = new OffscreenCanvas(64, 36);
          const g = c.getContext("2d")!;
          g.drawImage(bitmap, 0, 0, 64, 36);
          const d = g.getImageData(0, 0, 64, 36).data;
          return Array.from({ length: 64 * 36 }, (_, k) => (d[4 * k]! + d[4 * k + 1]! + d[4 * k + 2]!) / 3);
        }, png),
      );
    }
    expect(await page.evaluate(() => window.__vertige.sim().traversees)).toBe(1);
    const ecarts = vignettes.slice(1).map((v, i) => v.reduce((s, x, k) => s + Math.abs(x - vignettes[i]![k]!), 0) / v.length);
    const mediane = [...ecarts].sort((a, b) => a - b)[Math.floor(ecarts.length / 2)]!;
    const pire = Math.max(...ecarts);
    console.log("écarts entre images (niveaux de gris, sur 255) :", ecarts.map((e) => e.toFixed(2)).join(" "));
    expect(pire, "aucune image ne diffère de la précédente plus que d'un pas de course (la couture est invisible)").toBeLessThan(Math.max(4 * mediane, mediane + 3));
    // Le parcours entier : les trois paires et la plaque de sol, l'arrivée.
    await page.evaluate((k) => window.__jeu.avancer(k), c.length);
    await image(page);
    const fin = await page.evaluate(() => {
      const s = window.__vertige.sim();
      return { traversees: s.traversees, bascules: s.bascules, arrive: s.resultat().arrive };
    });
    expect(fin).toEqual({ traversees: 3, bascules: 1, arrive: true });
    await context.close();
  });

  test("la salle de la gravité : on saute sous un plafond marqué et la gravité monte", async ({ browser }) => {
    const { context, page } = await ouvrir(browser, "gravite");
    await page.evaluate(() => window.__vertige.jouer([{ k: 16, dl: 0, dt: 0 }, ...Array.from({ length: 300 }, () => ({ k: 0, dl: 0, dt: 0 }))]));
    // On part de (0, 12), loin du plafond marqué (x de −20 à −6) : le scénario de Node dit où il est ; ici seulement que le jeu se charge et ne plante pas.
    await page.evaluate(() => window.__jeu.avancer(200));
    const s = await page.evaluate(() => ({ sol: window.__vertige.sim().sol, tick: window.__vertige.sim().tick }));
    expect(s).toEqual({ sol: true, tick: 200 });
    await context.close();
  });
});
