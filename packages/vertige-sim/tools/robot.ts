import { Partie, TOUR, T_AVANT, T_DASH, T_SAUT, niveau, type Commande } from "../src/index";

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
export function jouerEtapes(nom: "parcours" | "bac-a-sable" | "mur", etapes: readonly Etape[], opts: { tremblement?: (pas: number) => [number, number]; maxPas?: number; virageMax?: number } = {}): Sortie {
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
