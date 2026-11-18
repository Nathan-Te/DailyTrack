import { mixSeed, Rng } from "@cdj/core";
import { CASE, CIBLE_CAMERA, LARGEUR_MORCEAU, LASER_ALLUME, LASER_CYCLE, LIGNES, MODE_AVION, MODE_ONDE } from "./constantes";
import { BLOC, PIQUE, VIDE, type Laser, type Motif, type Objet, type Portail, type Scie } from "./monde";
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
  scies: Scie[];
  lasers: Laser[];
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
  const scies: Scie[] = [];
  const lasers: Laser[] = [];
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
  const tirageStyle = new Rng(mixSeed(mixSeed(e.jour, 0x4a21c7), premier)).int(100);
  // Lot GR7 : la variante de la section (0 à 5) règle le style et la taille ; une section à danger est toujours un champ (les dangers sont des obstacles en l'air).
  const champ = info.danger ? true : info.mode === MODE_AVION ? info.facile || (info.variante % 2 === 0 ? tirageStyle < 80 : tirageStyle < 30) : !info.facile && (info.variante % 2 === 0 ? tirageStyle < 80 : tirageStyle < 30);

  if (info.mode === MODE_AVION) return { ...avion(), motif: "avion" };
  if (info.mode === MODE_ONDE) return { ...onde(), motif: "onde" };
  return { ...ressort(), motif: "ressort" };

  /** L'axe est le même, sur les colonnes libres, que celui de la première colonne de contenu : le pilote y est déjà quand le contenu commence. */
  function finir(axeDe: (a: number) => number): SortieSection {
    for (let c = 0; c < LARGEUR_MORCEAU; c++) axe[c] = axeDe(x0 + c);
    return { cases, pieces, gemmes, axe, portails, scies, lasers, motif: "avion" };
  }

  /**
   * **Le style de la section (lot GR6, retour de Nathan : de vraies portions de niveau pour ces gameplays)** : un *couloir* (l'avion : un tunnel qui ondule ; l'onde : un tunnel bordé de piques) ou **un champ** — l'espace est libre
   * et ce sont **des obstacles en l'air** (blocs suspendus, colonnes qui tombent du plafond ou montent du sol, **mines de piques**) qu'il faut contourner. Tiré de (jour, section) : le même pour tous les morceaux d'une section.
   * La première section de l'avion est un champ (des blocs, larges, sans danger) ; celle de l'onde un couloir.
   */

  // --- LE CHAMP : des obstacles en l'air, un axe qui les contourne ------------------------------------------------------------------------------------------------------------------------------------------------
  /**
   * Un obstacle est posé toutes les ~1,25 s (le TEMPS : même difficulté à toute vitesse) : `{ a0, a1 }` colonnes, `{ r0, r1 }` rangées (r1 exclue), `cell` BLOC ou PIQUE. **L'axe passe du côté qui laisse au moins 3 rangées libres**
   * (le plus proche de l'axe d'avant : le chemin ne fait pas de grands sauts, l'onde ne monte pas à plus de 45°) et reste à plat le long de l'obstacle.
   */
  function champAerien(): SortieSection {
    const avion = info.mode === MODE_AVION;
    const facile = info.facile;
    // La taille (variante 0 à 5, `Math.trunc(variante / 2)` : 0 à 2) règle l'espace entre deux obstacles : 0, 0,1 ou 0,2 s de plus que le rythme de base (jamais plus serré : la preuve du robot en dépend).
    const rythme = [0, 12, 24][Math.trunc(info.variante / 2)]!;
    const espace = (avion ? (facile ? 170 : d < 50 ? 135 : 110) : facile ? 170 : d < 50 ? 150 : 125) + (facile ? 0 : rythme);
    interface Obs {
      a0: number;
      a1: number;
      r0: number;
      r1: number;
      cell: number;
      /** Lot GR7 : un danger qui bouge : une scie sur un rail vertical, un laser (le rayon va de la rangée `r0` à `r1`). */
      kind?: "scie" | "laser";
      /** Scie : en bas (vrai) ou en haut (faux) du rail quand on arrive. */
      bas?: boolean;
    }
    const obstacles: Obs[] = [];
    const MILIEU = 11 * (CASE >> 1); // 5,5 cases
    const waypoints: { a: number; y: number }[] = [{ a: aDebut, y: MILIEU }];
    const tMax = t(aFin);
    for (let k = 0, tk = tc + 70; tk < tMax; k++, tk += espace) {
      const a0 = colonneAu(tk);
      // Après le dernier obstacle l'axe revient au milieu : l'onde ne monte que d'une rangée par colonne (45°), il lui faut la place (jusqu'à 3 rangées de retour, de l'obstacle de 2 colonnes au bout).
      if (a0 < aDebut + 1 || a0 >= aFin - (avion ? 3 : 6)) continue;
      const rng = new Rng(mixSeed(mixSeed(e.jour, 0x31c9d5), premier * 64 + k));
      const g = rng.int(100);
      const rs = 3 + rng.int(5); // 3 à 7
      const longue = facile ? 3 : 3 + rng.int(2); // une colonne qui tombe ou monte : 3 ou 4 rangées
      let o: Obs;
      // Lot GR7 : dans une section à danger, un obstacle sur deux est le danger de la section (le premier : on le voit venir, il est seul).
      const danger = info.danger !== null && k % 2 === 0;
      if (danger && info.danger === "scies") o = { a0, a1: a0 + 1, r0: 3, r1: 10, cell: BLOC, kind: "scie" };
      else if (danger) o = { a0, a1: a0 + 1, r0: 9 - longue, r1: 10, cell: BLOC, kind: "laser" }; // un rayon qui monte du sol : l'axe passe au-dessus, un joueur qui ne fait rien reste en bas
      else if (avion) {
        if (g < 35) o = { a0, a1: a0 + 2, r0: rs, r1: rs + 2, cell: BLOC }; // un îlot suspendu
        else if (g < 55 && !facile) o = { a0, a1: a0 + 1, r0: rs, r1: rs + 2, cell: PIQUE }; // une mine de piques
        else if (g < 78) o = { a0, a1: a0 + 2, r0: 2, r1: 2 + longue, cell: BLOC }; // une colonne du plafond
        else o = { a0, a1: a0 + 2, r0: 10 - longue, r1: 10, cell: BLOC }; // une colonne du sol
      } else if (g < 45) o = { a0, a1: a0 + 1, r0: rs, r1: rs + 2, cell: PIQUE };
      else if (g < 75) o = { a0, a1: a0 + 2, r0: rs, r1: rs + 2, cell: PIQUE }; // un amas
      else if (g < 88) o = { a0, a1: a0 + 1, r0: 2, r1: 2 + longue, cell: PIQUE }; // des piques qui pendent du plafond
      else o = { a0, a1: a0 + 1, r0: 10 - longue, r1: 10, cell: PIQUE }; // des piques qui montent du sol
      // Le côté : au moins 3 rangées libres, le plus proche de l'axe d'avant.
      const avant = waypoints[waypoints.length - 1]!.y;
      const haut = (2 + o.r0) * (CASE >> 1);
      const bas = (o.r1 + 10) * (CASE >> 1);
      const okHaut = o.r0 - 2 >= 3;
      const okBas = 10 - o.r1 >= 3;
      let y = okHaut && okBas ? (Math.abs(haut - avant) <= Math.abs(bas - avant) ? haut : bas) : okHaut ? haut : bas;
      if (o.kind === "laser") y = 3 * CASE + 819; // un rayon qui monte du sol : l'axe passe tout en haut, loin de sa pointe (le pilote de l'onde zigzague de près d'une case à grande vitesse)
      if (o.kind === "scie") {
        // Une scie sur toute la hauteur : l'axe passe du côté d'où il vient, et la scie est de l'autre côté quand on arrive.
        // (lot GR7 : toujours en haut, la scie en bas : un joueur qui ne fait rien reste en bas, il la rencontre)
        y = 4 * CASE;
        o.bas = true;
      }
      // Lot GR7 : l'avion ne rejoint pas en un souffle (1,1 s) un axe à plus de 3,5 rangées de l'axe d'avant : un obstacle qui l'exigerait n'est pas posé (la preuve du robot, à grande vitesse et en boucle 2).
      if (avion && Math.abs(y - avant) > 3 * CASE + (CASE >> 1)) continue;
      obstacles.push(o);
      waypoints.push({ a: o.a0 - 1, y }, { a: o.a1, y });
    }
    waypoints.push({ a: Math.max(aFin - 1, waypoints[waypoints.length - 1]!.a + 1), y: MILIEU });
    const centreDe = (a: number): number => {
      if (a <= waypoints[0]!.a) return waypoints[0]!.y;
      for (let i = 0; i + 1 < waypoints.length; i++) {
        const p = waypoints[i]!;
        const q = waypoints[i + 1]!;
        if (a <= q.a) return q.a === p.a ? q.y : p.y + Math.trunc(((q.y - p.y) * (a - p.a)) / (q.a - p.a));
      }
      return waypoints[waypoints.length - 1]!.y;
    };
    for (const o of obstacles) {
      if (o.kind === "scie") {
        // Le rail va de la rangée 3 à la rangée 9 (les centres) dans la colonne : le disque est en bas ou en haut quand on y arrive.
        const col = o.a0;
        if (col >= x0 && col < x0 + LARGEUR_MORCEAU) {
          const P = 90 + 12 * (info.variante % 3);
          const u = o.bas ? P : 0;
          const p2 = 2 * P;
          const tA = t(col);
          scies.push({ x0: col * CASE + (CASE >> 1), y0: 3 * CASE + (CASE >> 1), x1: col * CASE + (CASE >> 1), y1: 9 * CASE + (CASE >> 1), periode: P, decalage: (((u - tA) % p2) + p2) % p2 });
        }
      } else if (o.kind === "laser") {
        const col = o.a0;
        if (col >= x0 && col < x0 + LARGEUR_MORCEAU) {
          const tA = t(col);
          lasers.push({ c: col - x0, r0: o.r0, r1: o.r1 - 1, decalage: (((LASER_CYCLE - LASER_ALLUME / 2 - tA) % LASER_CYCLE) + LASER_CYCLE) % LASER_CYCLE });
          // Le rayon part du sol (c'est son émetteur) : rien n'est posé en l'air.
        }
      } else for (let a = o.a0; a < o.a1; a++) for (let r = o.r0; r < o.r1; r++) if (a >= x0 && a < x0 + LARGEUR_MORCEAU) poser(a - x0, r, o.cell);
    }
    for (let c = 0; c < LARGEUR_MORCEAU; c++) {
      const a = x0 + c;
      if (a >= aDebut && a < aFin && (a - aDebut) % 2 === 0) pieces.push({ x: centreX(c), y: centreDe(a) });
    }
    gemmeAuMilieu(centreDe);
    return finir(centreDe);
  }

  // --- L'AVION : un couloir qui ondule, des piliers en haut et en bas, des pièces en vague --------------------------------------------------------------------------------------------------------------------
  function avion(): SortieSection {
    if (champ) return champAerien();
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
    if (champ) return champAerien();
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
    const obstacles: { a0: number; a1: number; haut: number; piques?: boolean; scie?: boolean }[] = [];
    const tMax = t(aFin);
    for (let k = 0, tk = tc + 60; tk < tMax; k++, tk += espace) {
      const genre = new Rng(mixSeed(mixSeed(e.jour, 0x7d1c5b), premier * 64 + k)).int(100);
      const a0 = colonneAu(tk);
      if (a0 + 2 < aDebut || a0 >= aFin - 2) continue;
      if (genre < 40) obstacles.push({ a0, a1: Math.max(a0 + 2, colonneAu(tk + (facile ? 40 : 60))), haut: 0 });
      else if (genre < 68 || facile) obstacles.push({ a0, a1: a0 + 1 + (genre % 2), haut: 1 + (genre >= 80 ? hauteurMax - 1 : 0) });
      else if (info.danger === "scies") obstacles.push({ a0, a1: a0 + 2, haut: 2, scie: true }); // lot GR7 : une scie sur le sol, sur un rail court : on la saute (l'axe se tient plus haut : le ressort bondit plus tôt)
      else obstacles.push({ a0, a1: a0 + 2 + (genre % 2), haut: 1, piques: true }); // des piques au sol (le rouge) : on les saute comme une colonne basse
    }
    const dans = (a: number): { a0: number; a1: number; haut: number; piques?: boolean; scie?: boolean } | undefined => obstacles.find((o) => a >= o.a0 && a < o.a1);
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
      } else if (o && !o.scie) for (let h = 1; h <= o.haut; h++) poser(c, SOL - h, o.piques ? PIQUE : BLOC);
    }
    // Lot GR7 : les scies du sol (un rail de 3 colonnes, au milieu quand on y arrive).
    for (const o of obstacles) {
      if (!o.scie || o.a0 < x0 - 3 || o.a0 >= x0 + LARGEUR_MORCEAU) continue;
      const P = 80 + 10 * (info.variante % 3);
      const tA = t(o.a0 + 1);
      const p2 = 2 * P;
      scies.push({ x0: o.a0 * CASE + (CASE >> 1), y0: 9 * CASE + (CASE >> 1), x1: (o.a0 + 2) * CASE + (CASE >> 1), y1: 9 * CASE + (CASE >> 1), periode: P, decalage: (((Math.trunc(P / 2) - tA) % p2) + p2) % p2 });
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
