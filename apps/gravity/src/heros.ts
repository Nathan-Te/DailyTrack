// Le héros de Gravity (lot GR3) : le cube jaune de Jump (`creerPersonnage` de `@cdj/visuels/plateformes/three` : corps, yeux, pieds, courses et chutes animés par `animateLook`) **avec son bandeau d'encre** aux deux pans qui flottent
// (propre à Gravity). Il **se retourne avec la gravité** (le corps pivote autour du centre de sa boîte) et **s'écrase à l'atterrissage** (le ressort de `@cdj/visuels`). Autour de lui : l'aura du bouclier et le cercle de l'aimant.
// **Ce fichier ne lit que des nombres de la simulation** (position, gravité, bouclier…) ; rien du jeu n'y est décidé.
import { BufferGeometry, DoubleSide, Group, Mesh, MeshBasicMaterial } from "three";
import { LOOK, animateLook, restLook, squashScale, type Look } from "@cdj/visuels/plateformes";
import { artGeometry, creerPersonnage } from "@cdj/visuels/plateformes/three";
import type { CouleursGravity } from "./couleurs";
import { BANDEAU, dessinAnneau, dessinDisque, dessinPan, dessinRuban, dessinTirets } from "./dessins";

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
}

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
    // le bandeau : le ruban sur le corps, les deux pans qui flottent derrière (chacun pivote autour de son attache)
    const ruban = new Mesh(geo(dessinRuban(c.encre)), opaque);
    this.corps.add(ruban);
    for (const haut of [true, false]) {
      const pivot = new Group();
      pivot.position.set(BANDEAU.attacheX, BANDEAU.attacheY, 0);
      pivot.add(new Mesh(geo(dessinPan(c.encre, haut)), opaque));
      this.corps.add(pivot);
      this.pans.push(pivot);
    }
    this.corps.position.y = -TAILLE_HEROS / 2;
    this.flip.add(this.corps);
    // l'aura du bouclier : un anneau Diamant et un voile ; le cercle en tirets de l'aimant
    this.anneau = new Mesh(geo(dessinAnneau(c.diamant)), opaque);
    this.aura.add(this.anneau, new Mesh(geo(dessinDisque(c.diamant)), mat(new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, side: DoubleSide, depthWrite: false }))));
    this.cercleAimant = new Mesh(geo(dessinTirets(c.papier, RAYON_AIMANT)), mat(new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.32, side: DoubleSide, depthWrite: false })));
    this.groupe.add(this.cercleAimant, this.flip, this.aura);
    this.groupe.position.z = 0.2;
  }

  /** Le héros court : la distance parcourue au sol règle les pieds (un pas de simulation). */
  avancerPas(dx: number, sol: boolean): void {
    if (sol) this.look = { ...this.look, stride: this.look.stride + dx };
  }
  /** Il atterrit : le corps s'écrase (le ressort de `@cdj/visuels` le ramène) ; il repart (une inversion) : le corps s'étire. */
  atterrir(force = 0.42): void {
    this.look = { ...this.look, squash: force, squashVel: 0 };
  }
  repartir(): void {
    this.look = { ...this.look, squash: LOOK.takeoff * 0.8, squashVel: 0 };
  }

  poser(p: PoseHeros): void {
    this.groupe.visible = !p.mort;
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
    // l'écrasement est appliqué au corps entier (le bandeau avec lui) ; le personnage ne reçoit pas le sien
    const { sx, sy } = squashScale(this.look.squash, p.reduit ? 0.5 : 1);
    this.corps.scale.set(sx, sy, 1);
    this.perso.poser({ look: { ...this.look, squash: 0 }, blink: p.tick % 420 < 12 ? 1 : 0 });
    // les pans : ils flottent derrière, et se couchent à la course
    const k = p.reduit ? 0 : 1;
    this.pans.forEach((pan, i) => {
      pan.rotation.z = (i === 0 ? 0.25 : -0.2) + Math.sin(p.temps * 17 + i * 1.7) * 0.32 * k + (p.sol ? 0 : 0.18);
    });
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

  detruire(): void {
    for (const g of this.geometries) g.dispose();
    for (const m of this.materiaux) m.dispose();
    this.groupe.clear();
  }
}
