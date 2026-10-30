import { boites, type Effet, type PieceKind, type Taille, type VuePartie } from "@cdj/tower-sim";
import { BufferAttribute, BufferGeometry, CircleGeometry, Color, Group, Mesh, MeshBasicMaterial, OrthographicCamera, PlaneGeometry, Scene, WebGLRenderer } from "three";
import type { FantomePiece } from "./fantomeLocal";
import { EFFET_HALO, PIECE_COULEUR, SCENE } from "./palette";

// La scène de Tower (lot T1) : Three.js en projection orthographique, comme Jump — des aplats, aucun dégradé, aucune texture. Les pièces sont des boîtes de couleur bordées d'encre, avec
// des yeux fixes (les yeux qui paniquent viendront au lot T5) ; le ciel, la mer, la plateforme et ses nuages viennent de la maquette `tower-hud-paysage.html`. 1 unité = 1 mètre.
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
const NIVEAU_MER = -1.65;
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
  kind: PieceKind;
  /** Ce qui change l'aspect d'une pièce (quarts de tour, taille, effet, corps fixe) : si la clé change, le groupe est reconstruit. */
  cle: string;
  prev: Etat;
  cur: Etat;
  /** Une pièce tombée finit sa chute pour le décor (la simulation l'a retirée) : vitesses estimées au moment de la perte. */
  chute: { vx: number; vy: number; w: number } | null;
}

const plan = new PlaneGeometry(1, 1);
const disque = new CircleGeometry(1, 20);
const matieres = new Map<string, MeshBasicMaterial>();
function matiere(couleur: string): MeshBasicMaterial {
  let m = matieres.get(couleur);
  if (!m) matieres.set(couleur, (m = new MeshBasicMaterial({ color: new Color(couleur) })));
  return m;
}

function rect(couleur: string, x: number, y: number, w: number, h: number, z: number): Mesh {
  const m = new Mesh(plan, matiere(couleur));
  m.position.set(x, y, z);
  m.scale.set(w, h, 1);
  return m;
}

function cercle(couleur: string, x: number, y: number, r: number, z: number): Mesh {
  const m = new Mesh(disque, matiere(couleur));
  m.position.set(x, y, z);
  m.scale.set(r, r, 1);
  return m;
}

const HALO = 0.16;
const cleDe = (p: { rot: number; taille: Taille; effet: Effet | null; fixe: boolean }): string => `${p.rot}${p.taille}${p.effet ?? ""}${p.fixe ? "f" : ""}`;

/** Une pièce : une bordure d'encre sous des boîtes de couleur, et ses yeux (lot T2 : à sa taille, avec le liseré de son effet : lierre, pièce figée, pièce glissante). */
function construirePiece(kind: PieceKind, rot: number, taille: Taille = "normale", effet: Effet | null = null, fixe = false): Group {
  const g = new Group();
  const bs = boites(kind, rot, taille);
  const echelle = taille === "petite" ? 0.55 : taille === "geante" ? 1.6 : 1;
  const halo = fixe ? EFFET_HALO.figee : effet === "lierre" ? EFFET_HALO.lierre : effet === "figee" ? EFFET_HALO.figee : effet === "glissante" ? EFFET_HALO.glissante : null;
  if (halo) for (const b of bs) g.add(rect(halo, b.cx / 8, b.cy / 8, (2 * b.hw) / 8 + 2 * (BORD + HALO), (2 * b.hh) / 8 + 2 * (BORD + HALO), -0.01));
  for (const b of bs) g.add(rect(SCENE.encre, b.cx / 8, b.cy / 8, (2 * b.hw) / 8 + 2 * BORD, (2 * b.hh) / 8 + 2 * BORD, 0));
  for (const b of bs) g.add(rect(PIECE_COULEUR[kind], b.cx / 8, b.cy / 8, (2 * b.hw) / 8 + 0.01, (2 * b.hh) / 8 + 0.01, 0.01));
  // Les yeux, dans la plus grande boîte, droits dans le repère de la pièce.
  const grande = bs.reduce((a, b) => (Math.min(b.hw, b.hh) > Math.min(a.hw, a.hh) ? b : a));
  const ex = grande.cx / 8;
  const ey = grande.cy / 8;
  for (const s of [-1, 1]) {
    g.add(cercle(SCENE.encre, ex + s * 0.17 * echelle, ey, 0.21 * echelle, 0.02));
    g.add(cercle(SCENE.papier, ex + s * 0.17 * echelle, ey, 0.18 * echelle, 0.03));
    g.add(cercle(SCENE.encre, ex + s * 0.17 * echelle + 0.02 * echelle, ey - 0.04 * echelle, 0.075 * echelle, 0.04));
  }
  return g;
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

  constructor(
    private readonly conteneur: HTMLElement,
    private readonly plateformeDemi8: number,
  ) {
    this.renderer = new WebGLRenderer({ antialias: true, powerPreference: "high-performance" });
    this.renderer.setClearColor(new Color(SCENE.ciel));
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

  /** Le ciel (le fond), les nuages, la mer, la plateforme et son pilier. */
  private decor(): void {
    const s = this.scene;
    // Des nuages en pixels, comme la maquette (90 × 14 px et 44 × 12 px à 20 px par mètre), semés à la main : aucun hasard.
    for (let i = 0; i < 46; i++) {
      const y = 4 + i * 8.5 + ((i * 7) % 5);
      const x = ((i * 37) % 47) - 23;
      s.add(rect(SCENE.nuage, x, y, 4.5, 0.7, -9));
      s.add(rect(SCENE.nuage, x + 1, y + 0.6, 2.2, 0.6, -9));
    }
    s.add(rect(SCENE.mer, 0, NIVEAU_MER - 60, 400, 120, -8));
    for (const [x, y, l] of [[-9, -2.2, 1.5], [-5, -2.7, 2], [3, -2.3, 1.3], [8, -2.8, 1.7], [-14, -3.1, 1.6], [13, -2.4, 1.4]] as const) s.add(rect(SCENE.vague, x, y, l, 0.1, -7));
    const hw = this.plateformeDemi8 / 8;
    s.add(rect(SCENE.encre, 0, -1.2 - 0.6, 3 + 2 * BORD, 1.2 + 2 * BORD, -2));
    s.add(rect(SCENE.pilier, 0, -1.2 - 0.6, 3, 1.2, -1.9));
    s.add(rect(SCENE.encre, 0, -0.6, 2 * hw + 2 * BORD, 1.2 + 2 * BORD, -1));
    s.add(rect(SCENE.plateforme, 0, -0.6, 2 * hw, 1.2, -0.9));
    s.add(rect(SCENE.plateformeReflet, 0, -0.16, 2 * hw - 0.1, 0.25, -0.8));
  }

  /** Le trait pointillé du palier (100 m de large : plus que n'importe quel écran) et les huit traînées du vent, cachés tant qu'ils ne servent pas. */
  private monterPalier(): void {
    const pos: number[] = [];
    for (let x = -50; x < 50; x += 0.9) pos.push(x, -0.05, 0, x + 0.55, -0.05, 0, x + 0.55, 0.05, 0, x, -0.05, 0, x + 0.55, 0.05, 0, x, 0.05, 0);
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(pos), 3));
    this.palier.add(new Mesh(g, matiere(SCENE.papier)));
    this.palier.position.z = -0.6;
    this.palier.visible = false;
    this.scene.add(this.palier);
    for (let i = 0; i < 8; i++) {
      const m = rect(SCENE.papier, 0, 0, 2.2 + (i % 3) * 0.7, 0.06, -0.4);
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
    for (const m of this.trainees) m.visible = sens !== 0;
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
        e = { groupe: construirePiece(p.kind, p.rot, p.taille, p.effet, p.fixe), kind: p.kind, cle: cleDe(p), prev: { x: p.x, y: p.y, angle: p.angle }, cur: { x: p.x, y: p.y, angle: p.angle }, chute: null };
        e.groupe.position.z = 1 + p.id * 0.05;
        this.scene.add(e.groupe);
        this.pieces.set(p.id, e);
      }
      if (e.cle !== cleDe(p)) {
        const z = e.groupe.position.z;
        this.scene.remove(e.groupe);
        e.groupe = construirePiece(p.kind, p.rot, p.taille, p.effet, p.fixe);
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
          // La simulation l'a retirée à ce tick : la pièce finit sa chute, sous la mer (derrière elle), sur sa lancée.
          e.chute = { vx: (e.cur.x - e.prev.x) * 60, vy: (e.cur.y - e.prev.y) * 60, w: (e.cur.angle - e.prev.angle) * 60 };
          e.groupe.position.z = -7.5;
        }
        continue;
      }
      e.prev = e.cur;
      e.cur = { x: p.x, y: p.y, angle: p.angle };
    }
    this.cibleHauteur = vue.hauteurMm / 1000;
  }

  /** Dessine : `alpha` (0 à 1) place l'image entre les deux derniers ticks, `dt` (secondes) fait avancer la caméra et la chute des pièces tombées. */
  dessiner(alpha: number, dt: number): void {
    for (const e of this.pieces.values()) {
      if (e.chute) {
        e.chute.vy -= G * dt;
        e.cur = { x: e.cur.x + e.chute.vx * dt, y: e.cur.y + e.chute.vy * dt, angle: e.cur.angle + e.chute.w * dt };
        e.prev = e.cur;
        if (e.cur.y < NIVEAU_MER - 8) e.groupe.visible = false;
      }
      const a = e.chute ? 1 : alpha;
      let da = e.cur.angle - e.prev.angle;
      if (da > Math.PI) da -= 2 * Math.PI;
      else if (da < -Math.PI) da += 2 * Math.PI;
      e.groupe.position.x = e.prev.x + (e.cur.x - e.prev.x) * a;
      e.groupe.position.y = e.prev.y + (e.cur.y - e.prev.y) * a;
      e.groupe.rotation.z = e.prev.angle + da * a;
    }
    const but = basDeVue(this.cibleHauteur, this.H, this.W < this.H);
    this.yBas = this.premier ? but : this.yBas + (but - this.yBas) * (1 - Math.exp(-SUIVI * dt));
    this.premier = false;
    this.camera.bottom = this.yBas;
    this.camera.top = this.yBas + this.H;
    this.camera.updateProjectionMatrix();
    this.temps += dt;
    if (this.sensVent !== 0) {
      const portee = 2 * this.W;
      this.trainees.forEach((m, i) => {
        const x = ((((i * 5.3 + this.temps * this.sensVent * (7 + (i % 3) * 2.5)) % portee) + portee) % portee) - portee / 2;
        m.position.set(x, this.yBas + this.H * (0.12 + 0.1 * i), -0.4);
      });
    }
    this.renderer.render(this.scene, this.camera);
  }

  /** Efface les pièces (une nouvelle partie). */
  vider(): void {
    for (const e of this.pieces.values()) this.scene.remove(e.groupe);
    this.pieces.clear();
    this.premier = true;
    this.cibleHauteur = 0;
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
