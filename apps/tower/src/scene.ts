import { boitesE, type Echelles, type Effet, type PieceKind, type Taille, type Visee, type VuePartie, type VuePiece } from "@cdj/tower-sim";
import { BufferAttribute, BufferGeometry, Color, Group, Mesh, OrthographicCamera, PlaneGeometry, Scene, WebGLRenderer } from "three";
import { contourDe, enQuads } from "./contour";
import type { DecorScene } from "./decorScene";
import { melanger } from "./couleurs";
import { BORD, couchesDe, LISERE } from "./dessinPiece";
import { avancerChute, type ChuteDecor, commencerChute, rayonDePiece } from "./chute";
import { Clignotement, expressionDe, type Genre, regardVers } from "./expression";
import type { FantomePiece } from "./fantomeLocal";
import type { Habit, Soudure } from "./habits";
import type { EffetsTaquet } from "./taquetFx";
import type { EvenementJeu } from "./evenements";
import { matiere, matiereTransparente, rect } from "./formes";
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
/** Le plan unité des traits de la visée (partagé). */
const plan1 = new PlaneGeometry(1, 1);
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
  /** Lot T9 : l'habit de l'effet (`habits.ts`, à la demande), l'instant où la pièce a été dessinée, sa demi-taille (mètres, pour le taquet) et l'étirement du coup en cours (0 à 1). */
  habit: Habit | null;
  naissance: number;
  demi: { x: number; y: number };
  etire: number;
  /** L'instant (secondes d'affichage) jusqu'auquel les yeux se détendent, après un choc ou une pièce calée. */
  detente: number;
}

/** Libère les formes propres à une pièce (l'habit : `polygones.ts` les marque `jetable`) ; les formes partagées (`formes.ts`) restent. */
function jeter(g: Group): void {
  g.traverse((o) => {
    const geo = (o as Mesh).geometry;
    if (geo?.userData.jetable) geo.dispose();
  });
}

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
  if (p.effet === "vent" && p.etat === "active") return "plisse"; // lot T9 : le coup de vent plisse les yeux de la pièce en main
  return "normal";
}

/** Le verglas de la pièce glissante : la glace du bord (épais) et le blanc qui givre sa couleur. */
const GLACE = "#BFE6F5";
const LISERE_GLACE = 0.2;
/** Le trait d'encre épais de la pièce géante (le double et plus d'un trait ordinaire). */
const BORD_GEANTE = BORD * 2.2;

/**
 * Une pièce : l'encre de sa forme sous sa couleur en retrait, et ses yeux (lot T2 : à sa taille, avec le liseré de son effet : lierre, pièce figée ; lot T5 : des yeux vivants).
 * Lot T9 : **l'habit de l'effet**, dessiné tout de suite pour ce qui tient aux couches (le bord de glace épais et la teinte givrée de la pièce glissante, le trait d'encre épais de la géante) ; le reste de l'habit
 * (plaques boulonnées, liane, glaçons, rivets…) est posé par `habits.ts` dès qu'il est arrivé.
 */
function construirePiece(kind: PieceKind, rot: number, taille: Taille, effet: Effet | null, fixe: boolean, echelles: Echelles | undefined, phase: number, id: number, habits: typeof import("./habits") | null): { groupe: Group; yeux: Yeux; rayon: number; habit: Habit | null; demi: { x: number; y: number } } {
  const g = new Group();
  const bs = boitesE(kind, rot, taille, echelles);
  const e4 = echelles ?? { petite4: 2, geante4: 8 };
  // Les yeux suivent la taille de la pièce (la moitié : 0,55 ; le double : 1,6 ; une taille d'essai : à proportion).
  const echelle = taille === "petite" ? (1.1 * e4.petite4) / 4 : taille === "geante" ? (0.8 * e4.geante4) / 4 : 1;
  const glissante = effet === "glissante";
  const halo = glissante ? GLACE : fixe ? EFFET_HALO.figee : effet === "lierre" ? EFFET_HALO.lierre : effet === "figee" ? EFFET_HALO.figee : null;
  // Lot T6 : le dessin est le collider — l'encre est la forme physique, le liseré d'un effet puis la couleur de la pièce sont EN RETRAIT, tous à l'intérieur (`dessinPiece.ts`).
  const couches = couchesDe(bs, halo !== null, taille === "geante" ? BORD_GEANTE : BORD, glissante ? LISERE_GLACE : LISERE);
  const base = paletteCourante().pieces[kind];
  const couleur = glissante ? melanger(base, "#FFFFFF", 0.55) : base;
  for (const r of couches.encre) g.add(rect(SCENE.encre, r.cx, r.cy, r.w, r.h, 0));
  if (halo) for (const r of couches.lisere) g.add(rect(halo, r.cx, r.cy, r.w, r.h, 0.005));
  for (const r of couches.couleur) g.add(rect(couleur, r.cx, r.cy, r.w, r.h, 0.01));
  const habit = habits && (effet !== null || fixe) ? habits.habiller(g, { bs, id, effet, fixe, taille, couleur: base }) : null;
  // Les yeux, dans la plus grande boîte, droits dans le repère de la pièce.
  const grande = bs.reduce((a, b) => (Math.min(b.hw, b.hh) > Math.min(a.hw, a.hh) ? b : a));
  const yeux = new Yeux(g, grande.cx / 8, grande.cy / 8, echelle, phase);
  const demi = { x: Math.max(...bs.map((b) => Math.abs(b.cx) + b.hw)) / 8, y: Math.max(...bs.map((b) => Math.abs(b.cy) + b.hh)) / 8 };
  return { groupe: g, yeux, rayon: rayonDePiece(bs), habit, demi };
}

/** Les options de la scène : le hasard d'affichage et les réglages de rendu lus à chaque image (les curseurs de `?debug&tune` s'appliquent tout de suite). */
export interface OptionsScene {
  hasard?: () => number;
  /** Les réglages de rendu en vigueur : gain de panique, secousse, inclinaison au vent, traînées. */
  rendu?: () => { panique: number; secousse: number; inclinaisonVent: number; trainees: number; etirement?: number; eclat?: number; secousseTaquet?: number };
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
  /** Lot T6 : la visée (deux traits et le contour de l'arrivée), posée par `poserVisee`, allumée par défaut (`viseeActive`). */
  private readonly viseeGroupe = new Group();
  private readonly traitsVisee: Mesh[] = [];
  private visee: Visee | null = null;
  private viseePiece: { kind: PieceKind; rot: number; taille: Taille } | null = null;
  private viseeCle = "";
  private readonly arriveeGroupe = new Group();
  viseeActive = true;
  /** Lot T2 : le trait pointillé du prochain palier (à la hauteur en mètres, posé sur le monde) et les traînées du coup de vent. */
  private readonly palier = new Group();
  private readonly trainees: Group[] = [];
  private sensVent: -1 | 0 | 1 = 0;
  private temps = 0;
  private yBas = BAS_MIN;
  private cibleHauteur = 0;
  private premier = true;
  /** Lot T9 : le décor monté (s'il est arrivé) et le bas de la vue au départ de la partie, d'où partent les parallaxes. */
  private decorMonte: DecorScene | null = null;
  private yRef = BAS_MIN;
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
  /** Lot T9 — l'habillage des effets (`habits.ts`) et les effets du taquet (`taquetFx.ts`), deux modules à la demande chargés ensemble, au premier effet ou au premier taquet. */
  private habits: typeof import("./habits") | null = null;
  private fx: EffetsTaquet | null = null;
  private habitsDemandes = false;
  private soudures: readonly Soudure[] = [];

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
    this.viseeGroupe.add(this.arriveeGroupe);
    for (let i = 0; i < 2; i++) {
      const m = new Mesh(plan1, matiereTransparente(SCENE.encre, 0.35));
      this.traitsVisee.push(m);
      this.viseeGroupe.add(m);
    }
    this.scene.add(this.viseeGroupe);
    this.monterPalier();
    this.redimensionner();
    // Lot T9 : l'habillage des effets et les effets du taquet se chargent dès l'ouverture du jeu (deux petits modules à part), pour être prêts au premier effet comme au premier taquet.
    this.demanderHabits();
  }

  /** Le ciel (le fond : un aplat, la couleur d'effacement), la mer, l'eau de devant (où les pièces tombées disparaissent), la plateforme et son pilier. */
  private decor(): void {
    const s = this.scene;
    const P = paletteCourante();
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
    // Lot T6 : comme les pièces, l'encre est la forme elle-même (le dessus de la plateforme est exactement à y = 0, celui du collider : les pièces y reposent sans s'enfoncer dans un trait), la couleur est en retrait.
    p.add(rect(SCENE.encre, 0, -1.2 - 0.6, 3, 1.2, Z.pilier));
    p.add(rect(P.pilier, 0, -1.2 - 0.6, 3 - 2 * BORD, 1.2 - 2 * BORD, Z.pilier + 0.1));
    p.add(rect(SCENE.encre, 0, -0.6, 2 * hw, 1.2, Z.plateforme));
    p.add(rect(P.plateforme, 0, -0.6, 2 * hw - 2 * BORD, 1.2 - 2 * BORD, Z.plateforme + 0.1));
    p.add(rect(P.plateformeReflet, 0, -0.16 - BORD / 2, 2 * hw - 0.1 - 2 * BORD, 0.25 - BORD / 2, Z.plateforme + 0.2));
  }

  /** Lot T5 : une plateforme d'une autre largeur (un réglage d'essai de `?debug&tune` : la largeur forcée, sans toucher au générateur). */
  poserPlateforme(demi8: number): void {
    if (demi8 === this.plateformeDemi8) return;
    this.plateformeDemi8 = demi8;
    this.remplirPlateforme();
    this.decorMonte?.poserPlateforme(demi8 / 8);
  }

  /**
   * Lot T9 — le décor du thème (trois plans, le registre d'altitude, ce qui s'ajoute à la plateforme), chargé à la demande (`decors.ts`) : il se pose quand il arrive, sous le ciel et la mer du thème qui
   * suffisaient en attendant. Affichage seulement.
   */
  /** Le décor monté (pour les essais de cadence : le cacher ou le montrer). */
  get decorDuTheme(): DecorScene | null {
    return this.decorMonte;
  }

  poserDecor(d: DecorScene): void {
    this.decorMonte?.dispose();
    this.decorMonte = d;
    this.scene.add(d.racine);
    d.poserPlateforme(this.plateformeDemi8 / 8);
  }

  /** Lot T5 : les tailles d'essai (la physique les donne aux pièces ; la scène les dessine à la même taille). À poser avant `vider` et `sync` d'une nouvelle partie. */
  poserEchelles(e: Echelles | undefined): void {
    this.echelles = e;
  }

  /** Lot T5 : la panique de chaque pièce (`AnalyseurPanique.analyser`), lue à chaque image par les yeux. */
  poserPanique(p: ReadonlyMap<number, PaniquePiece>): void {
    this.panique = p;
  }

  /** Lot T9 : charge (une fois) les modules de l'habillage et du taquet, à l'ouverture du jeu ; quand ils arrivent, les pièces qui portent un effet sont redessinées avec leur habit. */
  private demanderHabits(): void {
    if (this.habitsDemandes) return;
    this.habitsDemandes = true;
    void Promise.all([import("./habits"), import("./taquetFx")])
      .then(([h, t]) => {
        this.habits = h;
        this.fx = new t.EffetsTaquet(this.hasard, this.reduit);
        this.scene.add(this.fx.racine);
        for (const e of this.pieces.values()) e.cle = "";
      })
      .catch(() => undefined);
  }

  /** Lot T9 : les soudures du lierre (`Partie.soudures()`, une lecture seule des joints), à poser quand leur nombre change. */
  poserSoudures(s: readonly Soudure[]): void {
    this.soudures = s;
  }

  /**
   * Lot T9 — les quatre temps du taquet, lus dans les événements de la partie : le coup étire la pièce et lance les traînées, le choc fait l'éclat et la micro-secousse, la pièce calée lève sa poussière et
   * ses yeux se détendent, un coup sans choc ne laisse qu'un souffle ; la pose d'une pièce géante lève sa poussière et fend ce qu'elle écrase. Le « toc » et la vibration sont ajoutés par le jeu.
   */
  reagir(ev: EvenementJeu): void {
    if (ev.genre === "contact" && ev.id !== undefined && ev.taille === "geante" && ev.vitesse > 0.3) {
      const e = this.pieces.get(ev.id);
      if (e && this.fx) this.fx.poseGeante({ x: e.cur.x, y: e.cur.y, demiX: e.demi.x, demiY: e.demi.y });
      return;
    }
    if (ev.genre !== "taquet" && ev.genre !== "choc" && ev.genre !== "cale" && ev.genre !== "souffle") return;
    const e = this.pieces.get(ev.id);
    if (!e) return;
    const cadre = { x: e.cur.x, y: e.cur.y, demiX: e.demi.x, demiY: e.demi.y };
    const r = this.rendu();
    if (ev.genre === "taquet") {
      e.etire = 1;
      this.fx?.coup(cadre, ev.sens);
    } else if (ev.genre === "choc") {
      e.etire = 0;
      this.fx?.choc(cadre, ev.sens, r.eclat ?? 1);
      this.secousse.declencherTaquet(r.secousseTaquet ?? 1);
      e.detente = this.temps + 1.2;
    } else if (ev.genre === "cale") {
      this.fx?.cale(cadre);
      e.detente = this.temps + 1.2;
    } else {
      e.etire = 0;
      this.fx?.souffle(cadre, ev.sens);
    }
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
      // Lot T9 : des traînées blanches cerclées d'encre (l'encre dessous, un peu plus grande).
      const l = 1.6 + (i % 4) * 0.8;
      const ep = 0.07 + (i % 3) * 0.035;
      const m = new Group();
      m.add(rect(SCENE.encre, 0, 0, l + 0.1, ep + 0.09, 0), rect(SCENE.papier, 0, 0, l, ep, 0.001));
      m.position.z = Z.traineesVent;
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
        const c = construirePiece(p.kind, p.rot, p.taille, p.effet, p.fixe, this.echelles, p.id * 1.3, p.id, this.habits);
        e = {
          groupe: c.groupe, yeux: c.yeux, kind: p.kind, cle: cleDe(p), prev: { x: p.x, y: p.y, angle: p.angle }, cur: { x: p.x, y: p.y, angle: p.angle }, chute: null, vue: p,
          clignement: new Clignotement(hasardAffichage(graineDePiece(p.id, this.numeroPartie)), this.temps), regard: { x: 0, y: -0.5 }, penche: 0,
          habit: c.habit, naissance: this.temps, demi: c.demi, etire: 0, detente: 0,
        };
        e.groupe.position.z = 1 + p.id * 0.05;
        this.scene.add(e.groupe);
        this.pieces.set(p.id, e);
      }
      e.vue = p;
      if (e.cle !== cleDe(p)) {
        const z = e.groupe.position.z;
        this.scene.remove(e.groupe);
        jeter(e.groupe);
        const c = construirePiece(p.kind, p.rot, p.taille, p.effet, p.fixe, this.echelles, p.id * 1.3, p.id, this.habits);
        e.groupe = c.groupe;
        e.yeux = c.yeux;
        e.habit = c.habit;
        e.demi = c.demi;
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
      // Lot T9 : le coup de taquet écrase la pièce dans le sens du coup (×1,15 / ×0,85, à l'affichage seul, pendant le coup) ; l'habit de l'effet s'anime.
      e.etire = Math.max(0, e.etire - dt / 0.13);
      const k = reduit ? 0 : e.etire * 0.15 * (rendu.etirement ?? 1);
      e.groupe.scale.set(1 + k, 1 - k, 1);
      e.habit?.maj({ t: this.temps, age: this.temps - e.naissance, reduit, sensVent: e.vue.etat === "active" ? this.sensVent : 0, angle: e.cur.angle, soudures: this.soudures });
      this.animerYeux(e, active, rendu.panique, dt);
    }
    const but = basDeVue(this.cibleHauteur, this.H, this.W < this.H);
    this.yBas = this.premier ? but : this.yBas + (but - this.yBas) * (1 - Math.exp(-SUIVI * dt));
    if (this.premier) this.yRef = but;
    this.premier = false;
    this.decorMonte?.maj(this.yBas, this.yRef, this.temps, reduit);
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
    this.fx?.maj(dt);
    this.dessinerGerbe();
    this.dessinerVisee();
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
    e.yeux.appliquer(expressionDe({ niveau, genre: this.temps < e.detente && e.vue.etat === "libre" ? "soulage" : genreDe(e.vue), regard: e.regard, clignement: e.clignement.valeur(this.temps, niveau), t: this.temps }), this.temps);
  }

  /** La visée de l'image : deux traits translucides depuis le bas de la pièce en main (à sa position interpolée) et le contour de l'arrivée, reconstruit seulement quand la forme change. */
  private dessinerVisee(): void {
    const v = this.visee;
    const g = this.viseeGroupe;
    g.visible = this.viseeActive && v !== null && this.viseePiece !== null;
    if (!g.visible || !v || !this.viseePiece) return;
    let dy = 0;
    for (const e of this.pieces.values()) if (e.vue.etat === "active") dy = e.groupe.position.y - e.cur.y;
    v.traits.forEach((t, i) => {
      const m = this.traitsVisee[i]!;
      const haut = t.yHaut + dy;
      const bas = t.yBas ?? this.yBas - 1;
      m.visible = haut > bas;
      m.position.set(t.x, (haut + bas) / 2, Z.visee);
      m.scale.set(0.05, Math.max(0.001, haut - bas), 1);
    });
    const cle = `${this.viseePiece.kind}${this.viseePiece.rot}${this.viseePiece.taille}${paletteCourante().pieces[this.viseePiece.kind]}`;
    if (cle !== this.viseeCle) {
      this.viseeCle = cle;
      for (const c of [...this.arriveeGroupe.children]) {
        this.arriveeGroupe.remove(c);
        if ((c as Mesh).geometry !== plan1) (c as Mesh).geometry.dispose();
      }
      const { kind, rot, taille } = this.viseePiece;
      const bs = boitesE(kind, rot, taille, this.echelles);
      for (const r of couchesDe(bs, false).couleur) {
        const m = new Mesh(plan1, matiereTransparente(paletteCourante().pieces[kind], 0.22));
        m.position.set(r.cx, r.cy, 0);
        m.scale.set(r.w, r.h, 1);
        this.arriveeGroupe.add(m);
      }
      const contour = new BufferGeometry();
      contour.setAttribute("position", new BufferAttribute(new Float32Array(enQuads(contourDe([{ kind, rot, taille, x: 0, y: 0, angle: 0 }]), 0.05)), 3));
      this.arriveeGroupe.add(new Mesh(contour, matiereTransparente(SCENE.encre, 0.45)));
    }
    this.arriveeGroupe.visible = v.arrivee !== null;
    if (v.arrivee) this.arriveeGroupe.position.set(v.arrivee.x, v.arrivee.y, Z.visee);
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
    for (const e of this.pieces.values()) {
      this.scene.remove(e.groupe);
      jeter(e.groupe);
    }
    this.pieces.clear();
    this.premier = true;
    this.cibleHauteur = 0;
    this.numeroPartie++;
    this.gerbe.vider();
    this.fx?.vider();
    this.soudures = [];
    this.secousse.arreter();
    this.panique = new Map();
    this.poserPalier(null);
    this.poserVent(0);
  }

  /**
   * Pose (ou retire, avec `null`) la silhouette d'une partie précédente, derrière la tour (lot T6) : UN seul contour de la silhouette de la tour, en trait fin (`contour.ts`), et non plus
   * chaque pièce en pointillé — la lecture de la tour en cours reste nette.
   */
  poserFantome(pieces: readonly FantomePiece[] | null): void {
    for (const c of [...this.fantome.children]) {
      this.fantome.remove(c);
      (c as Mesh).geometry.dispose();
    }
    if (!pieces || pieces.length === 0) return;
    const g = new BufferGeometry();
    g.setAttribute("position", new BufferAttribute(new Float32Array(enQuads(contourDe(pieces), 0.06)), 3));
    this.fantome.add(new Mesh(g, matiere(SCENE.papier)));
  }

  /**
   * La visée (lot T6) : deux traits fins verticaux depuis les bords de la pièce en main jusqu'à la première surface, et le contour de l'endroit où elle touchera en premier. Affichage seul : `visee`
   * vient de `Partie.visee()` (une lecture du monde, entre deux ticks). `null` : rien. Aplats et traits, couleur de la pièce ; discrets (translucides).
   */
  poserVisee(visee: Visee | null, kind: PieceKind | null, rot: number, taille: Taille): void {
    this.visee = visee;
    this.viseePiece = kind === null ? null : { kind, rot, taille };
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
