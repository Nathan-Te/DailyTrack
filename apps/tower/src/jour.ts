import { formatDay } from "@cdj/core";
import { dailyTower, lireJourFige, type Scenario } from "@cdj/tower-sim";

// Le contenu d'un jour pour le jeu (lot T2) : le jour FIGÉ s'il existe (`jours/AAAA-MM-JJ.json`, écrit par `npm run figer:tower -w @cdj/tower-sim`, jamais à la main), sinon le
// générateur avec la version courante. La liste des dates figées publiées est écrite à la construction (`vite.config.ts`, d'après `public/jours/`) : une date qui n'y est pas ne
// fait aucune requête. Un fichier qui ne se relit pas (`lireJourFige` : format, versions, forme de chaque champ) est ignoré, comme s'il n'existait pas.

declare const __JOURS_FIGES__: readonly string[] | undefined;

/** Les jours figés publiés avec le jeu (vide hors construction : en test, dans le serveur de développement avant le premier figeage). */
export const JOURS_FIGES: readonly string[] = typeof __JOURS_FIGES__ === "undefined" ? [] : __JOURS_FIGES__;

/** Lit le fichier d'un jour figé (`jours/AAAA-MM-JJ.json`, à côté de la page) ; null s'il manque, n'est pas du JSON, ne se relit pas ou tarde. */
async function lireFichier(jour: number, base: string, delai = 4000): Promise<Scenario | null> {
  const date = formatDay(jour);
  if (!JOURS_FIGES.includes(date)) return null;
  const ctrl = typeof AbortController === "undefined" ? null : new AbortController();
  const minuteur = ctrl ? setTimeout(() => ctrl.abort(), delai) : null;
  try {
    const r = await fetch(new URL(`jours/${date}.json`, base), { signal: ctrl?.signal, cache: "no-cache" });
    if (!r.ok) return null;
    const lu = lireJourFige((await r.json()) as unknown, jour);
    return typeof lu === "string" ? null : lu;
  } catch {
    return null;
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
}

/** Le contenu du jour `jour` : le jour figé s'il existe, sinon `dailyTower` avec la version courante. */
export async function contenuDuJour(jour: number, base: string = document.baseURI): Promise<Scenario> {
  return (await lireFichier(jour, base)) ?? dailyTower(jour);
}
