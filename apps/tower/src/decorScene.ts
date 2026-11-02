import { BufferAttribute, BufferGeometry, Color, DoubleSide, Group, Mesh, MeshBasicMaterial } from "three";
import { type Anim, decalageParallaxe, type DecorTheme, deplacer, type Forme, formesDeCiel, PARALLAXE, PX, semerCiel, TUILE_M, xEnMetres, yEnMetres, yEnPx, yPlan } from "./decorLogique";
import { ENCRE } from "./couleurs";

// Lot T9 — les décors dans Three.js : **des aplats, aucun dégradé, aucune image**. Chaque plan est assemblé UNE fois, avec un seul maillage par couleur (le décor d'un thème coûte une dizaine d'appels de
// dessin, pas des centaines) ; les formes d'un plan gardent leur ordre d'écriture (la profondeur `z` croît à chaque forme). **Affichage seulement** : rien ici ne lit la simulation. Ce module est chargé À LA DEMANDE
// avec le décor de son thème (`decors.ts`), jamais dans le premier chargement.

const matieres = new Map<string, MeshBasicMaterial>();
/** Une matière en aplat, des deux faces (les formes tournent dans les deux sens : miroirs, ordonnées retournées). */
function matiere(couleur: string): MeshBasicMaterial {
  let m = matieres.get(couleur);
  if (!m) matieres.set(couleur, (m = new MeshBasicMaterial({ color: new Color(couleur), side: DoubleSide })));
  return m;
}

/** Les profondeurs des quatre plans : [début, étendue]. Le lointain, le moyen et le proche sont DERRIÈRE la mer (`Z.mer` −8) sauf le proche ; le sol est devant l'eau de devant et derrière la gerbe. */
const Z_PLANS: readonly (readonly [number, number])[] = [[-9.9, 0.45], [-9.4, 0.45], [-8.9, 0.45], [-5.895, 0.085]];
/** Le nombre de tuiles posées de chaque côté du milieu : 2 → 100 m de large (plus que n'importe quel écran). */
const TUILES = 2;
const ENCRE_PX = 1;

type Tampon = Map<string, number[]>;
const pousser = (t: Tampon, c: string, pts: readonly number[], z: number): void => {
  let v = t.get(c);
  if (!v) t.set(c, (v = []));
  for (let i = 2; i < pts.length / 2; i++) v.push(pts[0]!, pts[1]!, z, pts[2 * i - 2]!, pts[2 * i - 1]!, z, pts[2 * i]!, pts[2 * i + 1]!, z);
};

/** Un disque en polygone : 14 côtés suffisent pour un petit disque, un grand (le soleil, la lune) en a 36. */
const disque = (cx: number, cy: number, r: number): number[] => {
  const n = r > 12 ? 36 : 14;
  return Array.from({ length: n }, (_, i) => [cx + r * Math.cos((2 * i * Math.PI) / n), cy + r * Math.sin((2 * i * Math.PI) / n)]).flat();
};
/** Un trait épais : un rectangle autour du segment. */
function trait(x1: number, y1: number, x2: number, y2: number, w: number): number[] {
  const d = Math.hypot(x2 - x1, y2 - y1) || 1;
  const nx = (-(y2 - y1) / d) * (w / 2);
  const ny = ((x2 - x1) / d) * (w / 2);
  return [x1 + nx, y1 + ny, x2 + nx, y2 + ny, x2 - nx, y2 - ny, x1 - nx, y1 - ny];
}

/** Les maillages d'une liste de formes (px de la planche), posées à `ox` mètres, éventuellement en miroir, avec leur profondeur qui monte de `dz` à chaque forme à partir de `z0`. Rend la profondeur suivante. */
function monter(t: Tampon, formes: readonly Forme[], ox: number, miroir: boolean, z0: number, dz: number): number {
  const X = (px: number): number => (miroir ? -xEnMetres(px) : xEnMetres(px)) + ox;
  const Y = (py: number): number => yEnMetres(py);
  const pts = (liste: readonly number[]): number[] => liste.map((v, i) => (i % 2 === 0 ? X(v) : Y(v)));
  const e = ENCRE_PX;
  let z = z0;
  for (const f of formes) {
    z += dz;
    const zInk = z - dz / 2;
    switch (f.t) {
      case "r": {
        if (f.ink) pousser(t, ENCRE, pts([f.x - e, f.y - e, f.x + f.w + e, f.y - e, f.x + f.w + e, f.y + f.h + e, f.x - e, f.y + f.h + e]), zInk);
        pousser(t, f.c, pts([f.x, f.y, f.x + f.w, f.y, f.x + f.w, f.y + f.h, f.x, f.y + f.h]), z);
        break;
      }
      case "c": {
        if (f.ink) pousser(t, ENCRE, pts(disque(f.x, f.y, f.r + e)), zInk);
        pousser(t, f.c, pts(disque(f.x, f.y, f.r)), z);
        break;
      }
      case "l":
        pousser(t, f.c, pts(trait(f.x1, f.y1, f.x2, f.y2, f.w)), z);
        break;
      case "p": {
        if (f.ink) {
          for (let i = 0; i < f.pts.length; i += 2) {
            const j = (i + 2) % f.pts.length;
            pousser(t, ENCRE, pts(trait(f.pts[i]!, f.pts[i + 1]!, f.pts[j]!, f.pts[j + 1]!, 2 * e)), zInk);
            pousser(t, ENCRE, pts(disque(f.pts[i]!, f.pts[i + 1]!, e)), zInk);
          }
        }
        pousser(t, f.c, pts(f.pts), z);
        break;
      }
    }
  }
  return z;
}

/** Les maillages d'un tampon (un par couleur), dans un groupe. */
function maillages(t: Tampon): Group {
  const g = new Group();
  for (const [couleur, v] of t) {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new BufferAttribute(new Float32Array(v), 3));
    const m = new Mesh(geo, matiere(couleur));
    m.frustumCulled = false;
    g.add(m);
  }
  return g;
}

interface AnimMontee {
  a: Anim;
  groupe: Group;
}

/** La hauteur de vue maximale (m) : en portrait sur un téléphone allongé, 19,5 m × 2,2. La neige couvre cette hauteur. */
const HAUTEUR_VUE_MAX = 46;

/** Le décor d'un thème dans la scène. */
export class DecorScene {
  readonly racine = new Group();
  private readonly plans: Group[] = [];
  private readonly anims: AnimMontee[] = [];
  private plateforme: Group | null = null;

  /** `nom` : le thème (la graine du ciel semé) ; `yRef` : le bas de la vue au départ d'une partie en paysage (les bandes et le ciel semé en partent). */
  constructor(
    private readonly theme: DecorTheme,
    nom: string,
    private readonly yRef: number,
  ) {
    const ciel = semerCiel(nom, theme.zones);
    theme.plans.forEach((plan, i) => {
      const k = PARALLAXE[i]!;
      // Tout ce que ce plan dessine, dans l'ordre : les bandes du ciel haut (derrière tout), le ciel semé, puis les formes de la planche (une fois au milieu, puis sur chaque tuile).
      const segments: { formes: readonly Forme[]; ox: number; miroir: boolean }[] = [];
      if (i === 0) segments.push({ formes: this.bandesEnPx(), ox: 0, miroir: false });
      for (const item of ciel) {
        if (item.plan !== i) continue;
        // Au milieu de l'écran de paysage (9,75 m du bas) quand le bas de la vue est à la hauteur `a` ; l'origine de l'élément est son centre (x = 200 px : le milieu d'une tuile).
        segments.push({ formes: deplacer(formesDeCiel(item, theme.ciel), TUILE_M * PX / 2, yEnPx(yPlan(k, item.a, yRef, 9.75))), ox: item.x, miroir: false });
      }
      segments.push({ formes: plan.centre, ox: 0, miroir: false });
      for (let j = -TUILES; j <= TUILES; j++) segments.push({ formes: plan.repete, ox: j * TUILE_M, miroir: Math.abs(j) % 2 === 1 });
      const [z0, etendue] = Z_PLANS[i]!;
      const dz = etendue / (segments.reduce((n, s) => n + s.formes.length, 0) + 2);
      const t: Tampon = new Map();
      let z = z0;
      for (const s of segments) z = monter(t, s.formes, s.ox, s.miroir, z, dz);
      const g = maillages(t);
      this.plans.push(g);
      this.racine.add(g);
    });
    for (const a of theme.anims) this.monterAnim(a);
  }

  /**
   * Les bandes, en formes de la planche : chacune commence à la hauteur de vue où elle doit apparaître en bas de l'écran et **s'arrête où la suivante commence** (des aplats qui ne se recouvrent pas : le recouvrement
   * coûtait une vingtaine de pour cent de cadence en rendu logiciel) ; la dernière monte très haut.
   */
  private bandesEnPx(): Forme[] {
    const bords = this.theme.bandes.map((b) => yEnPx(yPlan(PARALLAXE[0], b.de, this.yRef, 0)));
    return this.theme.bandes.map((b, i): Forme => {
      const haut = i + 1 < bords.length ? bords[i + 1]! : bords[i]! - 20000;
      return { t: "r", c: b.c, x: -3000, y: haut, w: 6000, h: bords[i]! - haut };
    });
  }

  private monterAnim(a: Anim): void {
    const t: Tampon = new Map();
    const large = a.ecran === true || a.mode === "tombe";
    const copies = a.mode === "tombe" ? Math.ceil(HAUTEUR_VUE_MAX / (a.a / PX)) + 1 : 1;
    const [z0, etendue] = a.ecran ? ([-5.97, 0.02] as const) : Z_PLANS[a.plan]!;
    // Une animation se pose au-dessus des formes de son plan (la dernière tranche de profondeur).
    const dz = (etendue * 0.04) / (a.formes.length * copies * (large ? 2 * TUILES + 1 : 1) + 1);
    let z = z0 + etendue * 0.95;
    for (let c = 0; c < copies; c++) {
      const formes = a.mode === "tombe" ? deplacer(a.formes, 0, -c * a.a) : a.formes;
      for (let j = large ? -TUILES : 0; j <= (large ? TUILES : 0); j++) z = monter(t, formes, j * TUILE_M, Math.abs(j) % 2 === 1, z, dz);
    }
    const groupe = maillages(t);
    (a.ecran ? this.racine : this.plans[a.plan]!).add(groupe);
    this.anims.push({ a, groupe });
  }

  /** Ce qui s'ajoute à la plateforme (neige, planches) : refait à chaque largeur. */
  poserPlateforme(hw: number): void {
    if (this.plateforme) this.racine.remove(this.plateforme);
    this.plateforme = null;
    if (!this.theme.plateforme) return;
    const t: Tampon = new Map();
    // Le repère de ces formes : l'origine est le milieu du dessus de la plateforme (y = 0 dans le monde), 20 px par mètre, y vers le bas (voir `DecorTheme.plateforme`).
    monter(t, deplacer(this.theme.plateforme(hw), TUILE_M * PX / 2, yEnPx(0)), 0, false, -0.78, 0.003);
    this.plateforme = maillages(t);
    this.racine.add(this.plateforme);
  }

  /** À appeler à chaque image : la parallaxe de chaque plan, puis les animations (rien ne bouge avec `reduit`). `yRef` : le bas de la vue au départ de la partie. */
  maj(yBas: number, yRef: number, t: number, reduit: boolean): void {
    this.plans.forEach((g, i) => (g.position.y = decalageParallaxe(PARALLAXE[i]!, yBas, yRef)));
    for (const { a, groupe } of this.anims) {
      const phase = reduit ? 0 : t / a.T + (a.ph ?? 0);
      // Un groupe posé dans son plan en suit déjà la parallaxe ; celui qui suit l'écran (la neige) monte avec la caméra.
      groupe.position.set(0, a.ecran ? yBas - yRef : 0, 0);
      switch (a.mode) {
        case "bob":
          groupe.position.y += Math.sin(phase * 2 * Math.PI) * (a.a / PX);
          break;
        case "derive":
          groupe.position.x = Math.sin(phase * 2 * Math.PI) * (a.a / PX);
          break;
        case "tombe":
          groupe.position.y -= (((phase % 1) + 1) % 1) * (a.a / PX);
          break;
        case "scintille":
          groupe.visible = reduit || Math.sin(phase * 2 * Math.PI) > -0.25;
          break;
      }
    }
  }

  dispose(): void {
    this.racine.traverse((o) => (o as Mesh).geometry?.dispose());
    this.racine.removeFromParent();
  }
}
