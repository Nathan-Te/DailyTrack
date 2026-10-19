import {
  CircleGeometry,
  Color,
  DynamicDrawUsage,
  EqualStencilFunc,
  Group,
  InstancedBufferAttribute,
  InstancedMesh,
  KeepStencilOp,
  Matrix4,
  Mesh,
  MeshBasicMaterial,
  PlaneGeometry,
  RingGeometry,
  CanvasTexture,
  LinearFilter,
  type Object3D,
} from "three";
import { PLAYER_HEIGHT, PLAYER_WIDTH, UNITS_PER_TILE } from "@cdj/jump-sim";
import { STAIN_DISCS, type StainDisc } from "./stains";

// Ce que le lot 3 ajoute à la scène, **affichage seulement** (on lit des positions, on n'écrit rien dans la simulation) :
//   - le fantôme (un carré translucide, et un anneau qui s'ouvre là où il meurt) ;
//   - la foule du carnage (un seul `InstancedMesh` : un carré par vie) ;
//   - les taches de peinture (un seul `InstancedMesh` de disques, découpés au pochoir par les blocs pleins : la peinture ne déborde jamais
//     dans le vide). Au-delà de `MAX_STAINS` taches, les plus anciennes s'estompent (elles se fondent dans la couleur des blocs, puis partent).
// Rien n'est créé pendant le jeu : capacités fixées à la construction, objets recyclés.

const T = UNITS_PER_TILE;
const PW = PLAYER_WIDTH / T;
const PH = PLAYER_HEIGHT / T;

/** Taches affichées au plus (les plus anciennes s'estompent au-delà). */
export const MAX_STAINS = 300;
/** Durée de l'estompe d'une tache qui sort (s). */
export const STAIN_FADE = 1.6;
/** Repère du pochoir écrit par les blocs pleins (`scene.ts`). */
export const SOLID_STENCIL = 1;

/** Lot P2 : hauteur de l'étiquette du fantôme du premier (tuiles) et son écart au-dessus du fantôme. Discrète : moins d'une demi-tuile. */
export const GHOST_LABEL_HEIGHT = 0.42;
const GHOST_LABEL_GAP = 0.3;

export class GhostMesh {
  readonly group = new Group();
  private readonly body: Mesh;
  private readonly ring: Mesh;
  private readonly ringMat: MeshBasicMaterial;
  /** Lot P2 : l'étiquette (pseudo) au-dessus du fantôme du premier, dessinée une fois dans une texture (rien n'est créé en jeu). */
  private label: Mesh | null = null;

  constructor(parent: Object3D, color: number) {
    this.body = new Mesh(new PlaneGeometry(PW, PH), new MeshBasicMaterial({ color, transparent: true, opacity: 0.38, depthWrite: false }));
    this.body.position.z = 0.18;
    this.ringMat = new MeshBasicMaterial({ color, transparent: true, opacity: 0.6, depthWrite: false });
    this.ring = new Mesh(new RingGeometry(0.42, 0.55, 28), this.ringMat);
    this.ring.position.z = 0.18;
    this.group.add(this.body, this.ring);
    this.group.visible = false;
    parent.add(this.group);
  }

  /**
   * Pose du fantôme : coin haut-gauche (tuiles, y vers le bas) s'il est vivant ; sinon l'anneau à l'endroit de sa mort, qui s'ouvre et
   * s'efface pendant l'attente (`dying` de 0 à 1).
   */
  set(pose: { x: number; y: number } | null, death: { x: number; y: number; dying: number } | null): void {
    this.group.visible = !!pose || !!death;
    this.body.visible = !!pose;
    if (pose) this.body.position.set(pose.x + PW / 2, -(pose.y + PH / 2), 0.18);
    if (this.label) {
      this.label.visible = !!pose;
      if (pose) this.label.position.set(pose.x + PW / 2, -pose.y + GHOST_LABEL_GAP + GHOST_LABEL_HEIGHT / 2, 0.19);
    }
    this.ring.visible = !!death;
    if (death) {
      this.ring.position.set(death.x, -death.y, 0.18);
      const s = 0.6 + death.dying * 1.4;
      this.ring.scale.set(s, s, 1);
      this.ringMat.opacity = 0.6 * (1 - death.dying);
    }
  }

  hide(): void {
    this.group.visible = false;
  }

  /**
   * Lot P2 : le texte au-dessus du fantôme (le pseudo du premier), ou `null` pour l'enlever. Dessiné une fois dans une texture (`canvas`), à la
   * couleur du fantôme, cerné de sombre pour se lire sur tous les ciels. Rien à faire sans document (tests sous Node).
   */
  setLabel(text: string | null, color: number): void {
    if (this.label) {
      this.group.remove(this.label);
      (this.label.material as MeshBasicMaterial).map?.dispose();
      (this.label.material as MeshBasicMaterial).dispose();
      this.label.geometry.dispose();
      this.label = null;
    }
    if (!text || typeof document === "undefined") return;
    const canvas = document.createElement("canvas");
    const ctx = canvas.getContext("2d");
    if (!ctx) return;
    const px = 48;
    const font = `600 ${px}px system-ui, sans-serif`;
    ctx.font = font;
    const width = Math.ceil(ctx.measureText(text).width) + 16;
    canvas.width = width;
    canvas.height = Math.round(px * 1.35);
    ctx.font = font;
    ctx.textAlign = "center";
    ctx.textBaseline = "middle";
    ctx.lineJoin = "round";
    ctx.lineWidth = 8;
    ctx.strokeStyle = "rgba(6, 4, 14, 0.85)";
    ctx.strokeText(text, width / 2, canvas.height / 2);
    ctx.fillStyle = `#${color.toString(16).padStart(6, "0")}`;
    ctx.fillText(text, width / 2, canvas.height / 2);
    const map = new CanvasTexture(canvas);
    map.minFilter = LinearFilter;
    const h = GHOST_LABEL_HEIGHT;
    const mesh = new Mesh(new PlaneGeometry((h * canvas.width) / canvas.height, h), new MeshBasicMaterial({ map, transparent: true, opacity: 0.8, depthWrite: false }));
    mesh.visible = false;
    this.label = mesh;
    this.group.add(mesh);
  }

  /** Lot P2 : l'étiquette est-elle posée (tests : `__jump.ghosts`) ? */
  get labelled(): boolean {
    return this.label !== null;
  }
}

/** La foule du carnage : un carré translucide par vie. */
export class CrowdMesh {
  readonly mesh: InstancedMesh;
  private readonly m = new Matrix4();
  private readonly hidden = new Matrix4().makeScale(0, 0, 0);

  constructor(
    parent: Object3D,
    color: number,
    readonly capacity: number,
  ) {
    this.mesh = new InstancedMesh(new PlaneGeometry(PW, PH), new MeshBasicMaterial({ color, transparent: true, opacity: 0.55, depthWrite: false }), Math.max(1, capacity));
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.position.z = 0.17;
    for (let i = 0; i < this.mesh.count; i++) this.mesh.setMatrixAt(i, this.hidden);
    this.mesh.visible = false;
    parent.add(this.mesh);
  }

  /** Coin haut-gauche (tuiles, y vers le bas), ou null : cachée. */
  set(i: number, x: number | null, y = 0): void {
    if (i >= this.capacity) return;
    if (x === null) this.mesh.setMatrixAt(i, this.hidden);
    else this.mesh.setMatrixAt(i, this.m.makeTranslation(x + PW / 2, -(y + PH / 2), 0));
  }

  commit(): void {
    this.mesh.instanceMatrix.needsUpdate = true;
  }

  show(on: boolean): void {
    this.mesh.visible = on;
  }

  dispose(parent: Object3D): void {
    parent.remove(this.mesh);
    this.mesh.geometry.dispose();
    (this.mesh.material as MeshBasicMaterial).dispose();
    this.mesh.dispose();
  }
}

interface LiveStain {
  discs: StainDisc[];
  /** Première case de l'instance. */
  slot: number;
  /** 1 = pleine ; décroît vers 0 pendant l'estompe. */
  life: number;
  fading: boolean;
}

/**
 * Les taches : disques instanciés, découpés par le pochoir des blocs pleins. Chaque tache a `STAIN_DISCS` cases réservées (cases libres
 * recyclées) ; au-delà de `MAX_STAINS`, la plus ancienne s'estompe vers la couleur des blocs pendant `STAIN_FADE` s, puis libère ses cases.
 */
export class StainLayer {
  readonly mesh: InstancedMesh;
  private readonly stains: LiveStain[] = [];
  private readonly free: number[] = [];
  private readonly m = new Matrix4();
  private readonly hidden = new Matrix4().makeScale(0, 0, 0);
  private readonly paint: Color;
  private readonly tile: Color;
  private readonly c = new Color();
  private dirty = true;
  /** Taches posées depuis le départ (contrôle). */
  added = 0;

  constructor(parent: Object3D, paint: number, tile: number) {
    const slots = (MAX_STAINS + 40) * STAIN_DISCS;
    const material = new MeshBasicMaterial({ color: 0xffffff });
    // Pochoir : seulement là où un bloc plein a écrit `SOLID_STENCIL`.
    material.stencilWrite = true;
    material.stencilRef = SOLID_STENCIL;
    material.stencilFunc = EqualStencilFunc;
    material.stencilFail = KeepStencilOp;
    material.stencilZFail = KeepStencilOp;
    material.stencilZPass = KeepStencilOp;
    this.mesh = new InstancedMesh(new CircleGeometry(1, 20), material, slots);
    this.mesh.instanceMatrix.setUsage(DynamicDrawUsage);
    this.mesh.instanceColor = new InstancedBufferAttribute(new Float32Array(slots * 3), 3);
    this.mesh.instanceColor.setUsage(DynamicDrawUsage);
    this.mesh.frustumCulled = false;
    this.mesh.renderOrder = 1;
    this.mesh.position.z = 0.01;
    for (let i = 0; i < slots; i++) this.mesh.setMatrixAt(i, this.hidden);
    for (let s = slots - STAIN_DISCS; s >= 0; s -= STAIN_DISCS) this.free.push(s);
    this.paint = new Color(paint);
    this.tile = new Color(tile);
    parent.add(this.mesh);
  }

  /** Taches pleines à l'écran (sans celles qui s'estompent). */
  get count(): number {
    return this.stains.filter((s) => !s.fading).length;
  }

  /** Disques visibles (contrôle). */
  get discs(): number {
    return this.stains.reduce((n, s) => n + s.discs.length, 0);
  }

  /** Pose une tache. La plus ancienne s'estompe si l'on dépasse `MAX_STAINS`. */
  add(discs: StainDisc[], instant = false): void {
    if (discs.length === 0) return;
    let slot = this.free.pop();
    if (slot === undefined) {
      // Plus de cases : la plus ancienne (même en cours d'estompe) part tout de suite.
      const oldest = this.stains.shift()!;
      this.release(oldest);
      slot = this.free.pop()!;
    }
    this.stains.push({ discs, slot, life: 1, fading: false });
    this.added++;
    let full = this.stains.filter((s) => !s.fading).length;
    for (const s of this.stains) {
      if (full <= MAX_STAINS) break;
      if (s.fading) continue;
      s.fading = true;
      full--;
      if (instant) s.life = 0;
    }
    this.dirty = true;
  }

  /** Remplace toutes les taches (chargement, début et fin du carnage). */
  reset(list: StainDisc[][]): void {
    for (const s of this.stains) this.release(s);
    this.stains.length = 0;
    for (const d of list) this.add(d, true);
    this.update(0);
  }

  private release(s: LiveStain): void {
    for (let k = 0; k < STAIN_DISCS; k++) this.mesh.setMatrixAt(s.slot + k, this.hidden);
    this.free.push(s.slot);
    this.dirty = true;
  }

  /** Avance l'estompe ; met à jour les instances si quelque chose a changé. */
  update(dt: number): void {
    for (let i = this.stains.length - 1; i >= 0; i--) {
      const s = this.stains[i]!;
      if (!s.fading) continue;
      s.life -= dt / STAIN_FADE;
      this.dirty = true;
      if (s.life <= 0) {
        this.release(s);
        this.stains.splice(i, 1);
      }
    }
    if (!this.dirty) return;
    this.dirty = false;
    for (const s of this.stains) {
      const k = Math.max(0, Math.min(1, s.life));
      for (let j = 0; j < STAIN_DISCS; j++) {
        const d = s.discs[j];
        if (!d) {
          this.mesh.setMatrixAt(s.slot + j, this.hidden);
          continue;
        }
        const r = d.r * (0.6 + 0.4 * k);
        this.m.makeScale(r, r, 1);
        this.m.setPosition(d.x, -d.y, 0);
        this.mesh.setMatrixAt(s.slot + j, this.m);
        // Nuance par disque, puis fondu vers la couleur des blocs quand la tache s'estompe.
        this.c.copy(this.paint).offsetHSL(0, 0, d.shade * 0.06).lerp(this.tile, 1 - k);
        this.mesh.setColorAt(s.slot + j, this.c);
      }
    }
    this.mesh.instanceMatrix.needsUpdate = true;
    if (this.mesh.instanceColor) this.mesh.instanceColor.needsUpdate = true;
  }

  set visible(on: boolean) {
    this.mesh.visible = on;
  }
}
