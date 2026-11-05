import { dailyBlocks, medailleDe, numeroBlocks, Partie, colonneDe, ligneDe, seuilsDepuis } from "@cdj/blocks-sim";
import { jouerDiamant } from "@cdj/blocks-sim/diamant";
import { parseDay } from "@cdj/core";
import { expect, test, type Page } from "@playwright/test";
import { exempleDePartage } from "../src/exemple";
import type { MedailleExemple } from "../src/essai";
import { appareil, JOUR, lancer } from "./appareil";

// « Blocks » — `?scenario=partage` (lot B4) : l'écran de fin tout de suite, avec un résultat d'exemple (le début de la partie du bot, arrêté dans la bande d'une médaille), et la ligne que « Partager » envoie —
// `Du Jour · Blocks #5 — 4 582 pts — combo ×7 — 🥈` — en français et en anglais. Le presse-papiers est celui du navigateur (droits donnés par `appareil`, ordinateur : pas de feuille de partage).
const jour = parseDay(JOUR)!;
const contenu = dailyBlocks(jour);
const seuils = seuilsDepuis(jouerDiamant(contenu).resultat.score);
const EMOJI: Record<string, string> = { silver: "\u{1F948}", gold: "\u{1F947}", bronze: "\u{1F949}", author: "\u{1F48E}" };
const nombre = (n: number, langue: "fr" | "en"): string => new Intl.NumberFormat(langue === "en" ? "en-US" : "fr-FR").format(n).replace(/[\u202f\u2009]/g, "\u00a0");

/** Ce que le résultat d'exemple vaut, par la simulation (Node). */
function attendu(m: MedailleExemple): { score: number; combo: number; medaille: string | null } {
  const p = new Partie(contenu);
  for (const a of exempleDePartage(contenu, m)) p.poser(colonneDe(a), ligneDe(a));
  const code = medailleDe([p.score], seuils);
  return { score: p.score, combo: p.comboMax, medaille: code ? EMOJI[code]! : null };
}
async function ligneCopiee(page: Page): Promise<string> {
  await page.locator("#jeu-partager").click();
  await expect(page.locator("#jeu-partage-etat")).toHaveText(/copi|cop/i);
  return page.evaluate(() => navigator.clipboard.readText());
}
async function ouvrir(browser: Parameters<typeof appareil>[0], medaille: string, locale = "fr-FR") {
  const a = await appareil(browser, `/?debug&manuel&tactile=0&scenario=partage&medaille=${medaille}`, true, true, locale);
  await lancer(a.page);
  await a.page.evaluate(() => window.__jeu.avancer(5)); // un pas suffit : la partie d'exemple est donnée pour finie
  await expect(a.page.locator("#jeu-fin")).toBeVisible();
  return a;
}

test.describe("Blocks : `?scenario=partage`", () => {
  test("l'écran de fin s'ouvre tout de suite sur le résultat d'exemple, non classé ; la ligne à partager est celle du seed (français, médaille d'argent)", async ({ browser }) => {
    const { context, page } = await ouvrir(browser, "argent");
    const ex = attendu("argent");
    expect(ex.medaille).toBe(EMOJI.silver);
    expect(await page.evaluate(() => window.__jeu.score())).toEqual([ex.score, ex.combo]);
    await expect(page.locator("#jeu-fin-score")).toHaveText(`${nombre(ex.score, "fr")} pts`);
    await expect(page.locator("#jeu-fin-rang")).toHaveText("Partie d'essai : non classée."); // un essai local, jamais envoyé
    expect(await page.evaluate(() => window.__jeu.envoi().statut)).not.toBe("ranked");
    const adresse = await page.evaluate(() => location.origin + location.pathname);
    // Le titre vient du numéro du jour (#5 : le 6 novembre, quatre jours après le premier), puis le score, la médaille et le combo maximal (les extras du kit, après la médaille).
    expect(numeroBlocks(jour)).toBe(5);
    expect(await ligneCopiee(page)).toBe(`Du Jour · Blocks #5 — ${nombre(ex.score, "fr")} pts — ${EMOJI.silver} — combo ×${ex.combo}\n${adresse}`);
    await context.close();
  });

  test("anglais : le séparateur de milliers anglais, « pts » et « combo » gardés", async ({ browser }) => {
    const { context, page } = await ouvrir(browser, "or", "en-US");
    const ex = attendu("or");
    await expect(page.locator("#jeu-fin-score")).toHaveText(`${nombre(ex.score, "en")} pts`);
    const ligne = (await ligneCopiee(page)).split("\n")[0]!;
    expect(ligne).toBe(`Du Jour · Blocks #5 — ${nombre(ex.score, "en")} pts — ${EMOJI.gold} — combo ×${ex.combo}`);
    expect(ex.score).toBeGreaterThanOrEqual(1000); // un grand nombre : « 1,234 » et non « 1 234 »
    expect(ligne).toMatch(/\d,\d{3} pts/);
    await context.close();
  });

  test("sans médaille : aucune pastille dans la ligne", async ({ browser }) => {
    const { context, page } = await ouvrir(browser, "aucune");
    const ex = attendu("aucune");
    expect(ex.medaille).toBeNull();
    const ligne = (await ligneCopiee(page)).split("\n")[0]!;
    expect(ligne).toBe(ex.combo > 0 ? `Du Jour · Blocks #5 — ${nombre(ex.score, "fr")} pts — combo ×${ex.combo}` : `Du Jour · Blocks #5 — ${nombre(ex.score, "fr")} pts`);
    expect(ligne).not.toMatch(/[\u{1F300}-\u{1FAFF}]/u);
    await context.close();
  });

  test("la médaille du Diamant : le résultat d'exemple est toute la partie du bot", async ({ browser }) => {
    const { context, page } = await ouvrir(browser, "diamant");
    const ex = attendu("diamant");
    expect(ex.medaille).toBe(EMOJI.author);
    expect((await ligneCopiee(page)).split("\n")[0]).toBe(`Du Jour · Blocks #5 — ${nombre(ex.score, "fr")} pts — ${EMOJI.author} — combo ×${ex.combo}`);
    await context.close();
  });
});
