import { boites, boitesE, type Echelles, type Effet, type PieceKind, type Taille, type VuePartie, type VuePiece } from "@cdj/tower-sim";
import { BufferAttribute, BufferGeometry, Color, Group, Mesh, OrthographicCamera, Scene, WebGLRenderer } from "three";
import { avancerChute, type ChuteDecor, commencerChute, rayonDePiece } from "./chute";
import { Clignotement, expressionDe, type Genre, regardVers } from "./expression";
import type { FantomePiece } from "./fantomeLocal";
import { matiere, rect } from "./formes";
import { Gerbe, VIE_ONDE } from "./gerbe";
import { graineDePiece, hasardAffichage } from "./hasardAffichage";
import { mouvementReduit } from "./mouvement";
import { EFFET_HALO, paletteCourante, SCENE } from "./palette";
import { type Niveau, type PaniquePiece } from "./panique";
import { NIVEAU_MER, Z } from "./profondeurs";
import { Secousse } from "./secousse";
import { Yeux } from "./yeux";

// La scène de Tower (lot T1) : Three.js en projection orthographique, comme Jump — des aplats, aucun dégradé, aucune texture. Les pièces sont des boîtes de couleur bordées d'encre, avec
// des yeux ; le ciel, la mer, la plateforme et ses nuages viennent de la maquette `tower-hud-paysage.html`. 1 unité = 1 mètre.
//
// Lot T5 — la vie. **Tout ce qui est ajouté ici est de l'affichage, dérivé de la vue de la partie** (jamais l'inverse) : des yeux qui regardent et qui paniquent (`yeux.ts`, `expression.ts`,
// `panique.ts`), la secousse de caméra (`secousse.ts`, absente avec `prefers-reduced-motion`), les pièces tombées qui finissent leur chute devant la mer et se perdent dans une gerbe d'eau
// aplatie (`chute.ts`, `gerbe.ts`, `profondeurs.ts`), les traînées du vent et l'inclinaison de la pièce active, l'effet de la prochaine pièce (la plaque du HUD). Le hasard de ces effets est
// celui de l'affichage (`hasardAffichage.ts`), pas celui de la simulation.
//
// La caméra montre toujours la même étendue sur le **petit côté** de l'écran (`VUE_COURTE`) : en paysage c'est la hauteur, en portrait la largeur — donc plus de hauteur en portrait.
// Elle suit le sommet de la tour en douceur et montre la plateforme tant que la tour est basse (le bas de la vue ne descend pas sous `BAS_MIN`).

/** L'étendue visible sur le petit côté de l'écran, en mètres (la maquette : 390 px à 20 px par mètre). */
export const VUE_COURTE = 19.5;
/** Du sommet de la tour au haut de la vue : la pièce naît 7 m au-dessus (4 m de haut au plus), plus la bande du HUD. */
export const MARGE_HAUT = 13;
/** Le bas de la vue ne descend pas sous ce niveau : la mer est visible (paysage, maquette : la plateforme à 55 px du bas, 22 px de mer). */
export const BAS_MIN = -2.75;
/** En portrait, la plateforme est posée **au-dessus des boutons de commande** du bas (maquette `tower-hud-portrait.html` : 144 px du bas à 20 px par mètre). */
export const BAS_MIN_PORTRAIT = -7.2;
/** Vitesse de la caméra (par seconde) : elle rattrape son but, sans à-coup. */
const SUIVI = 2.5;
const BORD = 0.07;
const G = 9.81;

/** Le bas de la vue pour une tour de `hauteur` mètres, sur une vue de `H` mètres de haut (`portrait` : plus haute que large). */
export function basDeVue(hauteur: number, H: number, portrait = false): number {
  return Math.max(portrait ? BAS_MIN_PORTRAIT : BAS_MIN, hauteur + MARGE_HAUT - H);
}

/** L'étendue visible (largeur, hauteur en mètres) pour un écran de `largeur` × `hauteur` pixels. */
export function etendueVisible(largeur: number, hauteur: number): { W: number; H: number } {
  const aspect = largeur / Math.max(1, hauteur);
  return aspect >= 1 ? { W: VUE_COURTE * aspect, H: VUE_COURTE } : { W: VUE_COURTE, H: VUE_COURTE / aspect };
}

interface Etat {
  x: number;
  y: number;
  angle: number;
}
interface Entree {
  groupe: Group;
  yeux: Yeux;
  kind: PieceKind;
  /** Ce qui change l'aspect d'une pièce (quarts de tour, taille, effet, corps fixe) : si la clé change, le groupe est reconstruit. */
  cle: string;
  prev: Etat;
  cur: Etat;
  /** Une pièce tombée finit sa chute pour le décor (la simulation l'a retirée) : la chute est la seule à bouger encore. */
  chute: ChuteDecor | null;
  /** La dernière vue de la pièce (l'expression et le regard en dérivent à chaque image). */
  vue: VuePiece;
  /** Le clignement de cette pièce (hasard d'affichage), le regard lissé (repère de la pièce) et l'inclinaison au vent lissée (rad). */
  clignement: Clignotement;
  regard: { x: number; y: number };
  penche: number;
}

const HALO = 0.16;
const cleDe = (p: { rot: number; taille: Taille; effet: Effet | null; fixe: boolean }): string => `${p.rot}${p.taille}${p.effet ?? ""}${p.fixe ? "f" : ""}`;

/** Au-delà de cette distance (m) la pièce active n'attire plus le regard des pièces posées. */
const PORTEE_REGARD = 10;
/** Le nombre de traînées de vent que la scène sait dessiner (le réglage choisit combien sont visibles). */
const TRAINEES_MAX = 12;

/** Le genre d'expression d'une pièce : sa chute, son effet et son état. */
export function genreDe(p: Pick<VuePiece, "etat" | "fixe" | "soudee" | "effet">): Genre {
  if (p.etat === "perdue") return "chute";
  if (p.fixe) return "figee";
  if (p.soudee) return "soulage";
  if (p.effet === "glissante") return "glissante";
  return "normal";
}

/** Une pièce : une bordure d'encre sous des boîtes de couleur, et ses yeux (lot T2 : à sa taille, avec le liseré de son effet : lierre, pièce figée, pièce glissante ; lot T5 : des yeux vivants). */
function construirePiece(kind: PieceKind, rot: number, taille: Taille, effet: Effet | null, fixe: boolean, echelles: Echelles | undefined, phase: number): { groupe: Group; yeux: Yeux; rayon: number } {
  const g = new Group();
  const bs = boitesE(kind, rot, taille, echelles);
  const e4 = echelles ?? { petite4: 2, geante4: 8 };
  // Les yeux suivent la taille de la pièce (la moitié : 0,55 ; le double : 1,6 ; une taille d'essai : à proportion).
  const echelle = taille === "petite" ? (1.1 * e4.petite4) / 4 : taille === "geante" ? (0.8 * e4.geante4) / 4 : 1;
  const halo = fixe ? EFFET_HALO.figee : effet === "lierre" ? EFFET_HALO.lierre : effet === "figee" ? EFFET_HALO.figee : effet === "glissante" ? EFFET_HALO.glissante : null;
  if (halo) for (const b of bs) g.add(rect(halo, b.cx / 8, b.cy / 8, (2 * b.hw) / 8 + 2 * (BORD + HALO), (2 * b.hh) / 8 + 2 * (BORD + HALO), -0.01));
  for (const b of bs) g.add(rect(SCENE.encre, b.cx / 8, b.cy / 8, (2 * b.hw) / 8 + 2 * BORD, (2 * b.hh) / 8 + 2 * BORD, 0));
  for (const b of bs) g.add(rect(paletteCourante().pieces[kind], b.cx / 8, b.cy / 8, (2 * b.hw) / 8 + 0.01, (2 * b.hh) / 8 + 0.01, 0.01));
  // Les yeux, dans la plus grande boîte, droits dans le repère de la pièce.
  const grande = bs.reduce((a, b) => (Math.min(b.hw, b.hh) > Math.min(a.hw, a.hh) ? b : a));
  const yeux = new Yeux(g, grande.cx / 8, grande.cy / 8, echelle, phase);
  return { groupe: g, yeux, rayon: rayonDePiece(bs) };
}

/** La silhouette d'une forme en pointillé (les arêtes extérieures de ses boîtes), en un seul maillage. */
function pointilles(kind: PieceKind, rot: number, taille: Taille = "normale"): BufferGeometry {
  const bs = boites(kind, rot, taille).map((b) => ({ x0: (b.cx - b.hw) / 8, x1: (b.cx + b.hw) / 8, y0: (b.cy - b.hh) / 8, y1: (b.cy + b.hh) / 8 }));
  const pos: number[] = [];
  const T = 0.09;
  const DASH = 0.3;
  const PAS = 0.52;
  const dedans = (x: number, y: number, sauf: number): boolean => bs.some((b, i) => i !== sauf && x > b.x0 + 0.02 && x < b.x1 - 0.02 && y > b.y0 + 0.02 && y < b.y1 - 0.02);
  const quad = (x0: number, y0: number, x1: number, y1: number) => pos.push(x0, y0, 0, x1, y0, 0, x1, y1, 0, x0, y0, 0, x1, y1, 0, x0, y1, 0);
  bs.forEach((b, i) => {
    for (const y of [b.y0, b.y1]) {
      for (let x = b.x0; x < b.x1 - 0.05; x += PAS) {
        const fin = Math.min(x + DASH, b.x1);
        const cx = (x + fin) / 2;
        // Un tiret posé contre une autre boîte de la pièce (arête partagée) n'est pas sur la silhouette.
        if (dedans(cx, y + (y === b.y0 ? 0.05 : -0.05), i) && dedans(cx, y + (y === b.y0 ? -0.05 : 0.05), i)) continue;
        if (dedans(cx, y + (y === b.y0 ? 0.05 : -0.05), i) || dedans(cx, y + (y === b.y0 ? -0.05 : 0.05), i)) continue;
        quad(x, y - T / 2, fin, y + T / 2);
      }
    }
    for (const x of [b.x0, b.x1]) {
      for (let y = b.y0; y < b.y1 - 0.05; y += PAS) {
        const fin = Math.min(y + DASH, b.y1);
        const cy = (y + fin) / 2;
        if (dedans(x + 0.05, cy, i) || dedans(x - 0.05, cy, i)) continue;
        quad(x - T / 2, y, x + T / 2, fin);
      }
    }
  });
  const g = new BufferGeometry();
  g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
  return g;
}

/** Les options de la scène : le hasard d'affichage et les réglages de rendu lus à chaque image (les curseurs de `?debug&tune` s'appliquent tout de suite). */
export interface OptionsScene {
  hasard?: () => number;
  /** Les réglages de rendu en vigueur : gain de panique, secousse, inclinaison au vent, traînées. */
  rendu?: () => { panique: number; secousse: number; inclinaisonVent: number; trainees: number };
  /** Mouvement réduit ? (`prefers-reduced-motion` ; injectable pour les tests). */
  reduit?: () => boolean;
}

export class Scene3D {
  readonly canvas: HTMLCanvasElement;
  private readonly renderer: WebGLRenderer;
  private readonly scene = new Scene();
  private readonly camera = new OrthographicCamera(-1, 1, 1, -1, -100, 100);
  private readonly pieces = new Map<number, Entree>();
  private readonly fantome = new Group();
  /** Lot T2 : le trait pointillé du prochain palier (à la hauteur en mètres, posé sur le monde) et les traînées du coup de vent. */
  private readonly palier = new Group();
  private readonly trainees: Mesh[] = [];
  private sensVent: -1 | 0 | 1 = 0;
  private temps = 0;
  private yBas = BAS_MIN;
  private cibleHauteur = 0;
  private premier = true;
  private W = 1;
  private H = 1;
  // Lot T5
  private readonly hasard: () => number;
  private readonly rendu: NonNullable<OptionsScene["rendu"]>;
  private readonly reduit: () => boolean;
  private readonly secousse: Secousse;
  private readonly gerbe = new Gerbe();
  private readonly gouttes: Mesh[] = [];
  private readonly plateforme = new Group();
  private echelles: Echelles | undefined;
  private panique: ReadonlyMap<number, PaniquePiece> = new Map();
  private numeroPartie = 0;
  /** Une pièce tombée touche l'eau : le jeu en fait un « plouf ». */
  surPlouf: ((x: number, taille: Taille) => void) | null = null;

  constructor(
    private readonly conteneur: HTMLElement,
    private plateformeDemi8: number,
    o: OptionsScene = {},
  ) {
    this.hasard = o.hasard ?? hasardAffichage(0x70e7);
    this.rendu = o.rendu ?? (() => ({ panique: 1, secousse: 1, inclinaisonVent: 4, trainees: 10 }));
    this.reduit = o.reduit ?? mouvementReduit;
    this.secousse = new Secousse(this.hasard, this.reduit, () => this.rendu().secousse);
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(new Color(paletteCourante().ciel));
    this.canvas = this.renderer.domElement;
    this.canvas.className = "tower__scene";
    this.canvas.setAttribute("aria-hidden", "true");
    conteneur.prepend(this.canvas);
    this.camera.position.z = 10;
    this.decor();
    this.fantome.position.z = -0.5;
    this.scene.add(this.fantome);
    this.monterPalier();
    this.redimensionner();
  }

  /** Le ciel (le fond), les nuages, la mer, l'eau de devant (où les pièces tombées disparaissent), la plateforme et son pilier. */
  private decor(): void {
    const s = this.scene;
    const P = paletteCourante();
    for (const [x, y, w, h] of P.formes) s.add(rect(P.decor, x, y, w, h, Z.decor));
    s.add(rect(P.sol, 0, NIVEAU_MER - 60, 400, 120, Z.mer));
    // L'eau de devant : le même aplat que la mer, devant les pièces tombées (`Z.chute`) et derrière la plateforme : une pièce qui tombe entre dans l'eau sans rien couper.
    s.add(rect(P.sol, 0, NIVEAU_MER - 60, 400, 120, Z.merAvant));
    for (const [x, y, l] of [[-9, -2.2, 1.5], [-5, -2.7, 2], [3, -2.3, 1.3], [8, -2.8, 1.7], [-14, -3.1, 1.6], [13, -2.4, 1.4]] as const) s.add(rect(P.vague, x, y, l, 0.1, Z.vagues));
    this.remplirPlateforme();
    s.add(this.plateforme);
  }

  /** Le dessus de la plateforme et son pilier, à la largeur courante. */
  private remplirPlateforme(): void {
    for (const c of [...this.plateforme.children]) this.plateforme.remove(c);
    const hw = this.plateformeDemi8 / 8;
    const P = paletteCourante();
    const p = this.plateforme;
    p.add(rect(SCENE.encre, 0, -1.2 - 0.6, 3 + 2 * BORD, 1.2 + 2 * BORD, Z.pilier));
    p.add(rect(P.pilier, 0, -1.2 - 0.6, 3, 1.2, Z.pilier + 0.1));
    p.add(rect(SCENE.encre, 0, -0.6, 2 * hw + 2 * BORD, 1.2 + 2 * BORD, Z.plateforme));
    p.add(rect(P.plateforme, 0, -0.6, 2 * hw, 1.2, Z.plateforme + 0.1));
    p.add(rect(P.plateformeReflet, 0, -0.16, 2 * hw - 0.1, 0.25, Z.plateforme + 0.2));
  }

  /** Lot T5 : une plateforme d'une autre largeur (un réglage d'essai de `?debug&tune` : la largeur forcée, sans toucher au générateur). */
  poserPlateforme(demi8: number): void {
    if (demi8 === this.plateformeDemi8) return;
    this.plateformeDemi8 = demi8;
    this.remplirPlateforme();
  }

  /** Lot T5 : les tailles d'essai (la physique les donne aux pièces ; la scène les dessine à la même taille). À poser avant `vider` et `sync` d'une nouvelle partie. */
  poserEchelles(e: Echelles | undefined): void {
    this.echelles = e;
  }

  /** Lot T5 : la panique de chaque pièce (`AnalyseurPanique.analyser`), lue à chaque image par les yeux. */
  poserPanique(p: ReadonlyMap<number, PaniquePiece>): void {
    this.panique = p;
  }

  /** Lot T5 : la secousse de caméra (une pièce perdue, ou une cascade). Rien avec le mouvement réduit. */
  secouer(cascade: boolean): void {
    this.secousse.declencher(cascade);
  }

  /** Le trait pointillé du palier (100 m de large : plus que n'importe quel écran) et les traînées du vent, cachés tant qu'ils ne servent pas. */
  private monterPalier(): void {
    const pos: number[] = [];
    for (let x = -50; x < 50; x += 0.9) pos.push(x, -0.05, 0, x + 0.55, -0.05, 0, x + 0.55, 0.05, 0, x, -0.05, 0, x + 0.55, 0.05, 0, x, 0.05, 0);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    this.palier.add(new Mesh(g, matiere(SCENE.papier)));
    this.palier.position.z = -0.6;
    this.palier.visible = false;
    this.scene.add(this.palier);
    // Les traînées du vent : des barres plates de longueurs et d'épaisseurs différentes, en aplat (lot T5 : plus nombreuses, plus variées).
    for (let i = 0; i < TRAINEES_MAX; i++) {
      const m = rect(SCENE.papier, 0, 0, 1.6 + (i % 4) * 0.8, 0.05 + (i % 3) * 0.03, Z.traineesVent);
      m.visible = false;
      this.trainees.push(m);
      this.scene.add(m);
    }
  }

  /** Pose (ou retire, avec `null`) le trait pointillé du prochain palier, à `metres` mètres au-dessus de la plateforme. */
  poserPalier(metres: number | null): void {
    this.palier.visible = metres !== null;
    if (metres !== null) this.palier.position.y = metres;
  }

  /** Le coup de vent : des traînées qui filent dans le sens du vent (−1 gauche, 1 droite), 0 : aucune. Affichage seulement. */
  poserVent(sens: -1 | 0 | 1): void {
    this.sensVent = sens;
    if (sens === 0) for (const m of this.trainees) m.visible = false;
  }

  /** L'ordonnée à l'écran (pixels CSS depuis le haut) d'une hauteur du monde, sur la vue courante : la plaque du palier s'y pose. */
  ecranY(metres: number): number {
    const hauteurPx = this.conteneur.clientHeight || window.innerHeight;
    return ((this.yBas + this.H - metres) / this.H) * hauteurPx;
  }

  /** Adapte le rendu à la taille de la fenêtre. */
  redimensionner(): void {
    const w = this.conteneur.clientWidth || window.innerWidth;
    const h = this.conteneur.clientHeight || window.innerHeight;
    this.renderer.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
    this.renderer.setSize(w, h, false);
    const { W, H } = etendueVisible(w, h);
    this.W = W;
    this.H = H;
    this.camera.left = -W / 2;
    this.camera.right = W / 2;
  }

  /** À appeler après chaque tick de simulation : les nouvelles positions, les précédentes gardées pour l'interpolation. */
  sync(vue: VuePartie): void {
    for (const p of vue.pieces) {
      let e = this.pieces.get(p.id);
      if (!e) {
        const c = construirePiece(p.kind, p.rot, p.taille, p.effet, p.fixe, this.echelles, p.id * 1.3);
        e = {
          groupe: c.groupe, yeux: c.yeux, kind: p.kind, cle: cleDe(p), prev: { x: p.x, y: p.y, angle: p.angle }, cur: { x: p.x, y: p.y, angle: p.angle }, chute: null, vue: p,
          clignement: new Clignotement(hasardAffichage(graineDePiece(p.id, this.numeroPartie)), this.temps), regard: { x: 0, y: -0.5 }, penche: 0,
        };
        e.groupe.position.z = 1 + p.id * 0.05;
        this.scene.add(e.groupe);
        this.pieces.set(p.id, e);
      }
      e.vue = p;
      if (e.cle !== cleDe(p)) {
        const z = e.groupe.position.z;
        this.scene.remove(e.groupe);
        const c = construirePiece(p.kind, p.rot, p.taille, p.effet, p.fixe, this.echelles, p.id * 1.3);
        e.groupe = c.groupe;
        e.yeux = c.yeux;
        e.groupe.position.z = z;
        this.scene.add(e.groupe);
        e.cle = cleDe(p);
      }
      if (p.etat === "abandonnee") {
        e.groupe.visible = false;
        continue;
      }
      if (p.etat === "perdue") {
        if (!e.chute) {
          // La simulation l'a retirée à ce tick : la pièce finit sa chute, sur sa lancée, DEVANT la mer du fond (`Z.chute`), jusqu'à l'eau de devant où elle disparaît dans une gerbe.
          const bs = boitesE(p.kind, p.rot, p.taille, this.echelles);
          e.chute = commencerChute(e.cur.x, e.cur.y, e.cur.angle, (e.cur.x - e.prev.x) * 60, (e.cur.y - e.prev.y) * 60, (e.cur.angle - e.prev.angle) * 60, rayonDePiece(bs));
          e.groupe.position.z = Z.chute;
        }
        continue;
      }
      e.prev = e.cur;
      e.cur = { x: p.x, y: p.y, angle: p.angle };
    }
    this.cibleHauteur = vue.hauteurMm / 1000;
  }

  /** Dessine : `alpha` (0 à 1) place l'image entre les deux derniers ticks, `dt` (secondes) fait avancer la caméra, la chute des pièces tombées, les yeux, la secousse et la gerbe. */
  dessiner(alpha: number, dt: number): void {
    this.temps += dt;
    const reduit = this.reduit();
    // Où est la pièce active (pour le regard des autres) ?
    let active: Entree | undefined;
    for (const e of this.pieces.values()) if (e.vue.etat === "active") active = e;
    const rendu = this.rendu();
    for (const e of this.pieces.values()) {
      if (e.chute) {
        if (avancerChute(e.chute, dt)) {
          if (!reduit) this.gerbe.declencher(e.chute.x, e.vue.taille === "petite" ? 0.2 : e.vue.taille === "geante" ? 1 : 0.55, this.hasard);
          this.surPlouf?.(e.chute.x, e.vue.taille);
        }
        e.cur = { x: e.chute.x, y: e.chute.y, angle: e.chute.angle };
        e.prev = e.cur;
        if (e.chute.finie) e.groupe.visible = false;
      }
      const a = e.chute ? 1 : alpha;
      let da = e.cur.angle - e.prev.angle;
      if (da > Math.PI) da -= 2 * Math.PI;
      else if (da < -Math.PI) da += 2 * Math.PI;
      e.groupe.position.x = e.prev.x + (e.cur.x - e.prev.x) * a;
      e.groupe.position.y = e.prev.y + (e.cur.y - e.prev.y) * a;
      // L'inclinaison au vent : la pièce active penche dans le sens du vent (affichage seulement : la physique ne change pas).
      const cibleInclinaison = e.vue.etat === "active" && e.vue.effet === "vent" && this.sensVent !== 0 ? -this.sensVent * ((rendu.inclinaisonVent * Math.PI) / 180) * (0.75 + 0.25 * Math.sin(this.temps * 2.2)) : 0;
      e.penche += (cibleInclinaison - e.penche) * (1 - Math.exp(-8 * dt));
      e.groupe.rotation.z = e.prev.angle + da * a + e.penche;
      this.animerYeux(e, active, rendu.panique, dt);
    }
    const but = basDeVue(this.cibleHauteur, this.H, this.W < this.H);
    this.yBas = this.premier ? but : this.yBas + (but - this.yBas) * (1 - Math.exp(-SUIVI * dt));
    this.premier = false;
    this.camera.bottom = this.yBas;
    this.camera.top = this.yBas + this.H;
    this.camera.updateProjectionMatrix();
    const secousse = this.secousse.avancer(dt * 1000);
    this.camera.position.set(secousse.x, secousse.y, 10);
    if (this.sensVent !== 0) {
      const portee = 2 * this.W;
      const n = Math.max(0, Math.min(TRAINEES_MAX, Math.round(rendu.trainees)));
      this.trainees.forEach((m, i) => {
        m.visible = i < n;
        if (!m.visible) return;
        const x = ((((i * 5.3 + this.temps * this.sensVent * (6 + (i % 4) * 2.2)) % portee) + portee) % portee) - portee / 2;
        m.position.set(x, this.yBas + this.H * (0.08 + (0.84 * ((i * 0.618) % 1))), Z.traineesVent);
      });
    }
    this.gerbe.avancer(dt);
    this.dessinerGerbe();
    this.renderer.render(this.scene, this.camera);
  }

  /** Les yeux d'une pièce : sa panique (de la vue de la partie), son genre, son regard et son clignement. */
  private animerYeux(e: Entree, active: Entree | undefined, gain: number, dt: number): void {
    const p = this.panique.get(e.vue.id);
    const niveau = (e.vue.etat === "perdue" ? 3 : gain <= 0 ? 0 : (p?.niveau ?? 0)) as Niveau;
    // Le regard : la pièce active et celles qui bougent encore regardent le sol ; les pièces posées regardent la pièce active tant qu'elle tombe près d'elles.
    const monde = { x: e.groupe.position.x, y: e.groupe.position.y };
    let cible = { x: monde.x, y: monde.y - 3 };
    if (active && active !== e && e.vue.endormie && Math.hypot(active.groupe.position.x - monde.x, active.groupe.position.y - monde.y) < PORTEE_REGARD) cible = { x: active.groupe.position.x, y: active.groupe.position.y };
    const v = regardVers(monde, cible, e.groupe.rotation.z);
    const k = 1 - Math.exp(-14 * dt);
    e.regard.x += (v.x - e.regard.x) * k;
    e.regard.y += (v.y - e.regard.y) * k;
    e.yeux.appliquer(expressionDe({ niveau, genre: genreDe(e.vue), regard: e.regard, clignement: e.clignement.valeur(this.temps, niveau), t: this.temps }), this.temps);
  }

  /** La gerbe : un petit nombre de rectangles plats, repris d'une image à l'autre (aucune allocation par image). */
  private dessinerGerbe(): void {
    const liste = this.gerbe.gouttes;
    while (this.gouttes.length < liste.length) {
      const m = rect(SCENE.papier, 0, 0, 1, 1, Z.gerbe);
      this.gouttes.push(m);
      this.scene.add(m);
    }
    this.gouttes.forEach((m, i) => {
      const g = liste[i];
      m.visible = g !== undefined;
      if (!g) return;
      if (g.genre === "goutte") {
        m.position.set(g.x, g.y, Z.gerbe);
        m.scale.set(g.taille * 1.6, g.taille * 0.9, 1);
      } else {
        // L'onde : une barre plate qui s'étale sur la surface et s'amincit.
        const k = g.age / VIE_ONDE;
        m.position.set(g.x, NIVEAU_MER + 0.04, Z.gerbe);
        m.scale.set(0.3 + g.taille * k, 0.09 * (1 - k * 0.7), 1);
      }
    });
  }

  /** Efface les pièces (une nouvelle partie). */
  vider(): void {
    for (const e of this.pieces.values()) this.scene.remove(e.groupe);
    this.pieces.clear();
    this.premier = true;
    this.cibleHauteur = 0;
    this.numeroPartie++;
    this.gerbe.vider();
    this.secousse.arreter();
    this.panique = new Map();
    this.poserPalier(null);
    this.poserVent(0);
  }

  /** Pose (ou retire, avec `null`) la silhouette en pointillé d'une partie précédente, derrière la tour. */
  poserFantome(pieces: readonly FantomePiece[] | null): void {
    for (const c of [...this.fantome.children]) {
      this.fantome.remove(c);
      (c as Mesh).geometry.dispose();
    }
    if (!pieces) return;
    for (const p of pieces) {
      const m = new Mesh(pointilles(p.kind, p.rot, p.taille), matiere(SCENE.papier));
      m.position.set(p.x, p.y, 0);
      m.rotation.z = p.angle;
      this.fantome.add(m);
    }
  }

  /** Les mètres visibles (pour les tests et `?debug`). */
  get vue(): { W: number; H: number; bas: number } {
    return { W: this.W, H: this.H, bas: this.yBas };
  }

  dispose(): void {
    this.renderer.dispose();
    this.canvas.remove();
  }
}
