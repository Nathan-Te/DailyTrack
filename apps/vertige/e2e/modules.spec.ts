import { expect, test } from "@playwright/test";
import { Partie, T_REPRISE, T_SAUT, ecrireTemps } from "@cdj/vertige-sim";
import { MODULES, enchainement, robotDuModule } from "@cdj/vertige-sim/modules";
import { appareil, lancer } from "./appareil";

// Lot V2 — les modules de niveau et l'enchaînement, vus du navigateur : la galerie (`?scenario=modules`) liste chaque module avec le temps de son robot, « Voir la solution » rejoue la solution (la même partie que Node, au bit
// près), « Jouer » part au repos ; l'enchaînement (`?scenario=enchainement`) se joue de bout en bout, une chute ramène au dernier palier, la reprise (R) aussi, et le temps du robot est affiché à l'arrivée. Les règles sont dans
// `packages/vertige-sim/test` (`modules.test.ts`, `enchainement.test.ts`).
const ouvrir = async (browser: Parameters<typeof appareil>[0], scenario: string) => {
  const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=${scenario}`);
  await lancer(page);
  await page.waitForFunction(() => !!window.__vertige);
  return { context, page };
};

test.describe("Vertige : les modules de niveau", () => {
  test("la galerie liste les modules et le temps de leur robot ; « Voir la solution » rejoue la solution (même partie que Node)", async ({ browser }) => {
    const { context, page } = await ouvrir(browser, "modules");
    await expect(page.locator(".vertige-galerie__module")).toHaveCount(MODULES.length);
    for (const m of MODULES) {
      const ligne = page.locator(`.vertige-galerie__module[data-module="${m.id}"]`);
      await expect(ligne).toContainText(m.nom);
      await expect(ligne).toContainText(`Robot : ${ecrireTemps(robotDuModule(m).ticks, "fr")}`);
    }
    for (const id of ["saut-1", "portail-gravite", "gravite-2"]) {
      const m = MODULES.find((x) => x.id === id)!;
      const robot = robotDuModule(m);
      await page.locator(`.vertige-galerie__module[data-module="${id}"] [data-action="voir"]`).click();
      await page.waitForFunction((x) => window.__vertige.module() === x, id);
      await page.evaluate((n) => window.__jeu.avancer(n + 5), robot.ticks);
      const etat = await page.evaluate(() => ({ fin: window.__vertige.sim().fin, captures: window.__vertige.sim().captures, chutes: window.__vertige.sim().chutes, empreinte: (window.__vertige.sim() as unknown as { empreinte(): string }).empreinte() }));
      expect(etat.fin, `${id} : le robot du navigateur arrive`).toBe(robot.ticks);
      expect([etat.captures, etat.chutes]).toEqual([1, 0]);
      expect(etat.empreinte, `${id} : l'état du navigateur est celui de Node`).toBe(robot.partie.empreinte());
      await expect(page.locator(".vertige-etat")).toContainText(`robot : ${ecrireTemps(robot.ticks, "fr")}`);
    }
    await context.close();
  });

  test("« Jouer » part au repos, avant le palier d'entrée : en courant tout droit on atteint le palier dans l'état canonique", async ({ browser }) => {
    const { context, page } = await ouvrir(browser, "modules");
    await page.locator(`.vertige-galerie__module[data-module="mur-1"] [data-action="jouer"]`).click();
    await page.waitForFunction(() => window.__vertige.module() === "mur-1");
    expect(await page.evaluate(() => window.__vertige.sim().tick)).toBe(0);
    await page.evaluate(() => {
      window.__vertige.jouer(Array.from({ length: 200 }, () => ({ k: 1, dl: 0, dt: 0 })));
      window.__jeu.avancer(160);
    });
    const s = await page.evaluate(() => ({ captures: window.__vertige.sim().captures, z: window.__vertige.sim().z, vz: window.__vertige.sim().vz }));
    expect(s.captures).toBe(1); // le palier d'entrée : on y arrive en course, au centre, dans l'axe
    expect(s.vz).toBe(-9_500_000);
    await context.close();
  });

  test("l'enchaînement : la solution du robot, de bout en bout dans le navigateur, arrive comme dans Node ; le temps du robot est affiché", async ({ browser }) => {
    const e = enchainement();
    const { context, page } = await ouvrir(browser, "enchainement");
    await page.evaluate((c) => {
      window.__vertige.jouer(c);
      window.__jeu.avancer(c.length + 3);
    }, e.solution);
    const r = await page.evaluate(() => ({ fin: window.__vertige.sim().fin, captures: window.__vertige.sim().captures, chutes: window.__vertige.sim().chutes, empreinte: (window.__vertige.sim() as unknown as { empreinte(): string }).empreinte() }));
    const n = new Partie(e.niveau);
    for (const c of e.solution) if (!n.finie) n.avancer(c);
    expect([r.fin, r.captures, r.chutes]).toEqual([n.fin, n.captures, 0]);
    expect(r.empreinte).toBe(n.empreinte());
    await expect(page.locator(".vertige-etat")).toContainText(`Robot : ${ecrireTemps(e.arriveeRobot, "fr")}`);
    await expect(page.locator(".vertige-etat")).toContainText(`Vous : ${ecrireTemps(e.arriveeRobot, "fr")}`);
    await context.close();
  });

  test("l'enchaînement : chuter exprès ramène au dernier palier, la reprise (touche R) aussi, le chrono continue — comme dans Node", async ({ browser }) => {
    const e = enchainement();
    const [a, b] = [e.paliersRobot[1]!, e.paliersRobot[2]!];
    const commandes = e.solution.slice(0, b + 120).map((c, i) => (i >= a && i < b ? { ...c, k: c.k & ~T_SAUT } : i === b + 100 ? { ...c, k: c.k | T_REPRISE } : c));
    const { context, page } = await ouvrir(browser, "enchainement");
    await page.evaluate((c) => {
      window.__vertige.jouer(c);
      window.__jeu.avancer(c.length);
    }, commandes);
    const r = await page.evaluate(() => ({ chutes: window.__vertige.sim().chutes, reprises: window.__vertige.sim().reprises, tick: window.__vertige.sim().tick, empreinte: (window.__vertige.sim() as unknown as { empreinte(): string }).empreinte() }));
    const n = new Partie(e.niveau);
    for (const c of commandes) n.avancer(c);
    expect(r.chutes).toBeGreaterThanOrEqual(2); // la chute, puis la reprise
    expect(r.reprises).toBe(1);
    expect(r.tick).toBe(commandes.length); // le chrono n'est pas remis à zéro
    expect(r.empreinte, "la chute et la reprise sont les mêmes dans le navigateur et dans Node").toBe(n.empreinte());
    // Le coût de dessin de l'enchaînement : peu d'appels, et au plus une paire de portails dessinée à la fois.
    const dessin = await page.evaluate(() => ({ appels: window.__vertige.monde.renderer.info.render.calls, fenetres: window.__vertige.monde.fenetres?.dessinees ?? 0 }));
    expect(dessin.fenetres).toBeLessThanOrEqual(2);
    expect(dessin.appels).toBeLessThan(600);
    await context.close();
  });
});
