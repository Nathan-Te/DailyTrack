// Lot 43 — **la scène du jeu au palier 1**, dans le premier chargement : la scène de tout le monde (course, accueil, Salon, spectateur, revoir le meilleur
// tour, miniatures). Repris du compositeur de la vitrine (`composerPalier.ts`, retouche 38b) pour le palier 1 seul, sans aucun module des pas :
//   - la piste : route paramétrable (`route.ts`) aux rebords et couleurs du thème (`routeP`), éléments de course du palier 1 (`palier1.ts` : portiques
//     avec feux de départ, arrivée, arche gonflable, plaques, panneaux de virage et de distance, rythme des portions rapides, sponsors fictifs) ;
//   - la lumière de C **construite directement** (ciel à quatre arrêts, brume, hémisphère, soleil, ombres, exposition par thème), les horizons du thème
//     (`HORIZONS`), le soleil — ou la lune — posé **d'où vient la lumière** ; la Nuit : lampadaires de piste, quatre lampes réelles qui les suivent,
//     flaques de lumière, phares ;
//   - l'occlusion par sommets de C (calculée une fois à la construction) ; pas de texture de grain (la matière vient avec le décor, au lot suivant) ;
//   - **le décor d'aujourd'hui**, tel quel (`decorGeometry`, trackMesh.ts : mêmes tirages au sort) ;
//   - les ombres posées **devant** la voiture (là où regarde la caméra), même taille de carte qu'avant.
// Les éléments et l'éclairage de piste sont fusionnés dans un seul calque `solide` (éclairé, projette et reçoit les ombres) : un appel de rendu, et un seul
// dans la carte d'ombres ; les rebords sont dans le calque de la route (ils reçoivent les ombres, n'en projettent pas). **Rendu seul** : la route qui porte la voiture suit les mêmes points que la simulation ; rien ne touche à `sim`.
import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  Color,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PlaneGeometry,
  PointLight,
  Scene,
  SpotLight,
  Vector3,
  type BufferAttribute,
  type Material,
  type PerspectiveCamera,
} from "three";
import { FALL_DEPTH, type PaletteName, type Track } from "@cdj/sim";
import { buildHalos } from "../halo";
import { Builder, mix, seeded } from "../meshKit";
import { signsFor } from "../signage";
import { fastZones } from "../speedFeel";
import { FEUX_ETEINTS, memesFeux, type EtatFeux } from "../feux";
import { LOOKS, PALETTE_DEFS, checkerTexture, decorGeometry, disposeScene, type DecorGeometry, type Look, type Palette, type SceneStats, type TrackScene, type TrackSceneOptions } from "../trackMesh";
import { construireRoute } from "./route";
import { Affiches } from "./outils";
import { ambianceDOrigine, ciel, silhouettes } from "./composer";
import { THEMES_C, occlusionSommets, textureFlaque } from "./directionC";
import { texturedCielC } from "./textures";
import { FeuxDepart, arriveeP, coupureP, eclairagePisteP, paletteP1, panneauP, panneauxDistanceP, plaqueP, porteP, portiqueDepartP, routeP, rythmeP, sponsorsRebordsP, turboP, type EclairagePiste } from "./palier1";
import { atlasSponsors } from "./sponsors";
import { HORIZONS, type Ambiance, type Calques, type Contexte } from "./types";

/** Demi-largeur (m) de la carte d'ombres : celle d'avant (lot 23). */
const SHADOW_HALF = 42;
/** Avance (m) du centre de la carte d'ombres devant la voiture : la moitié de la carte servait derrière la caméra (38b, « d'autres pas » n° 2). */
export const OMBRES_AVANT = 24;
const HEADLIGHT_POWER = 900;
/** Part de la puissance des phares gardée en vue capot. */
const HOOD_HEADLIGHT = 0.1;
const TAILLE_SOL = 1200;
/** Où sont posés les portiques sur leur bloc (m depuis l'entrée du bloc) : départ et arrivée (lot 46 : le pas « vie » y accroche ses drapeaux). */
export const Q_DEPART = 26;
export const Q_ARRIVEE = 16;
const CASE_SOL = 8;

/** Ce que construit le palier 1 avant la scène : la piste et ses éléments par calque, le décor d'aujourd'hui, l'éclairage de piste de la nuit. */
export interface GeometrieP1 {
  pal: Palette;
  look: Look;
  floorY: number;
  calques: Calques;
  decor: DecorGeometry;
  feux: FeuxDepart | null;
  /** Panneaux de virage et de distance posés. */
  signs: number;
  distances: number;
  eclairage: EclairagePiste | null;
  /** Le contexte des éléments (lot 46 : les pas à la demande le reçoivent). */
  x: Contexte;
}

/**
 * Les formes du palier 1 d'un circuit, sans rien de la scène (ni lumière, ni ciel, ni texture : de quoi les mesurer dans un test, `log` et `headless`).
 * Le décor est celui d'aujourd'hui (`decorGeometry`), avec ses tirages au sort.
 */
export function geometrieP1(track: Track, palette: PaletteName, options: TrackSceneOptions = {}): GeometrieP1 {
  const base = PALETTE_DEFS[palette];
  const pal = paletteP1(palette, base);
  const tc = THEMES_C[palette];
  const look: Look = { ...LOOKS[palette], exposure: tc.exposition };
  const floorY = track.voidY - FALL_DEPTH;
  const aerien = !!options.aerial;
  const feux = aerien ? null : new FeuxDepart();
  const calques: Calques = {
    route: new Builder(),
    solide: new Builder(),
    lumineux: new Builder(),
    decor: new Builder(),
    decorLumineux: new Builder(),
    dense: new Builder(),
    rideau: new Builder(),
    affiches: new Affiches(),
    bandeaux: [],
    // Pas de bandeau de texte en vue aérienne (miniatures) ni sans DOM (tests).
    aerien: aerien || !!options.headless,
    ...(feux ? { feux } : {}),
  };
  const x: Contexte = { palette, pal, look, track, floorY, ...(options.log ? { log: options.log } : {}), ...(options.textes ? { textes: options.textes } : {}) };
  // Les rebords dans le calque de la route : ils reçoivent les ombres et n'en projettent pas (comme l'existant). Les projeter (« ombres de contact », 38b)
  // redessinait tous les rebords dans la carte d'ombres : deux fois leurs triangles, pour une ombre de quelques centimètres ; c'est un pas de plus haut palier.
  construireRoute(track, pal, routeP(palette), { route: calques.route, lumineux: calques.lumineux, rebords: calques.route }, floorY);
  const fast = fastZones(track);
  for (const b of track.blocks) {
    if (b.kind === "boost") plaqueP(calques, x, b);
    if (b.kind === "turbo") turboP(calques, x, b);
    if (b.kind === "cut") coupureP(calques, x, b);
    // Les repères et les arches de vitesse : dans le calque de la route (ils ne projettent pas d'ombre, comme les bornes de l'existant).
    if (!aerien) rythmeP({ ...calques, solide: calques.route }, x, b, fast[b.index] ?? false);
    if (b.mark === "checkpoint") porteP(calques, x, b);
    if (b.mark === "finish") arriveeP(calques, x, b, Q_ARRIVEE);
    if (b.mark === "start") portiqueDepartP(calques, x, b, Q_DEPART);
  }
  let signs = 0;
  let distances = 0;
  if (!aerien) {
    const liste = signsFor(track);
    for (const s of liste) panneauP(calques, x, track.blocks[s.block]!, s);
    signs = liste.length;
    distances = panneauxDistanceP(calques, x, liste);
    sponsorsRebordsP(calques, x);
  }
  // Les lampadaires de la Nuit : dans le calque de la route eux aussi (la lune ne fait pas d'ombre qui compte ; leurs lampes éclairent).
  const eclairage = tc.lampes ? eclairagePisteP({ ...calques, solide: calques.route }, x, tc.lampes.couleur) : null;
  // Lot 46 : les pas à la demande (la vie : drapeaux, écrans, foule de la tribune) posent leurs pièces dans les calques ; jamais en vue aérienne.
  const pas = aerien ? [] : (options.pas ?? []);
  const coupes = new Set(options.coupes);
  const decor = decorGeometry(track, palette, { ...options, foule: !coupes.has("foule") && pas.some((p) => p.foule) });
  for (const p of pas) p.elements?.(calques, x, decor, coupes);
  return { pal, look, floorY, calques, decor, feux, signs, distances, eclairage, x };
}

/** La lumière d'un thème vue par le palier 1 : soleil, hémisphère, brume et ciel de C ; silhouettes de l'horizon du thème, fondues vers la brume. */
function ambianceP1(palette: PaletteName, base: Palette, pal: Palette, look: Look): Ambiance {
  const tc = THEMES_C[palette];
  const a = ambianceDOrigine(pal, look);
  const fond = (c: number) => mix(c, tc.brume[0], tc.silhouettes);
  return { ...a, ciel: { zenith: tc.ciel[0], horizon: tc.ciel[2], bandes: false }, silhouettes: { corps: fond(base.mountain), sommet: fond(base.mountainTop), plates: false, forme: HORIZONS[palette] } };
}

/** La direction d'où vient la lumière du soleil (ou de la lune) : sa hauteur est celle du thème (lot 21), son cap est commun à tous les thèmes. */
export function directionSoleil(sunHeight: number): Vector3 {
  const h = sunHeight;
  return new Vector3(40 * (1.2 - h) * 1.4, 30 + 110 * h, -30 * (1.2 - h) * 1.4);
}

/** Construit la scène d'un circuit au palier 1 (même interface que l'existant : `TrackScene`). */
export function composerP1(track: Track, palette: PaletteName, options: TrackSceneOptions = {}): TrackScene {
  const aerien = !!options.aerial;
  const geo = geometrieP1(track, palette, options);
  const { pal, look, floorY, calques, decor } = geo;
  const base = PALETTE_DEFS[palette];
  const tc = THEMES_C[palette];
  const nuit = pal.scenery === "lamps" || pal.scenery === "pylons";

  // --- Lumière (celle de C, construite directement) ---
  const scene = new Scene();
  const sunPos = directionSoleil(pal.sunHeight);
  const sunDir = sunPos.clone().normalize();
  if (!aerien) {
    scene.background = texturedCielC(tc.ciel);
    scene.fog = new Fog(tc.brume[0], tc.brume[1], tc.brume[2]);
  }
  // Miniatures des thèmes sombres : lues en petit, elles doivent rester lisibles (le jeu, lui, garde sa nuit) — comme l'existant (lot 13).
  const leve = aerien && new Color(pal.floorA).getHSL({ h: 0, s: 0, l: 0 }).l < 0.25;
  scene.add(new HemisphereLight(tc.hemi[0], tc.hemi[1], leve ? 1.6 : tc.hemi[2]), new AmbientLight(leve ? 0xffffff : tc.hemi[0], leve ? 0.9 : tc.ambiante));
  // Lot 46 : les ombres fines du palier 3 (pas « ombres », à la demande) : carte plus grande, plus loin devant la voiture ; le décor projette aussi.
  const fines = aerien ? undefined : options.pas?.find((p) => p.ombres)?.ombres;
  const demi = fines?.demi ?? SHADOW_HALF;
  const avance = fines?.avant ?? OMBRES_AVANT;
  const sun = new DirectionalLight(tc.soleil[0], leve ? 2.2 : tc.soleil[1]);
  sun.position.copy(sunPos);
  const sunOffset = sunDir.clone().multiplyScalar(150);
  scene.add(sun, sun.target);
  sun.shadow.camera.left = -demi;
  sun.shadow.camera.right = demi;
  sun.shadow.camera.top = demi;
  sun.shadow.camera.bottom = -demi;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 340;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = fines?.normalBias ?? 0.06;
  sun.shadow.intensity = tc.ombre[0];
  sun.shadow.radius = tc.ombre[1];
  // Phares : un projecteur devant la voiture sur les thèmes sombres ; intensité 0 le jour (la lampe existe toujours : pas de recompilation).
  const head = new SpotLight(0xfff1d0, 0, 130, 0.7, 0.8, 1.2);
  scene.add(head, head.target);

  // --- Calques ---
  const mat = new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide });
  const plain = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const maillage = (g: Builder, m: Material, calque: string) => {
    const mesh = new Mesh(g.geometry(), m);
    mesh.userData.calque = calque;
    return mesh;
  };
  const roadMesh = maillage(calques.route, mat, "route");
  roadMesh.receiveShadow = true;
  const solidMesh = maillage(calques.solide, mat, "solide");
  solidMesh.castShadow = solidMesh.receiveShadow = true;
  const glowMesh = maillage(calques.lumineux, plain, "lumineux");
  const decorMesh = maillage(decor.decorG, mat, "decor");
  decorMesh.receiveShadow = true;
  decorMesh.castShadow = !!fines;
  decorMesh.userData.heavy = true;
  const decorGlow = maillage(decor.glowG, new MeshBasicMaterial({ vertexColors: true }), "decorLumineux");
  decorGlow.userData.heavy = true;
  const denseMesh = maillage(decor.denseG, mat, "dense");
  denseMesh.receiveShadow = true;
  const denseGlow = maillage(decor.denseGlow, new MeshBasicMaterial({ vertexColors: true }), "denseLumineux");
  denseMesh.userData.level = denseGlow.userData.level = 2;
  // Occlusion par sommets de C : le pied des murs, des piliers et des objets s'assombrit (une fois, à la construction ; rien par image).
  for (const m of [roadMesh, solidMesh, decorMesh, denseMesh]) occlusionSommets(m.geometry as BufferGeometry, tc.ao);
  for (const m of [roadMesh, solidMesh, glowMesh, decorMesh, decorGlow, denseMesh, denseGlow]) if (m.geometry.getAttribute("position").count > 0) scene.add(m);
  for (const banner of calques.bandeaux) scene.add(banner);
  if (calques.affiches.pos.length > 0) {
    // Les sponsors (un atlas, un maillage) : éclairés comme le décor, ce ne sont pas des écrans.
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(calques.affiches.pos, 3));
    g.setAttribute("uv", new Float32BufferAttribute(calques.affiches.uv, 2));
    g.computeVertexNormals();
    const aff = new Mesh(g, new MeshStandardMaterial({ map: options.headless ? null : atlasSponsors(), side: DoubleSide, roughness: 0.85 }));
    aff.receiveShadow = true;
    aff.userData.calque = "affiches";
    scene.add(aff);
  }

  // --- La nuit : flaques de lumière sous les lampadaires de piste, quatre lampes réelles posées sur les plus proches de la voiture ---
  const lampes: PointLight[] = [];
  const sources = geo.eclairage?.sources ?? [];
  if (tc.lampes && geo.eclairage && sources.length > 0 && !aerien) {
    const pos: number[] = [];
    const uv: number[] = [];
    const R = 8;
    for (const f of geo.eclairage.flaques) {
      for (const [dx, dz, u, v] of [[-R, -R, 0, 0], [R, -R, 1, 0], [R, R, 1, 1], [-R, -R, 0, 0], [R, R, 1, 1], [-R, R, 0, 1]] as const) {
        pos.push(f[0] + dx, f[1], f[2] + dz);
        uv.push(u, v);
      }
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(pos, 3));
    g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
    const flaques = new Mesh(g, new MeshBasicMaterial({ map: textureFlaque(tc.lampes.couleur), transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
    flaques.renderOrder = 3;
    flaques.userData.level = 1;
    scene.add(flaques);
    for (let i = 0; i < tc.lampes.nombre; i++) {
      const l = new PointLight(tc.lampes.couleur, tc.lampes.intensite, tc.lampes.portee, 1.6);
      l.userData.level = 1;
      lampes.push(l);
      scene.add(l);
    }
  }
  const choix = new Int32Array(lampes.length);
  const dist = new Float64Array(lampes.length);
  const proches = (px: number, pz: number) => {
    dist.fill(Infinity);
    choix.fill(-1);
    for (let i = 0; i < sources.length; i++) {
      const dd = (sources[i]![0] - px) ** 2 + (sources[i]![2] - pz) ** 2;
      let k = lampes.length - 1;
      if (dd >= dist[k]!) continue;
      while (k > 0 && dd < dist[k - 1]!) {
        dist[k] = dist[k - 1]!;
        choix[k] = choix[k - 1]!;
        k--;
      }
      dist[k] = dd;
      choix[k] = i;
    }
  };

  // Halos (lot 23) : néons, plaques, portes, lampadaires ; un seul `Points` additif, qualité ≥ 1.
  const halos = aerien ? null : buildHalos([calques.route, calques.solide, calques.lumineux, decor.decorG, decor.glowG, decor.denseGlow].flatMap((b) => b.halos), look.halo);
  if (halos) scene.add(halos.points);

  // Ciel et horizon suivent la caméra (donc la voiture) : toujours à l'horizon. Le disque est posé d'où vient la lumière.
  const backdrop = new Group();
  if (!aerien) {
    const amb = ambianceP1(palette, base, pal, look);
    backdrop.add(ciel(amb, seeded(`${track.id}:${palette}:ciel`), nuit, sunDir), silhouettes(amb, seeded(`${track.id}:${palette}:loin`)));
  }
  scene.add(backdrop);

  // Le sol lointain, aux couleurs de C ; en miniature d'un thème sombre, celles de l'existant (plus claires : la miniature se lit en petit).
  const [solA, solB] = leve ? [base.floorA, base.floorB] : tc.sol;
  const floor = new Mesh(new PlaneGeometry(TAILLE_SOL, TAILLE_SOL), new MeshStandardMaterial({ map: options.headless ? null : checkerTexture(solA, solB, TAILLE_SOL / (2 * CASE_SOL)), flatShading: true }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  floor.userData.calque = "sol";
  scene.add(floor);

  // --- Lot 46 : les pas à la demande posent leurs maillages (la vie, le ciel) ; ils s'animent sur un temps d'affichage ---
  const coupes = new Set(options.coupes);
  const animations = aerien ? [] : (options.pas ?? []).flatMap((p) => {
    const a = p.poser?.({ scene, calques, x: geo.x, decor, soleil: sunDir, coupes, sansDom: !!options.headless });
    return a ? [[p.id, a] as const] : [];
  });

  // --- Feux de départ : les couleurs des lampes dans le calque `lumineux`, repeintes quand l'état du décompte change ---
  const couleurs = glowMesh.geometry.getAttribute("color") as BufferAttribute;
  const lin = new Color();
  const lineaire = (hex: number): [number, number, number] => (lin.set(hex), [lin.r, lin.g, lin.b]);
  let etatFeux: EtatFeux = FEUX_ETEINTS;

  let shadowSize = 0;
  let currentLevel: 0 | 1 | 2 = 2;
  const setQuality = (level: 0 | 1 | 2, shadows = true) => {
    currentLevel = level;
    scene.traverse((o) => {
      // Seuls les objets marqués (`level`, ou `heavy` = niveau 1) sont touchés : les effets, la voiture et le fantôme gèrent leur visibilité eux-mêmes.
      const min = (o.userData.level as number | undefined) ?? (o.userData.heavy ? 1 : undefined);
      if (min !== undefined) o.visible = level >= min;
    });
    // Ombres : carte de 512 (qualité 1) ou 1024 (qualité 2) ; coupées à la qualité 0. `shadows` : le réglage « ombres » du joueur (lot 29).
    const want = aerien || !shadows ? 0 : level === 2 ? (fines?.carte ?? 1024) : level === 1 ? 512 : 0;
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
  setQuality(2);

  return {
    scene,
    look,
    dispose: () => {
      for (const [, a] of animations) a.dispose?.();
      // Cartes d'ombres des lumières (le Salon change de scène toutes les dix minutes : rien ne doit s'accumuler côté carte graphique). L'atlas des sponsors
      // est partagé entre les scènes (dessiné une fois) : on ne le libère pas.
      scene.traverse((o) => (o as { shadow?: { map?: { dispose(): void } | null } }).shadow?.map?.dispose());
      scene.traverse((o) => {
        const m = (o as Mesh).material as MeshStandardMaterial | undefined;
        if (m && !Array.isArray(m) && m.map && m.map === (options.headless ? null : atlasSponsors())) m.map = null;
      });
      disposeScene(scene);
    },
    setQuality,
    setLite(on) {
      setQuality(on ? 0 : 2);
    },
    setView(heightPx, fovDeg) {
      halos?.setView(heightPx, fovDeg);
    },
    stats(): SceneStats {
      let hills = false;
      backdrop.traverse((o) => {
        if (o.userData.level === 2 && o.visible) hills = true;
      });
      const fog = scene.fog as Fog | null;
      return { quality: currentLevel, shadowMap: sun.castShadow ? shadowSize : 0, headlights: head.visible ? head.intensity : 0, halos: { count: halos ? halos.points.geometry.getAttribute("position").count : 0, visible: !!halos?.points.visible }, denseDecor: denseMesh.visible, hills, signs: geo.signs, fog: fog ? { near: fog.near, far: fog.far } : null, ...(geo.feux ? { feux: etatFeux } : {}), ...(options.pas?.length && !aerien ? { pas: Object.fromEntries(options.pas.map((p) => [p.id, animations.find(([id]) => id === p.id)?.[1].stats?.() ?? {}])) } : {}) };
    },
    followGround(px, pz) {
      backdrop.position.set(px, floorY, pz);
      floor.position.x = Math.round(px / (2 * CASE_SOL)) * 2 * CASE_SOL;
      floor.position.z = Math.round(pz / (2 * CASE_SOL)) * 2 * CASE_SOL;
    },
    followCar(px, py, pz, yaw, hood = false) {
      // Ombres : la fenêtre de la carte est posée devant la voiture (là où regarde la caméra), par pas d'un mètre (les bords ne scintillent pas).
      const tx = Math.round(px + Math.sin(yaw) * avance);
      const ty = Math.round(py);
      const tz = Math.round(pz + Math.cos(yaw) * avance);
      sun.target.position.set(tx, ty, tz);
      sun.position.set(tx + sunOffset.x, ty + sunOffset.y, tz + sunOffset.z);
      if (head.visible) {
        const s = Math.sin(yaw);
        const c = Math.cos(yaw);
        head.position.set(px + s * 1.2, py + 0.75, pz + c * 1.2);
        head.target.position.set(px + s * 24, py - 0.4, pz + c * 24);
        head.intensity = HEADLIGHT_POWER * look.headlights * (hood ? HOOD_HEADLIGHT : 1);
      }
      if (lampes.length > 0) {
        proches(px, pz);
        lampes.forEach((l, i) => {
          const s = sources[choix[i]!];
          if (s) l.position.set(s[0], s[1] - 0.4, s[2]);
        });
      }
    },
    ...(animations.length > 0
      ? {
          animer(t: number, camera: PerspectiveCamera, hauteurPx: number) {
            for (const [, a] of animations) a.animer?.(t, camera, hauteurPx);
          },
          arrivee(t: number) {
            for (const [, a] of animations) a.arrivee?.(t);
          },
        }
      : {}),
    feux(etat) {
      if (!geo.feux || memesFeux(etat, etatFeux)) return;
      etatFeux = etat;
      const plage = geo.feux.peindre(couleurs.array as Float32Array, etat, lineaire);
      if (!plage) return;
      couleurs.clearUpdateRanges();
      couleurs.addUpdateRange(plage[0], plage[1] - plage[0]);
      couleurs.needsUpdate = true;
    },
  };
}
