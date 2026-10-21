import { mkdirSync, writeFileSync } from "node:fs";
import { join } from "node:path";
import AxeBuilder from "@axe-core/playwright";
import { expect, test, type Page } from "@playwright/test";

// Lot I6 (plateforme), copie de apps/web/e2e/axe.ts (chaque jeu a ses e2e et sa configuration) : la passe automatique d'accessibilité (axe-core, par @axe-core/playwright : la seule dépendance ajoutée du lot, en
// développement). Règles WCAG 2.0, 2.1 et 2.2 A et AA, plus les « bonnes pratiques » d'axe. **Aucune violation « serious » ni « critical »** ;
// les « moderate » et « minor » sont jointes au rapport du test (annotation et pièce jointe) et listées dans le README du lot avec ce qui est fait.
// `AXE_RAPPORT=<dossier>` écrit aussi chaque résultat en JSON (pour le README).
export const REGLES_AXE = ["wcag2a", "wcag2aa", "wcag21a", "wcag21aa", "wcag22aa", "best-practice"];

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
  return constats;
}

/** L'élément qui a le focus est-il dans `selecteur` ? */
export const focusDans = (page: Page, selecteur: string) => page.evaluate((s) => !!document.activeElement && !!document.querySelector(s)?.contains(document.activeElement), selecteur);
/** L'identifiant de l'élément qui a le focus (`BODY` : la page). */
export const focusSur = (page: Page) => page.evaluate(() => document.activeElement?.id || document.activeElement?.tagName || "");
