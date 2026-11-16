import { mixSeed, Rng } from "@cdj/core";
import { EV_GEYSER, EV_PORTAIL, EV_SPINNER, LANCEUR, NB_BILLES, NORME, TOUR, UNITE } from "./constantes";
import { cosinus, div, sinus } from "./entiers";
import type { Contenu, Module } from "./generateur";
import { Partie } from "./partie";
import { REGLAGES, type Reglages } from "./reglages";
import type { Poser, Segment, Table } from "./table";

// LA VALIDATION D'UNE TABLE (lot PB4) — seed : « Validée par un robot avant d'être servie : aucune bille ne doit rester coincée, et chaque module doit pouvoir être touché. Une table refusée est retirée, avec une graine
// suivante fixée. » Trois épreuves, toutes entières et déterministes (aucune graine ne vient du jour : **le verdict ne dépend que de la table**, donc se calcule une fois pour toutes pour les 444 tables possibles —
// `npm run valider:pinball`, `refusees.ts`, que le générateur lit) :
//  1. **Aucune bille coincée** (`billesCoincees`) : une bille lâchée sur une grille serrée de la table, à l'arrêt puis lancée dans une direction tirée, sans toucher aux batteurs, finit toujours perdue ou revenue au
//     lanceur, dans un délai de `DELAI_BILLE_MAX` pas. Les tests de sûreté du lot PB3 en sont le point de départ (ils lâchent la bille autour de chaque élément d'un thème) ; ici c'est la table entière, éléments ensemble.
//  2. **Chaque module peut être touché** (`SuiviModules`) : sur les parties du robot et sur des lancers dispersés (`tirsDisperses` : depuis les batteurs et depuis le lanceur), chaque module de la table est touché au
//     moins une fois. « Touché » : un bumper ou une cible frappés, un spinner traversé, un trou ou le tourbillon qui garde la bille, le manège ou le trou noir où elle entre, un portail dont elle franchit l'entrée, un
//     geyser qui la lance, la coulée où elle monte.
//  3. **La mission peut être réussie** au moins une fois, par l'une des parties du robot.

/** Le délai d'une bille lâchée : 54 000 pas = 90 secondes de jeu. Les billes lâchées mettent bien moins (le pire mesuré est dans le README du lot) ; une bille qui y est encore est coincée. */
export const DELAI_BILLE_MAX = 54000;
/** La grille de lâcher : tous les 30 px (bords de la table : 40 à 330 px, de 30 à 600 px de haut) ; à chaque point, une bille à l'arrêt et une bille lancée. */
export const PAS_GRILLE = 30;

export interface BilleCoincee {
  x: number;
  y: number;
  vx: number;
  vy: number;
}
export interface RapportBilles {
  /** Les billes lâchées et le plus grand nombre de pas qu'une bille a mis à être perdue. */
  lachers: number;
  pire: number;
  coincee: BilleCoincee | null;
}

/** Le nom d'un module posé : `S4:geyser` (emplacement et type) — celui du rapport et des tests. */
export const nomDuModule = (m: Pick<Poser, "emplacement" | "type">): string => `S${m.emplacement + 1}:${m.type}`;

/** Pose la bille en jeu, à `(x, y)` pixels, avec sa vitesse en unités par seconde. */
function enJeu(p: Partie, x: number, y: number, vx: number, vy: number): void {
  p.dansLanceur = false;
  p.entree = p.tick;
  p.x = x * UNITE;
  p.y = y * UNITE;
  p.px = p.x;
  p.py = p.y;
  p.vx = vx;
  p.vy = vy;
}

/** Le carré de la distance (unités) d'un point à un mur. Les produits restent sous 2^53 (un mur fait au plus 1,6 million d'unités : on divise par 1 024 avant de multiplier). */
const distance2 = (x: number, y: number, s: Segment): number => {
  const ex = s.bx - s.ax;
  const ey = s.by - s.ay;
  const l2 = ex * ex + ey * ey;
  let qx = s.ax;
  let qy = s.ay;
  if (l2 > 0) {
    const dot = (x - s.ax) * ex + (y - s.ay) * ey;
    const n = dot < 0 ? 0 : dot > l2 ? l2 : dot;
    const k = Math.max(1, div(l2, 1024));
    qx += div(ex * div(n, 1024), k);
    qy += div(ey * div(n, 1024), k);
  }
  return (x - qx) * (x - qx) + (y - qy) * (y - qy);
};

/** La bille posée là recouvre-t-elle un mur, un bumper ou un poteau (ou en est-elle trop près pour être honnête) ? Rien d'une partie réelle ne s'y trouverait. */
function pointOccupe(t: Table, x: number, y: number): boolean {
  const ux = x * UNITE;
  const uy = y * UNITE;
  const marge = 12 * UNITE;
  for (const s of t.murs) if (distance2(ux, uy, s) < marge * marge) return true;
  // à l'intérieur d'un lance-pierre (le triangle fermé de trois murs : sa diagonale, sa verticale à 78 px sous le sommet, son bas) la bille ne peut pas se trouver dans une partie réelle
  for (const s of t.murs) {
    if (s.type !== 1) continue;
    const cx = s.ax; // le troisième sommet : sous le premier, 78 px plus bas
    const cy = s.ay + 78 * UNITE;
    const aire = (ax: number, ay: number, bx: number, by: number, px: number, py: number): number => Math.sign((bx - ax) * (py - ay) - (by - ay) * (px - ax));
    const d1 = aire(s.ax, s.ay, s.bx, s.by, ux, uy);
    const d2 = aire(s.bx, s.by, cx, cy, ux, uy);
    const d3 = aire(cx, cy, s.ax, s.ay, ux, uy);
    if (!((d1 < 0 || d2 < 0 || d3 < 0) && (d1 > 0 || d2 > 0 || d3 > 0))) return true;
  }
  for (const c of [...t.poteaux, ...t.bumpers]) {
    const m = c.r + 14 * UNITE;
    if ((ux - c.x) * (ux - c.x) + (uy - c.y) * (uy - c.y) < m * m) return true;
  }
  return false;
}

/** La table est dans le rectangle utile : entre les murs, sous l'arc (rayon 176,25 px autour de (196,25 ; 205)), à 18 px de chaque bord. */
const dansLaTable = (x: number, y: number): boolean => {
  if (x < 40 || x > 330) return false;
  if (y >= 205) return true;
  const dx = x - 196;
  const dy = y - 205;
  return dx * dx + dy * dy <= 158 * 158;
};

/**
 * **Aucune bille coincée** : la bille lâchée en chaque point libre d'une grille de `PAS_GRILLE` px, à l'arrêt puis lancée (direction et vitesse tirées d'une graine fixée), sans appui sur un batteur ni bille sauvée,
 * finit perdue ou revenue au lanceur en moins de `DELAI_BILLE_MAX` pas.
 */
export function billesCoincees(contenu: Contenu, base: Reglages = REGLAGES): RapportBilles {
  const reglages: Reglages = { ...base, sauvee: 0 };
  const rng = new Rng(mixSeed(0x424c4c, 1));
  let lachers = 0;
  let pire = 0;
  const modele = new Partie(contenu, reglages);
  for (let y = 30; y <= 600; y += PAS_GRILLE) {
    for (let x = 40; x <= 330; x += PAS_GRILLE) {
      if (!dansLaTable(x, y) || pointOccupe(modele.table, x, y)) continue;
      for (const lance of [false, true]) {
        // le tirage se fait toujours (même graine qu'on lance ou non) : la grille d'une table ne dépend pas d'un test voisin
        const a = rng.int(360);
        const v = 100 + rng.int(1400);
        const tour = div(a * 16384, 360);
        const vx = lance ? div(cosinus(tour) * v * UNITE, NORME) : 0;
        const vy = lance ? div(sinus(tour) * v * UNITE, NORME) : 0;
        const p = new Partie(contenu, reglages);
        enJeu(p, x, y, vx, vy);
        let pas = 0;
        while (p.billes === NB_BILLES && !p.dansLanceur && !p.finie && pas < DELAI_BILLE_MAX) {
          p.avancer();
          pas++;
        }
        lachers++;
        if (p.billes === NB_BILLES && !p.dansLanceur) return { lachers, pire: DELAI_BILLE_MAX, coincee: { x, y, vx: div(vx, UNITE), vy: div(vy, UNITE) } };
        pire = Math.max(pire, pas);
      }
    }
  }
  return { lachers, pire, coincee: null };
}

/**
 * **Ce que la bille a touché**, module par module (voir l'en-tête) : `pas(partie)` est appelée après chaque pas d'une partie de cette table. `touches` : les noms (`nomDuModule`) des modules touchés, `mission` : une
 * partie a réussi la mission du thème.
 */
export class SuiviModules {
  readonly touches = new Set<string>();
  mission = false;
  private readonly poses: readonly { pose: Poser; nom: string }[];
  /** Les rangs (dans `poses`) des modules pas encore touchés : la boucle de chaque pas n'a plus qu'eux à regarder. */
  private readonly restants: number[];
  constructor(private readonly table: Table) {
    this.poses = table.poses.map((pose) => ({ pose, nom: nomDuModule(pose) }));
    this.restants = this.poses.map((_, i) => i);
  }

  /** Les modules de la table jamais touchés. */
  manquants(): string[] {
    return this.poses.filter((m) => !this.touches.has(m.nom)).map((m) => m.nom);
  }

  pas(p: Partie): void {
    if (p.missionFaite) this.mission = true;
    if (this.restants.length === 0) return;
    const t = this.table;
    let entree = -2;
    for (let q = this.restants.length - 1; q >= 0; q--) {
      const { pose, nom } = this.poses[this.restants[q]!]!;
      let touche = false;
      const r = pose.rang;
      switch (pose.type as Module) {
        case "bumpers":
        case "mini":
        case "asteroide":
          for (let i = r; i < r + pose.n; i++) if (p.choc[i] === 40) touche = true;
          break;
        case "cibles":
          for (const k of t.banques[r]!) if (p.bas[k]) touche = true;
          break;
        case "spinner": {
          const c = t.spinners[r]!;
          touche = (p.ev & EV_SPINNER) !== 0 && Math.abs(p.x - c.x) < c.l && Math.abs(p.y - c.y) < 12 * UNITE;
          break;
        }
        case "trou":
          touche = p.captifDe === r;
          break;
        case "manege":
          touche = p.manegeSecteur[r]! >= 0;
          break;
        case "tourbillon":
          touche = p.captifTb === r;
          break;
        case "trouNoir": {
          const z = t.trousNoirs[r]!;
          touche = (p.x - z.x) * (p.x - z.x) + (p.y - z.y) * (p.y - z.y) < z.r * z.r;
          break;
        }
        case "portailA":
        case "portailB": {
          if ((p.ev & EV_PORTAIL) === 0) break;
          if (entree === -2) {
            // la bille ressort 20 px sous l'autre portail : le portail le plus proche est la sortie, l'autre est l'entrée
            let proche = 0;
            let d = Infinity;
            t.portails.forEach((q, i) => {
              const dd = (p.x - q.x) * (p.x - q.x) + (p.y - q.y) * (p.y - q.y);
              if (dd < d) {
                d = dd;
                proche = i;
              }
            });
            entree = t.portails.length - 1 - proche;
          }
          touche = r === entree;
          break;
        }
        case "geyser":
          touche = (p.ev & EV_GEYSER) !== 0;
          break;
        case "coulee":
          touche = p.couleeDedans[r]!;
          break;
      }
      if (touche) {
        this.touches.add(nom);
        this.restants.splice(q, 1);
      }
    }
  }
}

/**
 * **Des lancers dispersés** : la bille part de six points de la rangée des batteurs, dans neuf directions (de 50° à 130°) et à deux vitesses, et joue 5 secondes (108 tirs) ; puis onze lancers du lanceur, de la charge
 * 500 à la charge 1 000, sans toucher aux batteurs, jusqu'à la perte de la bille (au plus 20 secondes). Ils éprouvent la table sans dépendre d'un robot : ce que la bille peut toucher depuis un batteur et depuis le lanceur.
 * Rend le nombre de lancers.
 */
export function tirsDisperses(contenu: Contenu, suivi: SuiviModules, base: Reglages = REGLAGES): number {
  let tirs = 0;
  const reglages: Reglages = { ...base, sauvee: 0 };
  for (const x of [104, 136, 168, 200, 232, 264]) {
    for (let k = 0; k < 9; k++) {
      for (const v of [850, 1300]) {
        const angle = div((50 + 10 * k) * TOUR, 360); // de 50° à 130°, en angles de table
        const p = new Partie(contenu, reglages);
        enJeu(p, x, 600, div(cosinus(angle) * v * UNITE, NORME), -div(sinus(angle) * v * UNITE, NORME));
        for (let pas = 0; pas < 3000 && p.billes === NB_BILLES && !p.dansLanceur && !p.finie; pas++) {
          p.avancer();
          suivi.pas(p);
        }
        tirs++;
      }
    }
  }
  for (let charge = 500; charge <= 1000; charge += 50) {
    const p = new Partie(contenu, reglages);
    p.regler(LANCEUR, true);
    while (p.charge < charge && p.dansLanceur) p.avancer();
    p.regler(LANCEUR, false);
    for (let pas = 0; pas < 12000 && p.billes === NB_BILLES && !p.finie && (pas < 10 || !p.dansLanceur); pas++) {
      p.avancer();
      suivi.pas(p);
    }
    tirs++;
  }
  return tirs;
}
