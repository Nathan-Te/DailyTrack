// Le héros de Gravity (lot GR3) : le cube jaune de Jump (`creerPersonnage` de `@cdj/visuels/plateformes/three` : corps, yeux, pieds, courses et chutes animés par `animateLook`) **avec son bandeau d'encre** aux deux pans qui flottent
// (propre à Gravity). Il **se retourne avec la gravité** (le corps pivote autour du centre de sa boîte) et **s'écrase à l'atterrissage** (le ressort de `@cdj/visuels`). Autour de lui : l'aura du bouclier et le cercle de l'aimant.
// **Ce fichier ne lit que des nombres de la simulation** (position, gravité, bouclier…) ; rien du jeu n'y est décidé.
import { BufferGeometry, DoubleSide, Float32BufferAttribute, Group, Mesh, MeshBasicMaterial } from "three";
import { MODE_AVION, MODE_ONDE, MODE_RESSORT } from "@cdj/gravity-sim";
import { LOOK, animateLook, restLook, type Look } from "@cdj/visuels/plateformes";
import { artGeometry, creerPersonnage } from "@cdj/visuels/plateformes/three";
import type { CouleursGravity } from "./couleurs";
import { BANDEAU, dessinAnneau, dessinDisque, dessinPan, dessinRuban, dessinTirets } from "./dessins";
import { dessinAvion, dessinRessort, segmentDeTrainee } from "./dessinsModes";
import { lisser } from "./vitesse";

/** La boîte du héros (cases) et le rayon de l'aimant. */
export const TAILLE_HEROS = 0.8;
export const RAYON_AIMANT = 3.5;

export interface PoseHeros {
  /** Le centre de la boîte (cases ; y vers le haut : −rangée). */
  x: number;
  y: number;
  /** La gravité : +1 tire vers le bas, −1 vers le haut. */
  g: 1 | -1;
  sol: boolean;
  /** Vitesse vers l'avant (cases/s) et vitesse de chute dans le sens de la gravité (cases/s). */
  vx: number;
  chute: number;
  tick: number;
  temps: number;
  /** Secondes du rendu depuis l'image d'avant (les ressorts), 0 en pause. */
  dt: number;
  invuln: number;
  bouclier: boolean;
  aimant: number;
  mort: boolean;
  /** Mouvement réduit : le corps ne rebondit ni ne penche, les pans ne flottent pas, les cercles ne tournent pas. */
  reduit: boolean;
  /** Lot GR6 : le mode de vol (`MODE_*`) et la vitesse verticale vers le haut (cases/s : négative en descendant). Le dessin ne lit que cela. */
  mode: number;
  vyUp: number;
}

/** Lot GR6 — les constantes du dessin des modes (rendu seulement). */
/** La rapidité (par seconde) avec laquelle un mode s'installe ou s'efface : l'entrée et la sortie d'un mode sont douces (un quart de seconde). */
export const TAUX_MODE = 14;
/** L'inclinaison de l'avion suit sa montée, à 60 % de l'angle de sa trajectoire (au plus ≈ 30°) ; celle de l'onde est exactement sa trajectoire (45°). Rapidité du lissage (par seconde). */
export const PART_INCLINAISON_AVION = 0.6;
const TAUX_INCLINAISON = 22;
/** Le ressort (le dessin d'un oscillateur amorti, un pas de simulation à la fois) : raideur, amortissement, compression à l'atterrissage et au bond, et sa hauteur au repos (cases). */
const RESSORT_K = 900;
const RESSORT_AMORTI = 28;
export const COMPRESSION_ATTERRISSAGE = 0.9;
export const COMPRESSION_BOND = 0.75;
const HAUTEUR_RESSORT = 0.2;
/** Les virages de la traînée de l'onde : au plus ce nombre de points gardés, et son épaisseur (cases). */
const MAX_POINTS_TRAINEE = 24;
const EPAISSEUR_TRAINEE = 0.15;
const DT_PAS = 1 / 120;

/** L'angle (radians) d'une trajectoire de vitesse horizontale `vx` et verticale `vyUp` (cases/s). */
export const angleDeTrajectoire = (vx: number, vyUp: number): number => Math.atan2(vyUp, Math.max(1, vx));
/** La hauteur du ressort (cases) pour une compression de −0,4 (détendu) à 1 (écrasé). */
export const hauteurDuRessort = (compression: number): number => HAUTEUR_RESSORT * (1 - 0.6 * Math.min(1, Math.max(-0.4, compression)));

export class Heros {
  readonly groupe = new Group();
  private readonly flip = new Group();
  private readonly corps = new Group();
  private readonly pans: Group[] = [];
  private readonly aura = new Group();
  private readonly anneau: Mesh;
  private readonly cercleAimant: Mesh;
  private readonly perso;
  private readonly geometries: BufferGeometry[] = [];
  private readonly materiaux: MeshBasicMaterial[] = [];
  private look: Look = restLook();
  // Lot GR6 : les modes. `poids` : la part de chaque mode (0 à 1, indice = `MODE_*`) qui s'installe doucement ; `incl` : le groupe qui penche le héros ; `angle` : son inclinaison affichée.
  private readonly incl = new Group();
  private readonly avion = new Group();
  private readonly ressort = new Group();
  private readonly filRessort: Mesh;
  private readonly poids = [1, 0, 0, 0];
  private angle = 0;
  /** Le ressort : compression (−0,4 à 1) et sa vitesse, avancés à chaque pas. */
  private compression = 0;
  private vitesseCompression = 0;
  /** La traînée d'encre de l'onde (monde, cases) : les virages (changements de sens vertical) de l'onde en cours ; `enOnde` : le dernier bout suit le héros. */
  readonly traine: Mesh;
  private readonly trainePos = new Float32Array(MAX_POINTS_TRAINEE * 12);
  private readonly trainePoints: { x: number; y: number }[] = [];
  private enOnde = false;
  private signeVy = 0;
  private teteX = 0;
  private teteY = 0;
  /** −1 à 1 : le retournement affiché (le corps passe par une tranche mince, puis se retrouve la tête en bas). */
  private retournement = 1;

  constructor(c: CouleursGravity) {
    const mat = (m: MeshBasicMaterial): MeshBasicMaterial => {
      this.materiaux.push(m);
      return m;
    };
    const geo = (a: Parameters<typeof artGeometry>[0]): BufferGeometry => {
      const g = artGeometry(a);
      this.geometries.push(g);
      return g;
    };
    const opaque = mat(new MeshBasicMaterial({ vertexColors: true, side: DoubleSide }));
    this.perso = creerPersonnage({ couleur: c.jaune, largeur: TAILLE_HEROS, hauteur: TAILLE_HEROS });
    this.corps.add(this.perso.groupe);
    // le bandeau (lot GR5 : l'accroche d'accessoire du personnage, `accessoire`, origine = bas-milieu de la boîte) : le ruban sur le corps, les deux pans qui flottent derrière (chacun pivote autour de son attache). Il suit
    // l'écrasement, le rebond, le penché, la respiration et le retournement du personnage : le jeu n'a plus d'écrasement propre.
    const ruban = new Mesh(geo(dessinRuban(c.encre)), opaque);
    this.perso.accessoire.add(ruban);
    for (const haut of [true, false]) {
      const pivot = new Group();
      pivot.position.set(BANDEAU.attacheX, BANDEAU.attacheY, 0);
      pivot.add(new Mesh(geo(dessinPan(c.encre, haut)), opaque));
      this.perso.accessoire.add(pivot);
      this.pans.push(pivot);
    }
    this.corps.position.y = -TAILLE_HEROS / 2;
    // l'avion en papier (derrière et devant le bas du cube) et le ressort (sous lui) : cachés tant que leur mode n'est pas là
    const papier = dessinAvion(c.encre, c.papier);
    const arriere = new Mesh(geo(papier.arriere), opaque);
    const avant = new Mesh(geo(papier.avant), opaque);
    this.avion.add(arriere, avant);
    this.avion.visible = false;
    const r = dessinRessort(c.encre, c.papier);
    this.filRessort = new Mesh(geo(r.fil), opaque);
    this.ressort.add(this.filRessort, new Mesh(geo(r.plaque), opaque));
    this.ressort.position.y = -TAILLE_HEROS / 2;
    this.ressort.visible = false;
    this.flip.add(this.corps, this.avion, this.ressort);
    this.incl.add(this.flip);
    // la traînée de l'onde : un tampon mis à jour à chaque image, dans le monde (la scène l'ajoute à part, `traine`)
    const idx: number[] = [];
    for (let i = 0; i < MAX_POINTS_TRAINEE; i++) idx.push(i * 4, i * 4 + 1, i * 4 + 2, i * 4, i * 4 + 2, i * 4 + 3);
    const geoTraine = new BufferGeometry();
    geoTraine.setIndex(idx);
    geoTraine.setAttribute("position", new Float32BufferAttribute(this.trainePos, 3).setUsage(35048));
    geoTraine.setAttribute("color", new Float32BufferAttribute(new Float32Array(MAX_POINTS_TRAINEE * 12).fill(0), 3));
    const colTraine = geoTraine.getAttribute("color") as Float32BufferAttribute;
    const lin = (v: number): number => (v <= 0.04045 ? v / 12.92 : ((v + 0.055) / 1.055) ** 2.4);
    for (let i = 0; i < MAX_POINTS_TRAINEE * 4; i++) colTraine.setXYZ(i, lin(((c.encre >> 16) & 255) / 255), lin(((c.encre >> 8) & 255) / 255), lin((c.encre & 255) / 255));
    geoTraine.setDrawRange(0, 0);
    this.geometries.push(geoTraine);
    this.traine = new Mesh(geoTraine, opaque);
    this.traine.frustumCulled = false;
    this.traine.position.z = 0.15;
    // l'aura du bouclier : un anneau Diamant et un voile ; le cercle en tirets de l'aimant
    this.anneau = new Mesh(geo(dessinAnneau(c.diamant)), opaque);
    this.aura.add(this.anneau, new Mesh(geo(dessinDisque(c.diamant)), mat(new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, side: DoubleSide, depthWrite: false }))));
    this.cercleAimant = new Mesh(geo(dessinTirets(c.papier, RAYON_AIMANT)), mat(new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, side: DoubleSide, depthWrite: false })));
    this.groupe.add(this.cercleAimant, this.incl, this.aura);
    this.groupe.position.z = 0.2;
  }

  /**
   * Le héros court : la distance parcourue au sol règle les pieds (un pas de simulation). Lot GR6 : le même pas avance le ressort (oscillateur amorti), garde la traînée de l'onde et note le mode ; `(cx, cy)` : le centre de la
   * boîte (cases, y vers le haut), `vyUp` : sa vitesse verticale vers le haut.
   */
  avancerPas(dx: number, sol: boolean, mode = 0, cx = 0, cy = 0, vyUp = 0): void {
    if (sol) this.look = { ...this.look, stride: this.look.stride + dx };
    // le ressort : détendu en l'air, au repos au sol ; le bond et l'atterrissage le compriment (`bondir`, `atterrir`)
    const cible = sol ? 0 : -0.2;
    this.vitesseCompression += (-RESSORT_K * (this.compression - cible) - RESSORT_AMORTI * this.vitesseCompression) * DT_PAS;
    this.compression = Math.min(1, Math.max(-0.4, this.compression + this.vitesseCompression * DT_PAS));
    // la traînée d'encre de l'onde : un point à chaque changement de sens vertical (montée, plat, descente), et la tête suit le héros
    if (mode === MODE_ONDE) {
      const signe = Math.sign(vyUp);
      if (!this.enOnde) {
        this.enOnde = true;
        this.trainePoints.length = 0;
        this.trainePoints.push({ x: cx, y: cy });
      } else if (signe !== this.signeVy) this.trainePoints.push({ x: cx, y: cy });
      this.signeVy = signe;
    } else if (this.enOnde) {
      this.enOnde = false;
      this.trainePoints.push({ x: cx, y: cy }); // la dernière arête : l'encre reste dans le monde et s'éloigne
    }
    this.teteX = cx;
    this.teteY = cy;
    // les points sortis de l'écran par la gauche s'en vont (et jamais plus que le tampon)
    while (this.trainePoints.length > 2 && (this.trainePoints[1]!.x < cx - 18 || this.trainePoints.length > MAX_POINTS_TRAINEE - 2)) this.trainePoints.shift();
    if (this.trainePoints.length === 2 && !this.enOnde && this.trainePoints[1]!.x < cx - 18) this.trainePoints.length = 0;
  }
  /** Il atterrit : le corps s'écrase (le ressort de `@cdj/visuels` le ramène) ; il repart (une inversion) : le corps s'étire. Le ressort, lui, se comprime. */
  atterrir(force = 0.42): void {
    this.look = { ...this.look, squash: force, squashVel: 0 };
    this.compression = COMPRESSION_ATTERRISSAGE;
    this.vitesseCompression = 0;
  }
  /** Le bond du ressort : il est comprimé et se détend d'un coup. */
  bondir(): void {
    this.compression = COMPRESSION_BOND;
    this.vitesseCompression = -36;
    this.look = { ...this.look, squash: LOOK.takeoff * 0.9, squashVel: 0 };
  }
  repartir(): void {
    this.look = { ...this.look, squash: LOOK.takeoff * 0.8, squashVel: 0 };
  }

  poser(p: PoseHeros): void {
    this.groupe.visible = !p.mort;
    this.traine.visible = this.traine.visible && !p.mort;
    if (p.mort) return;
    this.groupe.position.x = p.x;
    this.groupe.position.y = p.y;
    // le retournement : vers la gravité, en quelques images ; en pause (`dt` nul) il reste où il est
    if (p.dt > 0) this.retournement += (p.g - this.retournement) * (1 - Math.exp(-34 * p.dt));
    if (Math.abs(p.g - this.retournement) < 0.02) this.retournement = p.g;
    this.flip.scale.y = Math.abs(this.retournement) < 0.06 ? 0.06 * (this.retournement < 0 ? -1 : 1) : this.retournement;
    // le mouvement vu du héros : « vers le haut » est à l'opposé de la gravité
    const dt = Math.min(0.05, p.dt);
    this.look = animateLook(this.look, dt, { vx: p.vx, vyUp: -p.chute, ground: p.sol, slide: 0, runSpeed: 12.5, fallSpeed: 17 }, p.reduit ? 0 : 1);
    // l'écrasement est celui du personnage (`squashAmount` : moitié avec « réduire les animations »), que le bandeau suit par l'accroche d'accessoire
    this.perso.poser({ look: this.look, squashAmount: p.reduit ? 0.5 : 1, blink: p.tick % 420 < 12 ? 1 : 0 });
    // les pans : ils flottent derrière, et se couchent à la course
    const k = p.reduit ? 0 : 1;
    this.pans.forEach((pan, i) => {
      pan.rotation.z = (i === 0 ? 0.25 : -0.2) + Math.sin(p.temps * 17 + i * 1.7) * 0.32 * k + (p.sol ? 0 : 0.18);
    });
    this.poserLesModes(p, dt);
    // l'invulnérabilité fait clignoter le héros (et son aura)
    const clignote = p.invuln > 0 && Math.floor(p.tick / 6) % 2 === 1;
    this.flip.visible = !clignote;
    // l'aura : un bouclier plein tant qu'il tient ; une fois crevé, l'anneau gonfle et s'éteint pendant l'invulnérabilité
    this.aura.visible = p.bouclier || p.invuln > 0;
    const crevaison = p.bouclier ? 0 : 1 - p.invuln / 96;
    const pulsation = p.reduit ? 1 : 1 + Math.sin(p.temps * 7) * 0.035;
    const echelle = (p.bouclier ? 1 : 1 + crevaison * 0.7) * pulsation;
    this.aura.scale.set(echelle, echelle, 1);
    this.aura.visible = this.aura.visible && (p.bouclier || Math.floor(p.tick / 4) % 2 === 0);
    // l'aimant : un cercle en tirets qui tourne ; il clignote dans la dernière seconde
    this.cercleAimant.visible = p.aimant > 0 && (p.aimant > 120 || Math.floor(p.tick / 8) % 2 === 0);
    this.cercleAimant.rotation.z = p.reduit ? 0 : p.temps * 0.35;
  }

  /**
   * Les modes de vol (lot GR6) : chacun s'installe et s'efface doucement (`poids`). **Avion** : le cube est assis dans un avion en papier plié qui s'incline avec la montée ; **onde** : le cube, plus petit, est penché à 45°
   * (dans le sens de sa trajectoire) et laisse une traînée d'encre en zigzag ; **ressort** : le cube est sur un ressort qui se comprime à chaque bond et à l'atterrissage, se détend en l'air. Ne lit que l'état de la simulation.
   */
  private poserLesModes(p: PoseHeros, dt: number): void {
    for (let m = 0; m < 4; m++) this.poids[m] = lisser(this.poids[m]!, p.mode === m ? 1 : 0, dt, TAUX_MODE);
    const pa = this.poids[MODE_AVION]!;
    const po = this.poids[MODE_ONDE]!;
    const pr = this.poids[MODE_RESSORT]!;
    // l'inclinaison : celle de la trajectoire (avion : adoucie), lissée ; rien avec « réduire les animations » pour l'avion, l'onde garde son 45° (c'est son dessin, pas un mouvement)
    const trajectoire = angleDeTrajectoire(p.vx, p.vyUp);
    const voulu = p.mode === MODE_ONDE ? trajectoire : p.mode === MODE_AVION ? (p.reduit ? 0 : trajectoire * PART_INCLINAISON_AVION) : 0;
    this.angle = lisser(this.angle, voulu, dt, TAUX_INCLINAISON);
    this.incl.rotation.z = this.angle;
    // le cube : plus petit et plus haut ou plus bas selon le mode ; le ressort lui donne sa hauteur
    const haut = hauteurDuRessort(this.compression);
    const echelle = 1 - 0.3 * pa - 0.28 * po - 0.2 * pr;
    this.corps.scale.setScalar(echelle);
    this.corps.position.y = -TAILLE_HEROS / 2 + 0.14 * pa + 0.112 * po + haut * pr;
    this.avion.visible = pa > 0.02;
    this.avion.scale.setScalar(Math.max(0.01, pa));
    this.ressort.visible = pr > 0.02;
    this.ressort.scale.set(Math.max(0.01, pr), Math.max(0.01, pr), 1);
    this.filRessort.scale.y = Math.max(0.01, haut);
    // la traînée de l'onde : les virages, puis la tête (le héros, interpolé)
    const pts = this.trainePoints.slice();
    if (this.enOnde) pts.push({ x: p.x, y: p.y });
    let n = 0;
    for (let i = 0; i + 1 < pts.length && n < MAX_POINTS_TRAINEE; i++) {
      segmentDeTrainee(this.trainePos, n * 12, pts[i]!.x, pts[i]!.y, pts[i + 1]!.x, pts[i + 1]!.y, EPAISSEUR_TRAINEE);
      n++;
    }
    const geo = this.traine.geometry;
    (geo.getAttribute("position") as Float32BufferAttribute).needsUpdate = true;
    geo.setDrawRange(0, n * 6);
    this.traine.visible = n > 0;
  }

  detruire(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materiaux) m.dispose();
    this.groupe.clear();
  }
}
