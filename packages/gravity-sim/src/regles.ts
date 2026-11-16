import { DISTANCE_PAR_CRAN, GRAVITE, GRAVITY_SIM_VERSION, MORCEAUX_PAR_THEME, VENT_GRAVITE, VITESSE_BASE, VITESSE_MAX } from "./constantes";

// Les règles sous lesquelles une partie se joue (lot GR5) : **ce qu'un jour figé garde de la simulation** et **ce que les essais de calibrage règlent**, au même endroit.
//
// 1. **Les versions de la simulation** (`SIMS`) : une version est un jeu de valeurs (la caméra : vitesse de départ, plafond, pente ; la gravité) que la partie lit à l'endroit où elle les employait comme constantes. Un jour
//    figé nomme la version qui l'a produit (`JourFige.sim`) ; `lireJourFige` l'accepte tant qu'elle est ici (`versionsSimJouables`), et le terrain, la partie, le robot et le rejeu la lisent sur le contenu du jour. Une
//    version s'AJOUTE (jamais une valeur changée à sa place) ; quand le changement n'est pas une valeur mais un comportement (une règle de `partie.ts`), la version porte un drapeau que `partie.ts` lit (jamais une copie du
//    fichier). La règle de ce qu'on garde et de ce qu'on retire : `packages/gravity-sim/CLAUDE.md`, « Les anciennes versions ».
// 2. **Les réglages d'essai** (`ReglagesEssai`) : les mêmes valeurs, changées par l'adresse de la page (`?vitesse=`, `?plafond=`, `?pente=`, `?gravite=`, `?longueur=`, `?medailles=` : `apps/gravity/src/essai.ts`, **hors production
//    seulement**), pour essayer un calibrage sans déployer. Un contenu qui en porte est un **essai** : jamais classé, jamais envoyé (la partie est marquée `essai`).

/** Ce qu'une version de la simulation fixe (tout est entier : vitesses en unités par seconde, gravité en unités par pas, pente en unités de caméra par cran). */
export interface ReglesSim {
  /** Vitesse de la caméra au départ (unités par seconde : 7 cases/s = 28 672). */
  vitesseBase: number;
  /** Vitesse plafond de la caméra. */
  vitesseMax: number;
  /** La vitesse de la caméra gagne 1 unité par seconde tous les `distanceParCran` unités parcourues : 220 donne 1 case/s tous les 220 m (maquette : `7 + distance / 220`). */
  distanceParCran: number;
  /** La gravité : unités par seconde ajoutées à chaque pas. */
  gravite: number;
  /** La gravité dans le vent (le rapport 2/5 de la gravité : 628 pour 1 570). */
  ventGravite: number;
}
/** Les versions jouables de la simulation. **On en ajoute, on n'en change pas** : un jour figé sous la version 2 se rejoue avec cette ligne tant qu'on la garde. */
export const SIMS: Record<number, ReglesSim> = {
  2: { vitesseBase: VITESSE_BASE, vitesseMax: VITESSE_MAX, distanceParCran: DISTANCE_PAR_CRAN, gravite: GRAVITE, ventGravite: VENT_GRAVITE },
};
/** Les versions de la simulation que ce code sait jouer. */
export const versionsSimJouables = (): number[] => Object.keys(SIMS).map(Number);

/** Les réglages d'essai : chaque champ remplace la valeur de la version ; absent = celle de la version. `pourcent` : le pourcentage du score du robot qui fait un seuil de médaille (`seuils.ts`). **Hors production, jamais classé.** */
export interface ReglagesEssai {
  vitesseBase?: number;
  vitesseMax?: number;
  distanceParCran?: number;
  gravite?: number;
  /** La longueur d'un thème, en morceaux (19 : 304 m). */
  morceauxParTheme?: number;
  pourcent?: number;
}
export const CHAMPS_D_ESSAI = ["vitesseBase", "vitesseMax", "distanceParCran", "gravite", "morceauxParTheme", "pourcent"] as const;

/** Les règles d'une partie : la version de la simulation (ses valeurs, réglées s'il y a un essai) et la longueur d'un thème (celle du générateur du jour, réglée s'il y a un essai). */
export interface Regles extends ReglesSim {
  /** La version de la simulation dont ces règles viennent. */
  sim: number;
  morceauxParTheme: number;
}

export class ErreurRegles extends Error {
  constructor(message: string) {
    super(message);
    this.name = "ErreurRegles";
  }
}

/** Les règles d'un contenu : la version `sim` de la simulation, `morceauxParTheme` (celui du générateur du jour), les réglages d'essai par-dessus. Une version inconnue lève `ErreurRegles`. */
export function reglesDe(sim: number, morceauxParTheme: number, essai?: ReglagesEssai): Regles {
  const v = SIMS[sim];
  if (!v) throw new ErreurRegles(`version de simulation inconnue : ${sim}`);
  const r: Regles = { sim, ...v, morceauxParTheme };
  if (essai) {
    if (essai.vitesseBase !== undefined) r.vitesseBase = essai.vitesseBase;
    if (essai.vitesseMax !== undefined) r.vitesseMax = essai.vitesseMax;
    if (essai.distanceParCran !== undefined) r.distanceParCran = essai.distanceParCran;
    if (essai.gravite !== undefined) {
      r.gravite = essai.gravite;
      r.ventGravite = Math.trunc((essai.gravite * 2) / 5); // le vent allège toujours la gravité aux 2/5
    }
    if (essai.morceauxParTheme !== undefined) r.morceauxParTheme = essai.morceauxParTheme;
  }
  return r;
}

/** Les règles de la version courante, sans essai : ce que les fonctions de ce paquet prennent quand on ne leur en donne pas. */
export const REGLES_COURANTES: Regles = Object.freeze(reglesDe(GRAVITY_SIM_VERSION, MORCEAUX_PAR_THEME));

/** Une clé qui change avec les règles et l'essai : les tables et les terrains gardés en mémoire en dépendent. */
export const cleDesRegles = (r: Regles): string => `${r.sim}.${r.vitesseBase}.${r.vitesseMax}.${r.distanceParCran}.${r.gravite}.${r.ventGravite}.${r.morceauxParTheme}`;
