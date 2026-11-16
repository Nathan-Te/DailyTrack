import { CIBLES_GENERATOR_VERSION, CIBLES_SIM_VERSION, TICKS_PAR_SECONDE, VARIANTE, dailyCibles, lireJourFige, medailleDe, numeroCibles, seuilsDe, themeDuJour, touchesDuBot, enregistrer, type Contenu } from "@cdj/cibles-sim";
import { formatDay } from "@cdj/core";
import { dateDemandable, lireFichierDeJour } from "@cdj/kit/jour";
import type { DefinitionJeu } from "@cdj/kit/jeu/types";
import { nouvellePartieCibles } from "./scene";

// La définition de « Cibles » pour `brancherJeu` : sa simulation, son rendu, son aide. Tout le reste est le kit. **Moins de 100 lignes de glue** : c'est la mesure du lot K4f.
declare const __JOURS_FIGES__: readonly string[] | undefined;
const JOURS_FIGES: readonly string[] = typeof __JOURS_FIGES__ === "undefined" ? [] : __JOURS_FIGES__;

/** Le contenu d'un jour : le fichier figé s'il existe (`jours/AAAA-MM-JJ.json`) et se relit, sinon le générateur courant. */
async function contenuDuJour(jour: number, base: string): Promise<Contenu> {
  const date = formatDay(jour);
  if (dateDemandable(date, import.meta.env.VITE_PRODUCTION === "1", JOURS_FIGES)) {
    try {
      const lu = lireJourFige(await lireFichierDeJour("jours", date, base, 4000));
      if (lu) return lu;
    } catch {
      /* absent ou abîmé : le générateur */
    }
  }
  return dailyCibles(jour, CIBLES_GENERATOR_VERSION);
}

/**
 * Lot PG1 — **les essais du kit sur le jeu témoin** (`?debug`, jamais en production : règle R9) : `?debug&chargement=1000` déclare un `chargerPartie` lent (la partie ne démarre qu'après) et
 * `?debug&hud=surimpression` met le HUD sur le plateau (les zones du kit : `scene.ts`). Ils servent `e2e/surimpression.spec.ts` ; sans eux, rien ne change.
 */
const essai = (nom: string): string | null => (import.meta.env.VITE_PRODUCTION === "1" ? null : new URLSearchParams(location.search).has("debug") ? new URLSearchParams(location.search).get(nom) : null);
const CHARGEMENT_MS = Number(essai("chargement")) || 0;

export const DEFINITION: DefinitionJeu<Contenu> = {
  ...(CHARGEMENT_MS > 0 ? { chargerPartie: () => new Promise<void>((fini) => setTimeout(fini, CHARGEMENT_MS)) } : {}),
  ...(essai("hud") === "surimpression" ? { hud: "surimpression" as const } : {}),
  ticksParSeconde: TICKS_PAR_SECONDE,
  versions: { simVersion: CIBLES_SIM_VERSION, generatorVersion: CIBLES_GENERATOR_VERSION },
  actions: [
    { id: "gauche", clavier: ["ArrowLeft", "KeyA"], manette: null },
    { id: "droite", clavier: ["ArrowRight", "KeyD"], manette: null },
    { id: "haut", clavier: ["ArrowUp", "KeyW"], manette: null },
    { id: "bas", clavier: ["ArrowDown", "KeyS"], manette: null },
    { id: "toucher", clavier: ["Space", "KeyX"], manette: "b0" },
  ],
  themeDuJour,
  numero: numeroCibles,
  contenuDuJour,
  seuils: (c) => seuilsDe(c),
  medaille: (score, s) => medailleDe(score, s),
  nouvellePartie: nouvellePartieCibles,
  rediffusionDiamant: (c) => enregistrer(c, touchesDuBot(c)),
  formatScore: (score, langue) => VARIANTE.formatScore(score, langue),
  scorePartage: (score, langue) => VARIANTE.scorePartage(score, langue),
  aide: ["aide.point1", "aide.point2", "aide.point3"],
};
