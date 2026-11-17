import { mixSeed, Rng } from "@cdj/core";
import { CASE, CIBLE_CAMERA, LARGEUR_MORCEAU, LIGNES, MODE_AVION, MODE_ONDE } from "./constantes";
import { BLOC, PIQUE, VIDE, type Motif, type Objet, type Portail } from "./monde";
import { COLONNE_PORTAIL, type InfoSection, type PlanDuJour } from "./plan";

// LES SECTIONS À MODE (lot GR6) : le contenu des morceaux d'une section d'avion, d'onde ou de ressort. **Tout est posé dans le TEMPS, pas dans les colonnes** : un couloir qui ondule dure autant de secondes à 7 cases/s qu'à
// 17 cases/s (les colonnes sont plus longues quand ça va vite), ce qui garde chaque motif à la portée d'un joueur à toute vitesse. Le temps d'une colonne vient de la trajectoire de la caméra sous les portails de vitesse du jour
// (`Trajectoire`) : `t(a)` est le pas où le joueur arrive à la colonne absolue `a`.
//
// **La composition d'une section** : le portail d'entrée (colonne `COLONNE_PORTAIL` du premier morceau) → **un couloir libre d'environ 1 s** (`LIBRE_TICKS`, toute la hauteur) → le contenu (le motif du mode) → les deux dernières
// colonnes du dernier morceau de contenu ouvertes → **le morceau de retour** (le portail de retour à la colonne `COLONNE_PORTAIL`, puis un sol et des pièces : « le retour propre au mode gravité », écrit par le générateur).
// **L'axe** (`Morceau.axe`) est le centre de la boîte du joueur au milieu de chaque colonne : le centre du couloir (avion, onde) ou la hauteur à tenir (ressort) ; les pièces y sont posées, le pilote du robot le suit.

/** Le couloir libre après le portail d'entrée : 1 s. */
export const LIBRE_TICKS = 120;
/** Les colonnes laissées ouvertes à la fin du contenu du dernier morceau (avant le morceau de retour). */
const OUVERT_FIN = 2;

/** Une vague entière, douce : de −4 096 à 4 096 pour une phase de 0 à 1 023 (deux paraboles). */
export function vague(phase: number): number {
  const p = ((phase % 1024) + 1024) % 1024;
  const h = p % 512;
  const v = Math.trunc((h * (512 - h) * 4096) / 65536);
  return p < 512 ? v : -v;
}
/** Un entier divisé par `den` et arrondi au plus proche (vers le haut à égalité) : sans `Math.round`. */
const arrondi = (n: number, den: number): number => Math.floor((2 * n + den) / (2 * den));

export interface EntreeSection {
  jour: number;
  m: number;
  info: InfoSection;
  plan: PlanDuJour;
  /** La difficulté, de 0 à 100. */
  d: number;
  rng: Rng;
}
export interface SortieSection {
  cases: Uint8Array;
  pieces: Objet[];
  gemmes: Objet[];
  axe: number[];
  portails: Portail[];
  motif: Motif;
}

const colonneVide = (): number[] => Array.from({ length: LIGNES }, (_, r) => (r < 2 || r >= LIGNES - 2 ? BLOC : VIDE));

/** Un morceau de contenu d'une section (rang 0 à longueur − 1). */
export function genererSection(e: EntreeSection): SortieSection {
  const { m, info, plan, d, rng } = e;
  const x0 = m * LARGEUR_MORCEAU;
  const premier = m - info.rang;
  const tr = plan.trajectoire;
  /** Le pas où le joueur arrive à la colonne absolue `a`, et la colonne où il est au pas `t`. */
  const t = (a: number): number => tr.tickOuLeJoueurArrive(a * CASE);
  const colonneAu = (tick: number): number => Math.trunc((tr.camAu(tick) + CIBLE_CAMERA) / CASE);

  const cases = new Uint8Array(LARGEUR_MORCEAU * LIGNES);
  for (let c = 0; c < LARGEUR_MORCEAU; c++) cases.set(colonneVide(), c * LIGNES);
  const pieces: Objet[] = [];
  const gemmes: Objet[] = [];
  const axe: number[] = new Array<number>(LARGEUR_MORCEAU).fill(0);
  const portails: Portail[] = [];
  const poser = (c: number, r: number, type: number): void => {
    if (c >= 0 && c < LARGEUR_MORCEAU && r >= 0 && r < LIGNES) cases[c * LIGNES + r] = type;
  };
  const centreX = (c: number): number => (x0 + c) * CASE + (CASE >> 1);

  // Le portail d'entrée.
  if (info.rang === 0) portails.push({ c: COLONNE_PORTAIL, type: info.mode === MODE_AVION ? "avion" : info.mode === MODE_ONDE ? "onde" : "ressort" });

  // Le temps de la section : le pas du portail d'entrée, le début du contenu (après le couloir libre), la dernière colonne de contenu.
  const aEntree = premier * LARGEUR_MORCEAU + COLONNE_PORTAIL;
  const t0 = t(aEntree);
  const aDebut = Math.max(aEntree + 1, colonneAu(t0 + LIBRE_TICKS));
  const aFin = (premier + info.longueur) * LARGEUR_MORCEAU - OUVERT_FIN; // exclue
  const tc = t(aDebut); // le pas du début du contenu

  if (info.mode === MODE_AVION) return { ...avion(), motif: "avion" };
  if (info.mode === MODE_ONDE) return { ...onde(), motif: "onde" };
  return { ...ressort(), motif: "ressort" };

  /** L'axe est le même, sur les colonnes libres, que celui de la première colonne de contenu : le pilote y est déjà quand le contenu commence. */
  function finir(axeDe: (a: number) => number): SortieSection {
    for (let c = 0; c < LARGEUR_MORCEAU; c++) axe[c] = axeDe(x0 + c);
    return { cases, pieces, gemmes, axe, portails, motif: "avion" };
  }

  // --- L'AVION : un couloir qui ondule, des piliers en haut et en bas, des pièces en vague --------------------------------------------------------------------------------------------------------------------
  function avion(): SortieSection {
    const facile = info.facile;
    const G = facile ? 6 : d < 35 ? 5 : 4; // la hauteur libre du couloir, en rangées
    const A = facile ? 1 : d < 50 ? 1 : 2; // l'amplitude de l'ondulation, en rangées
    const P = facile ? 360 : d < 50 ? 300 : 260; // la période, en pas (3 s à 2,2 s) : le même nombre de secondes quelle que soit la vitesse
    const base = 2 + Math.trunc((8 - G) / 2);
    const bornes = (r0: number): number => Math.max(2, Math.min(10 - G, r0));
    const PP = 150; // un pilier tous les 1,25 s ; il commence 1,25 s après le début du contenu
    const epaisseur = !facile && d >= 60 && G >= 5 ? 2 : 1;
    const avecPiliers = !facile && d >= 25;
    /** Les rangées libres (haute, basse incluse) de la colonne absolue `a`, ou null hors du contenu. */
    const bande = (a: number): [number, number] | null => {
      if (a < aDebut || a >= aFin) return null;
      const u = t(a) - tc;
      let r0 = bornes(base + arrondi(A * vague(arrondi(u * 1024, P)), 4096));
      let r1 = r0 + G - 1;
      if (avecPiliers && u >= PP) {
        const k = Math.trunc((u - PP) / PP);
        const a0 = colonneAu(tc + PP + k * PP);
        if (a >= a0 && a < a0 + 2) {
          if (k % 2 === 0) r0 += epaisseur;
          else r1 -= epaisseur;
        }
      }
      return [r0, r1];
    };
    const centreDe = (a: number): number => {
      const b = bande(Math.max(a, aDebut)) ?? bande(aFin - 1) ?? [base, base + G - 1];
      return (b[0] + b[1] + 1) * (CASE >> 1);
    };
    for (let c = 0; c < LARGEUR_MORCEAU; c++) {
      const b = bande(x0 + c);
      if (b === null) continue;
      for (let r = 2; r < b[0]; r++) poser(c, r, BLOC);
      for (let r = b[1] + 1; r < LIGNES - 2; r++) poser(c, r, BLOC);
      // Des pièces en vague : une colonne sur deux, sur l'axe.
      if ((x0 + c - aDebut) % 2 === 0) pieces.push({ x: centreX(c), y: centreDe(x0 + c) });
    }
    gemmeAuMilieu(centreDe);
    return finir(centreDe);
  }

  // --- L'ONDE : un couloir serré en escalier, bordé de piques, des pièces sur l'axe ------------------------------------------------------------------------------------------------------------------------
  function onde(): SortieSection {
    const facile = info.facile;
    // Un couloir serré (3 rangées) seulement à une vitesse où un doigt le tient : à grande vitesse le zigzag fait au moins 6 pas de montée ou de descente (0,85 case à 17 cases/s), le couloir est plus large.
    const lent = tr.vitesseEn(tr.camAu(tc)) < 10 * CASE;
    const G = facile ? 5 : d >= 60 && lent ? 3 : 4;
    const A = facile ? 1 : 2;
    const duree = facile ? 100 : d < 40 ? 70 : 55; // les pas par rangée de dérive du couloir : un couloir qui monte ou descend d'une rangée toutes les 0,8 à 0,5 s
    const base = Math.max(3, Math.min(9 - G, 3 + Math.trunc((6 - G) / 2)));
    const tri = (k: number): number => (k <= A ? k : k <= 3 * A ? 2 * A - k : k - 4 * A);
    const bande = (a: number): number | null => {
      if (a < aDebut || a >= aFin) return null;
      const u = t(a) - tc;
      return Math.max(3, Math.min(9 - G, base + tri(Math.trunc(u / duree) % (4 * A))));
    };
    const centreDe = (a: number): number => {
      const r0 = bande(Math.max(a, aDebut)) ?? bande(aFin - 1) ?? base;
      return (2 * r0 + G) * (CASE >> 1);
    };
    for (let c = 0; c < LARGEUR_MORCEAU; c++) {
      const r0 = bande(x0 + c);
      if (r0 === null) continue;
      for (let r = 2; r < r0 - 1; r++) poser(c, r, BLOC);
      poser(c, r0 - 1, PIQUE);
      poser(c, r0 + G, PIQUE);
      for (let r = r0 + G + 1; r < LIGNES - 2; r++) poser(c, r, BLOC);
      if ((x0 + c - aDebut) % 2 === 0) pieces.push({ x: centreX(c), y: centreDe(x0 + c) });
    }
    gemmeAuMilieu(centreDe);
    return finir(centreDe);
  }

  // --- LE RESSORT : des trous et des colonnes à franchir en rythme, des pièces en arc ----------------------------------------------------------------------------------------------------------------------
  function ressort(): SortieSection {
    const facile = info.facile;
    const espace = facile ? 170 : d < 50 ? 150 : 130; // un obstacle toutes les 1,4 s à 1,1 s : en rythme avec les bonds
    const hauteurMax = facile ? 1 : 2;
    const SOL = 10;
    const NORMAL = 8 * CASE + 819; // 8,2 cases : le centre qu'on tient au-dessus du sol (un bond part du sol à 9,6)
    /** Les obstacles du morceau : `{ a0, a1, haut }` (colonnes absolues, `haut` > 0 : une colonne de `haut` cases ; 0 : un trou). Tirés dans l'ordre du temps, pour que le même morceau donne les mêmes obstacles. */
    const obstacles: { a0: number; a1: number; haut: number }[] = [];
    const tMax = t(aFin);
    for (let k = 0, tk = tc + 60; tk < tMax; k++, tk += espace) {
      const genre = new Rng(mixSeed(mixSeed(e.jour, 0x7d1c5b), premier * 64 + k)).int(100);
      const a0 = colonneAu(tk);
      if (a0 + 2 < aDebut || a0 >= aFin - 2) continue;
      if (genre < 50) obstacles.push({ a0, a1: Math.max(a0 + 2, colonneAu(tk + (facile ? 40 : 60))), haut: 0 });
      else obstacles.push({ a0, a1: a0 + 1 + (genre % 2), haut: 1 + (genre >= 80 ? hauteurMax - 1 : 0) });
    }
    const dans = (a: number): { a0: number; a1: number; haut: number } | undefined => obstacles.find((o) => a >= o.a0 && a < o.a1);
    const centreDe = (a: number): number => {
      const o = obstacles.find((q) => a >= q.a0 - 1 && a <= q.a1);
      return o && o.haut > 0 ? (SOL - o.haut) * CASE - CASE - 819 : NORMAL;
    };
    for (let c = 0; c < LARGEUR_MORCEAU; c++) {
      const a = x0 + c;
      if (a < aDebut || a >= aFin) continue;
      const o = dans(a);
      if (o && o.haut === 0) {
        poser(c, SOL, VIDE);
        poser(c, SOL + 1, VIDE);
      } else if (o) for (let h = 1; h <= o.haut; h++) poser(c, SOL - h, BLOC);
    }
    // Des pièces en arc au-dessus de chaque obstacle (cinq, sur une parabole), sinon trois pièces d'une colonne sur trois à la hauteur normale.
    for (const o of obstacles) {
      const milieu = Math.trunc((o.a0 + o.a1) / 2);
      for (let i = -2; i <= 2; i++) {
        const a = milieu + i * 2;
        if (a >= x0 && a < x0 + LARGEUR_MORCEAU && a >= aDebut && a < aFin) pieces.push({ x: centreX(a - x0), y: centreDe(milieu) - (4 - i * i) * 614 + 1229 });
      }
    }
    for (let c = 0; c < LARGEUR_MORCEAU; c++) {
      const a = x0 + c;
      if (a >= aDebut && a < aFin && (a - aDebut) % 4 === 0 && !obstacles.some((o) => a >= o.a0 - 3 && a <= o.a1 + 3)) pieces.push({ x: centreX(c), y: NORMAL });
    }
    gemmeAuMilieu(centreDe);
    return finir(centreDe);
  }

  /** Une gemme sur l'axe, dans la deuxième moitié du contenu d'une section (un morceau sur deux, au tirage de la section : tiré avec le morceau, donc stable). */
  function gemmeAuMilieu(centreDe: (a: number) => number): void {
    if (info.facile || info.rang !== 1 || !rng.chance(60)) return;
    const c = 8;
    if (x0 + c >= aDebut && x0 + c < aFin) gemmes.push({ x: centreX(c), y: centreDe(x0 + c) });
  }
}
