import { expect, test } from "@playwright/test";
import { parseDay } from "@cdj/core";
import { STRATEGIES, TICKS_PAR_SECONDE, VARIANTE, dailyRush, diamantDuJour, formatTemps, ligneDuJour, medailleDe, seuilsDe } from "@cdj/rush-sim";
import { JOUR, appareil, lancer } from "./appareil";

// « Rush » (lot BR4) — les médailles, vues du navigateur : le tableau des médailles (`?scenario=medailles`), l'écran de fin à un temps donné (`?scenario=fin`, celui du kit complété par le jeu) et le fantôme du Diamant
// (`?scenario=jour&fantome=1`, le bouton du kit dans l'interface en jeu). Les règles (Diamant = meilleur des trois stratégies, pourcentages de la fiche, jour figé) sont dans `packages/rush-sim/test/medailles.test.ts`.
const jour = parseDay(JOUR)!;
// lot BR5 (économie : « foncer » ne gagne plus de niveau) : les essais qui regardent les CARTES du Diamant prennent un jour où il farme un peu (le 7 novembre : « un peu d'XP », 9 niveaux)
const JOUR_FARM = "2026-11-07";
const jourFarm = parseDay(JOUR_FARM)!;
const MEDAILLES = { author: "Diamant", gold: "Or", silver: "Argent", bronze: "Bronze" } as const;

test.describe("Rush : les médailles", () => {
  test("le tableau des médailles montre, par jour, le boss, les trois temps du pilote, la stratégie du Diamant, les quatre seuils et le pilote humanisé — ceux que la simulation calcule", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=medailles&jours=3");
    await page.locator("#jeu-jouer").click();
    await page.waitForSelector(".rush-medailles__table tbody tr", { timeout: 90_000 });
    const lignes = page.locator(".rush-medailles__table tbody tr");
    await expect(lignes).toHaveCount(3);
    for (let k = 0; k < 3; k++) {
      const l = ligneDuJour(dailyRush(jour + k));
      const tr = lignes.nth(k);
      await expect(tr).toHaveAttribute("data-diamant", l.diamant);
      for (const s of STRATEGIES) await expect(tr.locator(`td[data-strategie="${s}"]`)).toHaveText(l.temps[s] >= 36000 ? "—" : formatTemps(l.temps[s], "fr")); // une partie perdue (le pire temps) s'écrit « — »
      // la cellule du Diamant est marquée, et le seuil « Diamant » est son temps
      await expect(tr.locator(`td.rush-medailles__diamant`)).toHaveAttribute("data-strategie", l.diamant);
      for (const m of ["author", "gold", "silver", "bronze"] as const) await expect(tr.locator(`td[data-seuil="${m}"]`)).toHaveText(formatTemps(l.seuils[m], "fr"));
      expect(l.seuils.author).toBe(Math.min(...STRATEGIES.map((s) => l.temps[s])));
      for (const s of STRATEGIES) await expect(tr.locator(`td[data-humain="${s}"]`)).toHaveText(l.humain[s] >= 36000 ? "—" : formatTemps(l.humain[s], "fr"));
    }
    await expect(page.locator(".rush-medailles__pied")).toHaveText(`${VARIANTE.fiche.bareme.join(" % · ")} %`); // les pourcentages de la fiche
    await context.close();
  });

  test("l'écran de fin à 65 s : le temps, la médaille, l'écart avec la suivante en temps, le boss du jour, les cartes choisies et « Rejouer »", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=fin&temps=65000&jour=${JOUR_FARM}`);
    await page.locator("#jeu-jouer").click();
    await expect(page.locator("#jeu-fin-score")).toHaveText("1:05,00", { timeout: 90_000 });
    const s = seuilsDe(dailyRush(jourFarm));
    const med = medailleDe([65 * TICKS_PAR_SECONDE], s);
    // la liste des médailles : les quatre seuils, en temps (le kit les écrit en ticks : le jeu les réécrit)
    const valeurs = await page.locator("#jeu-fin .dj-medaille__valeur").allTextContents();
    expect(valeurs).toHaveLength(4);
    expect(valeurs).toEqual([s.author, s.gold, s.silver, s.bronze].map((t) => formatTemps(t, "fr")));
    // « encore … » : l'écart avec la médaille suivante, en temps
    const suivante = (["bronze", "silver", "gold", "author"] as const).find((m) => s[m] < 65 * TICKS_PAR_SECONDE);
    if (suivante) {
      const encore = page.locator("#jeu-fin-encore");
      await expect(encore).toContainText(formatTemps(65 * TICKS_PAR_SECONDE - s[suivante], "fr"));
      expect(await encore.textContent()).not.toMatch(/\d{4,}/); // jamais des ticks
    }
    expect(med === null ? "rien" : MEDAILLES[med]).toBeTruthy();
    // ce que le jeu pose : le boss du jour, les cartes (celles du Diamant), le Diamant
    const bloc = page.locator("#jeu-fin .rush-fin");
    await expect(bloc).toHaveCount(1);
    await expect(bloc.locator('[data-role="boss"]')).toContainText("Boss du jour : ");
    await expect(bloc.locator('[data-role="cartes"]')).toContainText("Cartes choisies : ");
    await expect(bloc.locator('[data-role="diamant"]')).toContainText(formatTemps(s.author, "fr"));
    await expect(bloc.locator('[data-role="diamant"]')).toContainText(`(${["foncer", "un peu d'XP", "beaucoup d'XP"][STRATEGIES.indexOf(diamantDuJour(dailyRush(jourFarm)).strategie)]})`);
    // une partie d'essai : dite, jamais classée ; et on peut rejouer
    await expect(page.locator("#jeu-fin-rang")).toBeVisible();
    await expect(page.locator("#jeu-rejouer")).toBeVisible();
    await context.close();
  });

  test("l'écran de fin ne s'écrit qu'une fois (le kit le refait, le jeu le complète sans doublon)", async ({ browser }) => {
    const { context, page } = await appareil(browser, "/?debug&manuel&tactile=0&scenario=fin&temps=40000");
    await page.locator("#jeu-jouer").click();
    await expect(page.locator("#jeu-fin-score")).toBeVisible({ timeout: 90_000 });
    await page.waitForTimeout(600); // plusieurs images
    await expect(page.locator("#jeu-fin .rush-fin")).toHaveCount(1);
    await context.close();
  });

  test("le fantôme du Diamant : visible dès le départ, translucide, au pas de la partie, fait ses choix de cartes sans montrer l'écran des cartes ; le bouton fantôme est dans l'interface en jeu", async ({ browser }) => {
    const { context, page } = await appareil(browser, `/?debug&manuel&tactile=0&scenario=jour&fantome=1&jour=${JOUR_FARM}`);
    await lancer(page);
    await expect(page.locator("#jeu-hud-fantome")).toBeVisible(); // le bouton du kit, dans le HUD de la partie (pas seulement dans la pause)
    const f0 = await page.evaluate(() => window.__rush.fantome());
    expect(f0).toMatchObject({ visible: true, tick: 0, finie: false });
    expect(f0!.opacite).toBeGreaterThan(0);
    expect(f0!.opacite).toBeLessThan(0.5); // un chevalier translucide
    // le joueur ne bouge pas : le fantôme avance du même nombre de ticks (le monde du joueur n'est figé que par SON choix)
    await page.evaluate(() => window.__jeu.avancer(240));
    const f1 = await page.evaluate(() => window.__rush.fantome());
    expect(f1!.tick).toBe(240);
    expect(f1!.x !== f0!.x || f1!.y !== f0!.y).toBe(true); // il court
    // plus loin, il gagne des niveaux (il fait SON choix tout de suite) : l'écran des cartes n'est jamais celui du fantôme
    for (let i = 0; i < 12 && (await page.evaluate(() => window.__rush.fantome()!.nv)) < 2; i++) await page.evaluate(() => window.__jeu.avancer(300));
    expect(await page.evaluate(() => window.__rush.fantome()!.nv)).toBeGreaterThanOrEqual(2);
    await expect(page.locator(".rush-choix")).toBeHidden();
    // le fantôme est la partie du Diamant : ce qu'il a fait est ce que le serveur rejouerait (même nombre de ticks à la fin)
    const attendu = diamantDuJour(dailyRush(jourFarm));
    const fin = attendu.parties[attendu.strategie].score;
    for (let i = 0; i < 40 && !(await page.evaluate(() => window.__rush.fantome()!.finie)); i++) await page.evaluate(() => window.__jeu.avancer(300));
    const f2 = await page.evaluate(() => window.__rush.fantome());
    expect(f2!.finie).toBe(true);
    expect(f2!.tick).toBe(fin);
    await context.close();
  });
});
