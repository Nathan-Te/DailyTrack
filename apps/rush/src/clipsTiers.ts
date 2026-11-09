import { ANNONCE, ANNONCE_PLONGEON, CHAUVE, COMPETENCE, COUP, ESQUIVE, GELEE, PLONGEON, RECUPERE, REPOS, type Chevalier, type Golem, type Monstre } from "@cdj/rush-sim";

// Lot BR-A3 : la TABLE « état de la simulation → clip » des modèles tiers (animés : un squelette, des clips nommés par la chaîne de conversion `apps/rush/modeles-tiers/`).
// Pure (aucun Three.js) : testée par `test/clipsTiers.test.ts`. La vue (`tiers.ts`) joue ce qu'elle rend, avec un FONDU entre deux clips.
//  · `boucle` : le clip tourne à sa vitesse (× `vitesse`) ;
//  · `une` : il se joue une fois et reste sur sa dernière image ;
//  · `progression` : son temps SUIT la simulation (`p`, de 0 à 1, entre `de` et `a` de sa durée) — une annonce, un coup, une esquive durent ce que dure la règle, jamais ce que dure le clip.

export type ModeClip = "boucle" | "une" | "progression";
export interface Clip {
  nom: string;
  mode: ModeClip;
  /** De 0 à 1 : où en est l'état (mode `progression`). */
  p?: number;
  /** La part du clip jouée (mode `progression`) : de `de` à `a` (fractions de sa durée). */
  de?: number;
  a?: number;
  vitesse?: number;
  /** Le fondu d'entrée, en secondes (0,15 par défaut). */
  fondu?: number;
}

/** Où tombe l'impact dans les clips d'attaque des packs (fraction de la durée, lue sur les planches de `modeles-tiers/build/`) : la fin de l'annonce de la sim s'y cale. */
export const IMPACT = { golem: 0.5, gelee: 0.42, coup: 0.42 } as const;

const borne = (x: number): number => Math.min(1, Math.max(0, x));

/** Le chevalier : `duree` du coup en cours (ticks), `dureeEsquive` (ticks), `course` (0 à 1 : la course hors combat), `touche` (vrai juste après un dégât), `perdue`, `gagnee`. */
export function clipChevalier(c: Pick<Chevalier, "etat" | "t" | "combo" | "marche">, o: { duree: number; dureeEsquive: number; course: number; touche: boolean; perdue: boolean; gagnee: boolean }): Clip {
  if (o.perdue) return { nom: "mort", mode: "une", fondu: 0.1 };
  if (c.etat === COUP) return { nom: `coup${(c.combo % 3) + 1}`, mode: "progression", p: borne(c.t / Math.max(1, o.duree)), de: 0.05, a: 0.95, fondu: 0.06 };
  if (c.etat === ESQUIVE) return { nom: "esquive", mode: "progression", p: borne(c.t / Math.max(1, o.dureeEsquive)), de: 0, a: 1, fondu: 0.05 };
  if (c.etat === COMPETENCE) return { nom: "competence", mode: "boucle", vitesse: 1.4, fondu: 0.08 };
  if (o.touche) return { nom: "touche", mode: "une", fondu: 0.05 };
  if (o.gagnee) return { nom: "victoire", mode: "boucle" };
  if (c.marche) return o.course > 0.3 ? { nom: "course", mode: "boucle", vitesse: 0.9 + 0.3 * o.course } : { nom: "marche", mode: "boucle", vitesse: 1.15 };
  return { nom: "attente", mode: "boucle" };
}

/** Le boss (le golem, seul converti dans l'essai) : `marche` (il se déplace), `dort` (avant le réveil), `mort` (vie à 0). L'annonce suit la fraction de la sim jusqu'à l'impact du clip. */
export function clipGolem(g: Pick<Golem, "etat" | "t" | "duree" | "t1" | "hp">, o: { marche: boolean; dort: boolean }): Clip {
  if (g.hp <= 0) return { nom: "mort", mode: "une", fondu: 0.2 };
  if (o.dort) return { nom: "dort", mode: "boucle" };
  if (g.etat === ANNONCE) {
    const premier = Math.max(1, g.t1 || g.duree);
    // jusqu'au premier impact : du début du clip à son impact ; ensuite (le second coup de la phase 2) : la fin du clip
    if (g.t <= premier) return { nom: "annonce", mode: "progression", p: borne(g.t / premier), de: 0, a: IMPACT.golem, fondu: 0.2 };
    return { nom: "annonce", mode: "progression", p: borne((g.t - premier) / Math.max(1, g.duree - premier)), de: 0, a: IMPACT.golem, fondu: 0.1 };
  }
  if (g.etat === RECUPERE) return { nom: "recupere", mode: "boucle", fondu: 0.25 };
  return o.marche ? { nom: "marche", mode: "boucle", vitesse: 0.9 } : { nom: "attente", mode: "boucle" };
}

/** Les monstres convertis (la gelée, la chauve-souris) ; `null` pour un type sans modèle tiers (il garde sa forme procédurale). */
export function clipMonstre(
  m: Pick<Monstre, "type" | "etat" | "t" | "gel">,
  d: { geleeAnnonce: number; geleeBond: number; chauvePlongeon: number },
  o: { marche: boolean; touche: boolean },
): Clip | null {
  if (m.type === GELEE) {
    if (o.touche) return { nom: "touche", mode: "une", fondu: 0.05 };
    if (m.gel > 0) return { nom: "repos", mode: "boucle", vitesse: 1.6 };
    if (m.t < d.geleeAnnonce) return { nom: "bond", mode: "progression", p: borne(m.t / d.geleeAnnonce), de: 0, a: IMPACT.gelee, fondu: 0.1 };
    if (m.t < d.geleeAnnonce + d.geleeBond) return { nom: "bond", mode: "progression", p: borne((m.t - d.geleeAnnonce) / d.geleeBond), de: IMPACT.gelee, a: 1, fondu: 0.04 };
    return o.marche ? { nom: "marche", mode: "boucle", vitesse: 1.3 } : { nom: "attente", mode: "boucle" };
  }
  if (m.type === CHAUVE) {
    if (o.touche) return { nom: "touche", mode: "une", fondu: 0.05 };
    if (m.etat === ANNONCE_PLONGEON) return { nom: "annonce", mode: "boucle", vitesse: 1.6, fondu: 0.1 };
    if (m.etat === PLONGEON) return { nom: "plongeon", mode: "progression", p: borne(m.t / Math.max(1, d.chauvePlongeon)), de: 0.1, a: 0.9, fondu: 0.06 };
    if (m.etat === REPOS) return { nom: "repos", mode: "boucle" };
    return { nom: "marche", mode: "boucle", vitesse: 1.2 };
  }
  return null;
}

/** Les noms de clips qu'un modèle doit porter (la chaîne de conversion les écrit ; `test/clipsTiers.test.ts` vérifie que la table n'en demande pas d'autres). */
export const CLIPS_REQUIS = {
  chevalier: ["attente", "marche", "course", "coup1", "coup2", "coup3", "esquive", "competence", "touche", "mort", "victoire"],
  golem: ["attente", "marche", "annonce", "recupere", "mort", "dort"],
  gelee: ["attente", "marche", "bond", "touche", "repos"],
  "chauve-souris": ["marche", "annonce", "plongeon", "repos", "touche"],
} as const;
export type NomTiers = keyof typeof CLIPS_REQUIS;
