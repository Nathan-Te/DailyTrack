// Les EFFETS de la scène de « Blocks » (lot B2), **purs** (aucun dessin, aucune horloge, aucun hasard de la simulation) : ce que les particules, les annonces et l'illumination d'une ligne qui s'efface sont à l'instant `t`
// (secondes). La scène les dessine ; ils ne changent jamais un octet d'une partie ni d'une rediffusion. Les positions sont en **cases de la grille** (`col + 0,5` : le centre de la case), y vers le bas.

/** Un générateur de nombres dans [0, 1) (mulberry32) : le hasard d'AFFICHAGE, jamais celui de la simulation. Une graine donne toujours la même suite. */
export function hasardAffichage(graine: number): () => number {
  let a = graine >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

/** La ligne qui s'efface s'illumine (la case passe au papier) pendant ce temps, puis éclate en particules. Les lignes et colonnes d'une même pose partent ensemble. */
export const DUREE_ILLUMINATION = 0.16;
/** Le plafond de particules vivantes : de quoi remplir l'effacement d'une grille presque pleine sans jamais passer sous 60 images par seconde sur un téléphone moyen. */
export const PARTICULES_MAX = 160;
const GRAVITE = 9; // cases par seconde au carré

export interface Particule {
  x: number;
  y: number;
  vx: number;
  vy: number;
  /** L'instant de sa naissance (secondes) et sa durée de vie. */
  t0: number;
  vie: number;
  couleur: string;
  /** Sa taille de départ, en cases. */
  taille: number;
  rot: number;
  vrot: number;
}

export interface CaseEffacee {
  col: number;
  ligne: number;
  couleur: string;
  /** Les yeux de la pièce étaient sur cette case : ils se ferment, contents, le temps de l'illumination. */
  yeux: boolean;
  t0: number;
}

/** Les particules d'un effacement : `cases` éclatent à l'instant `t0`. Combien par case : plus la pose est grande, moins chaque case en jette (le total ne dépasse jamais `PARTICULES_MAX`). */
export function eclater(cases: readonly { col: number; ligne: number; couleur: string }[], t0: number, hasard: () => number, vivantes = 0): Particule[] {
  const place = Math.max(0, PARTICULES_MAX - vivantes);
  if (cases.length === 0 || place === 0) return [];
  const parCase = Math.max(1, Math.min(5, Math.floor(place / cases.length)));
  const out: Particule[] = [];
  for (const c of cases) {
    for (let k = 0; k < parCase && out.length < place; k++) {
      const angle = hasard() * 2 * Math.PI;
      const vitesse = 1.6 + hasard() * 3.4;
      out.push({
        x: c.col + 0.5 + (hasard() - 0.5) * 0.4,
        y: c.ligne + 0.5 + (hasard() - 0.5) * 0.4,
        vx: Math.cos(angle) * vitesse,
        vy: Math.sin(angle) * vitesse - 2.2,
        t0,
        vie: 0.5 + hasard() * 0.45,
        couleur: c.couleur,
        taille: 0.13 + hasard() * 0.12,
        rot: hasard() * Math.PI,
        vrot: (hasard() - 0.5) * 12,
      });
    }
  }
  return out;
}

export interface EtatParticule {
  x: number;
  y: number;
  /** Sa taille en cases, qui rétrécit jusqu'à rien. */
  taille: number;
  alpha: number;
  rot: number;
}
/** La particule à l'instant `t`, ou `null` quand elle est finie. */
export function etatParticule(p: Particule, t: number): EtatParticule | null {
  const age = t - p.t0;
  if (age < 0 || age >= p.vie) return null;
  const k = age / p.vie;
  return { x: p.x + p.vx * age, y: p.y + p.vy * age + 0.5 * GRAVITE * age * age, taille: p.taille * (1 - 0.6 * k), alpha: k < 0.6 ? 1 : 1 - (k - 0.6) / 0.4, rot: p.rot + p.vrot * age };
}

/** À quel point la case est illuminée (0 à 1 : la couche de papier posée sur son bloc) : elle blanchit vite, puis tient jusqu'à l'éclatement. `age` : secondes depuis le début de l'effacement. */
export const illumination = (age: number): number => Math.min(1, Math.max(0, age / (DUREE_ILLUMINATION * 0.5)));
/** La case a-t-elle fini de s'illuminer (elle éclate alors) ? */
export const illuminationFinie = (age: number): boolean => age >= DUREE_ILLUMINATION;

/** Une annonce (« Combo ×3 ! », « Plateau vide ! ») : une pastille qui apparaît en rebondissant, tient, puis s'efface. */
export interface Annonce {
  texte: string;
  t0: number;
  duree: number;
  genre: "combo" | "plateau" | "fin";
}
export function etatAnnonce(a: Annonce, t: number): { echelle: number; alpha: number } | null {
  const age = t - a.t0;
  if (age < 0 || age > a.duree) return null;
  const entree = Math.min(1, age / 0.2);
  // Un petit dépassement (0,6 → 1,12 → 1) : l'annonce « claque ».
  const echelle = entree < 1 ? 0.6 + 0.52 * Math.sin((entree * Math.PI) / 2) : 1 + 0.12 * Math.max(0, 1 - (age - 0.2) / 0.12);
  const reste = a.duree - age;
  return { echelle, alpha: reste < 0.25 ? reste / 0.25 : 1 };
}

/** Un gain flottant (« +270 ») à l'endroit de l'effacement : il monte d'une case et demie puis s'efface. */
export interface GainFlottant {
  texte: string;
  /** Le point de départ, en cases. */
  x: number;
  y: number;
  t0: number;
  /** Plus gros pour un plateau vide. */
  grand: boolean;
}
export const DUREE_GAIN = 1.1;
export function etatGain(g: GainFlottant, t: number): { x: number; y: number; alpha: number; echelle: number } | null {
  const age = t - g.t0;
  if (age < 0 || age > DUREE_GAIN) return null;
  const k = age / DUREE_GAIN;
  return { x: g.x, y: g.y - 1.5 * (1 - (1 - k) * (1 - k)), alpha: k < 0.7 ? 1 : 1 - (k - 0.7) / 0.3, echelle: 0.7 + 0.3 * Math.min(1, age / 0.12) };
}

/** Le combo vient-il de changer ? Une petite « bosse » du compteur dans l'instant qui suit (0 à 1, puis plus rien). */
export function bosse(age: number, duree = 0.28): number {
  return age < 0 || age >= duree ? 0 : Math.sin((age / duree) * Math.PI);
}
