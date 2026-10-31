import { formatDay } from "@cdj/core";
import { type Contenu, dailyTower, lireJour, type Medailles, TOWER_GENERATOR_VERSION } from "@cdj/tower-sim";

// Le contenu d'un jour pour le jeu (lot T2) : le jour FIGÉ s'il existe (`jours/AAAA-MM-JJ.json`, écrit par `npm run figer:tower -w @cdj/tower-sim`, jamais à la main), sinon le
// générateur avec la version courante. La liste des dates figées publiées est écrite à la construction (`vite.config.ts`, d'après `public/jours/`) : une date qui n'y est pas ne
// fait aucune requête. Un fichier qui ne se relit pas (`lireJour` : format, versions, forme de chaque champ) est ignoré, comme s'il n'existait pas.
// Lot T3 : un jour PRÉPARÉ (`npm run preparer:tower`) porte aussi ses médailles et, hors production, la preuve de l'auteur (le bot) : la construction de production la retire (`preuves.ts`).

declare const __JOURS_FIGES__: readonly string[] | undefined;

/** Les jours figés publiés avec le jeu (vide hors construction : en test, dans le serveur de développement avant le premier figeage). */
export const JOURS_FIGES: readonly string[] = typeof __JOURS_FIGES__ === "undefined" ? [] : __JOURS_FIGES__;

/** Ce qu'un jour donne au jeu : son contenu, ses médailles si le fichier du jour en a (sinon `null`), et la preuve de l'auteur (hors production seulement : sinon `null`). */
export interface JourDuJeu {
  contenu: Contenu;
  medailles: Medailles | null;
  preuve: string | null;
}

/** Lit le fichier d'un jour figé (`jours/AAAA-MM-JJ.json`, à côté de la page) ; null s'il manque, n'est pas du JSON, ne se relit pas ou tarde. */
async function lireFichier(jour: number, base: string, delai = 4000): Promise<JourDuJeu | null> {
  const date = formatDay(jour);
  // En production la liste écrite à la construction décide (aucune requête pour un jour qui n'est pas figé) ; ailleurs (aperçu, local, tests) on essaie toujours : un fichier absent est ignoré.
  if (import.meta.env.VITE_PRODUCTION === "1" && !JOURS_FIGES.includes(date)) return null;
  const ctrl = typeof AbortController === "undefined" ? null : new AbortController();
  const minuteur = ctrl ? setTimeout(() => ctrl.abort(), delai) : null;
  try {
    const r = await fetch(new URL(`jours/${date}.json`, base), { signal: ctrl?.signal, cache: "no-cache" });
    if (!r.ok) return null;
    const lu = lireJour((await r.json()) as unknown, jour);
    return typeof lu === "string" ? null : lu;
  } catch {
    return null;
  } finally {
    if (minuteur) clearTimeout(minuteur);
  }
}

/** Le jour `jour` : le jour figé s'il existe (il porte son tirage), sinon `dailyTower` avec la version courante au tirage `tirage` (0, ou `?tirage=` hors production ; sans médailles : le jeu les estime ou les calcule). */
export async function chargerJour(jour: number, tirage = 0, base: string = document.baseURI): Promise<JourDuJeu> {
  return (await lireFichier(jour, base)) ?? { contenu: dailyTower(jour, TOWER_GENERATOR_VERSION, tirage), medailles: null, preuve: null };
}
