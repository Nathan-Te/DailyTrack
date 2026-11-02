// Lot T8 — le diagnostic de la STABILITÉ d'une tour jouée comme un humain (outil de mesure : il LIT la partie, jamais l'inverse ; hors du test de pureté, il utilise Math.sin / Math.random-free).
//   npm run stabilite:tower -w @cdj/tower-sim [-- --variante=<nom>|toutes] [--n=200] [--version=4|5] [--json] [--liste]
// Le corpus (≥ 200 parties à graine fixe, générées pendant le jeu, donc rejouables à l'identique) :
//   - `bruite`  : un joueur bruité (vise la grille, tire des temps de réaction et de cadence, quelques porte-à-faux légers, quelques pièces mal placées) sur 56 jours × 3 niveaux de bruit ;
//   - `bot`     : le bot du lot T3, imparfait (3 positions de chaque côté, un décalage d'une demi-case toutes les 7 pièces) ; ses commandes sont calculées une fois sous la simulation 4 puis rejouées
//                 telles quelles (cache `dist/stabilite-bot.json`) ;
//   - `alignement` / `essai` : les deux scénarios nommés, joués par le joueur bruité à faible bruit.
// Les indicateurs (voir `docs/tower/lots/lot-T8-stabilite-taquet.md`) :
//   1. mouvements SANS CAUSE : une pièce endormie ou calme depuis ≥ 1 s (60 ticks) qui se déplace de plus de 5 mm ou tourne de plus de 0,5° alors qu'aucune pièce n'a rejoint ni quitté son îlot (les pièces en
//      contact, graphe relevé tous les 2 ticks) dans les 30 ticks précédents ; la variante « en chaîne » compte à part ceux dont une autre pièce de l'îlot bougeait encore (un effondrement en cours) ;
//   2. mouvements PAR IMPACT : à chaque pose, 120 ticks après le lâcher (ou au lâcher suivant), le déplacement net des pièces que la pièce posée n'a jamais touchées (contact direct) ;
//   3. DÉRIVE : l'écart du bord gauche des pièces posées sur la grille (lâchées à une demi-case, non penchées) à la grille des demi-cases, 120 ticks après chaque pose et à la fin ;
//   4. EMBOÎTABILITÉ : à chaque pose, les trous d'une ou deux cases (du dessus : fosses ; latéraux : galeries sous un surplomb) relevés sur une grille de demi-cases ; on demande si la pièce exacte y entre
//      encore (tir de la forme vers le bas dans la fosse ; recouvrement statique dans la galerie), avec 1 mm de tolérance (strict) et avec la tolérance de la version jouée.
import { isMainThread, parentPort, Worker, workerData } from "node:worker_threads";
import { existsSync, mkdirSync, readFileSync, writeFileSync } from "node:fs";
import type RAPIER from "@dimforge/rapier2d-deterministic-compat";
import { bot, ROTATIONS } from "../src/bot/bot";
import { COMMANDE, DEMI_CASE_8 } from "../src/constantes";
import { dailyTower } from "../src/generateur";
import { Partie, type PieceKind, type Rapier, REGLAGES_DEFAUT, type Scenario, SCENARIO_ALIGNEMENT, SCENARIO_ESSAI, boitesE } from "../src";
import { chargerRapier } from "../src/rapier";
import { daysFromCivil } from "@cdj/core";

// ---------- le corpus ----------

export type Famille = "bruite" | "bot" | "alignement" | "essai";
export interface EntreeCorpus {
  id: string;
  famille: Famille;
  seed: number;
  /** Niveau de bruit du joueur bruité (0 : très soigneux). */
  bruit: number;
  contenu: Scenario;
}

const PREMIER_JOUR = daysFromCivil(2026, 11, 5);

export function corpus(n = 200): EntreeCorpus[] {
  const out: EntreeCorpus[] = [];
  const jour = (i: number): Scenario => dailyTower(PREMIER_JOUR + i);
  // 8 + 24 de ces n sont fixes ; le reste est le joueur bruité sur 56 jours × 3 niveaux (168 parties).
  let k = 0;
  for (const [nom, sc] of [["alignement", SCENARIO_ALIGNEMENT], ["essai", SCENARIO_ESSAI]] as const) {
    for (let b = 0; b < 4; b++) out.push({ id: `${nom}-${b}`, famille: nom, seed: 9000 + k++, bruit: b * 0.4, contenu: sc });
  }
  for (let i = 0; i < 24; i++) out.push({ id: `bot-${i}`, famille: "bot", seed: 7000 + i, bruit: 0, contenu: jour(60 + i) });
  const restant = Math.max(0, n - out.length);
  for (let i = 0; i < restant; i++) out.push({ id: `bruite-${i}`, famille: "bruite", seed: 1000 + i, bruit: [0.1, 0.35, 0.8][i % 3]!, contenu: jour(i % 56) });
  return out;
}

// ---------- hasard de l'outil (mulberry32) ----------

function mulberry(seed: number): () => number {
  let a = seed >>> 0;
  return () => {
    a = (a + 0x6d2b79f5) >>> 0;
    let t = a;
    t = Math.imul(t ^ (t >>> 15), t | 1);
    t ^= t + Math.imul(t ^ (t >>> 7), t | 61);
    return ((t ^ (t >>> 14)) >>> 0) / 4294967296;
  };
}

// ---------- accès aux entrailles de la partie (lecture seule) ----------

interface PieceInt {
  id: number;
  kind: PieceKind;
  rot: number;
  etat: string;
  body: RAPIER.RigidBody | null;
  g8: number;
  x: number;
  y: number;
  angle: number;
  endormie: boolean;
  taille: "normale" | "petite" | "geante";
  fixe: boolean;
}
interface Interne {
  world: RAPIER.World;
  pieces: PieceInt[];
  R: Rapier;
}
const interne = (p: Partie): Interne => p as unknown as Interne;

// ---------- le joueur bruité ----------

interface Intention {
  rot: number;
  cible8: number; // bord gauche visé, huitièmes de mètre, multiple de 4
  attente: number;
  cadence: number;
  cadenceRot: number;
  descend: boolean;
  mal: boolean;
}

/** La hauteur de la tour par abscisse (pas de 1/8 m, de −24 à +24 m) : null hors de la plateforme et de toute pièce. */
function hauteurs(partie: Partie, plateformeDemi8: number): (number | null)[] {
  const N = 384;
  const H: (number | null)[] = new Array(N).fill(null);
  const x0 = -24;
  for (let i = 0; i < N; i++) {
    const x = x0 + (i + 0.5) / 8;
    if (Math.abs(x) <= plateformeDemi8 / 8) H[i] = 0;
  }
  const I = interne(partie);
  for (const p of I.pieces) {
    if (p.etat !== "libre") continue;
    const c = Math.cos(p.angle);
    const s = Math.sin(p.angle);
    for (const b of boitesE(p.kind, p.rot, p.taille)) {
      const cx = p.x + (b.cx * c - b.cy * s) / 8;
      const cy = p.y + (b.cx * s + b.cy * c) / 8;
      const ext = (Math.abs(b.hw * c) + Math.abs(b.hh * s)) / 8;
      const haut = (Math.abs(b.hw * s) + Math.abs(b.hh * c)) / 8;
      for (let i = Math.max(0, Math.floor((cx - ext - x0) * 8)); i < Math.min(N, Math.ceil((cx + ext - x0) * 8)); i++) {
        const t = cy + haut;
        if (H[i] === null || t > H[i]!) H[i] = t;
      }
    }
  }
  return H;
}

const PH = Number(process.env.PH ?? 3);
const PT = Number(process.env.PT ?? 0.4);
function intention(partie: Partie, contenu: Scenario, kind: PieceKind, bruit: number, rnd: () => number): Intention {
  const H = hauteurs(partie, contenu.plateformeDemi8);
  const x0 = -24;
  const gauss = (): number => (rnd() + rnd() + rnd() - 1.5) * 2; // ≈ σ 1
  let hMax = 0;
  for (const h of H) if (h !== null && h > hMax) hMax = h;
  let meilleur: { rot: number; g8: number; score: number; support: number; equilibre: boolean } | null = null;
  const tous: { rot: number; g8: number; score: number; support: number; equilibre: boolean }[] = [];
  for (let rot = 0; rot < ROTATIONS[kind]; rot++) {
    const bs = boitesE(kind, rot);
    let gMin = Infinity;
    let dMax = -Infinity;
    for (const b of bs) {
      gMin = Math.min(gMin, b.cx - b.hw);
      dMax = Math.max(dMax, b.cx + b.hw);
    }
    const L8 = dMax - gMin;
    for (let g8 = -contenu.plateformeDemi8 - 8; g8 + L8 <= contenu.plateformeDemi8 + 8; g8 += DEMI_CASE_8) {
      // profil du dessous de la pièce et sa hauteur d'atterrissage
      let yLand = -Infinity;
      const cols: { H: number | null; B: number }[] = [];
      for (let u = 0; u < L8; u++) {
        const xr = gMin + u + 0.5; // huitièmes, relatif au centre de masse
        let B = Infinity;
        for (const b of bs) if (xr >= b.cx - b.hw && xr <= b.cx + b.hw) B = Math.min(B, (b.cy - b.hh) / 8);
        const i = Math.floor(g8 + u + 0.5 - x0 * 8);
        const h = H[i] ?? null;
        cols.push({ H: h, B });
        if (h !== null && h - B > yLand) yLand = h - B;
      }
      if (yLand === -Infinity) continue;
      let vide = 0;
      let appui = 0;
      let cMin = Infinity;
      let cMax = -Infinity;
      for (let u = 0; u < cols.length; u++) {
        const c = cols[u]!;
        const d = c.H === null ? 0.6 : yLand + c.B - c.H;
        if (c.H !== null && d <= 0.03) {
          appui++;
          cMin = Math.min(cMin, gMin + u);
          cMax = Math.max(cMax, gMin + u + 1);
        }
        vide += Math.min(d, 6);
      }
      const support = appui / cols.length;
      const equilibre = 0 >= cMin + 0.25 * 0 && 0 <= cMax; // le centre de masse (abscisse 0 dans le repère de la pièce) est au-dessus de l'appui
      // la surface d'après : sa hauteur maximale et sa rugosité (variation totale) sur la largeur de la plateforme
      let hautMax = hMax;
      const apres = H.slice();
      for (let u = 0; u < L8; u++) {
        const xr = gMin + u + 0.5;
        let T = -Infinity;
        for (const b of bs) if (xr >= b.cx - b.hw && xr <= b.cx + b.hw) T = Math.max(T, (b.cy + b.hh) / 8);
        const i = Math.floor(g8 + u + 0.5 - x0 * 8);
        if (i >= 0 && i < apres.length && T > -Infinity) apres[i] = yLand + T;
        hautMax = Math.max(hautMax, yLand + T);
      }
      let tv = 0;
      let prec: number | null = null;
      const a0 = Math.floor((-contenu.plateformeDemi8 - 8 - x0 * 8));
      const a1 = Math.floor(contenu.plateformeDemi8 + 8 - x0 * 8);
      for (let i = a0; i < a1; i++) {
        const v = apres[i] ?? 0;
        if (prec !== null) tv += Math.abs(v - prec);
        prec = v;
      }
      const score = -6 * (vide / cols.length) - PH * (hautMax - hMax) - PT * tv + 4 * support + (equilibre ? 0 : -12) + gauss() * bruit;
      const c = { rot, g8, score, support, equilibre };
      tous.push(c);
      if (!meilleur || score > meilleur.score) meilleur = c;
    }
  }
  let choix = meilleur ?? { rot: 0, g8: 0, score: 0, support: 0, equilibre: true };
  let mal = false;
  // quelques porte-à-faux légers
  if (rnd() < 0.03 + 0.05 * bruit) {
    const cands = tous.filter((c) => c.support >= 0.45 && c.support < 0.85 && c.equilibre);
    if (cands.length > 0) {
      choix = cands[Math.floor(rnd() * cands.length)]!;
      mal = true;
    }
  }
  // quelques pièces mal placées d'une demi-case
  if (rnd() < 0.05 * bruit) {
    choix = { ...choix, g8: choix.g8 + (rnd() < 0.5 ? -DEMI_CASE_8 : DEMI_CASE_8) };
    mal = true;
  }
  return {
    rot: (4 - choix.rot) & 3, // le nombre d'ordres « tourner » : un ordre donne rot − 1 (sens des aiguilles d'une montre)
    cible8: choix.g8,
    attente: Math.floor(4 + rnd() * (10 + 14 * bruit)),
    cadence: 3 + Math.floor(rnd() * 5),
    cadenceRot: 6 + Math.floor(rnd() * 8),
    descend: rnd() < 0.65,
    mal,
  };
}

/** Le bord gauche (huitièmes) d'une pièce de la vue. */
function bordGauche8(p: PieceInt): number {
  const c = Math.cos(p.angle);
  const s = Math.sin(p.angle);
  let g = Infinity;
  for (const b of boitesE(p.kind, p.rot, p.taille)) for (const sx of [-1, 1]) for (const sy of [-1, 1]) g = Math.min(g, p.x * 8 + (b.cx + sx * b.hw) * c - (b.cy + sy * b.hh) * s);
  return g;
}

/** Un joueur : chaque tick rend le masque. `suite` : les masques d'un bot précalculé (un tableau par pièce), absent : le joueur bruité. */
class Joueur {
  private id = -1;
  private k = 0;
  private it: Intention | null = null;
  private tournes = 0;
  private dernierPas = -99;
  private dernierRot = -99;
  private fini = -1;
  private numero = -1;
  constructor(
    private readonly e: EntreeCorpus,
    private readonly rnd: () => number,
    private readonly suite: number[][] | null,
  ) {}

  masque(partie: Partie): number {
    const l = partie.lecture();
    if (l.active < 0) return 0;
    if (l.active !== this.id) {
      if (process.env.DEBUG_JOUEUR && this.id >= 0 && this.it) {
        const q = interne(partie).pieces[this.id]!;
        console.error(`   -> pièce ${this.id} ${q.kind} lâchée : bord ${bordGauche8(q).toFixed(1)} visé ${this.it.cible8} état ${q.etat} y ${q.y.toFixed(2)} k ${this.k}`);
      }
      this.id = l.active;
      this.k = 0;
      this.numero++;
      this.tournes = 0;
      this.dernierPas = -99;
      this.dernierRot = -99;
      this.fini = -1;
      if (!this.suite) this.it = intention(partie, this.e.contenu, interne(partie).pieces[l.active]!.kind, this.e.bruit, this.rnd);
      if (process.env.DEBUG_JOUEUR) console.error("pièce", l.active, interne(partie).pieces[l.active]!.kind, JSON.stringify(this.it), "vies", l.vies, "h", l.hauteurMm);
    }
    const k = this.k++;
    if (this.suite) {
      const plan = this.suite[this.numero] ?? [];
      return k < plan.length ? plan[k]! : COMMANDE.DESCENDRE;
    }
    const it = this.it!;
    let m = 0;
    if (k < it.attente) return 0;
    if (this.tournes < it.rot) {
      if (k - this.dernierRot >= it.cadenceRot) {
        m |= COMMANDE.TOURNER;
        this.tournes++;
        this.dernierRot = k;
      }
    } else {
      const p = interne(partie).pieces[l.active]!;
      const ecart = it.cible8 - bordGauche8(p);
      if (Math.abs(ecart) > 2) {
        if (k - this.dernierPas >= it.cadence) {
          m |= ecart > 0 ? COMMANDE.DROITE : COMMANDE.GAUCHE;
          this.dernierPas = k;
        }
      } else if (this.fini < 0) this.fini = k;
    }
    if (it.descend && this.fini >= 0 && k >= this.fini + 3) m |= COMMANDE.DESCENDRE;
    return m;
  }
}

// ---------- le bot imparfait, calculé une fois ----------

const CACHE_BOT = new URL("../dist/stabilite-bot.json", import.meta.url);
type CacheBot = Record<string, number[][]>;

export function calculerBot(R: Rapier, e: EntreeCorpus): number[][] {
  const g = bot(R, e.contenu, { positionsParCote: 3, largeurPct: 50, decalage: (n) => (n % 7 === 6 ? (n % 14 === 6 ? -1 : 1) : 0) });
  const plans: number[][] = [];
  for (;;) {
    const n = g.next();
    if (n.done) break;
    plans.push(n.value);
  }
  return plans;
}

// ---------- la mesure d'une partie ----------

/** Une variante de cause : ne change qu'un seul facteur. */
export interface Variante {
  nom: string;
  description: string;
  version?: number;
  /** Options de `Partie` (contact, physique, et les options de la simulation 5). */
  options?: Record<string, unknown>;
  /** Appelée une fois par tick après `avancer`, avec les entrailles (amortissement, sommeil forcé…). */
  apres?: (p: Partie, tick: number) => void;
}

export interface Evenement {
  tick: number;
  piece: number;
  mm: number;
  deg: number;
  cause: "sans" | "chaine" | "touche";
}
export interface Impact {
  /** La vitesse maximale (m/s) de la pièce posée dans les 30 ticks qui suivent le lâcher : le « coup de marteau ». */
  vitesseImpact: number;
  maxMm: number;
  medMm: number;
  paires: number[];
  effondrement: boolean;
  /** La pièce posée (forme, appui estimé) et la pièce non touchée qui a le plus bougé (pour comprendre les grands déplacements). */
  posee?: { kind: string; x: number; y: number; rot: number };
  /** Toutes les autres pièces étaient à moins d'un degré d'un quart de tour quand cette pièce a été lâchée : une tour « bien bâtie » (sans pièce déjà penchée). */
  bienBatie?: boolean;
  /** Toutes les autres pièces étaient calmes (depuis au moins 20 ticks) quand cette pièce a été lâchée : l'effet de la pose précédente est fini. */
  calmeAvant?: boolean;
  plusMobile?: { kind: string; y: number; mm: number; deg: number };
}
/** Les tolérances (mètres) auxquelles on demande si la pièce exacte entre encore dans un trou : de 1 mm (strict) à 3 cm. */
export const TOLERANCES = [0.001, 0.005, 0.01, 0.015, 0.02, 0.03] as const;
export interface CompteTrous {
  total: number;
  perdusStrict: number;
  perdus: number;
  /** Combien de trous perdus à chacune des `TOLERANCES`. */
  parTol: number[];
  /** Les mêmes comptes, limités aux relevés d'une tour BIEN BÂTIE (aucune pièce penchée de plus d'un degré) : la dérive seule, sans les pièces mal posées. */
  bienTotal: number;
  bienParTol: number[];
}
export interface Trous {
  du_dessus: CompteTrous;
  lateraux: CompteTrous;
}
export interface MesureJeu {
  id: string;
  famille: Famille;
  hauteurMm: number;
  vies: number;
  poses: number;
  ticks: number;
  mouvements: number;
  /** Mouvements sans cause au seuil fin (1 mm, 0,1°), comptés une fois par repos. */
  mouvementsFins: number;
  sansCause: Evenement[];
  chaine: Evenement[];
  impacts: Impact[];
  deriveMm: number[];
  deriveFinMm: number[];
  trous: Trous;
}

/** La version jouée par défaut par l'outil (4 avant le lot T8 ; 5 ensuite). */
export let VERSION_PAR_DEFAUT = Number(process.env.VERSION_SIM ?? 4);
const SEUIL_MM = 5;
const SEUIL_DEG = 0.5;
const CALME_TICKS = 60;
const FENETRE_CAUSE = 30;
const FENETRE_IMPACT = 120;
const PAS_GRAPHE = 2;

interface Etat {
  x: number;
  y: number;
  a: number;
  calme: number;
  ancre: { x: number; y: number; a: number } | null;
  dernierChangement: number;
  sig: string;
  voisins: Set<number>;
  fin: boolean;
}

/** Les paires de pièces libres en contact (distance ≤ 2 cm), lues dans Rapier. */
function graphe(partie: Partie): Map<number, Set<number>> {
  const I = interne(partie);
  const adj = new Map<number, Set<number>>();
  const parHandle = new Map<number, PieceInt>();
  for (const p of I.pieces) {
    if (p.etat !== "libre" || !p.body) continue;
    parHandle.set(p.body.handle, p);
    adj.set(p.id, new Set());
  }
  for (const p of parHandle.values()) {
    const body = p.body!;
    for (let i = 0; i < body.numColliders(); i++) {
      const c = body.collider(i);
      const voisins: RAPIER.Collider[] = [];
      I.world.contactPairsWith(c, (c2) => voisins.push(c2));
      for (const c2 of voisins) {
        const b2 = c2 ? c2.parent() : null;
        if (!b2 || b2.handle === body.handle) continue;
        const q = parHandle.get(b2.handle);
        if (!q) continue;
        let proche = false;
        I.world.contactPair(c, c2, (m) => {
          for (let k = 0; k < m.numContacts(); k++) if (m.contactDist(k) <= 0.02) proche = true;
        });
        if (proche) {
          adj.get(p.id)!.add(q.id);
          adj.get(q.id)!.add(p.id);
        }
      }
    }
  }
  return adj;
}

function composantes(adj: Map<number, Set<number>>, fixes: Set<number>): Map<number, number[]> {
  const seen = new Set<number>();
  const out = new Map<number, number[]>();
  for (const id of adj.keys()) {
    if (seen.has(id)) continue;
    const comp: number[] = [];
    const pile = [id];
    seen.add(id);
    while (pile.length) {
      const a = pile.pop()!;
      comp.push(a);
      for (const b of adj.get(a)!) if (!seen.has(b) && !fixes.has(b)) { seen.add(b); pile.push(b); }
    }
    comp.sort((u, v) => u - v);
    for (const a of comp) out.set(a, comp);
  }
  return out;
}

const mediane = (v: number[]): number => {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.floor(s.length / 2)]!;
};

export function jouerEtMesurer(R: Rapier, e: EntreeCorpus, variante: Variante, planBot: number[][] | null): MesureJeu {
  const version = variante.version ?? VERSION_PAR_DEFAUT;
  const partie = new Partie(R, e.contenu, REGLAGES_DEFAUT, { version, ...(variante.options ?? {}) } as never);
  const I = interne(partie);
  const rnd = mulberry(e.seed);
  const joueur = new Joueur(e, rnd, e.famille === "bot" ? planBot : null);
  const etats = new Map<number, Etat>();
  const res: MesureJeu = {
    id: e.id, famille: e.famille, hauteurMm: 0, vies: 0, poses: 0, ticks: 0, mouvements: 0, mouvementsFins: 0, sansCause: [], chaine: [], impacts: [], deriveMm: [], deriveFinMm: [],
    trous: { du_dessus: { total: 0, perdusStrict: 0, perdus: 0, parTol: TOLERANCES.map(() => 0), bienTotal: 0, bienParTol: TOLERANCES.map(() => 0) }, lateraux: { total: 0, perdusStrict: 0, perdus: 0, parTol: TOLERANCES.map(() => 0), bienTotal: 0, bienParTol: TOLERANCES.map(() => 0) } },
  };
  const lache = new Map<number, number>(); // pièce → tick du lâcher
  const instantanes = new Map<number, Map<number, { x: number; y: number; a: number }>>();
  const touchees = new Map<number, Set<number>>();
  const vImpact = new Map<number, number>();
  const bien = new Map<number, boolean>();
  const calmes = new Map<number, boolean>();
  const fixes = new Set<number>();
  const tolVersion = toleranceDeLaVersion(partie, version);
  let compo = new Map<number, number[]>();
  let t = 0;
  while (partie.etape !== "fini" && t < 30000) {
    const m = partie.etape === "jeu" ? joueur.masque(partie) : 0;
    partie.avancer(m);
    variante.apres?.(partie, t);
    t++;
    const libres = I.pieces.filter((p) => p.etat === "libre");
    // le graphe, tous les PAS_GRAPHE ticks
    if (t % PAS_GRAPHE === 0) {
      const adj = graphe(partie);
      for (const p of libres) if (p.fixe) fixes.add(p.id);
      compo = composantes(adj, fixes);
      for (const p of libres) {
        const s = etats.get(p.id);
        const c = compo.get(p.id) ?? [p.id];
        const sig = c.join(",");
        if (s && s.sig !== sig) s.dernierChangement = t;
        if (s) s.sig = sig;
        // pièces touchées par les pièces en cours de pose
        for (const [q, set] of touchees) if (adj.get(q)?.has(p.id) || q === p.id) set.add(p.id);
        if (s) s.voisins = adj.get(p.id) ?? new Set();
      }
      for (const [q, set] of touchees) for (const v of adj.get(q) ?? []) set.add(v);
    }
    // l'état de chaque pièce libre
    for (const p of libres) {
      if (p.fixe) continue;
      let s = etats.get(p.id);
      if (!s) {
        s = { x: p.x, y: p.y, a: p.angle, calme: 0, ancre: null, dernierChangement: t, sig: String(p.id), voisins: new Set(), fin: false };
        etats.set(p.id, s);
        lache.set(p.id, t);
        res.poses++;
        const snap = new Map<number, { x: number; y: number; a: number }>();
        for (const q of libres) if (q.id !== p.id) snap.set(q.id, { x: q.x, y: q.y, a: q.angle });
        calmes.set(p.id, libres.every((q) => q.id === p.id || q.fixe || (etats.get(q.id)?.calme ?? 0) >= 20));
        bien.set(p.id, libres.every((q) => q.id === p.id || q.fixe || Math.abs(q.angle - Math.round(q.angle / (Math.PI / 2)) * (Math.PI / 2)) < 0.0175));
        instantanes.set(p.id, snap);
        touchees.set(p.id, new Set());
      }
      const dx = p.x - s.x;
      const dy = p.y - s.y;
      const da = p.angle - s.a;
      if (t - (lache.get(p.id) ?? -999) < 30) vImpact.set(p.id, Math.max(vImpact.get(p.id) ?? 0, Math.hypot(dx, dy) * 60));
      const calme = p.endormie || (Math.hypot(dx, dy) < 0.0003 && Math.abs(da) < 0.0005);
      s.x = p.x;
      s.y = p.y;
      s.a = p.angle;
      s.calme = calme ? s.calme + 1 : 0;
      if (s.calme === CALME_TICKS) s.ancre = { x: p.x, y: p.y, a: p.angle };
      if (s.calme < CALME_TICKS) {
        s.ancre = null;
        s.fin = false;
      }
      if (s.ancre) {
        const mm = Math.hypot(p.x - s.ancre.x, p.y - s.ancre.y) * 1000;
        const deg = (Math.abs(p.angle - s.ancre.a) * 180) / Math.PI;
        if (mm > 1 || deg > 0.1) {
          // le seuil fin (1 mm, 0,1°) : un mouvement sans cause, compté une fois par repos
          if (!s.fin && t - s.dernierChangement > FENETRE_CAUSE) {
            const comp = compo.get(p.id) ?? [p.id];
            if (!comp.some((q) => q !== p.id && (etats.get(q)?.calme ?? 0) < FENETRE_CAUSE)) res.mouvementsFins++;
          }
          s.fin = true;
        }
        if (mm > SEUIL_MM || deg > SEUIL_DEG) {
          res.mouvements++;
          const comp = compo.get(p.id) ?? [p.id];
          const touche = t - s.dernierChangement <= FENETRE_CAUSE;
          let agite = false;
          for (const q of comp) {
            if (q === p.id) continue;
            const sq = etats.get(q);
            if (sq && sq.calme < FENETRE_CAUSE) agite = true;
          }
          const ev: Evenement = { tick: t, piece: p.id, mm: Math.round(mm * 10) / 10, deg: Math.round(deg * 100) / 100, cause: touche ? "touche" : agite ? "chaine" : "sans" };
          if (ev.cause === "sans") res.sansCause.push(ev);
          else if (ev.cause === "chaine") res.chaine.push(ev);
          s.ancre = null;
          s.calme = 0;
          s.fin = false;
        }
      }
    }
    // les points de contrôle de chaque pose
    for (const [id, t0] of [...lache]) {
      const prochain = [...lache.values()].filter((v) => v > t0).sort((a, b) => a - b)[0];
      if (t - t0 >= FENETRE_IMPACT || (prochain !== undefined && t >= prochain && t - t0 >= 30) || (partie.etape as string) === "fini") {
        lache.delete(id);
        controle(partie, res, vImpact, bien, calmes, id, instantanes.get(id)!, touchees.get(id)!, tolVersion, e.contenu.plateformeDemi8);
        instantanes.delete(id);
        touchees.delete(id);
      }
    }
  }
  const vue = partie.vue();
  res.hauteurMm = vue.hauteurMm;
  res.vies = vue.vies;
  res.ticks = t;
  // dérive finale
  res.deriveFinMm = deriveMm(partie);
  partie.dispose();
  return res;
}

/** La tolérance de recouvrement de la version jouée, en mètres : le retrait latéral du test de lâcher (5 mm en 4 ; au moins la tolérance en 5). */
function toleranceDeLaVersion(p: Partie, version: number): number {
  const t = (p as unknown as { tolLaterale?: number }).tolLaterale;
  return typeof t === "number" ? t : version >= 4 ? 0.005 : 0.001;
}

function deriveMm(partie: Partie): number[] {
  const out: number[] = [];
  for (const p of interne(partie).pieces) {
    if (p.etat !== "libre" || p.fixe) continue;
    if (Math.abs(p.angle) > 0.05 && Math.abs(Math.abs(p.angle) - Math.PI / 2) > 0.05) continue; // penchée de plus de 3° : exclue
    if (p.g8 % DEMI_CASE_8 !== 0) continue; // lâchée hors de la grille (vent)
    const g = bordGauche8(p) / 8;
    const r = g / 0.5 - Math.round(g / 0.5);
    out.push(Math.abs(r) * 0.5 * 1000);
  }
  return out;
}

/** Le contrôle d'une pose : déplacement des pièces non touchées, dérive, trous. */
function controle(partie: Partie, res: MesureJeu, vImpact: Map<number, number>, bien: Map<number, boolean>, calmes: Map<number, boolean>, id: number, avant: Map<number, { x: number; y: number; a: number }>, touchees: Set<number>, tol: number, demi8: number): void {
  const I = interne(partie);
  const paires: number[] = [];
  let effondrement = false;
  let plus: Impact["plusMobile"];
  for (const p of I.pieces) {
    const a = avant.get(p.id);
    if (!a) continue;
    if (p.etat === "perdue") {
      effondrement = true;
      continue;
    }
    if (p.etat !== "libre" || p.fixe) continue;
    const mm = Math.hypot(p.x - a.x, p.y - a.y) * 1000;
    if (mm > 300) effondrement = true;
    if (!touchees.has(p.id)) {
      paires.push(mm);
      if (!plus || mm > plus.mm) plus = { kind: p.kind, y: Math.round(p.y * 100) / 100, mm: Math.round(mm * 10) / 10, deg: Math.round(((Math.abs(p.angle - a.a) * 180) / Math.PI) * 100) / 100 };
    }
  }
  const posee = I.pieces[id]!;
  const av = avant.get(id);
  if (posee.etat !== "libre") effondrement = true;
  if (av && posee.etat === "libre" && Math.hypot(posee.x - av.x, posee.y - av.y) > 0.5) effondrement = true;
  res.impacts.push({ bienBatie: bien.get(id) ?? false, calmeAvant: calmes.get(id) ?? false, posee: { kind: posee.kind, x: Math.round(posee.x * 100) / 100, y: Math.round(posee.y * 100) / 100, rot: posee.rot }, plusMobile: plus, vitesseImpact: vImpact.get(id) ?? 0, maxMm: paires.length ? Math.max(...paires) : 0, medMm: mediane(paires), paires, effondrement });
  res.deriveMm.push(...deriveMm(partie));
  trous(partie, res, tol, demi8);
}

// ---------- les trous ----------

const CELLULE = 0.5;
interface Grille {
  c0: number; // colonne la plus à gauche, en cellules (x = c × 0,5)
  nC: number;
  nR: number;
  occ: Uint8Array;
}

function rasteriser(partie: Partie, demi8: number): Grille {
  const I = interne(partie);
  const c0 = -40;
  const nC = 80;
  let haut = 0;
  for (const p of I.pieces) if (p.etat === "libre") haut = Math.max(haut, p.y + 4);
  const nR = Math.ceil(haut / CELLULE) + 20;
  const occ = new Uint8Array(nC * nR);
  const marque = (cx: number, cy: number, hw: number, hh: number, ang: number): void => {
    const c = Math.cos(ang);
    const s = Math.sin(ang);
    const ext = Math.abs(hw * c) + Math.abs(hh * s);
    const hau = Math.abs(hw * s) + Math.abs(hh * c);
    for (let r = Math.max(0, Math.floor((cy - hau) / CELLULE)); r <= Math.min(nR - 1, Math.floor((cy + hau) / CELLULE)); r++) {
      for (let col = Math.max(0, Math.floor((cx - ext) / CELLULE) - c0); col <= Math.min(nC - 1, Math.floor((cx + ext) / CELLULE) - c0); col++) {
        let dedans = 0;
        for (let i = 0; i < 3; i++) {
          for (let j = 0; j < 3; j++) {
            const px = (col + c0 + (i + 0.5) / 3) * CELLULE - cx;
            const py = (r + (j + 0.5) / 3) * CELLULE - cy;
            const u = px * c + py * s;
            const v = -px * s + py * c;
            if (Math.abs(u) <= hw && Math.abs(v) <= hh) dedans++;
          }
        }
        if (dedans >= 5) occ[r * nC + col] = 1;
      }
    }
  };
  for (const p of I.pieces) {
    if (p.etat !== "libre") continue;
    const c = Math.cos(p.angle);
    const s = Math.sin(p.angle);
    for (const b of boitesE(p.kind, p.rot, p.taille)) marque(p.x + (b.cx * c - b.cy * s) / 8, p.y + (b.cx * s + b.cy * c) / 8, b.hw / 8, b.hh / 8, p.angle);
  }
  void demi8;
  return { c0, nC, nR, occ };
}

function trous(partie: Partie, res: MesureJeu, tol: number, demi8: number): void {
  const I = interne(partie);
  const bien = I.pieces.every((q) => q.etat !== "libre" || q.fixe || Math.abs(q.angle - Math.round(q.angle / (Math.PI / 2)) * (Math.PI / 2)) < 0.0175);
  const g = rasteriser(partie, demi8);
  const sol = (col: number, r: number): boolean => {
    if (r < 0) return Math.abs((col + g.c0 + 0.5) * CELLULE) <= demi8 / 8; // la plateforme
    if (col < 0 || col >= g.nC || r >= g.nR) return false;
    return g.occ[r * g.nC + col] === 1;
  };
  const libre = (col: number, r: number): boolean => r >= 0 && col >= 0 && col < g.nC && r < g.nR && g.occ[r * g.nC + col] === 0;
  const R = I.R;
  const enMain = I.pieces.find((q) => q.etat === "active")?.body ?? undefined; // la pièce en main (un fantôme) ne compte pas
  // (A) fosses du dessus
  for (let r = 0; r < g.nR - 2; r++) {
    for (let col = 0; col < g.nC; col++) {
      if (!libre(col, r) || (col > 0 && libre(col - 1, r))) continue;
      let fin = col;
      while (fin + 1 < g.nC && libre(fin + 1, r)) fin++;
      const n = fin - col + 1;
      if (n !== 2 && n !== 4) continue;
      if (!sol(col - 1, r) || !sol(fin + 1, r) || !sol(col - 1, r + 1) || !sol(fin + 1, r + 1) || col === 0 || fin === g.nC - 1) continue;
      let appui = true;
      let ouvert = true;
      for (let c = col; c <= fin; c++) {
        if (!sol(c, r - 1)) appui = false;
        for (let rr = r; rr < g.nR; rr++) if (!libre(c, rr)) ouvert = false;
      }
      if (!appui || !ouvert) continue;
      const x = ((col + fin + 1) / 2 + g.c0) * CELLULE;
      // la largeur RÉELLE de la fosse, à deux hauteurs : un « trou » dont les murs sont de plus de 10 cm hors de la grille n'est pas un trou de la grille (pièces mal posées, glissées)
      const largeurReelle = (y: number): number => {
        const gch = I.world.castRay(new R.Ray({ x, y }, { x: -1, y: 0 }), 3, true, undefined, undefined, undefined, enMain);
        const drt = I.world.castRay(new R.Ray({ x, y }, { x: 1, y: 0 }), 3, true, undefined, undefined, undefined, enMain);
        return (gch ? gch.timeOfImpact : 9) + (drt ? drt.timeOfImpact : 9);
      };
      const nominal = n * CELLULE;
      if (Math.abs(largeurReelle(r * CELLULE + 0.25) - nominal) > 0.1 || Math.abs(largeurReelle(r * CELLULE + 0.75) - nominal) > 0.1) continue;
      const kind: PieceKind = n === 2 ? "I" : "O";
      const rot = n === 2 ? 1 : 0;
      const bs = boitesE(kind, rot);
      const fond = r * CELLULE;
      // le fond RÉEL de la fosse (le plus haut des trois points du fond : une pièce du fond légèrement penchée n'est pas à la hauteur de la grille)
      let fondReel = fond;
      {
        const yRayon = fond + 6;
        let h = -Infinity;
        for (const dx of [-0.35 * n * CELLULE, 0, 0.35 * n * CELLULE]) {
          const hit = I.world.castRay(new R.Ray({ x: x + dx, y: yRayon }, { x: 0, y: -1 }), 12, true, undefined, undefined, undefined, enMain);
          if (hit) h = Math.max(h, yRayon - hit.timeOfImpact);
        }
        if (h > -Infinity) fondReel = h;
      }
      const test = (marge: number): boolean => {
        // chaque boîte est lancée vers le bas depuis au-dessus du ciel jusqu'au fond réel de la fosse
        let ok = true;
        for (const b of bs) {
          const forme = new R.Cuboid(Math.max(0.0001, b.hw / 8 - marge), b.hh / 8);
          const cyBas = fondReel + (b.cy - bas8(bs)) / 8;
          const dist = 10;
          const hit = I.world.castShape({ x: x + b.cx / 8, y: cyBas + dist }, 0, { x: 0, y: -1 }, forme, 0, dist, false, undefined, undefined, undefined, enMain);
          if (hit && hit.time_of_impact < dist - 0.03) ok = false;
        }
        return ok;
      };
      if (process.env.DEBUG_TROUS && !test(0.03)) {
        const ws = [0.1, 0.3, 0.5, 0.7, 0.9, 1.2, 1.6].map((dy) => largeurReelle(fond + dy).toFixed(3));
        console.error(`  fosse ${n / 2} case(s) x ${x} fond ${fond} larg@h ${ws.join(" ")}`);
      }
      compter(res.trous.du_dessus, test, tol, bien);
    }
  }
  // (B) galeries latérales sous un surplomb
  for (const h of [2, 4]) {
    const kind: PieceKind = h === 2 ? "I" : "O";
    const longueur = h === 2 ? 8 : 4;
    const bs = boitesE(kind, 0);
    for (let r = 0; r + h < g.nR; r++) {
      let col = 0;
      while (col < g.nC) {
        const ok = (c: number): boolean => {
          if (!sol(c, r - 1) || !sol(c, r + h)) return false;
          for (let k = 0; k < h; k++) if (!libre(c, r + k)) return false;
          return true;
        };
        if (!ok(col)) {
          col++;
          continue;
        }
        let fin = col;
        while (fin + 1 < g.nC && ok(fin + 1)) fin++;
        const n = fin - col + 1;
        const ferméGauche = col > 0 && sol(col - 1, r);
        const ferméDroite = fin < g.nC - 1 && sol(fin + 1, r);
        const murs = [ferméGauche, ferméDroite].filter(Boolean).length;
        if (n >= longueur && murs <= 1 && r >= 0) {
          // la pièce entre jusqu'au mur du fond (ou, sans mur, au bord gauche)
          const gauche = ferméDroite ? (fin + 1 - longueur + g.c0) * CELLULE : (col + g.c0) * CELLULE;
          const x = gauche + (longueur * CELLULE) / 2;
          const y = r * CELLULE + (h * CELLULE) / 2;
          const test = (marge: number): boolean => {
            let bon = true;
            for (const b of bs) {
              const forme = new R.Cuboid(Math.max(0.0001, b.hw / 8 - marge), Math.max(0.0001, b.hh / 8 - marge));
              I.world.intersectionsWithShape({ x: x + b.cx / 8, y: y + b.cy / 8 }, 0, forme, () => {
                bon = false;
                return false;
              }, undefined, undefined, undefined, enMain);
            }
            return bon;
          };
          // la hauteur RÉELLE de la galerie en deux endroits : à plus de 10 cm de la grille, ce n'est pas un trou de la grille
          const hauteurReelle = (px: number): number => {
            const bas = I.world.castRay(new R.Ray({ x: px, y: r * CELLULE + (h * CELLULE) / 2 }, { x: 0, y: -1 }), 3, true, undefined, undefined, undefined, enMain);
            const haut = I.world.castRay(new R.Ray({ x: px, y: r * CELLULE + (h * CELLULE) / 2 }, { x: 0, y: 1 }), 3, true, undefined, undefined, undefined, enMain);
            return (bas ? bas.timeOfImpact : 9) + (haut ? haut.timeOfImpact : 9);
          };
          if (Math.abs(hauteurReelle(x - 0.5) - h * CELLULE) > 0.1 || Math.abs(hauteurReelle(x + 0.5) - h * CELLULE) > 0.1) {
            col = fin + 1;
            continue;
          }
          compter(res.trous.lateraux, test, tol, bien);
        }
        col = fin + 1;
      }
    }
  }
}

function compter(c: CompteTrous, test: (marge: number) => boolean, tol: number, bien: boolean): void {
  c.total++;
  if (bien) c.bienTotal++;
  if (!test(0.001)) c.perdusStrict++;
  if (!test(tol)) c.perdus++;
  TOLERANCES.forEach((m, i) => {
    if (!test(m)) {
      c.parTol[i]!++;
      if (bien) c.bienParTol[i]!++;
    }
  });
}

const bas8 = (bs: readonly { cy: number; hh: number }[]): number => Math.min(...bs.map((b) => b.cy - b.hh));

// ---------- les variantes (une cause à la fois) ----------

/** Amortit (linéaire, angulaire) les pièces libres, une fois chacune (l'amortissement n'est pas retenu : pas dans la simulation, seulement ici, pour la mesure). */
const amortir = (lin: number, ang: number): Variante["apres"] => {
  const vus = new WeakSet<object>();
  return (p) => {
    for (const q of interne(p).pieces) {
      if (q.etat !== "libre" || !q.body || vus.has(q.body)) continue;
      vus.add(q.body);
      q.body.setLinearDamping(lin);
      q.body.setAngularDamping(ang);
    }
  };
};

/** Endort de force une pièce libre calme depuis `n` ticks (vitesse sous `v` m/s). */
const dormir = (n: number, v: number): Variante["apres"] => {
  const calmes = new Map<number, number>();
  return (p) => {
    for (const q of interne(p).pieces) {
      if (q.etat !== "libre" || !q.body || q.fixe) continue;
      if (q.body.isSleeping()) continue;
      const l = q.body.linvel();
      const vit = Math.hypot(l.x, l.y);
      const c = vit < v && Math.abs(q.body.angvel()) < v ? (calmes.get(q.id) ?? 0) + 1 : 0;
      calmes.set(q.id, c);
      if (c >= n) q.body.sleep();
    }
  };
};

/** La simulation 5 avec tous ses correctifs éteints : celle de la 4, au coup de vent près (qui ne sert pas au corpus de départ). Chaque variante de cause ne change qu'UN facteur à partir d'elle. */
const NEUTRE = { vitessePose8: 20, graviteDouce: 1, dureeGraviteDouce: 0, tolerance: 0.001 };
const depuisNeutre = (stabilite: Record<string, unknown> = {}, reste: Record<string, unknown> = {}): Record<string, unknown> => ({ ...reste, stabilite: { ...NEUTRE, ...stabilite } });

export const VARIANTES: Variante[] = [
  { nom: "v4", description: "la simulation 4 telle quelle (l'« avant »)", version: 4 },
  { nom: "v5", description: "la simulation 5 telle quelle (l'« après »)", version: 5 },
  { nom: "neutre", description: "la simulation 5 avec ses correctifs éteints (doit redonner la 4)", version: 5, options: depuisNeutre() },
  { nom: "pose-0", description: "pose douce : la pièce part de 0 m/s au lâcher (au lieu de 2,5 m/s) : la gravité seule", version: 5, options: depuisNeutre({ vitessePose8: 0 }) },
  { nom: "pose-4", description: "pose douce : la pièce part de 0,5 m/s au lâcher", version: 5, options: depuisNeutre({ vitessePose8: 4 }) },
  { nom: "amort-1", description: "amortissement linéaire et angulaire 1 des pièces libres", version: 5, options: depuisNeutre(), apres: amortir(1, 1) },
  { nom: "amort-3", description: "amortissement linéaire et angulaire 3", version: 5, options: depuisNeutre(), apres: amortir(3, 3) },
  { nom: "frottement-0.9", description: "frottement 0,9 (au lieu de 0,6)", version: 5, options: depuisNeutre({}, { physique: { frottement: 0.9 } }) },
  { nom: "contact-30Hz", description: "raideur du contact : 30 Hz (Rapier par défaut)", version: 5, options: depuisNeutre({}, { contact: { frequence: 30 } }) },
  { nom: "contact-60Hz", description: "raideur du contact : 60 Hz", version: 5, options: depuisNeutre({}, { contact: { frequence: 60 } }) },
  { nom: "contact-240Hz", description: "raideur du contact : 240 Hz", version: 5, options: depuisNeutre({}, { contact: { frequence: 240 } }) },
  { nom: "prediction-1mm", description: "prédiction de contact 1 mm (au lieu de 2)", version: 5, options: depuisNeutre({}, { contact: { prediction: 0.001 } }) },
  { nom: "prediction-5mm", description: "prédiction de contact 5 mm", version: 5, options: depuisNeutre({}, { contact: { prediction: 0.005 } }) },
  { nom: "iterations-60", description: "60 itérations du solveur (au lieu de 30)", version: 5, options: depuisNeutre({}, { contact: { iterations: 60 } }) },
  { nom: "internes-4", description: "4 itérations internes (au lieu de 1)", version: 5, options: depuisNeutre({}, { contact: { iterationsInternes: 4 } }) },
  { nom: "tolerance-20mm", description: "tolérance d'emboîtement 2 cm en main (le reste neutre)", version: 5, options: depuisNeutre({ tolerance: 0.02 }) },
  { nom: "pose4+internes4", description: "pose douce 0,5 m/s + 4 itérations internes", version: 5, options: depuisNeutre({ vitessePose8: 4 }, { contact: { iterationsInternes: 4 } }) },
  { nom: "pose4+frott0.9", description: "pose douce 0,5 m/s + frottement 0,9", version: 5, options: depuisNeutre({ vitessePose8: 4 }, { physique: { frottement: 0.9 } }) },
  { nom: "pose4+frott0.9+internes4", description: "pose douce + frottement 0,9 + 4 itérations internes", version: 5, options: depuisNeutre({ vitessePose8: 4 }, { physique: { frottement: 0.9 }, contact: { iterationsInternes: 4 } }) },
  { nom: "pose4+frott0.9+internes4+amort0.5", description: "… + amortissement 0,5", version: 5, options: depuisNeutre({ vitessePose8: 4 }, { physique: { frottement: 0.9 }, contact: { iterationsInternes: 4 } }), apres: amortir(0.5, 0.5) },
  { nom: "pose4+frott1.2+internes4", description: "pose douce + frottement 1,2 + 4 itérations internes", version: 5, options: depuisNeutre({ vitessePose8: 4 }, { physique: { frottement: 1.2 }, contact: { iterationsInternes: 4 } }) },
  { nom: "pose4+grav0.2x8", description: "pose douce 0,5 m/s, gravité ×0,2 pendant 8 ticks", version: 5, options: depuisNeutre({ vitessePose8: 4, graviteDouce: 0.2, dureeGraviteDouce: 8 }) },
  { nom: "pose2+grav0x6", description: "pose douce 0,25 m/s, sans gravité pendant 6 ticks", version: 5, options: depuisNeutre({ vitessePose8: 2, graviteDouce: 0, dureeGraviteDouce: 6 }) },
  { nom: "pose4+grav0x8", description: "pose douce 0,5 m/s, sans gravité pendant 8 ticks", version: 5, options: depuisNeutre({ vitessePose8: 4, graviteDouce: 0, dureeGraviteDouce: 8 }) },
  { nom: "A", description: "candidat : pose 0,25 m/s sans gravité 20 ticks, tolérance 2 cm", version: 5, options: depuisNeutre({ vitessePose8: 2, graviteDouce: 0, dureeGraviteDouce: 20, tolerance: 0.02 }) },
  { nom: "B", description: "candidat : pose 0,125 m/s sans gravité 20 ticks, tolérance 2 cm", version: 5, options: depuisNeutre({ vitessePose8: 1, graviteDouce: 0, dureeGraviteDouce: 20, tolerance: 0.02 }) },
  { nom: "C", description: "candidat A + amortissement 0,5", version: 5, options: depuisNeutre({ vitessePose8: 2, graviteDouce: 0, dureeGraviteDouce: 20, tolerance: 0.02 }), apres: amortir(0.5, 0.5) },
  { nom: "D", description: "candidat A + frottement 0,9", version: 5, options: depuisNeutre({ vitessePose8: 2, graviteDouce: 0, dureeGraviteDouce: 20, tolerance: 0.02 }, { physique: { frottement: 0.9 } }) },
  { nom: "E", description: "candidat A + 4 itérations internes", version: 5, options: depuisNeutre({ vitessePose8: 2, graviteDouce: 0, dureeGraviteDouce: 20, tolerance: 0.02 }, { contact: { iterationsInternes: 4 } }) },
  { nom: "F", description: "candidat A + gravité ×0,1 au lieu de 0", version: 5, options: depuisNeutre({ vitessePose8: 2, graviteDouce: 0.1, dureeGraviteDouce: 20, tolerance: 0.02 }) },
  { nom: "sommeil-20", description: "une pièce calme (< 5 cm/s) depuis 20 ticks est endormie de force", version: 5, options: depuisNeutre(), apres: dormir(20, 0.05) },
];

// ---------- l'agrégation ----------

function centile(v: number[], q: number): number {
  if (v.length === 0) return 0;
  const s = [...v].sort((a, b) => a - b);
  return s[Math.min(s.length - 1, Math.floor(q * s.length))]!;
}

export interface Synthese {
  variante: string;
  parties: number;
  poses: number;
  mouvements: number;
  sansCause: number;
  sansCausePieces: number;
  sansCauseFins: number;
  chaine: number;
  impactMed: number;
  impactP95: number;
  impactMax: number;
  /** Les poses d'une tour bien bâtie (aucune pièce penchée) : leur nombre, la médiane et le 95e centile du déplacement maximal des non touchées (mm). */
  bienN: number;
  bienMed: number;
  bienP95: number;
  /** Les poses d'une tour bien bâtie ET calme au lâcher : nombre, médiane, 95e centile. */
  calmeN: number;
  calmeMed: number;
  calmeP95: number;
  impactPairesMed: number;
  impactPairesP95: number;
  posesStables: number;
  deriveMed: number;
  deriveP95: number;
  deriveMax: number;
  deriveFinP95: number;
  trousDessus: CompteTrous;
  trousLateraux: CompteTrous;
  hauteurMedianeM: number;
  viesMoyennes: number;
  posesParPartie: number;
}

export function synthese(nom: string, jeux: MesureJeu[]): Synthese {
  const impacts = jeux.flatMap((j) => j.impacts);
  const stables = impacts.filter((i) => !i.effondrement);
  const paires = stables.flatMap((i) => i.paires);
  const derive = jeux.flatMap((j) => j.deriveMm);
  const fin = jeux.flatMap((j) => j.deriveFinMm);
  const somme = (cle: "du_dessus" | "lateraux"): CompteTrous => ({
    total: jeux.reduce((a, j) => a + j.trous[cle].total, 0),
    perdusStrict: jeux.reduce((a, j) => a + j.trous[cle].perdusStrict, 0),
    perdus: jeux.reduce((a, j) => a + j.trous[cle].perdus, 0),
    parTol: TOLERANCES.map((_, i) => jeux.reduce((a, j) => a + j.trous[cle].parTol[i]!, 0)),
    bienTotal: jeux.reduce((a, j) => a + j.trous[cle].bienTotal, 0),
    bienParTol: TOLERANCES.map((_, i) => jeux.reduce((a, j) => a + j.trous[cle].bienParTol[i]!, 0)),
  });
  return {
    variante: nom,
    parties: jeux.length,
    poses: jeux.reduce((a, j) => a + j.poses, 0),
    mouvements: jeux.reduce((a, j) => a + j.mouvements, 0),
    sansCause: jeux.reduce((a, j) => a + j.sansCause.length, 0),
    sansCauseFins: jeux.reduce((a, j) => a + j.mouvementsFins, 0),
    sansCausePieces: jeux.filter((j) => j.sansCause.length > 0).length,
    chaine: jeux.reduce((a, j) => a + j.chaine.length, 0),
    impactMed: mediane(stables.map((i) => i.maxMm)),
    impactP95: centile(stables.map((i) => i.maxMm), 0.95),
    impactMax: Math.max(0, ...stables.map((i) => i.maxMm)),
    bienN: stables.filter((i) => i.bienBatie).length,
    bienMed: mediane(stables.filter((i) => i.bienBatie).map((i) => i.maxMm)),
    calmeN: stables.filter((i) => i.bienBatie && i.calmeAvant).length,
    calmeMed: mediane(stables.filter((i) => i.bienBatie && i.calmeAvant).map((i) => i.maxMm)),
    calmeP95: centile(stables.filter((i) => i.bienBatie && i.calmeAvant).map((i) => i.maxMm), 0.95),
    bienP95: centile(stables.filter((i) => i.bienBatie).map((i) => i.maxMm), 0.95),
    impactPairesMed: mediane(paires),
    impactPairesP95: centile(paires, 0.95),
    posesStables: stables.length / Math.max(1, impacts.length),
    deriveMed: mediane(derive),
    deriveP95: centile(derive, 0.95),
    deriveMax: Math.max(0, ...derive),
    deriveFinP95: centile(fin, 0.95),
    trousDessus: somme("du_dessus"),
    trousLateraux: somme("lateraux"),
    hauteurMedianeM: mediane(jeux.map((j) => j.hauteurMm)) / 1000,
    viesMoyennes: jeux.reduce((a, j) => a + j.vies, 0) / Math.max(1, jeux.length),
    posesParPartie: jeux.reduce((a, j) => a + j.poses, 0) / Math.max(1, jeux.length),
  };
}

const f1 = (v: number): string => (Math.round(v * 10) / 10).toString();
const pc = (a: number, b: number): string => (b === 0 ? "—" : `${f1((100 * a) / b)} %`);

const part = (c: CompteTrous, i: number): string => pc(c.total - c.parTol[i]!, c.total);
const partBien = (c: CompteTrous, i: number): string => pc(c.bienTotal - c.bienParTol[i]!, c.bienTotal);
export function ligne(s: Synthese): string {
  const td = s.trousDessus;
  const tl = s.trousLateraux;
  return `| ${s.variante} | ${s.sansCause} (${s.sansCausePieces}) · fin ${s.sansCauseFins} | ${s.chaine} | ${f1(s.impactMed)} / ${f1(s.impactP95)} / ${f1(s.impactMax)} · bien bâtie (${s.bienN}) ${f1(s.bienMed)} / ${f1(s.bienP95)} · et calme (${s.calmeN}) ${f1(s.calmeMed)} / ${f1(s.calmeP95)} | ${f1(s.impactPairesMed)} / ${f1(s.impactPairesP95)} | ${f1(s.deriveMed)} / ${f1(s.deriveP95)} / ${f1(s.deriveMax)} | ${td.total} : ${part(td, 0)} · ${pc(td.total - td.perdus, td.total)} · ${part(td, 3)} · ${part(td, 5)} ; bien bâtie (${td.bienTotal}) ${partBien(td, 0)} · ${partBien(td, 1)} · ${partBien(td, 3)} · ${partBien(td, 5)} | ${tl.total} : ${part(tl, 0)} · ${pc(tl.total - tl.perdus, tl.total)} · ${part(tl, 3)} · ${part(tl, 5)} | ${f1(s.hauteurMedianeM)} m · ${f1(s.viesMoyennes)} · ${f1(s.posesParPartie)} |`;
}
export const ENTETE = [
  "| variante | sans cause (parties) | en chaîne | impact : max des non touchées, méd. / p95 / max (mm) | impact : toutes les paires, méd. / p95 (mm) | dérive méd. / p95 / max (mm) | trous du dessus : n, emboîtables à 1 mm · tol. de la version · 15 mm · 30 mm | trous latéraux : idem | hauteur méd. · vies · poses/partie |",
  "|---|---|---|---|---|---|---|---|---|",
].join("\n");

// ---------- exécution ----------

async function plansBot(R: Rapier, entrees: EntreeCorpus[]): Promise<CacheBot> {
  let cache: CacheBot = {};
  if (existsSync(CACHE_BOT)) cache = JSON.parse(readFileSync(CACHE_BOT, "utf8")) as CacheBot;
  const manque = entrees.filter((e) => e.famille === "bot" && !cache[e.id]);
  if (manque.length === 0) return cache;
  console.error(`calcul du bot imparfait : ${manque.length} parties (4 fils)…`);
  const fils = 4;
  const lots = Array.from({ length: fils }, (_, i) => manque.filter((_, k) => k % fils === i));
  const resultats = await Promise.all(
    lots.map(
      (lot) =>
        new Promise<CacheBot>((ok, ko) => {
          const w = new Worker(new URL(import.meta.url), { workerData: { mode: "bot", ids: lot.map((e) => e.id) } });
          w.on("message", (m) => ok(m as CacheBot));
          w.on("error", ko);
        }),
    ),
  );
  for (const r of resultats) Object.assign(cache, r);
  mkdirSync(new URL("../dist/", import.meta.url), { recursive: true });
  writeFileSync(CACHE_BOT, JSON.stringify(cache));
  void R;
  return cache;
}

async function mesurerTout(entrees: EntreeCorpus[], variante: Variante, cache: CacheBot): Promise<MesureJeu[]> {
  const fils = 4;
  const lots = Array.from({ length: fils }, (_, i) => entrees.map((e, k) => ({ e, k })).filter(({ k }) => k % fils === i).map(({ e }) => e));
  const parts = await Promise.all(
    lots.map(
      (lot) =>
        new Promise<MesureJeu[]>((ok, ko) => {
          const w = new Worker(new URL(import.meta.url), { workerData: { mode: "mesure", ids: lot.map((e) => e.id), n: entrees.length, variante: variante.nom, cache: Object.fromEntries(lot.filter((e) => e.famille === "bot").map((e) => [e.id, cache[e.id]])) } });
          w.on("message", (m) => ok(m as MesureJeu[]));
          w.on("error", ko);
        }),
    ),
  );
  return parts.flat();
}

if (!isMainThread && (workerData as { mode?: string } | null)?.mode && ((workerData as { mode: string }).mode === "bot" || (workerData as { mode: string }).mode === "mesure")) {
  const wd = workerData as { mode: "bot" | "mesure"; ids: string[]; n?: number; variante?: string; cache?: CacheBot };
  const R = await chargerRapier();
  const tout = corpus(wd.n ?? 200);
  const lot = wd.ids.map((id) => tout.find((e) => e.id === id)!);
  if (wd.mode === "bot") {
    const out: CacheBot = {};
    for (const e of lot) out[e.id] = calculerBot(R, e);
    parentPort!.postMessage(out);
  } else {
    const v = VARIANTES.find((x) => x.nom === wd.variante)!;
    parentPort!.postMessage(lot.map((e) => jouerEtMesurer(R, e, v, wd.cache?.[e.id] ?? null)));
  }
} else if (process.argv[1] && /stabilite(\.m?js|\.ts)?$/.test(process.argv[1])) {
  const arg = (nom: string): string | undefined => process.argv.find((a) => a.startsWith(`--${nom}=`))?.slice(nom.length + 3);
  if (process.argv.includes("--liste")) {
    for (const v of VARIANTES) console.log(`${v.nom} : ${v.description}`);
    process.exit(0);
  }
  const n = Number(arg("n") ?? 200);
  const choix = arg("variante") ?? "base";
  const noms = choix === "toutes" ? VARIANTES.map((v) => v.nom) : choix.split(",");
  const entrees = corpus(n);
  const R = await chargerRapier();
  const cache = await plansBot(R, entrees);
  const sorties: Synthese[] = [];
  console.log(ENTETE);
  for (const nom of noms) {
    const v = VARIANTES.find((x) => x.nom === nom);
    if (!v) throw new Error(`variante inconnue : ${nom}`);
    const t0 = Date.now();
    const jeux = await mesurerTout(entrees, v, cache);
    const s = synthese(nom, jeux);
    sorties.push(s);
    console.log(ligne(s));
    console.error(`  ${nom} : ${((Date.now() - t0) / 1000).toFixed(0)} s, ${jeux.length} parties`);
    if (process.argv.includes("--detail")) for (const j of jeux) for (const ev of j.sansCause.slice(0, 3)) console.error(`    ${j.id} tick ${ev.tick} pièce ${ev.piece} : ${ev.mm} mm ${ev.deg}°`);
    if (arg("ecrire")) writeFileSync(arg("ecrire")!, JSON.stringify({ nom, jeux }));
  }
  if (process.argv.includes("--json")) console.log(JSON.stringify(sorties, null, 1));
}
