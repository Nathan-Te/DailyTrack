// Socle de la scène par paliers (lot 39) : **la seule construction de la scène de Track**. Le jeu (course, accueil, Salon, spectateur, revoir le meilleur
// tour), les miniatures et la colonne « Existant » de la vitrine passent tous par `composer` ; `buildTrackScene` n'en est que le nom court du palier d'aujourd'hui.
//
// - **Les paliers** (`Palier`) : « existant » est la scène de `main` à la fin du lot 37, rien de plus (la géométrie vient de `trackGeometry`, `trackMesh.ts`) ; « P1 »,
//   « P2 » et « P3 » sont ceux de la vitrine (`src/scene/`, `docs/lots/lot-38-direction-scene/direction.md`) : **aucun n'est branché dans le jeu**, les lots suivants
//   le feront un par un. Un palier se branche en enregistrant son composeur (`brancherComposeur`) quand le module de ses pas a été chargé.
// - **Les modules des pas se chargent à la demande** (`chargerPas`, `import()`), jamais dans le premier chargement, et **la scène ne se reconstruit jamais pendant une
//   course** (`creerReconstructeur` : à l'accueil, à la pause, à l'arrivée, au podium du Salon).
// - **Un palier ne change jamais la simulation** : seul le rendu varie (même circuit, même route sous la voiture, mêmes rediffusions).
import { AdditiveBlending, AmbientLight, Color, DirectionalLight, DoubleSide, Fog, Group, HemisphereLight, Mesh, MeshBasicMaterial, MeshStandardMaterial, PlaneGeometry, Scene, SpotLight } from "three";
import { FALL_DEPTH, type PaletteName, type Track } from "@cdj/sim";
import { buildHalos } from "../halo";
import { mix } from "../meshKit";
import { LOOKS, PALETTE_DEFS, buildMountains, buildSky, checkerTexture, disposeScene, skyGradient, trackGeometry, type SceneStats, type TrackScene, type TrackSceneOptions } from "../trackMesh";

/** Les paliers de qualité de la scène. Seul « existant » est branché dans le jeu (lot 39) ; les autres sont ceux de la vitrine. */
export type Palier = "existant" | "P1" | "P2" | "P3";
export const PALIER_EXISTANT: Palier = "existant";

/** Construit la scène d'un circuit à un palier (ses options sont celles de `buildTrackScene`). */
export type Composeur = (track: Track, palette: PaletteName, options: TrackSceneOptions) => TrackScene;

/** Demi-largeur (m) de la carte d'ombres autour de la voiture. */
const SHADOW_HALF = 42;
/** Intensité des phares (candelas) : à régler à l'œil (capture de nuit). */
const HEADLIGHT_POWER = 900;
/** Part de la puissance des phares gardée en vue capot. */
const HOOD_HEADLIGHT = 0.1;


function composerExistant(track: Track, paletteName: PaletteName, options: TrackSceneOptions): TrackScene {
  const pal = PALETTE_DEFS[paletteName];
  const floorY = track.voidY - FALL_DEPTH; // le sol lointain : sous la route la plus basse (8 m) ; la voiture qui tombe n'y arrive jamais
  const look = LOOKS[paletteName];
  const { g, speedG, neonG, props, decorG, glowG, denseG, denseGlow, signCount, rnd } = trackGeometry(track, paletteName, options);

  const sky = new Color(pal.sky);
  const scene = new Scene();
  if (!options.aerial) {
    scene.background = skyGradient(pal);
    // Brume (lot 23) : sa densité est un trait du thème (voile de ville, air limpide du col, jour blanc de la banquise).
    scene.fog = new Fog(sky, pal.fogNear / look.haze, pal.fogFar / look.haze);
  }
  // Lumière : hémisphérique (ciel au-dessus, sol en dessous : les faces hautes sont plus claires que les flancs) + soleil.
  // Miniatures des thèmes de nuit : lues en petit, elles doivent rester lisibles (le jeu, lui, garde sa nuit).
  const lift = options.aerial && new Color(pal.floorA).getHSL({ h: 0, s: 0, l: 0 }).l < 0.25 ? 2.2 : 1;
  scene.add(new HemisphereLight(mix(pal.ambient[0], pal.zenith, 0.35), new Color(pal.floorB).getHex(), pal.ambient[1] * 0.45 * lift));
  scene.add(new AmbientLight(pal.ambient[0], pal.ambient[1] * 0.12 * lift));
  const sun = new DirectionalLight(pal.sun[0], pal.sun[1] * 0.85 * (lift > 1 ? 1.4 : 1));
  // Soleil (lot 21) : plus il est haut, plus la lumière vient d'en haut (ombres courtes) ; bas, elle rase les flancs.
  sun.position.set(40 * (1.2 - pal.sunHeight) * 1.4, 30 + 110 * pal.sunHeight, -30 * (1.2 - pal.sunHeight) * 1.4);
  const sunOffset = sun.position.clone().normalize().multiplyScalar(150);
  scene.add(sun, sun.target);
  // Ombres portées (lot 23, qualité ≥ 1) : une carte d'ombres qui suit la voiture (±SHADOW_HALF m) ; voir `setQuality`.
  sun.shadow.camera.left = -SHADOW_HALF;
  sun.shadow.camera.right = SHADOW_HALF;
  sun.shadow.camera.top = SHADOW_HALF;
  sun.shadow.camera.bottom = -SHADOW_HALF;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 320;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.06;
  sun.shadow.intensity = look.shadow;
  // Phares (lot 23) : un projecteur devant la voiture sur les thèmes sombres ; intensité 0 le jour (la lampe existe toujours : pas de recompilation).
  const head = new SpotLight(0xfff1d0, 0, 110, 0.62, 0.8, 1.2);
  scene.add(head, head.target);

  const mat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide });
  const roadMesh = new Mesh(g.geometry(), mat);
  roadMesh.receiveShadow = true;
  scene.add(roadMesh);
  const decorMesh = new Mesh(decorG.geometry(), mat);
  const glowMesh = new Mesh(glowG.geometry(), new MeshBasicMaterial({ vertexColors: true }));
  const speedMesh = new Mesh(speedG.geometry(), mat);
  const denseMesh = new Mesh(denseG.geometry(), mat);
  const denseGlowMesh = new Mesh(denseGlow.geometry(), new MeshBasicMaterial({ vertexColors: true }));
  decorMesh.userData.heavy = glowMesh.userData.heavy = speedMesh.userData.heavy = true;
  denseMesh.userData.level = denseGlowMesh.userData.level = 2;
  decorMesh.receiveShadow = denseMesh.receiveShadow = true;
  // Le décor reçoit les ombres mais n'en projette pas : le dessiner une seconde fois dans la carte d'ombres coûtait +6 à +12 ms par image
  // (processeur ×4, Ville et Nuit en qualité 2) pour des ombres lointaines que personne ne regarde ; la voiture et les accessoires en projettent.
  scene.add(decorMesh, glowMesh, speedMesh, denseMesh, denseGlowMesh);
  if (neonG.pos.length > 0) scene.add(new Mesh(neonG.geometry(), new MeshBasicMaterial({ vertexColors: true })));

  // Accessoires (lot 23) : panneaux, arches, portes. Toujours visibles (c'est de la lisibilité, pas du décor).
  const solidMesh = new Mesh(props.solid.geometry(), mat);
  solidMesh.castShadow = solidMesh.receiveShadow = true;
  scene.add(solidMesh, new Mesh(props.glow.geometry(), new MeshBasicMaterial({ vertexColors: true, side: DoubleSide })));
  if (props.curtain.pos.length > 0) {
    const curtain = new Mesh(props.curtain.geometry(), new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, side: DoubleSide, depthWrite: false, blending: AdditiveBlending }));
    curtain.renderOrder = 4;
    scene.add(curtain);
  }
  for (const banner of props.banners) scene.add(banner);

  // Halos (lot 23) : néons, turbos, lampadaires, portes. Un seul `Points` additif ; qualité ≥ 1.
  const halos = options.aerial ? null : buildHalos([...g.halos, ...glowG.halos, ...neonG.halos, ...denseGlow.halos, ...props.glow.halos], look.halo);
  if (halos) scene.add(halos.points);

  // Ciel et silhouettes lointaines suivent la caméra (donc la voiture) : toujours à l'horizon.
  const backdrop = new Group();
  if (!options.aerial) backdrop.add(buildSky(pal, rnd), buildMountains(pal, rnd));
  scene.add(backdrop);

  const size = 1200;
  const tile = 8;
  const floor = new Mesh(
    new PlaneGeometry(size, size),
    new MeshStandardMaterial({ map: checkerTexture(pal.floorA, pal.floorB, size / (2 * tile)), flatShading: true }),
  );
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  scene.add(floor);

  let shadowSize = 0;
  const setQuality = (level: 0 | 1 | 2, shadows = true) => {
    currentLevel = level;
    scene.traverse((o) => {
      // Seuls les objets marqués (`level`, ou `heavy` = niveau 1) sont touchés : les effets, la voiture et le fantôme gèrent leur visibilité eux-mêmes.
      const min = (o.userData.level as number | undefined) ?? (o.userData.heavy ? 1 : undefined);
      if (min !== undefined) o.visible = level >= min;
      const casts = o.userData.casts as number | undefined;
      if (casts !== undefined) o.castShadow = level >= casts;
    });
    // Ombres : carte de 512 (qualité 1) ou 1024 (qualité 2) ; coupées à la qualité 0 (reste l'ombre douce posée sous la voiture).
    const want = options.aerial || !shadows ? 0 : level === 2 ? 1024 : level === 1 ? 512 : 0; // `shadows` : le réglage « ombres » du joueur (lot 29)
    if (want !== shadowSize) {
      shadowSize = want;
      sun.castShadow = want > 0;
      if (want > 0) {
        sun.shadow.mapSize.set(want, want);
        sun.shadow.map?.dispose();
        sun.shadow.map = null;
      }
    }
    head.visible = level >= 1 && look.headlights > 0;
    head.intensity = head.visible ? HEADLIGHT_POWER * look.headlights : 0;
  };
  let currentLevel: 0 | 1 | 2 = 2;
  setQuality(2);

  return {
    scene,
    look,
    dispose: () => {
      // Cartes d'ombres des lumières (le Salon change de scène toutes les dix minutes : rien ne doit s'accumuler côté carte graphique).
      scene.traverse((o) => ((o as { shadow?: { map?: { dispose(): void } | null } }).shadow?.map?.dispose()));
      disposeScene(scene);
    },
    setQuality,
    setLite(on) {
      setQuality(on ? 0 : 2);
    },
    setView(heightPx, fovDeg) {
      halos?.setView(heightPx, fovDeg);
    },
    stats() {
      let hills = false;
      backdrop.traverse((o) => {
        if (o.userData.level === 2 && o.visible) hills = true;
      });
      const fog = scene.fog as Fog | null;
      return { quality: currentLevel, shadowMap: sun.castShadow ? shadowSize : 0, headlights: head.visible ? head.intensity : 0, halos: { count: halos ? halos.points.geometry.getAttribute("position").count : 0, visible: !!halos?.points.visible }, denseDecor: denseMesh.visible, hills, signs: signCount, fog: fog ? { near: fog.near, far: fog.far } : null };
    },
    followGround(x, z) {
      backdrop.position.set(x, floorY, z);
      floor.position.x = Math.round(x / (2 * tile)) * 2 * tile;
      floor.position.z = Math.round(z / (2 * tile)) * 2 * tile;
    },
    followCar(x, y, z, yaw, hood = false) {
      // Ombres : la fenêtre de la carte suit la voiture (pas d'un mètre : les bords ne scintillent pas).
      const tx = Math.round(x);
      const ty = Math.round(y);
      const tz = Math.round(z);
      sun.target.position.set(tx, ty, tz);
      sun.position.set(tx + sunOffset.x, ty + sunOffset.y, tz + sunOffset.z);
      if (head.visible) {
        const s = Math.sin(yaw);
        const c = Math.cos(yaw);
        head.position.set(x + s * 1.2, y + 0.75, z + c * 1.2);
        head.target.position.set(x + s * 24, y - 0.4, z + c * 24);
        head.intensity = HEADLIGHT_POWER * look.headlights * (hood ? HOOD_HEADLIGHT : 1);
      }
    },
  };
}

const COMPOSEURS: Partial<Record<Palier, Composeur>> = { existant: composerExistant };

/** Branche le composeur d'un palier : appelé par le module de ses pas, une fois chargé (`undefined` le débranche : les essais). */
export function brancherComposeur(palier: Palier, composeur: Composeur | undefined) {
  COMPOSEURS[palier] = composeur;
}

export const palierBranche = (palier: Palier): boolean => !!COMPOSEURS[palier];

/** **La** construction de la scène d'un circuit au palier demandé ; un palier pas encore branché est une erreur (on charge ses pas d'abord : `chargerPas`). */
export function composer(track: Track, palette: PaletteName, palier: Palier = PALIER_EXISTANT, options: TrackSceneOptions = {}): TrackScene {
  const composeur = COMPOSEURS[palier];
  if (!composeur) throw new Error(`palier « ${palier} » pas branché : charger ses pas d'abord`);
  return composeur(track, palette, options);
}

/** La scène d'aujourd'hui : route, rebords, plaques, portes, décor, ciel et un sol à damier (palier « existant »). */
export const buildTrackScene = (track: Track, palette: PaletteName = "desert", options: TrackSceneOptions = {}): TrackScene => composer(track, palette, PALIER_EXISTANT, options);

// --- Les modules des pas, à la demande ---------------------------------------------------------------------------------------

/** Un chargeur de module de pas : un `import()`. Rien n'est chargé avant qu'un palier ne le demande. */
export type Chargeur = () => Promise<unknown>;
export type Registre = Record<string, Chargeur>;

/** Les modules des pas du jeu, un chargeur chacun : **vide tant qu'aucun palier n'est activé** (les lots suivants y ajoutent leurs `import()`). */
export const PAS_DU_JEU: Registre = {};

/** Les pas que demande chaque palier (les modules de la vitrine : `finition`, `matiere`, `reflets`, `lumiere3`, `vie`, `post`…). */
export const PAS_DU_PALIER: Record<Palier, readonly string[]> = { existant: [], P1: [], P2: [], P3: [] };

const charges = new WeakMap<Registre, Map<string, Promise<unknown>>>();

/** Charge les modules demandés (une seule fois chacun, par registre). Un pas inconnu est une erreur. */
export function chargerPas(ids: readonly string[], registre: Registre = PAS_DU_JEU): Promise<unknown[]> {
  let deja = charges.get(registre);
  if (!deja) charges.set(registre, (deja = new Map()));
  return Promise.all(
    ids.map((id) => {
      const chargeur = registre[id];
      if (!chargeur) return Promise.reject(new Error(`pas inconnu : ${id}`));
      let p = deja!.get(id);
      if (!p) deja!.set(id, (p = chargeur()));
      return p;
    }),
  );
}

// --- Reconstruire hors course ------------------------------------------------------------------------------------------------

export interface Reconstructeur {
  /** Le palier de la scène courante. */
  palier(): Palier;
  /** Le palier voulu (la règle automatique, le réglage du joueur) : on commence à charger ses pas, la scène ne change pas encore. */
  demander(palier: Palier): void;
  /** Vrai s'il y a une reconstruction en attente. */
  enAttente(): boolean;
  /** Reconstruit la scène si un palier est demandé, que ses pas sont chargés et que le jeu n'est pas en course ; rend vrai si elle a changé. */
  essayer(): Promise<boolean>;
}

export interface OptionsReconstructeur {
  palier?: Palier;
  /** Vrai à l'accueil, à la pause, à l'arrivée et au podium du Salon ; **faux pendant une course**. Relu après chaque attente. */
  peutReconstruire(): boolean;
  /** Construit la scène du circuit courant au palier donné (`composer`), ou `null` s'il n'y en a pas (arène plate). */
  construire(palier: Palier): TrackScene | null;
  /** Prend la nouvelle scène (la voiture, les fantômes et les effets y passent, l'ancienne est libérée). */
  adopter(scene: TrackScene, palier: Palier): void;
  pas?: Record<Palier, readonly string[]>;
  registre?: Registre;
}

export function creerReconstructeur(o: OptionsReconstructeur): Reconstructeur {
  let courant: Palier = o.palier ?? PALIER_EXISTANT;
  let voulu: Palier | null = null;
  let prets: Promise<unknown> = Promise.resolve();
  let enCours = false;
  return {
    palier: () => courant,
    demander(palier) {
      if (palier === courant) {
        voulu = null;
        return;
      }
      voulu = palier;
      prets = chargerPas((o.pas ?? PAS_DU_PALIER)[palier], o.registre);
      prets.catch(() => (voulu = null)); // des pas qui ne chargent pas : on reste sur la scène courante
    },
    enAttente: () => voulu !== null,
    async essayer() {
      if (voulu === null || enCours || !o.peutReconstruire()) return false;
      enCours = true;
      try {
        const palier = voulu;
        await prets;
        if (voulu !== palier || !o.peutReconstruire()) return false; // la course a commencé pendant le chargement : on attend le prochain arrêt
        const scene = o.construire(palier);
        if (!scene) return false;
        o.adopter(scene, palier);
        courant = palier;
        voulu = null;
        return true;
      } catch {
        voulu = null;
        return false;
      } finally {
        enCours = false;
      }
    },
  };
}
