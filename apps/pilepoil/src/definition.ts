import { PILEPOIL_GENERATOR_VERSION, PILEPOIL_SIM_VERSION, TICKS_PAR_SECONDE, VARIANTE, dailyPilepoil, numeroPilepoil, type Contenu } from "@cdj/pilepoil-sim";
import type { DefinitionJeuParty } from "@cdj/kit/jeu/types";
import { nouvellePartiePilepoil } from "./scene";

// La définition du jeu Party de départ pour `brancherJeu` (lot PA1) : sa simulation, son rendu, son aide — ni thème, ni médailles, ni fantôme : le kit complète (`DefinitionJeuParty`). Tout le reste est le kit. **Moins de 100 lignes de glue** : c'est la mesure du lot K4f.
/** Le contenu d'un jour : **sa graine et ce qu'on en tire** (`dailyPilepoil`) — un jeu Party n'a ni générateur de niveaux ni fichier de jour figé. */
const contenuDuJour = async (jour: number): Promise<Contenu> => dailyPilepoil(jour, PILEPOIL_GENERATOR_VERSION);

/**
 * Lot PG1 — **les essais du kit sur le jeu témoin** (`?debug`, jamais en production : règle R9) : `?debug&chargement=1000` déclare un `chargerPartie` lent (la partie ne démarre qu'après) et
 * `?debug&hud=surimpression` met le HUD sur le plateau (les zones du kit : `scene.ts`). Ils servent `e2e/surimpression.spec.ts` ; sans eux, rien ne change.
 * Lot PG2 : `?debug&bilan=1` donne à la partie un bilan (la cause et quatre lignes : l'écran de fin du kit les montre) et `?debug&dessins=1` un petit dessin à côté de chaque pas de « Comment jouer » ; ils servent `e2e/fin-et-aide.spec.ts`.
 */
const essai = (nom: string): string | null => {
  if (import.meta.env.VITE_PRODUCTION === "1" || typeof location === "undefined") return null; // hors navigateur (les tests unitaires lisent cette définition) : aucun essai
  const q = new URLSearchParams(location.search);
  return q.has("debug") ? q.get(nom) : null;
};
const CHARGEMENT_MS = Number(essai("chargement")) || 0;

/** Lot PG2 — un dessin par pas (essai `?debug&dessins=1`) : un carré à trait d'encre, aux jetons de la charte. */
const dessinDuPas = (): SVGElement => {
  const ns = "http://www.w3.org/2000/svg";
  const s = document.createElementNS(ns, "svg");
  s.setAttribute("viewBox", "0 0 56 56");
  const r = document.createElementNS(ns, "rect");
  for (const [k, v] of Object.entries({ x: "6", y: "6", width: "44", height: "44", fill: "var(--dj-papier)", stroke: "var(--dj-encre)", "stroke-width": "4" })) r.setAttribute(k, v);
  s.append(r);
  return s;
};
const DESSINS_AIDE = { "aide.point1": dessinDuPas, "aide.point2": dessinDuPas, "aide.point3": dessinDuPas };

export const DEFINITION: DefinitionJeuParty<Contenu> = {
  ...(CHARGEMENT_MS > 0 ? { chargerPartie: () => new Promise<void>((fini) => setTimeout(fini, CHARGEMENT_MS)) } : {}),
  ...(essai("hud") === "surimpression" ? { hud: "surimpression" as const } : {}),
  ticksParSeconde: TICKS_PAR_SECONDE,
  versions: { simVersion: PILEPOIL_SIM_VERSION, generatorVersion: PILEPOIL_GENERATOR_VERSION },
  actions: [
    { id: "gauche", clavier: ["ArrowLeft", "KeyA"], manette: null },
    { id: "droite", clavier: ["ArrowRight", "KeyD"], manette: null },
    { id: "haut", clavier: ["ArrowUp", "KeyW"], manette: null },
    { id: "bas", clavier: ["ArrowDown", "KeyS"], manette: null },
    { id: "toucher", clavier: ["Space", "KeyX"], manette: "b0" },
  ],
  numero: numeroPilepoil,
  contenuDuJour,
  // Lot PG2 — l'essai du bilan (`?debug&bilan=1`) : la cause et quatre lignes, lues à la fin de la partie ; sans lui, aucune ligne de plus (l'écran de fin est celui d'avant).
  nouvellePartie:
    essai("bilan") === "1"
      ? (contenu, hote, o) => {
          const p = nouvellePartiePilepoil(contenu, hote, o);
          return { ...p, bilan: () => ({ cause: { cle: "bilan.cause" }, lignes: [{ cle: "bilan.touches", valeur: String(p.resultat().score[0] ?? 0) }, { cle: "bilan.theme", valeur: o.t(`theme.${o.theme}`) }, { cle: "bilan.vide", valeur: "" }, { cle: "bilan.duree", valeur: o.t("bilan.dureeValeur") }, { cle: "bilan.pilepoil", valeur: "20" }] }) };
        }
      : nouvellePartiePilepoil,
  formatScore: (score, langue) => VARIANTE.formatScore(score, langue),
  scorePartage: (score, langue) => VARIANTE.scorePartage(score, langue),
  aide: ["aide.point1", "aide.point2", "aide.point3"],
  ...(essai("dessins") === "1" ? { dessinsAide: DESSINS_AIDE } : {}),
};
