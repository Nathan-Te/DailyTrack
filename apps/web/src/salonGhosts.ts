import { CanvasTexture, Group, Sprite, SpriteMaterial, SRGBColorSpace } from "three";
import { DEFAULT_CAR_PARAMS, ReplayPlayer, SIM_VERSION, copyCar, createCar, createRace, decodeReplay, forwardSpeed, stepRace, steerLimit, wrapAngle, type CarState, type RaceState, type Track } from "@cdj/sim";
import type { CarModel, WheelPose } from "./carMesh";
import { construireFantome } from "./voiture/modele";
import { PLAN_CIVILE } from "./voiture/modeleCivile";
import { fantomeDe, libererFantome } from "./voiture/fantomes";
import { CHOIX_DEFAUT, type ChoixVoiture } from "./voiture/choix";
import { CarPose } from "./carPose";
import { t } from "./i18n";
import { GHOST_COLORS, MAX_GHOSTS, MY_GHOST_COLOR, ghostShown, type SalonGhostMode } from "./salon";

// Fantômes du Salon (lot 26) : jusqu'à cinq autres joueurs plus ton meilleur tour de la session, chacun d'une couleur, translucide,
// son pseudo au-dessus. Chaque fantôme est une rediffusion rejouée par la même simulation que ta voiture (aucun écart possible), sans
// collision : ils ne gênent jamais la conduite. Présentation seule : rien ici ne touche à ta course.

export interface GhostEntry {
  /** Clé stable : `<ref>:<temps>` ; deux entrées de même clé sont le même tour. */
  key: string;
  /** Place au classement ; `null` pour ton propre tour. */
  rank: number | null;
  name: string;
  ms: number;
  replay: string;
  /** Lot 51 : la voiture de cette course (le modèle, en version simple, à la couleur de la place) ; absente : la Sparrow en orange. */
  voiture?: ChoixVoiture;
  /** Lot 55 : la place (donc la couleur) que prend ce fantôme ; absente : la première libre (le Salon). Au jour, la teinte suit l'ordre du choix, comme dans le classement. */
  slot?: number;
  /** Lot 55 : ses temps intermédiaires, pour l'écart au fantôme le plus proche. */
  splits?: number[];
}

interface Active {
  entry: GhostEntry;
  slot: number;
  race: RaceState;
  player: ReplayPlayer;
  previous: CarState;
  /** Pas écoulés depuis son arrivée sur la ligne (le fantôme disparaît peu après). */
  finishedTicks: number;
}

interface Slot {
  model: CarModel;
  /** Lot 51 : le modèle de voiture que porte cette place, celui qu'on lui a demandé, et la couleur de la place (le fantôme est d'une seule teinte). */
  carId: string;
  carVoulu: string;
  couleur: number;
  group: Group;
  pose: CarPose;
  label: Sprite;
  texture: CanvasTexture;
  canvas: HTMLCanvasElement;
  wheel: WheelPose;
  shown: string;
  /** Trop près de la caméra capot : cachée (mise à jour à chaque image). */
  near: boolean;
}

/** Hauteur de l'étiquette à l'écran (pixels CSS ; le texte en occupe la moitié), et distances (m) hors desquelles elle est masquée. */
const LABEL_PX = 30;
const LABEL_NEAR = 9;
const LABEL_FAR = 160;
const HIDE_AFTER_FINISH_TICKS = 240; // 2 s sur la ligne, puis il s'efface

const css = (hex: number) => `#${hex.toString(16).padStart(6, "0")}`;

function makeSlot(color: number, group: Group): Slot {
  // La version simple de la civile (retouche 40b : un maillage, ≈ 400 triangles, translucide, sans livrée, teinte unie, liseré lumineux) : cinq
  // voitures de plus ne doivent pas coûter cinq fois la voiture du joueur. Lot 51 : la place prend le modèle de la voiture de la course qu'elle montre (`poserVoiture`) ;
  // la civile est là tout de suite, les autres modèles se chargent à la demande.
  const model = construireFantome(PLAN_CIVILE, color);
  model.group.visible = false;
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const label = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: false }));
  label.scale.set(8, 2, 1);
  label.position.set(0, 2.5, 0);
  label.visible = false;
  label.renderOrder = 5;
  model.group.add(label);
  return { model, carId: CHOIX_DEFAUT.id, carVoulu: CHOIX_DEFAUT.id, couleur: color, group, pose: new CarPose(), label, texture, canvas, wheel: { forward: 0, steerAngle: 0, braking: false, droop: [0, 0, 0, 0], dt: 0 }, shown: "", near: false };
}

/** Dessine le pseudo (et le rang) sur l'étiquette d'un fantôme. */
function paintLabel(s: Pick<Slot, "canvas" | "texture" | "shown">, text: string, color: number) {
  if (s.shown === text) return;
  s.shown = text;
  const g = s.canvas.getContext("2d");
  if (!g) return;
  g.clearRect(0, 0, 256, 64);
  g.font = "700 30px system-ui, sans-serif";
  g.textAlign = "center";
  g.textBaseline = "middle";
  g.lineJoin = "round";
  g.lineWidth = 7;
  g.strokeStyle = "rgba(8,12,26,.85)";
  g.strokeText(text, 128, 34);
  g.fillStyle = "#fff";
  g.fillText(text, 128, 34);
  g.fillStyle = css(color);
  g.fillRect(40, 56, 176, 5);
  s.texture.needsUpdate = true;
}

/**
 * Étiquette au pseudo d'une voiture regardée en rediffusion (mode spectateur, lot 27b) : le même dessin que celle des fantômes du Salon.
 * `place` règle sa taille pour qu'elle garde à peu près la même hauteur à l'écran, et la masque tout près de la caméra.
 */
export interface NameLabel {
  sprite: Sprite;
  set(text: string, color: number): void;
  place(dist: number, pixelAtOneMeter: number, near?: number): void;
}

export function createNameLabel(): NameLabel {
  const canvas = document.createElement("canvas");
  canvas.width = 256;
  canvas.height = 64;
  const texture = new CanvasTexture(canvas);
  texture.colorSpace = SRGBColorSpace;
  const sprite = new Sprite(new SpriteMaterial({ map: texture, transparent: true, depthWrite: false, fog: false }));
  sprite.scale.set(8, 2, 1);
  sprite.position.set(0, 2.5, 0);
  sprite.renderOrder = 5;
  const state = { canvas, texture, shown: "" };
  return {
    sprite,
    set: (text, color) => paintLabel(state, text, color),
    place(dist, pixelAtOneMeter, near = LABEL_NEAR) {
      const h = LABEL_PX * pixelAtOneMeter * dist * 2;
      sprite.visible = dist > near && dist < LABEL_FAR;
      sprite.scale.set(h * 4, h, 1);
      sprite.position.set(0, 2.2 + h * 0.3, 0);
    },
  };
}

export class GhostField {
  /** À ajouter à la scène du circuit. */
  readonly group = new Group();
  private readonly slots: Slot[];
  private active: Active[] = [];
  private pending: GhostEntry[] = [];
  private mode: SalonGhostMode = "all";
  /** Étiquettes et voitures dessinées à la dernière image (outil de test, mesures). */
  stats = { shown: 0, labels: 0, loaded: 0, rejected: 0, models: 0 };
  /** Coût mesuré sur le fil principal (ms cumulées) : simulation des fantômes (`step`) et placement des voitures et étiquettes (`place`). */
  readonly cost = { stepMs: 0, steps: 0, placeMs: 0, frames: 0 };

  constructor() {
    // Une voiture par place : cinq couleurs pour les autres joueurs, une teinte froide pour ton propre tour.
    this.slots = [...GHOST_COLORS.slice(0, MAX_GHOSTS), MY_GHOST_COLOR].map((c) => makeSlot(c, this.group));
    for (const s of this.slots) this.group.add(s.model.group);
    // (lot 51 : `poserVoiture` change le modèle d'une place sans changer le groupe)
  }

  get names(): string[] {
    return this.active.map((a) => a.entry.name);
  }

  get count(): number {
    return this.active.length;
  }

  setMode(mode: SalonGhostMode): void {
    this.mode = mode;
    this.applyVisibility();
  }

  /** Fantômes du **prochain** départ (la course en cours garde les siens). Ton propre tour (`rank === null`) occupe la dernière place. */
  setEntries(entries: GhostEntry[]): void {
    this.pending = entries;
  }

  /** Les entrées prêtes pour le prochain départ ont-elles changé depuis le dernier `restart` ? (clés différentes) */
  differsFromActive(): boolean {
    const a = this.active.map((x) => x.entry.key).sort().join("|");
    const p = this.pending.map((x) => x.key).sort().join("|");
    return a !== p;
  }

  /** Nouveau départ : chaque fantôme repart de la ligne avec ta course (`catchUpTicks` : pas déjà courus, si tu es parti avant leur arrivée). Rediffusions illisibles (autre version) : ignorées. */
  restart(track: Track, catchUpTicks = 0): void {
    this.active = [];
    this.stats.loaded = 0;
    this.stats.rejected = 0;
    let others = 0;
    for (const entry of this.pending) {
      if (entry.rank !== null && entry.slot === undefined && others >= MAX_GHOSTS) continue;
      const slot = entry.rank === null ? this.slots.length - 1 : (entry.slot ?? others);
      if (this.enroler(entry, slot, track, catchUpTicks) && entry.rank !== null) others++;
    }
    for (const s of this.slots) s.pose.reset();
    this.applyVisibility();
  }

  /**
   * Lot 55 : un fantôme de plus **en cours de course** (sa rediffusion est arrivée après le départ) : il rejoint la course à la place où il devrait être, sans toucher aux autres
   * (`catchUpTicks` : les pas déjà courus). Sans effet s'il est déjà là ou si sa place est prise.
   */
  ajouter(entry: GhostEntry, track: Track, catchUpTicks: number): boolean {
    const slot = entry.slot ?? this.slots.findIndex((_, i) => i < MAX_GHOSTS && !this.active.some((a) => a.slot === i));
    if (slot < 0 || slot >= MAX_GHOSTS || this.active.some((a) => a.entry.key === entry.key || a.slot === slot)) return false;
    const ok = this.enroler(entry, slot, track, catchUpTicks);
    if (ok) this.applyVisibility();
    return ok;
  }

  /** Les fantômes en course (clé, temps intermédiaires, pseudo) : l'écart au plus proche et les tests. */
  get entries(): readonly GhostEntry[] {
    return this.active.map((a) => a.entry);
  }

  private enroler(entry: GhostEntry, slot: number, track: Track, catchUpTicks: number): boolean {
    try {
      const replay = decodeReplay(entry.replay);
      if (replay.trackId !== track.id || replay.simVersion !== SIM_VERSION) throw new Error("autre circuit ou autre version");
      const race = createRace(track);
      const previous = createCar();
      const player = new ReplayPlayer(replay);
      // Arrivée tardive (le classement s'est chargé après le départ) : le fantôme rattrape la course du joueur, pas par pas, pour être à sa place.
      for (let t = 0; t < catchUpTicks && race.finishMs < 0; t++) {
        copyCar(race.car, previous);
        stepRace(race, player.next());
      }
      copyCar(race.car, previous);
      this.active.push({ entry, slot, race, player, previous, finishedTicks: 0 });
      this.poserVoiture(this.slots[slot]!, entry.voiture?.id ?? CHOIX_DEFAUT.id); // lot 51 : la voiture de sa course
      this.stats.loaded++;
      return true;
    } catch {
      this.stats.rejected++;
      return false;
    }
  }

  /**
   * Lot 51 : la place montre le modèle de cette voiture — chargé à la demande (un plan par modèle, gardé), construit en version simple à la couleur de la place, puis
   * posé à la place du précédent (position, visibilité et pseudo repris). Au plus six modèles à la fois (une place chacun) : autant d'appels de rendu qu'avant.
   */
  private poserVoiture(s: Slot, id: string): void {
    s.carVoulu = id;
    if (s.carId === id) return;
    void fantomeDe(id, s.couleur)
      .then((m) => {
        if (s.carVoulu !== id || s.carId === id) return libererFantome(m);
        const vieux = s.model;
        m.group.position.copy(vieux.group.position);
        m.group.rotation.copy(vieux.group.rotation);
        m.group.visible = vieux.group.visible;
        m.group.add(s.label);
        s.group.remove(vieux.group);
        s.group.add(m.group);
        libererFantome(vieux);
        s.model = m;
        s.carId = id;
        this.stats.models++;
      })
      .catch(() => undefined); // hors ligne : la place garde son modèle
  }

  /** Efface tout (changement de circuit). */
  clear(): void {
    this.active = [];
    this.pending = [];
    this.applyVisibility();
  }

  private applyVisibility(): void {
    const used = new Set<number>();
    for (const a of this.active) {
      const s = this.slots[a.slot]!;
      const visible = ghostShown(this.mode, a.entry.rank) && a.finishedTicks < HIDE_AFTER_FINISH_TICKS;
      s.model.group.visible = visible && !s.near;
      s.label.visible = visible;
      if (visible) used.add(a.slot);
    }
    this.slots.forEach((s, i) => {
      if (!used.has(i)) {
        s.model.group.visible = false;
        s.label.visible = false;
      }
    });
  }

  /** Un pas de simulation pour chaque fantôme (appelé avec chaque pas de ta course). */
  step(): void {
    if (this.active.length === 0) return;
    const t0 = performance.now();
    this.cost.steps++;
    for (const a of this.active) {
      copyCar(a.race.car, a.previous);
      stepRace(a.race, a.player.next());
      if (a.race.finishMs >= 0) a.finishedTicks++;
    }
    this.cost.stepMs += performance.now() - t0;
  }

  /**
   * Place les voitures et les étiquettes (`alpha` : fraction de pas pour l'interpolation, `dt` : secondes de l'image). `eye` : position de
   * la caméra et taille d'un pixel à un mètre (m) : les étiquettes gardent à peu près la même taille à l'écran, quelle que soit la distance.
   */
  place(alpha: number, dt: number, eye: { x: number; y: number; z: number; pixelAtOneMeter: number; clearance?: number }): void {
    const t0 = performance.now();
    let shown = 0;
    let hiddenNow = false;
    for (const a of this.active) {
      const s = this.slots[a.slot]!;
      const visible = ghostShown(this.mode, a.entry.rank) && a.finishedTicks < HIDE_AFTER_FINISH_TICKS;
      if (s.model.group.visible !== (visible && !s.near)) hiddenNow = true;
      if (!visible) continue;
      shown++;
      const c = a.race.car;
      const p = a.previous;
      s.model.group.position.set(p.x + (c.x - p.x) * alpha, p.y + (c.y - p.y) * alpha, p.z + (c.z - p.z) * alpha);
      s.pose.follow(c.nx, c.ny, c.nz, dt);
      s.pose.apply(s.model.group, p.pitch + (c.pitch - p.pitch) * alpha, p.yaw + wrapAngle(c.yaw - p.yaw) * alpha, p.roll + (c.roll - p.roll) * alpha);
      s.wheel.forward = forwardSpeed(c);
      s.wheel.steerAngle = -c.steer * steerLimit(s.wheel.forward, DEFAULT_CAR_PARAMS);
      s.wheel.dt = dt;
      s.model.update(s.wheel);
      // Étiquette : toujours à plat face à la caméra (un sprite), au-dessus de la caisse, sans suivre son roulis.
      paintLabel(s, a.entry.rank === null ? t("salon.tonTour") : `${a.entry.rank}. ${a.entry.name}`, a.entry.rank === null ? MY_GHOST_COLOR : GHOST_COLORS[a.slot]!);
      const g = s.model.group.position;
      const dist = Math.hypot(g.x - eye.x, g.y - eye.y, g.z - eye.z);
      // Hauteur de la ligne de texte : LABEL_PX pixels à l'écran ; masquée tout près (elle cacherait la voiture) et très loin (illisible).
      const h = LABEL_PX * eye.pixelAtOneMeter * dist * 2;
      s.label.visible = dist > LABEL_NEAR && dist < LABEL_FAR;
      // Vue capot : une voiture à moins de `clearance` de l'œil n'est pas dessinée (la caméra serait dans sa caisse).
      s.near = dist < (eye.clearance ?? 0);
      if (s.near) s.model.group.visible = false;
      s.label.scale.set(h * 4, h, 1);
      s.label.position.set(0, 2.2 + h * 0.3, 0);
    }
    if (hiddenNow) this.applyVisibility();
    this.stats.shown = shown;
    this.stats.labels = shown;
    this.cost.placeMs += performance.now() - t0;
    this.cost.frames++;
  }
}
