import { Rng } from "@cdj/core";
import { Partie, TOUR, T_AVANT, T_DASH, T_DROITE, T_GAUCHE, T_SAUT, appliquerT, niveau, type Commande, type NomNiveau } from "../src/index";

// Un joueur scripté, pour les tests, le golden et les mesures : il suit des points de passage (cap vers le point, en flottants : ce n'est PAS la simulation, seulement un fabricant de commandes entières)
// et saute ou dashe sur condition. Ce n'est pas le robot du jeu (lot V3) : il ne cherche rien, il suit un scénario écrit à la main pour un niveau.
export interface Etape {
  /** Le point visé (mètres), x et z. */
  vers: [number, number];
  /** Saute à l'appui quand la condition devient vraie (une seule fois). */
  saute?: (p: Partie) => boolean;
  dash?: (p: Partie) => boolean;
  /** L'étape finit quand la condition est vraie. */
  jusqu: (p: Partie) => boolean;
}
const m = (v: number): number => v / 1_000_000;

export interface Sortie {
  commandes: Commande[];
  partie: Partie;
  /** L'étape où la partie s'est arrêtée (−1 : elle a fini, ou les étapes sont épuisées). */
  bloqueA: number;
}

/** Joue les étapes sur un niveau. `tremblement` ajoute un petit mouvement de souris régulier (pour mesurer la taille d'une rediffusion avec le regard qui bouge). */
export function jouerEtapes(nom: NomNiveau, etapes: readonly Etape[], opts: { tremblement?: (pas: number) => [number, number]; maxPas?: number; virageMax?: number } = {}): Sortie {
  const p = new Partie(niveau(nom));
  const commandes: Commande[] = [];
  const virageMax = opts.virageMax ?? 500;
  let e = 0;
  let sauteFait = false;
  let dashFait = false;
  let appuiSaut = 0;
  let appuiDash = 0;
  while (!p.finie && e < etapes.length && commandes.length < (opts.maxPas ?? 14000)) {
    const et = etapes[e]!;
    if (et.jusqu(p)) {
      e++;
      sauteFait = dashFait = false;
      continue;
    }
    const dx = et.vers[0] - m(p.x);
    const dz = et.vers[1] - m(p.z);
    const voulu = Math.round((Math.atan2(-dx, -dz) / (2 * Math.PI)) * TOUR);
    let ecart = (((voulu - p.lacet) % TOUR) + TOUR) % TOUR;
    if (ecart > TOUR / 2) ecart -= TOUR;
    let dl = Math.max(-virageMax, Math.min(virageMax, ecart));
    let dt = 0;
    if (opts.tremblement) {
      const [a, b] = opts.tremblement(commandes.length);
      dl += a;
      dt += b;
    }
    if (!sauteFait && et.saute?.(p)) {
      sauteFait = true;
      appuiSaut = 6;
    }
    if (!dashFait && et.dash?.(p)) {
      dashFait = true;
      appuiDash = 6;
    }
    let k = T_AVANT;
    if (appuiSaut > 0) {
      k |= T_SAUT;
      appuiSaut--;
    }
    if (appuiDash > 0) {
      k |= T_DASH;
      appuiDash--;
    }
    const c: Commande = { k, dl, dt };
    commandes.push(c);
    p.avancer(c);
  }
  return { commandes, partie: p, bloqueA: p.finie ? -1 : e };
}

/** Le parcours de la maquette, en cinq étapes : les piliers, le mur, l'atterrissage, le trou du dash, l'arrivée. */
export const ETAPES_PARCOURS: readonly Etape[] = [
  { vers: [0, -6], saute: (p) => m(p.z) < -0.9, jusqu: (p) => p.sol && m(p.z) < -4.6 && m(p.y) > 0.2 },
  { vers: [0.6, -12], saute: (p) => m(p.z) < -6.6, jusqu: (p) => p.sol && m(p.z) < -10.6 && m(p.y) > 1.2 },
  { vers: [3.2, -20], saute: (p) => m(p.z) < -12.8, jusqu: (p) => p.sol && m(p.z) < -16.6 && m(p.y) > 2.2 },
  { vers: [3.7, -24], saute: (p) => m(p.z) < -18.9, jusqu: (p) => m(p.z) < -22.5 },
  { vers: [3.9, -80], jusqu: (p) => p.sol && m(p.z) < -38 && m(p.y) < 0.1 },
  { vers: [2, -80], saute: (p) => m(p.z) < -43.2, dash: (p) => m(p.z) < -46, jusqu: (p) => p.sol && m(p.z) < -50.6 },
  { vers: [2, -80], jusqu: (p) => p.finie },
];

/**
 * Un joueur scripté pour la gravité et les portails (lot V1) : il marche vers une suite de points du MONDE (mètres), en visant dans le repère local (celui du joueur, quelle que soit la gravité), et passe au point
 * suivant dès qu'une bascule de gravité ou une traversée de portail a eu lieu (ou, pour le dernier point, qu'il est à moins d'un mètre). Il ne saute pas, ne dashe pas : c'est un fabricant de commandes entières.
 */
export function jouerCibles(nom: NomNiveau, cibles: readonly [number, number, number][], opts: { maxPas?: number; apres?: number; virageMax?: number } = {}): Sortie & { orientations: number[] } {
  const p = new Partie(niveau(nom));
  const commandes: Commande[] = [];
  const orientations: number[] = [p.ori];
  const virageMax = opts.virageMax ?? 700;
  let t = 0;
  let evenements = p.bascules + p.traversees;
  let reste = opts.apres ?? 0;
  while (!p.finie && commandes.length < (opts.maxPas ?? 12000)) {
    if (p.bascules + p.traversees !== evenements) {
      evenements = p.bascules + p.traversees;
      if (p.ori !== orientations[orientations.length - 1]) orientations.push(p.ori);
      if (t < cibles.length) t++;
    }
    if (t >= cibles.length && reste-- <= 0) break;
    const cible = cibles[Math.min(t, cibles.length - 1)]!;
    const l = appliquerT(p.m, [cible[0] * 1_000_000, cible[1] * 1_000_000, cible[2] * 1_000_000]);
    const dx = l[0] / 1_000_000 - m(p.x);
    const dz = l[2] / 1_000_000 - m(p.z);
    const voulu = Math.round((Math.atan2(-dx, -dz) / (2 * Math.PI)) * TOUR);
    let ecart = (((voulu - p.lacet) % TOUR) + TOUR) % TOUR;
    if (ecart > TOUR / 2) ecart -= TOUR;
    const dl = Math.max(-virageMax, Math.min(virageMax, ecart));
    const c: Commande = { k: T_AVANT, dl, dt: 0 };
    commandes.push(c);
    p.avancer(c);
  }
  return { commandes, partie: p, bloqueA: p.finie ? -1 : t, orientations };
}

/**
 * Une marche au hasard semé qui a un but : à chaque instant, elle vise l'un des points donnés (mètres, dans le monde), change de point à chaque bascule ou traversée (ou tous les 500 pas), saute et dashe de temps en temps,
 * zigzague, et regarde parfois ailleurs. Elle fabrique les rediffusions de référence du golden qui visitent la gravité et les portails sans qu'un joueur scripté ne suive un chemin unique.
 */
export function marcheVersDesCibles(nom: NomNiveau, graine: number, cibles: readonly [number, number, number][], pas: number): Commande[] {
  const rng = new Rng(graine);
  const p = new Partie(niveau(nom));
  const out: Commande[] = [];
  let t = rng.int(cibles.length);
  let evenements = 0;
  let depuis = 0;
  while (out.length < pas && !p.finie) {
    if (p.bascules + p.traversees !== evenements || depuis++ >= 500) {
      evenements = p.bascules + p.traversees;
      t = rng.int(cibles.length);
      depuis = 0;
    }
    const cible = cibles[t]!;
    const l = appliquerT(p.m, [cible[0] * 1_000_000, cible[1] * 1_000_000, cible[2] * 1_000_000]);
    const voulu = Math.round((Math.atan2(-(l[0] / 1_000_000 - m(p.x)), -(l[2] / 1_000_000 - m(p.z))) / (2 * Math.PI)) * TOUR);
    let ecart = (((voulu - p.lacet) % TOUR) + TOUR) % TOUR;
    if (ecart > TOUR / 2) ecart -= TOUR;
    let k = T_AVANT;
    if (rng.int(40) === 0) k |= rng.int(2) === 0 ? T_GAUCHE : T_DROITE;
    if (rng.int(40) === 0) k |= T_SAUT;
    if (rng.int(200) === 0) k |= T_DASH;
    const c: Commande = { k, dl: Math.max(-600, Math.min(600, ecart)) + rng.int(31) - 15, dt: rng.int(11) - 5 };
    out.push(c);
    p.avancer(c);
  }
  return out;
}
