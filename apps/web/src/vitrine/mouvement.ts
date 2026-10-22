// Retouche 38b — la vue en mouvement : la voiture actuelle parcourt en boucle un bout du vrai circuit du jour d'un thème, conduite par le pilote
// automatique (un fil de travail, chargé à la demande), vue depuis la caméra de poursuite du jeu (mêmes réglages : retard, recul et champ de vision
// à la vitesse). On change de palier ou de pas en roulant : la scène se reconstruit, la voiture et la caméra restent où elles sont. Un compteur
// d'images par seconde mesure **l'appareil qui regarde** (sur téléphone : le vrai chiffre, que le rendu logiciel de la CI ne peut pas donner).
import { DEFAULT_CAR_PARAMS, steerLimit, type PaletteName, type Track } from "@cdj/sim";
import { NeutralToneMapping, PerspectiveCamera, Vector2, Vector3, WebGLRenderer, type Mesh } from "three";
import { CAMERAS } from "../cameras";
import { CarPose } from "../carPose";
import { createCarMesh, createShadow, placeShadow, type CarModel, type WheelPose } from "../carMesh";
import { flatRatio, speedCamera } from "../speedFeel";
import { buildTrackScene, type TrackScene } from "../trackMesh";
import { memoireScene } from "../scene/memoire";
import { texteReglages, type Reglages } from "../scene/paliers";
import { C, CHAMPS, fenetre, lire, type Bout } from "./parcours";
import type { DemandePilote, ReponsePilote } from "./piloteWorker";
import type { Fabrique } from "./variantes";

export interface CircuitTheme {
  id: string;
  titre: string;
  track: Track;
  palette: PaletteName;
  spec: string;
}

/** Ce que la vue affiche et ce que les tests lisent. */
export interface EtatMouvement {
  ouverte: boolean;
  theme: string;
  scene: "existant" | "paliers";
  reglages: string;
  /** Le pilote a fait le tour et la scène est construite : la voiture roule. */
  roule: boolean;
  images: number;
  ips: number;
  imageMs: number;
  pireMs: number;
  appels: number;
  triangles: number;
  constructionMs: number;
  memoire: { generees: number; cibles: number; post: number };
  /** Distance (m) de la caméra à la voiture : la caméra de poursuite la suit (≈ 6 à 10 m). */
  distanceCamera: number;
  /** Pas de la course affiché (dans le bout rejoué). */
  pas: number;
  erreur: string | null;
}

const wrap = (a: number) => {
  while (a > Math.PI) a -= 2 * Math.PI;
  while (a < -Math.PI) a += 2 * Math.PI;
  return a;
};

/** Le fil du pilote (un seul, à la demande) et les tours déjà faits (un par circuit). */
let fil: Worker | null = null;
const tours = new Map<string, Promise<Float32Array>>();
function tour(c: CircuitTheme): Promise<Float32Array> {
  let p = tours.get(c.track.id);
  if (!p) {
    p = new Promise<Float32Array>((resolve, reject) => {
      fil ??= new Worker(new URL("./piloteWorker.ts", import.meta.url), { type: "module" });
      const ecoute = (e: MessageEvent<ReponsePilote>) => {
        if (e.data.id !== c.track.id) return;
        fil!.removeEventListener("message", ecoute);
        if (e.data.poses) resolve(e.data.poses);
        else reject(new Error(e.data.erreur ?? "pilote"));
      };
      fil.addEventListener("message", ecoute);
      fil.postMessage({ id: c.track.id, spec: c.spec } satisfies DemandePilote);
    });
    tours.set(c.track.id, p);
  }
  return p;
}

export class VueMouvement {
  private renderer: WebGLRenderer | null = null;
  private readonly camera = new PerspectiveCamera(68, 16 / 9, 0.1, 700);
  private voiture: CarModel = createCarMesh();
  private readonly ombre: Mesh = createShadow();
  private readonly pose = new CarPose();
  private readonly roues: WheelPose & { droop: [number, number, number, number] } = { forward: 0, steerAngle: 0, braking: false, droop: [0, 0, 0, 0], dt: 0 };
  private ts: TrackScene | null = null;
  private fabrique: Fabrique | null = null;
  private readonly taille = new Vector2();
  private readonly tampon = new Vector2();
  private circuit: CircuitTheme | null = null;
  private poses: Float32Array | null = null;
  private bornes: [number, number] = [0, 0];
  private bout: Bout = "course";
  private choixScene: "existant" | "paliers" = "paliers";
  private courseT = 0;
  private temps = 0;
  private dernier = 0;
  private boucle = 0;
  private snap = true;
  private camYaw = 0;
  private camBaseY = 0;
  private readonly camPos = new Vector3();
  private readonly lift = new Vector3();
  private intervalles: number[] = [];
  private derniereMaj = 0;
  private generation = 0;
  readonly etat: EtatMouvement = { ouverte: false, theme: "", scene: "paliers", reglages: "", roule: false, images: 0, ips: 0, imageMs: 0, pireMs: 0, appels: 0, triangles: 0, constructionMs: 0, memoire: { generees: 0, cibles: 0, post: 0 }, distanceCamera: 0, pas: 0, erreur: null };

  constructor(
    private readonly canvas: HTMLCanvasElement,
    private readonly ips: HTMLElement,
    private readonly sortie: HTMLElement,
    private readonly paliers: () => Promise<Fabrique>,
    private readonly reglages: () => Reglages,
    private readonly erreurs: string[],
  ) {
    this.voiture.group.traverse((o) => (o.castShadow = true));
  }

  private moteur(): WebGLRenderer {
    if (!this.renderer) {
      const r = new WebGLRenderer({ canvas: this.canvas, antialias: true, powerPreference: "high-performance" });
      r.toneMapping = NeutralToneMapping;
      r.shadowMap.enabled = true;
      // Comme le jeu : densité de l'écran, plafonnée à 2.
      r.setPixelRatio(Math.min(window.devicePixelRatio || 1, 2));
      this.renderer = r;
    }
    const rect = this.canvas.getBoundingClientRect();
    const w = Math.max(1, Math.round(rect.width));
    const h = Math.max(1, Math.round(rect.height));
    const r = this.renderer;
    const taille = r.getSize(this.taille);
    if (taille.x !== w || taille.y !== h) r.setSize(w, h, false);
    return r;
  }

  /** Ouvre la vue sur un circuit (le pilote fait le tour s'il ne l'a pas encore fait). */
  async ouvrir(c: CircuitTheme) {
    this.etat.ouverte = true;
    this.etat.theme = c.id;
    this.etat.erreur = null;
    if (this.circuit?.track.id !== c.track.id) {
      this.circuit = c;
      this.poses = null;
      this.etat.roule = false;
      this.afficher("Le pilote automatique fait le tour…");
      try {
        const poses = await tour(c);
        if (this.circuit !== c) return;
        this.poses = poses;
        this.bornes = fenetre(c.track, poses, this.bout);
        this.courseT = 0;
        this.snap = true;
      } catch (e) {
        this.etat.erreur = String(e);
        this.erreurs.push(`mouvement ${c.id} : ${String(e)}`);
        this.afficher(`Erreur : ${String(e)}`);
        return;
      }
      await this.reconstruire();
    } else if (!this.ts) await this.reconstruire();
    this.demarrer();
  }

  fermer() {
    this.etat.ouverte = false;
    cancelAnimationFrame(this.boucle);
    this.boucle = 0;
    this.liberer();
    // Les cibles du post-traitement (plusieurs dizaines de Mo à la taille de l'écran) ne restent pas en mémoire, vue fermée.
    const r = this.renderer;
    if (r) void this.paliers().then((f) => f.liberer?.(r));
  }

  /** Change le bout du tour rejoué (départ ou en course). */
  changerBout(b: Bout) {
    this.bout = b;
    if (this.circuit && this.poses) {
      this.bornes = fenetre(this.circuit.track, this.poses, b);
      this.courseT = 0;
      this.snap = true;
    }
  }

  /**
   * Lot 40 : change la voiture (un des modèles proposés, à un palier) ; la caméra et le tour restent où ils sont. L'ancienne est libérée si elle
   * le permet.
   */
  async changerVoiture(v: CarModel & { dispose?(): void }) {
    const ancienne = this.voiture as CarModel & { dispose?(): void };
    if (ancienne === v) return;
    this.ts?.scene.remove(ancienne.group);
    this.voiture = v;
    v.group.traverse((o) => (o.castShadow = true));
    this.ts?.scene.add(v.group);
    ancienne.dispose?.();
  }

  /** Lot 40 : repeint la voiture (si son modèle le permet : les modèles proposés, pas l'existant). */
  repeindre(couleur: number, numero: string) {
    (this.voiture as CarModel & { peindre?(c: number, n?: string): void }).peindre?.(couleur, numero);
  }

  /** La scène montrée : l'existant (le jeu) ou les paliers (réglages du panneau). */
  async changerScene(s: "existant" | "paliers") {
    this.choixScene = s;
    await this.reconstruire();
  }

  /** Reconstruit la scène (réglages changés) ; la voiture et la caméra restent où elles sont. */
  async reconstruire() {
    const c = this.circuit;
    if (!c) return;
    const gen = ++this.generation;
    const fab: Fabrique = this.choixScene === "existant" ? { construire: (t, p) => buildTrackScene(t, p) } : await this.paliers();
    if (gen !== this.generation || !this.etat.ouverte) return;
    try {
      const t0 = performance.now();
      const ts = fab.construire(c.track, c.palette);
      this.etat.constructionMs = performance.now() - t0;
      this.liberer();
      ts.scene.add(this.voiture.group, this.ombre);
      this.ts = ts;
      this.fabrique = fab;
      this.etat.scene = this.choixScene;
      this.etat.reglages = this.choixScene === "existant" ? "existant" : texteReglages(this.reglages());
      this.intervalles = [];
      this.etat.roule = !!this.poses;
    } catch (e) {
      this.etat.erreur = String(e);
      this.erreurs.push(`mouvement ${c.id} : ${String(e)}`);
      console.error(e);
    }
  }

  private liberer() {
    if (!this.ts) return;
    // La voiture et son ombre passent d'une scène à l'autre : on les retire avant de libérer la scène.
    this.ts.scene.remove(this.voiture.group, this.ombre);
    this.ts.dispose();
    this.ts = null;
  }

  private demarrer() {
    if (this.boucle) return;
    this.dernier = performance.now();
    const image = (now: number) => {
      this.boucle = requestAnimationFrame(image);
      try {
        this.image(now);
      } catch (e) {
        this.etat.erreur = String(e);
        this.erreurs.push(`mouvement : ${String(e)}`);
        cancelAnimationFrame(this.boucle);
        this.boucle = 0;
        console.error(e);
      }
    };
    this.boucle = requestAnimationFrame(image);
  }

  private image(now: number) {
    const dt = Math.min(0.1, Math.max(0, (now - this.dernier) / 1000));
    if (this.dernier && now > this.dernier) this.intervalles.push(now - this.dernier);
    this.dernier = now;
    const ts = this.ts;
    const poses = this.poses;
    if (!ts || !poses) return;
    const r = this.moteur();
    this.temps += dt;
    this.courseT += dt;
    const [debut, fin] = this.bornes;
    const duree = (fin - debut) / 120;
    if (this.courseT >= duree) {
      this.courseT -= duree;
      this.snap = true;
    }
    const p = debut + this.courseT * 120;
    const i = Math.min(fin - 1, Math.floor(p));
    const f = p - i;
    const v = (k: (typeof C)[keyof typeof C]) => lire(poses, i, f, k);
    const x = v(C.x);
    const y = v(C.y);
    const z = v(C.z);
    const yaw = v(C.yaw);
    const avant = v(C.avant);
    const vit = Math.hypot(v(C.vx), v(C.vz));
    // La voiture : position, caisse (tangage, roulis, normale d'une paroi), roues (rotation, braquage, feux stop), ombre.
    const g = this.voiture.group;
    g.position.set(x, y, z);
    this.pose.follow(v(C.nx), v(C.ny), v(C.nz), dt, this.snap);
    this.pose.apply(g, v(C.pitch), yaw, v(C.roll));
    this.roues.forward = avant;
    this.roues.steerAngle = -v(C.steer) * steerLimit(avant, DEFAULT_CAR_PARAMS);
    this.roues.braking = poses[i * CHAMPS + C.frein]! > 0.5;
    this.roues.dt = dt;
    this.voiture.update(this.roues);
    placeShadow(this.ombre, x, z, yaw, y, 0);
    // La caméra de poursuite du jeu (« proche ») : cap et hauteur en retard, recul et champ de vision qui grandissent avec la vitesse.
    const rig = CAMERAS[0]!;
    const ratio = flatRatio(vit);
    const fast = speedCamera(vit);
    if (this.snap) {
      this.camYaw = yaw;
      this.camBaseY = y;
    }
    this.camYaw += wrap(yaw - this.camYaw) * (1 - Math.exp(-rig.yawLag * dt));
    this.camBaseY += (y - this.camBaseY) * (1 - Math.exp(-8 * dt));
    const back = rig.back + ratio * rig.backAtSpeed + fast.back;
    const up = this.pose.cameraUp;
    this.lift.copy(up).multiplyScalar(rig.height - fast.lower);
    const suivi = this.snap ? 1 : 1 - Math.exp(-(rig.posLag - fast.lag) * dt);
    this.camPos.x += (x - Math.sin(this.camYaw) * back + this.lift.x - this.camPos.x) * suivi;
    this.camPos.y += (this.camBaseY + this.lift.y - this.camPos.y) * suivi;
    this.camPos.z += (z - Math.cos(this.camYaw) * back + this.lift.z - this.camPos.z) * suivi;
    this.snap = false;
    const cam = this.camera;
    cam.position.copy(this.camPos);
    cam.up.copy(up);
    cam.lookAt(x + Math.sin(this.camYaw) * rig.ahead + up.x * rig.lookHeight, this.camBaseY + up.y * rig.lookHeight, z + Math.cos(this.camYaw) * rig.ahead + up.z * rig.lookHeight);
    const size = r.getDrawingBufferSize(this.tampon);
    cam.fov = rig.fov + ratio * rig.fovAtSpeed + fast.fov;
    cam.aspect = size.x / size.y;
    cam.updateProjectionMatrix();
    this.etat.distanceCamera = Math.hypot(cam.position.x - x, cam.position.y - y, cam.position.z - z);
    this.etat.pas = i;
    ts.followGround(x, z);
    ts.followCar(x, y, z, yaw);
    ts.setView(size.y, cam.fov);
    // L'image : directement (MSAA du moteur, comme le jeu) ou par la chaîne de post-traitement des paliers ; appels et triangles de toutes les passes.
    this.fabrique?.preparer?.(ts, r);
    r.info.autoReset = false;
    r.info.reset();
    let post = 0;
    if (this.fabrique?.rendre) post = this.fabrique.rendre(ts, r, cam, size.x, size.y, this.temps);
    else {
      r.toneMappingExposure = ts.look.exposure;
      r.render(ts.scene, cam);
    }
    this.etat.appels = r.info.render.calls;
    this.etat.triangles = r.info.render.triangles;
    r.info.autoReset = true;
    this.etat.images++;
    this.etat.memoire.post = post;
    if (now - this.derniereMaj > 500) {
      this.derniereMaj = now;
      // Images par seconde et durée d'une image, sur la dernière seconde (la carte graphique et le fil principal de cet appareil).
      let somme = 0;
      let n = 0;
      let pire = 0;
      for (let k = this.intervalles.length - 1; k >= 0 && somme < 1000; k--) {
        somme += this.intervalles[k]!;
        pire = Math.max(pire, this.intervalles[k]!);
        n++;
      }
      this.intervalles = this.intervalles.slice(-n);
      this.etat.ips = somme > 0 ? (n * 1000) / somme : 0;
      this.etat.imageMs = n ? somme / n : 0;
      this.etat.pireMs = pire;
      const m = memoireScene(ts.scene);
      this.etat.memoire.generees = m.generees;
      this.etat.memoire.cibles = m.cibles;
      this.afficher();
    }
  }

  private afficher(message?: string) {
    const e = this.etat;
    const fmt = (n: number, d = 0) => n.toLocaleString("fr-FR", { maximumFractionDigits: d, minimumFractionDigits: d });
    const mo = (o: number) => `${fmt(o / 1048576, 1)} Mo`;
    if (message) {
      this.ips.textContent = "";
      this.sortie.textContent = message;
      return;
    }
    this.ips.textContent = `${fmt(e.ips, e.ips < 10 ? 1 : 0)} images/s · ${fmt(e.imageMs, 0)} ms`;
    this.sortie.textContent = `Image : ${fmt(e.imageMs, 1)} ms en moyenne, pire ${fmt(e.pireMs, 0)} ms (sur 1 s, cet appareil) · ${fmt(e.appels)} appels · ${fmt(e.triangles / 1000, 1)} k triangles · construction ${fmt(e.constructionMs)} ms · textures ${mo(e.memoire.generees)}, cibles ${mo(e.memoire.cibles + e.memoire.post)} · ${e.scene === "existant" ? "existant (le jeu)" : `réglages ${e.reglages}`}`;
  }
}
