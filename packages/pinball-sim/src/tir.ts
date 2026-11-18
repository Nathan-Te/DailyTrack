import { DROITE, GAUCHE, EV_GEYSER, EV_PORTAIL, EV_RECUL, EV_SPINNER, NB_BILLES, RAYON, TICKS_PAR_SECONDE, UNITE, type Controle } from "./constantes";
import { div } from "./entiers";
import { MISSION_DU_THEME, MODULES_DE_MISSION, type Contenu } from "./generateur";
import { Partie } from "./partie";
import { REGLAGES, type Reglages } from "./reglages";
import type { Table } from "./table";
import { distance2, nomDuModule, nomDuRail } from "./validation";

// LA ZONE DE TIR LIBRE ET LA FENÊTRE DE TIR HUMAINE (lot PBL2) — « le robot touche » ne suffit pas : il faut « un humain peut viser ». Retour de Nathan après PBL1 : sur la table du Volcan (plan « tremplin »), la porte
// (un passage à deux murs) était plantée au-dessus du lance-pierre gauche, ses murs coupaient les tirs des batteurs, et le geyser, l'élément de la mission, était hors de portée d'un joueur. La validation regardait si le
// robot touche chaque élément ; le robot cherche ses coups au pas près et passe par les rebonds. Deux gardes, mesurées avec **le geste de référence d'un humain** :
//
// **Le geste de référence** : la bille est arrêtée sur un batteur levé (la bille « tenue » : le joueur garde le bouton enfoncé, la bille se pose dans le creux entre le guide du couloir de retour et le batteur). Il
// relâche le bouton à l'instant 0 puis le renfonce `d` pas plus tard : **le moment de frappe**. La bille a roulé un peu le long du batteur qui descend, le batteur remonte et la frappe ; `d` fait varier l'endroit du
// batteur où elle est frappée, donc sa vitesse et sa direction. On mesure, pour chaque `d`, **ce que la bille touche en premier** (un module, le mur d'un module, une rampe ou l'orbite prise, la porte franchie, ou rien).
//
// **La fenêtre d'un objectif** (l'élément de la mission, le verrou, chaque rampe et l'orbite, la porte quand elle est ouverte) est **la plus longue plage continue de moments de frappe dont la première chose touchée
// est cet objectif**, en millisecondes ; elle est mesurée depuis chacun des deux batteurs. **Un seuil humain** (`FENETRE_MIN_MS`) : un objectif qu'aucun des deux batteurs n'atteint pendant au moins cette durée n'est pas
// jouable en visant, et la table est refusée (`validation.ts`).
//
// **La zone de tir** : l'éventail des trajectoires de ce geste sur une table sans aucun module, des deux batteurs jusqu'au milieu de la table (`Y_MILIEU`). **Aucun obstacle posé librement n'y entre** : ni le mur d'un
// spinner ou de la coulée, ni la porte (ses murs et son battant) ; les bumpers, les cibles, le trou, les éléments des thèmes et les bouches des rails (des disques, des capteurs, des segments qui ne font pas obstacle
// à un tir) y sont permis. Tout est entier et déterministe, comme le reste du paquet.

/** Le seuil humain de la fenêtre de tir : 30 ms (18 pas), soit un peu moins de deux images à 60 Hz — l'entrée d'un téléphone est lue image par image. Mesure et justification : README du lot PBL2. */
export const FENETRE_MIN_MS = 30;
/** Une durée en pas à la milliseconde, arrondie vers le bas. */
export const pasEnMs = (pas: number): number => div(pas * 1000, TICKS_PAR_SECONDE);
/** Le seuil en pas (30 ms = 18 pas). */
export const FENETRE_MIN_PAS = div(FENETRE_MIN_MS * TICKS_PAR_SECONDE + 999, 1000);

/** Le milieu de la table (px) : la zone de tir s'arrête là. */
export const Y_MILIEU = 380;
/** Où la bille attend sur le batteur levé : on la lâche là (px, batteur gauche ; le droit est l'image dans l'axe) et on la laisse se poser. */
const LACHER_X = 140;
const LACHER_Y = 596;
/** Une bille est « tenue » quand sa vitesse reste sous 15 px/s pendant 120 pas ; au plus 3 000 pas pour s'y poser. */
const TENUE_VITESSE = 15;
const TENUE_PAS = 120;
const TENUE_MAX = 3000;
/** Le dernier moment de frappe essayé (pas) : au-delà la bille a quitté le batteur. */
const D_MAX = 420;
/** Un tir joue au plus 1 800 pas (3 s) avant de toucher quelque chose ; une bille prise par un rail est suivie jusqu'au bout (au plus 3 600 pas). */
const TIR_MAX = 1800;
const RAIL_MAX = 3600;
const AXE2 = 368;

/** Le geste, côté `cote` (0 : batteur gauche, 1 : droit) : la bille tenue, prête à partir. */
export interface BilleTenue {
  partie: Partie;
  /** Les pas qu'il a fallu pour qu'elle se pose. */
  pasPour: number;
  x: number;
  y: number;
}

/** Pose la bille tenue sur le batteur `cote` levé : elle est lâchée au-dessus, le bouton est tenu, et on attend qu'elle ne bouge plus. `null` si elle ne se pose pas (jamais mesuré). */
export function billeTenue(contenu: Contenu, cote: Controle, reglages: Reglages = REGLAGES): BilleTenue | null {
  const p = new Partie(contenu, { ...reglages, sauvee: 0 });
  p.dansLanceur = false;
  p.entree = 0;
  p.x = (cote === GAUCHE ? LACHER_X : AXE2 - LACHER_X) * UNITE;
  p.y = LACHER_Y * UNITE;
  p.px = p.x;
  p.py = p.y;
  p.vx = 0;
  p.vy = 0;
  p.regler(cote, true);
  let calme = 0;
  const seuil2 = TENUE_VITESSE * UNITE * (TENUE_VITESSE * UNITE);
  for (let pas = 1; pas <= TENUE_MAX; pas++) {
    p.avancer();
    if (p.finie || p.billes !== NB_BILLES) return null;
    calme = p.vx * p.vx + p.vy * p.vy < seuil2 ? calme + 1 : 0;
    if (calme >= TENUE_PAS) return { partie: p, pasPour: pas, x: div(p.x, UNITE), y: div(p.y, UNITE) };
  }
  return null;
}

/** Les modules d'un nom d'objectif : `mission` (l'élément de la mission du thème), `verrou` (le trou du verrou), `porte`, `rampe1`, `rampe2`, `orbite`. */
export const OBJECTIFS_BASE = ["mission", "verrou", "porte"] as const;

interface MurDeModule {
  ax: number;
  ay: number;
  bx: number;
  by: number;
  etiquette: string;
}

/**
 * **Ce que la bille touche en premier** : l'étiquette du premier élément touché depuis le début du tir — `mission`, `verrou`, `porte` (franchie ; la porte doit être ouverte), `rampe1`, `rampe2`, `orbite` (menés à
 * leur bout), `recul` (une rampe prise, mais trop lente), `S4:cibles` (un autre module : bumper frappé, cible tombée, trou ou tourbillon qui garde la bille, manège ou portail où elle entre,
 * geyser qui la lance ; **le spinner et la coulée ne sont pas des contacts** : la bille les traverse et continue), `mur:porte` (le battant fermé de la porte), ou `rien`.
 */
export class PremierContact {
  private readonly poses: { type: string; rang: number; n: number; nom: string; mission: boolean; verrou: boolean }[];
  private readonly battant: MurDeModule | null = null;
  private readonly portails: number;
  private rail = -1;
  private railAvant = 0;
  private passages = 0;
  constructor(table: Table, theme: Contenu["theme"]) {
    const types = MODULES_DE_MISSION[MISSION_DU_THEME[theme]] as readonly string[];
    this.poses = table.poses.map((q) => ({ type: q.type, rang: q.rang, n: q.n, nom: nomDuModule(q), mission: types.includes(q.type), verrou: q.type === "trou" && q.rang === table.verrou }));
    // les murs d'un module (spinner, coulée, fond des cibles, murs de la porte) ne sont pas des contacts : la bille qui les longe puis passe est un tir comme un autre. Seul le battant **fermé** de la porte est un obstacle.
    if (table.passage) {
      const b = table.passage.battant;
      this.battant = { ax: b.ax, ay: b.ay, bx: b.bx, by: b.by, etiquette: "mur:porte" };
    }
    this.portails = table.portails.length;
  }

  /** Remet le suivi à zéro pour un tir qui part de `p`. */
  debut(p: Partie): void {
    this.rail = -1;
    this.railAvant = 0;
    this.passages = p.passages;
  }

  /** À appeler après chaque pas : l'étiquette du premier élément touché, ou `null`. */
  voir(p: Partie): string | null {
    const t = p.table;
    if (this.rail >= 0) {
      if (p.railsFaits[this.rail]! > this.railAvant) return nomDuRail(t, this.rail);
      if ((p.ev & EV_RECUL) !== 0) return "recul";
      return null;
    }
    if (p.couche === 1 && p.rail >= 0) {
      this.rail = p.rail;
      this.railAvant = p.railsFaits[p.rail]!;
      return null;
    }
    if (p.passages > this.passages) return "porte";
    let entree = -2;
    for (const q of this.poses) {
      let touche = false;
      switch (q.type) {
        case "bumpers":
        case "mini":
        case "asteroide":
          for (let i = q.rang; i < q.rang + q.n; i++) if (p.choc[i] === 40) touche = true;
          break;
        case "cibles":
          for (const k of t.banques[q.rang]!) if (p.bas[k]) touche = true;
          break;
        case "trou":
          touche = p.captif > 0 && p.captifDe === q.rang;
          break;
        case "manege":
          touche = p.manegeSecteur[q.rang]! >= 0;
          break;
        case "tourbillon":
          touche = p.captif > 0 && p.captifTb === q.rang;
          break;
        case "portailA":
        case "portailB": {
          if ((p.ev & EV_PORTAIL) === 0) break;
          if (entree === -2) {
            let proche = 0;
            let d = Infinity;
            t.portails.forEach((z, i) => {
              const dd = (p.x - z.x) * (p.x - z.x) + (p.y - z.y) * (p.y - z.y);
              if (dd < d) {
                d = dd;
                proche = i;
              }
            });
            entree = this.portails - 1 - proche;
          }
          touche = q.rang === entree;
          break;
        }
        case "geyser":
          touche = (p.ev & EV_GEYSER) !== 0;
          break;
        default:
          break;
      }
      if (touche) return q.mission ? "mission" : q.verrou ? "verrou" : q.nom;
    }
    const m = this.battant;
    if (m && p.passageOuvert === 0) {
      const contact = (RAYON + 1) * UNITE;
      if (p.x >= Math.min(m.ax, m.bx) - contact && p.x <= Math.max(m.ax, m.bx) + contact && p.y >= Math.min(m.ay, m.by) - contact && p.y <= Math.max(m.ay, m.by) + contact && distance2(p.x, p.y, { ax: m.ax, ay: m.ay, bx: m.bx, by: m.by } as never) < contact * contact) return m.etiquette;
    }
    return null;
  }
}

/** Un tir : la partie `p` (déjà posée, le bouton du batteur enfoncé) joue jusqu'à ce que la bille touche quelque chose. Rend l'étiquette ; `trace`, si on la donne, reçoit la position de la bille tous les `echantillon` pas. */
function jouerLeTir(p: Partie, det: PremierContact, trace?: { x: number[]; y: number[] }, echantillon = 12, yMin?: number): string {
  det.debut(p);
  let maxPas = TIR_MAX;
  for (let pas = 1; pas <= maxPas; pas++) {
    p.avancer();
    if (trace && pas % echantillon === 0) {
      trace.x.push(div(p.x, UNITE));
      trace.y.push(div(p.y, UNITE));
    }
    if (yMin !== undefined && p.y < yMin * UNITE) return "rien";
    if (p.finie || p.billes !== NB_BILLES || p.dansLanceur) return "rien";
    const e = det.voir(p);
    if (e !== null) return e;
    if (p.couche === 1) maxPas = RAIL_MAX;
    // la bille retombe vers les batteurs sans avoir rien touché
    else if (pas > 40 && p.vy > 0 && p.y > 570 * UNITE) return "rien";
  }
  return "rien";
}

/** Ce que le geste a donné depuis un batteur : l'étiquette du premier contact de chaque moment de frappe `d` = 0, 1, 2… (jusqu'à ce que la bille ait quitté le batteur). */
export interface TirsDuBatteur {
  cote: Controle;
  /** La bille a-t-elle pu être posée ? */
  tenue: boolean;
  etiquettes: string[];
  /** Les trajectoires, si on les a demandées : pour chaque moment de frappe, les points de la bille (px). */
  traces?: { x: number[]; y: number[] }[];
}

/**
 * **Le geste de référence depuis un batteur** : on pose la bille tenue, on relâche le bouton à l'instant 0, et pour chaque `d` (0, 1, 2… pas) on rejoue depuis cet état en renfonçant le bouton à l'instant `d`. `porteOuverte` :
 * la porte est ouverte pour de bon (le tir mesure alors le passage de la porte). `traces` : garder les trajectoires (le dessin de `?debug`) ; `yMin` : s'arrêter à cette hauteur (la zone de tir).
 */
export function tirsDuBatteur(contenu: Contenu, cote: Controle, options: { reglages?: Reglages; porteOuverte?: boolean; traces?: boolean; yMin?: number; echantillon?: number } = {}): TirsDuBatteur {
  const reglages = options.reglages ?? REGLAGES;
  const tenue = billeTenue(contenu, cote, reglages);
  if (!tenue) return { cote, tenue: false, etiquettes: [] };
  const base = tenue.partie;
  if (options.porteOuverte) base.ouvrirLaPorte();
  base.regler(cote, false);
  const det = new PremierContact(base.table, contenu.theme);
  const essai = new Partie(contenu, { ...reglages, sauvee: 0 });
  const etiquettes: string[] = [];
  const traces: { x: number[]; y: number[] }[] = [];
  for (let d = 0; d <= D_MAX; d++) {
    // la bille a quitté le batteur (ou la table) : plus de frappe possible
    if (base.finie || base.billes !== NB_BILLES || base.y > 700 * UNITE) break;
    essai.recopier(base, false);
    essai.regler(cote, true);
    const trace = options.traces ? { x: [], y: [] } : undefined;
    etiquettes.push(jouerLeTir(essai, det, trace, options.echantillon ?? 12, options.yMin));
    if (trace) traces.push(trace);
    base.avancer();
  }
  return { cote, tenue: true, etiquettes, ...(options.traces ? { traces } : {}) };
}

/** La plus longue plage continue (pas) des moments de frappe dont l'étiquette est `cible`. */
export function plusLongueSerie(etiquettes: readonly string[], cible: string): number {
  let pire = 0;
  let serie = 0;
  for (const e of etiquettes) {
    serie = e === cible ? serie + 1 : 0;
    if (serie > pire) pire = serie;
  }
  return pire;
}

/** Les noms des objectifs d'une table : la mission, le verrou, ses rampes, son orbite et sa porte (ceux qui existent). */
export function objectifsDeLaTable(table: Table): string[] {
  const o = ["mission"];
  if (table.verrou >= 0) o.push("verrou");
  table.rails.forEach((_, i) => o.push(nomDuRail(table, i)));
  if (table.passage) o.push("porte");
  return o;
}

/** La fenêtre de chaque objectif, en pas, depuis chaque batteur : `[gauche, droite]`. */
export interface FenetresDeTir {
  objectifs: Record<string, [number, number]>;
  /** La meilleure des deux, en ms, par objectif. */
  ms: Record<string, number>;
  /** Les objectifs dont la meilleure fenêtre est sous le seuil. */
  manquants: string[];
  /** Les étiquettes de chaque moment de frappe, par batteur, porte fermée (puis ouverte pour la porte). */
  fermee: [string[], string[]];
  ouverte: [string[], string[]];
}

export function fenetresDeTir(contenu: Contenu, reglages: Reglages = REGLAGES, seuilPas: number = FENETRE_MIN_PAS): FenetresDeTir {
  const table = new Partie(contenu, reglages).table;
  const noms = objectifsDeLaTable(table);
  const fermee = [GAUCHE, DROITE].map((c) => tirsDuBatteur(contenu, c as Controle, { reglages }).etiquettes) as [string[], string[]];
  const ouverte: [string[], string[]] = table.passage ? ([GAUCHE, DROITE].map((c) => tirsDuBatteur(contenu, c as Controle, { reglages, porteOuverte: true }).etiquettes) as [string[], string[]]) : [[], []];
  const objectifs: Record<string, [number, number]> = {};
  const ms: Record<string, number> = {};
  const manquants: string[] = [];
  for (const nom of noms) {
    const sources = nom === "porte" ? ouverte : fermee;
    const w: [number, number] = [plusLongueSerie(sources[0], nom), plusLongueSerie(sources[1], nom)];
    objectifs[nom] = w;
    ms[nom] = pasEnMs(Math.max(w[0], w[1]));
    if (Math.max(w[0], w[1]) < seuilPas) manquants.push(nom);
  }
  return { objectifs, ms, manquants, fermee, ouverte };
}

// --- La zone de tir libre.

/** Le contenu d'une table sans aucun module (le plan d'essai `classique`, sans emplacement garni) : le châssis seul, où le geste dessine l'éventail. */
const TABLE_VIDE: Contenu = { jour: 0, g: 0, theme: "foire", plan: "classique", modules: [] };
/** La grille de la zone : des cases de 4 px. */
const CASE_ZONE = 4;
const COLONNES_ZONE = 94;
const LIGNES_ZONE = 190;
/** Un obstacle est dans la zone quand une bille de la zone le toucherait : à moins de `RAYON + 2` px d'un point de passage du centre. */
const MARGE_ZONE = RAYON + 2;

export interface ZoneDeTir {
  /** Les cases (`COLONNES_ZONE` × `LIGNES_ZONE`, 4 px) à moins de `MARGE_ZONE` d'une trajectoire, au-dessous du milieu de la table : 1 dans la zone. */
  cases: Uint8Array;
  /** Les trajectoires de l'éventail, un point par pas : `[batteur][moment de frappe]`. */
  traces: { x: number[]; y: number[] }[][];
  /** Le nombre de cases de la zone. */
  casesMarquees: number;
}

let ZONE: ZoneDeTir | null = null;

/** **La zone de tir** : l'éventail des trajectoires du geste de référence des deux batteurs, sur la table vide, jusqu'au milieu de la table. Calculée une fois (0,1 s). */
export function zoneDeTir(): ZoneDeTir {
  if (ZONE) return ZONE;
  const cases = new Uint8Array(COLONNES_ZONE * LIGNES_ZONE);
  const traces: { x: number[]; y: number[] }[][] = [];
  const r = div(MARGE_ZONE + CASE_ZONE - 1, CASE_ZONE);
  for (const cote of [GAUCHE, DROITE] as const) {
    const t = tirsDuBatteur(TABLE_VIDE, cote, { traces: true, yMin: Y_MILIEU, echantillon: 1 });
    traces.push(t.traces!);
    for (const tr of t.traces!) {
      // seule la part de la trajectoire qui atteint le milieu de la table compte (un tir qui retombe avant n'a pas d'éventail à y défendre)
      if (tr.y.length === 0 || tr.y[tr.y.length - 1]! > Y_MILIEU + 1) continue;
      for (let i = 0; i < tr.x.length; i++) {
        const x = tr.x[i]!;
        const y = tr.y[i]!;
        if (y < Y_MILIEU || y > 660) continue;
        const cx = div(x, CASE_ZONE);
        const cy = div(y, CASE_ZONE);
        for (let dy = -r; dy <= r; dy++) {
          for (let dx = -r; dx <= r; dx++) {
            const gx = cx + dx;
            const gy = cy + dy;
            if (gx < 0 || gy < 0 || gx >= COLONNES_ZONE || gy >= LIGNES_ZONE) continue;
            // le centre de la case à `MARGE_ZONE` du point au plus
            const ex = gx * CASE_ZONE + 2 - x;
            const ey = gy * CASE_ZONE + 2 - y;
            if (ex * ex + ey * ey <= MARGE_ZONE * MARGE_ZONE) cases[gy * COLONNES_ZONE + gx] = 1;
          }
        }
      }
    }
  }
  let n = 0;
  for (const c of cases) n += c;
  ZONE = { cases, traces, casesMarquees: n };
  return ZONE;
}

/** Le point (px) est-il dans la zone de tir ? */
export function dansLaZoneDeTir(x: number, y: number): boolean {
  const z = zoneDeTir();
  const gx = div(x, CASE_ZONE);
  const gy = div(y, CASE_ZONE);
  if (x < 0 || y < 0 || gx >= COLONNES_ZONE || gy >= LIGNES_ZONE) return false;
  return z.cases[gy * COLONNES_ZONE + gx] === 1;
}

/** Un obstacle posé librement qui entre dans la zone : son nom, et le premier point (px) qui y est. */
export interface ObstacleDansLaZone {
  nom: string;
  x: number;
  y: number;
}

/**
 * **Les obstacles posés librement qui entrent dans la zone de tir** : les murs d'un spinner, de la coulée, de la porte (ses deux murs et son battant). Les bumpers, les cibles, le trou, les éléments des thèmes (des
 * disques et des capteurs), le mini-batteur (un batteur) et les bouches des rails n'en sont pas. Une table sans obstacle dans la zone rend une liste vide.
 */
export function obstaclesDansLaZone(table: Table): ObstacleDansLaZone[] {
  const sortie: ObstacleDansLaZone[] = [];
  const verifier = (nom: string, ax: number, ay: number, bx: number, by: number): void => {
    const dx = bx - ax;
    const dy = by - ay;
    const n = Math.max(1, div(Math.max(Math.abs(dx), Math.abs(dy)), 2 * UNITE));
    for (let i = 0; i <= n; i++) {
      const x = div(ax + div(dx * i, n), UNITE);
      const y = div(ay + div(dy * i, n), UNITE);
      if (dansLaZoneDeTir(x, y)) {
        sortie.push({ nom, x, y });
        return;
      }
    }
  };
  for (const q of table.poses) {
    if (q.type !== "spinner" && q.type !== "coulee") continue;
    for (let i = q.m0; i < q.m1; i++) {
      const s = table.murs[i]!;
      verifier(nomDuModule(q), s.ax, s.ay, s.bx, s.by);
    }
  }
  if (table.passage) {
    for (let i = table.murs.length - 2; i < table.murs.length; i++) verifier("porte", table.murs[i]!.ax, table.murs[i]!.ay, table.murs[i]!.bx, table.murs[i]!.by);
    const b = table.passage.battant;
    verifier("porte", b.ax, b.ay, b.bx, b.by);
  }
  return sortie;
}
