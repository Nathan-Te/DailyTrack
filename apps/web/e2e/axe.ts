import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Lot I6 (plateforme) : la passe automatique d'accessibilité (axe-core, par @axe-core/playwright : la seule dépendance ajoutée du lot, en
// développement). Règles WCAG 2.0, 2.1 et 2.2 A et AA, plus les « bonnes pratiques » d'axe. **Aucune violation « serious » ni « critical »**, aucune
// « moderate » hors de `MODERES_ACCEPTES` ; les autres constats sont joints au rapport du test (annotation et pièce jointe).
// `AXE_RAPPORT=<dossier>` écrit aussi chaque résultat en JSON (pour le README).
export const REGLES_AXE = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

/**
 * Les constats « moderate » **acceptés**, chacun avec sa raison (décisions de Nathan, lot I6) : un futur lot ne les « corrige » pas. Tout autre
 * constat « moderate » fait échouer le test (il se corrige, ou il entre ici avec Nathan et sa raison).
 */
export const MODERES_ACCEPTES: Record<string, string> = {
  "meta-viewport":
    "le zoom est bloqué dans les jeux (`maximum-scale=1, user-scalable=no`) : un pincement en partie ne doit pas zoomer (il conduirait ou sauterait) — décision de Nathan, lot I6 ; le portail, le profil, le classement, les mentions et la 404 le permettent",
  region: "la scène du jeu (`canvas`) et les plaques de la partie sont hors d'un repère : ce n'est pas du contenu à lire ; les écrans, eux, sont des dialogues avec leur `main`",
};

export interface Constat {
  regle: string;
  impact: string;
  aide: string;
  cibles: string[];
}

/** Audite la page telle qu'elle est (`zone` : un sélecteur pour n'auditer qu'un écran) ; échoue sur toute violation grave. Rend les constats. */
export async function auditAxe(page: Page, nom: string, zone?: string): Promise<Constat[]> {
  await page.evaluate(() => document.fonts.ready);
  let builder = new AxeBuilder({ page }).withTags(REGLES_AXE);
  if (zone) builder = builder.include(zone);
  const resultat = await builder.analyze();
  const constats: Constat[] = resultat.violations.map((v) => ({
    regle: v.id,
    impact: v.impact ?? "inconnu",
    aide: v.help,
    cibles: v.nodes.slice(0, 6).map((n) => n.target.join(" ")),
  }));
  const graves = constats.filter((c) => c.impact === "serious" || c.impact === "critical");
  const autres = constats.filter((c) => !graves.includes(c));
  await test.info().attach(`axe-${nom}.json`, { body: JSON.stringify(constats, null, 2), contentType: "application/json" });
  for (const c of autres) test.info().annotations.push({ type: `axe ${c.impact}`, description: `${nom} : ${c.regle} — ${c.aide} (${c.cibles.join(", ")})` });
  if (process.env.AXE_RAPPORT) {
    mkdirSync(process.env.AXE_RAPPORT, { recursive: true });
    writeFileSync(join(process.env.AXE_RAPPORT, `${nom}.json`), JSON.stringify(constats, null, 2));
  }
  expect(graves, `${nom} : violations graves d'axe`).toEqual([]);
  const moderes = constats.filter((c) => c.impact === "moderate" && !Object.hasOwn(MODERES_ACCEPTES, c.regle));
  expect(moderes, `${nom} : constats « moderate » non acceptés (les corriger, ou les faire accepter par Nathan : MODERES_ACCEPTES)`).toEqual([]);
  return constats;
}

/** L'élément qui a le focus est-il dans `selecteur` ? */
export const focusDans = (page: Page, selecteur: string) => page.evaluate((s) => !!document.activeElement && !!document.querySelector(s)?.contains(document.activeElement), selecteur);
/** L'identifiant de l'élément qui a le focus (`BODY` : la page). */
export const focusSur = (page: Page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || "");
