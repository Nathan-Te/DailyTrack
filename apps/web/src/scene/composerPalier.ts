// Retouche 38b — la scène d'un circuit **à un palier de qualité** : le mélange recommandé du lot 38, nettoyé (palier 1), puis les pas des paliers
// 2 et 3, chacun commutable (`Reglages`, `paliers.ts`). Même interface que `buildTrackScene` (`TrackScene`), plus ce qu'il faut pour les pas qui
// demandent le moteur de rendu (la carte d'environnement), le temps (la vie, les nuages) ou une chaîne de passes (post-traitement).
// **Rendu seul** : la route qui porte la voiture suit les mêmes points que la simulation à tous les paliers ; rien ne touche à `sim`.
//
// Ce que le palier 1 nettoie du mélange du lot 38 (en plus de `palier1.ts`) :
//   - la lumière de C (ciel à quatre arrêts, brume, lumières, ombres, exposition, silhouettes fondues) est **construite directement** : plus de
//     scène construite puis repassée (`appliquerC`), plus de ciel dessiné puis jeté ;
//   - les ombres de contact : seuls les rebords et les éléments projettent sur la piste (le lot 38 redessinait toute la route dans la carte d'ombres) ;
//   - les lampes de la nuit suivent l'éclairage de piste qu'on pose (le lot 38 les retrouvait en lisant les couleurs des halos) ;
//   - le soleil (ou la lune) est dessiné **d'où vient la lumière** (il était à l'opposé, dans le jeu comme au lot 38).
import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  type CanvasTexture,
  Color,
  type DataTexture,
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
  type Object3D,
  PointLight,
  Points,
  Scene,
  type ShaderMaterial,
  SpotLight,
  Texture,
  Vector3,
  type Material,
  type PerspectiveCamera,
  type WebGLRenderer,
} from "three";
import { CELL, FALL_DEPTH, type PaletteName, type Track } from "@cdj/sim";
import { buildHalos } from "../halo";
import { Builder, mix, seeded } from "../meshKit";
import { signsFor } from "../signage";
import { fastZones } from "../speedFeel";
import { LOOKS, PALETTE_DEFS, disposeScene, type SceneStats, type TrackScene } from "../trackMesh";
import { construireRoute } from "./route";
import { Affiches } from "./outils";
import { ambianceDOrigine, ciel, silhouettes } from "./ciel";
import { THEMES_C, occlusionSommets, textureFlaque } from "./lumiere";
import { texturedCielC } from "./textures";
import { SOLS_C, grain, texturedSol, uvMonde } from "./decor/matiereC";
import { arriveeP, coupureP, eclairagePisteP, paletteP1, panneauP, panneauxDistanceP, plaqueP, porteP, portiqueDepartP, routeP, rythmeP, sponsorsRebordsP, turboP } from "./palier1";
import { atlasSponsors } from "./sponsors";
import { bordureVideB, rebordB } from "./piste";
import { Drapeaux, FINITION_ELEMENTS, marque, varierInstance, varierParPosition, type Marque } from "./finition";
import { verserDrapeaux } from "./drapeaux";
import { matiereAsphalte, matiereBeton, matiereDecor, matiereMetal, matieresDessinees, teinteLarge, tracesEtMarquages, type Matiere } from "./matiere";
import { detailleeAsphalte, detailleeBeton, detailleeDecor, detailleeMetal } from "./matiereDetaillee";
import { memoireScene, type MemoireScene } from "./memoire";
import { carteEnvironnement } from "./reflets";
import { brumeDeProfondeur, domeDuCiel, uniformesBrume, type Theme3 } from "./lumiere3";
import { THEMES_3 } from "./themes3";
import { Chronometre, drapeauxAnimes, ecransDuDepart, fouleAnimee, maillageEcrans, particules, rubanDesEcrans, suivreCamera, type Temps } from "./vie";
import { avecPost, type Reglages } from "./paliers";
import type { ReglagesPost } from "./post";
import { HORIZONS, type Ambiance, type Calques, type Contexte, type ModuleDecor } from "./types";

export interface ScenePalier extends TrackScene {
  readonly reglages: Reglages;
  readonly palette: PaletteName;
  readonly theme3: Theme3;
  /** Le dôme du ciel (pas « nuages ») : la chaîne de post-traitement le masque pendant l'occlusion. */
  readonly dome: Mesh | null;
  /** Temps passé à dessiner les textures de matière pour cette scène (ms) ; 0 si elles l'étaient déjà (une fois au chargement dans le jeu). */
  readonly texturesMs: number;
  /** Ce qui demande le moteur de rendu (carte d'environnement) : à appeler avant la première image. Idempotent. */
  preparer(renderer: WebGLRenderer): void;
  /** Avant chaque image : temps (s), caméra, hauteur de l'image (pixels) — vie, nuages, particules. */
  animer(t: number, camera: PerspectiveCamera, hauteurPx: number): void;
  memoire(): MemoireScene;
  /** La chaîne de post-traitement voulue (palier 3), ou `null` : on dessine directement à l'écran (MSAA du moteur, comme le jeu). */
  post(): ReglagesPost | null;
}

const SHADOW_HALF = 42;
/** Pas « ombres » : une carte deux fois plus fine en pixels, 120 m de côté, posée devant la voiture (là où regarde la caméra). */
const OMBRES_HALF = 60;
const OMBRES_AVANT = 34;
const HEADLIGHT_POWER = 900;

/** Les matériaux d'une scène selon ses pas : un par calque quand la matière ou les reflets l'exigent, sinon un seul (comme le lot 38). */
function materiaux(r: Reglages) {
  // La matière sobre (38c) ; l'ancienne matière « détaillée » (comparaison seulement) l'emporte si elle est cochée.
  const textures = r.detaillee
    ? { route: detailleeAsphalte(), rebords: detailleeBeton(), solide: detailleeMetal(), decor: detailleeDecor() }
    : r.matiere
      ? { route: matiereAsphalte(), rebords: matiereBeton(), solide: matiereMetal(), decor: matiereDecor() }
      : null;
  // Rugosité et métal par calque (pas « reflets ») : l'asphalte reste mat, la peinture des rebords satinée, le métal des portiques brille.
  const fini = { route: [0.92, 0], rebords: [0.62, 0], solide: [0.42, 0.35], decor: [0.85, 0] } as const;
  const make = (cle: keyof typeof fini) => {
    const t: Matiere | null = textures ? textures[cle] : null;
    const [rugosite, metal] = r.reflets ? fini[cle] : [1, 0];
    const m = new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide, roughness: rugosite, metalness: metal, map: t ? t.map : grain() });
    if (t) {
      // `uvMonde(…, 4)` : une unité de texture = 4 m ; la matière se répète tous les `echelle` m.
      for (const tx of [t.map, t.normalMap, t.roughnessMap]) tx?.repeat.set(4 / t.echelle, 4 / t.echelle);
      if (t.normalMap) {
        m.normalMap = t.normalMap;
        m.normalScale.set(t.relief, t.relief);
      }
      if (t.roughnessMap) {
        m.roughnessMap = t.roughnessMap;
        if (!r.reflets) m.roughness = 1;
      }
      teinteLarge(m, t.teinte);
    }
    return m;
  };
  if (!textures && !r.reflets) {
    const un = make("route");
    return { route: un, rebords: un, solide: un, decor: un };
  }
  return { route: make("route"), rebords: make("rebords"), solide: make("solide"), decor: make("decor") };
}

/** Passe en lumière linéaire un nuanceur qui écrit des couleurs d'écran (`gl_FragColor = vec4(c, 1.0)`) : pour la chaîne de post-traitement. */
export function lineariser(m: ShaderMaterial) {
  m.fragmentShader = m.fragmentShader.replace(/gl_FragColor\s*=\s*vec4\(([^;]*),\s*1\.0\);/, "gl_FragColor = vec4(pow(max($1, vec3(0.0)), vec3(2.2)), 1.0);");
  m.needsUpdate = true;
}

/** Linéarise les halos (`Points` de `halo.ts`) d'une liste d'objets : ceux de l'éclairage de piste de la Nuit, construits à part. */
export function lineariserHalos(objets: readonly Object3D[]) {
  for (const o of objets) if (o instanceof Points) lineariser(o.material as ShaderMaterial);
}

export interface OptionsPalier {
  /** Vue aérienne (miniatures) : ni ciel, ni brume, ni bandeaux, ni vie. */
  aerial?: boolean;
  /** Lot 44 : le décor du thème (celui du jeu, `decor/<thème>.ts`), chargé par la vitrine avant de construire. Absent : pas de décor. */
  decor?: ModuleDecor | null;
}

/** Construit la scène d'un circuit au palier donné (réglages). */
export function composerPalier(track: Track, paletteName: PaletteName, r: Reglages, options: OptionsPalier = {}): ScenePalier {
  const avantTextures = matieresDessinees().reduce((n, m) => n + m.ms, 0);
  const aerien = !!options.aerial;
  const base = PALETTE_DEFS[paletteName];
  const pal = paletteP1(paletteName, base);
  const look = { ...LOOKS[paletteName], exposure: THEMES_C[paletteName].exposition };
  const tc = THEMES_C[paletteName];
  const t3 = THEMES_3[paletteName];
  const floorY = track.voidY - FALL_DEPTH;
  const vivant = !aerien;
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
    aerien,
    rebords: new Builder(),
    // Les drapeaux existent dès qu'un pas les demande : figés (géométrie), ou animés (drapeaux, même sans le reste de la géométrie).
    ...(r.geometrie || (r.drapeaux && !aerien) ? { drapeaux: new Drapeaux() } : {}),
    ...(r.ecrans && vivant ? { ecrans: new Affiches(), chrono: new Affiches() } : {}),
    ...(r.foule && vivant ? { foule: [] } : {}),
  };
  // Lot 43 : les éléments de course sont ceux du jeu (`palier1.ts`) ; le pas « géométrie » leur arrive par le contexte (`finition.ts`). La vitrine est un
  // outil interne, en français : ses bandeaux disent « DÉPART » et « ARRIVÉE » (le jeu lit son catalogue).
  const varie = seeded(`${track.id}:${paletteName}:variete`);
  // Lot 44 : la variété du décor (pas « variété ») lui arrive par le contexte, comme la géométrie aux éléments : le décor du jeu n'importe pas `finition.ts`.
  const varierDecor = r.variete ? { marque: (c: Calques) => marque(c), varier: (c: Calques, m: unknown, x: number, sol: number, z: number) => varierInstance(c, m as Marque, x, sol, z, varie) } : undefined;
  const ctx: Contexte = { palette: paletteName, pal, look, track, floorY, reglages: r, varie, textes: { depart: "DÉPART", arrivee: "ARRIVÉE" }, ...(r.geometrie ? { finition: FINITION_ELEMENTS } : {}), ...(varierDecor ? { varierDecor: varierDecor as Contexte["varierDecor"] } : {}) };
  const style = routeP(paletteName, r, { rebord: (nom, sorte) => rebordB(nom, sorte), bordureVide: bordureVideB });
  construireRoute(track, pal, style, { route: calques.route, lumineux: calques.lumineux, rebords: calques.rebords }, floorY, { lissage: r.geometrie ? 2 : 1 });
  const fast = fastZones(track);
  const rythme = new Builder();
  for (const b of track.blocks) {
    if (b.kind === "boost") plaqueP(calques, ctx, b);
    if (b.kind === "turbo") turboP(calques, ctx, b);
    if (b.kind === "cut") coupureP(calques, ctx, b);
    if (!aerien) rythmeP({ ...calques, solide: rythme, lumineux: calques.lumineux }, ctx, b, fast[b.index] ?? false);
    if (b.mark === "checkpoint") porteP(calques, ctx, b);
    if (b.mark === "finish") arriveeP(calques, ctx, b, CELL / 2);
    if (b.mark === "start") portiqueDepartP(calques, ctx, b, 26);
  }
  let signs = 0;
  if (!aerien) {
    const liste = signsFor(track);
    for (const s of liste) {
      panneauP(calques, ctx, track.blocks[s.block]!, s);
      signs++;
    }
    panneauxDistanceP(calques, ctx, liste);
    sponsorsRebordsP(calques, ctx);
  }
  // Lot 44 : le décor du jeu (le sol relevé, la tribune, les recettes du thème), avec les crochets des pas (drapeaux, foule, écrans, variété).
  options.decor?.construire(calques, ctx);
  // Palier 3, pas « écrans » : les panneaux à diodes du départ, sur les rebords (`vie.ts`, comme le jeu).
  if (r.ecrans) ecransDuDepart(calques, ctx);
  if (r.traces) tracesEtMarquages(calques.route, track, (b) => style.couleurRoute(b, pal), pal.dash);
  if (r.variete) {
    varierParPosition(calques.rebords!, 4, 0.07, 38);
    varierParPosition(calques.solide, 3, 0.04, 39);
  }
  const piste = tc.lampes && !aerien ? eclairagePisteP(calques, ctx, tc.lampes.couleur) : null;
  const drapeauxAnimesOn = r.drapeaux && vivant && calques.drapeaux && !calques.drapeaux.vide;
  if (calques.drapeaux && !drapeauxAnimesOn) verserDrapeaux(calques.drapeaux, calques.solide);

  // --- Lumière (celle de C, construite directement) ---
  const scene = new Scene();
  const nuit = pal.scenery === "lamps" || pal.scenery === "pylons";
  const h = pal.sunHeight;
  const sunPos = new Vector3(40 * (1.2 - h) * 1.4, 30 + 110 * h, -30 * (1.2 - h) * 1.4);
  const sunDir = sunPos.clone().normalize();
  const amb: Ambiance = (() => {
    const a = ambianceDOrigine(pal, look);
    const fond = (c: number) => mix(c, tc.brume[0], tc.silhouettes);
    return { ...a, ciel: { zenith: tc.ciel[0], horizon: tc.ciel[2], bandes: false }, silhouettes: { corps: fond(base.mountain), sommet: fond(base.mountainTop), plates: false, forme: HORIZONS[paletteName] } };
  })();
  if (!aerien) {
    scene.background = texturedCielC(tc.ciel);
    scene.fog = new Fog(tc.brume[0], tc.brume[1], tc.brume[2]);
  }
  const hemi = new HemisphereLight(tc.hemi[0], tc.hemi[1], tc.hemi[2] * (r.reflets ? 0.6 : 1));
  scene.add(hemi, new AmbientLight(tc.hemi[0], tc.ambiante));
  const sun = new DirectionalLight(tc.soleil[0], tc.soleil[1]);
  sun.position.copy(sunPos);
  const sunOffset = sunDir.clone().multiplyScalar(150);
  scene.add(sun, sun.target);
  const demi = r.ombres ? OMBRES_HALF : SHADOW_HALF;
  sun.shadow.camera.left = -demi;
  sun.shadow.camera.right = demi;
  sun.shadow.camera.top = demi;
  sun.shadow.camera.bottom = -demi;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 340;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = r.ombres ? 0.04 : 0.06;
  sun.shadow.intensity = tc.ombre[0];
  sun.shadow.radius = tc.ombre[1];
  const head = new SpotLight(0xfff1d0, 0, 130, 0.7, 0.8, 1.2);
  scene.add(head, head.target);

  // --- Calques ---
  const mats = materiaux(r);
  const plain = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const maillage = (g: Builder, mat: Material, calque: string) => {
    const m = new Mesh(g.geometry(), mat);
    m.userData.calque = calque;
    return m;
  };
  const roadMesh = maillage(calques.route, mats.route, "route");
  roadMesh.receiveShadow = true;
  const rebordsMesh = maillage(calques.rebords!, mats.rebords, "rebords");
  rebordsMesh.castShadow = rebordsMesh.receiveShadow = true;
  const solidMesh = maillage(calques.solide, mats.solide, "solide");
  solidMesh.castShadow = solidMesh.receiveShadow = true;
  const glowMesh = maillage(calques.lumineux, plain, "lumineux");
  const decorMesh = maillage(calques.decor, mats.decor, "decor");
  decorMesh.receiveShadow = true;
  decorMesh.castShadow = r.ombres;
  decorMesh.userData.heavy = true;
  const decorGlow = maillage(calques.decorLumineux, plain, "decorLumineux");
  decorGlow.userData.heavy = true;
  const denseMesh = maillage(calques.dense, mats.decor, "dense");
  denseMesh.receiveShadow = true;
  denseMesh.userData.level = 2;
  const rythmeMesh = maillage(rythme, mats.solide, "rythme");
  rythmeMesh.userData.heavy = true;
  const eclaires = [roadMesh, rebordsMesh, solidMesh, decorMesh, denseMesh, rythmeMesh];
  // Matière de C : occlusion par sommets, coordonnées « monde » (grain ou matière du palier 2).
  for (const m of eclaires) {
    const geo = m.geometry as BufferGeometry;
    if (geo.getAttribute("position").count === 0) continue;
    occlusionSommets(geo, tc.ao);
    uvMonde(geo, 4);
  }
  for (const m of [...eclaires, glowMesh, decorGlow]) if (m.geometry.getAttribute("position").count > 0) scene.add(m);
  for (const banner of calques.bandeaux) scene.add(banner);
  for (const [liste, atlas, calque] of [[calques.affiches, atlasSponsors(), "affiches"]] as const) {
    if (liste.pos.length === 0) continue;
    // Les affiches sont éclairées (ce ne sont pas des écrans) : un matériau physique, l'atlas en couleur.
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(liste.pos, 3));
    geo.setAttribute("uv", new Float32BufferAttribute(liste.uv, 2));
    geo.computeVertexNormals();
    const aff = new Mesh(geo, new MeshStandardMaterial({ map: atlas, side: DoubleSide, roughness: 0.8 }));
    aff.receiveShadow = true;
    aff.userData.calque = calque;
    scene.add(aff);
  }
  const all = [calques.route, calques.rebords!, calques.solide, calques.lumineux, calques.decor, calques.decorLumineux, calques.dense, rythme];
  const halos = aerien ? null : buildHalos(all.flatMap((b) => b.halos), look.halo);
  if (halos) {
    // Le nuanceur des halos (halo.ts, celui du jeu) écrit ses couleurs telles quelles, pour l'écran. Dessinés dans la cible linéaire du
    // post-traitement puis convertis par la passe de sortie, ils sortiraient beaucoup plus clairs (de gros disques) : on les linéarise ici.
    if (avecPost(r)) lineariser(halos.points.material as ShaderMaterial);
    scene.add(halos.points);
  }

  const backdrop = new Group();
  if (!aerien) backdrop.add(ciel(amb, seeded(`${track.id}:${paletteName}`), nuit, sunDir), silhouettes(amb, seeded(`${track.id}:${paletteName}:loin`)));
  scene.add(backdrop);

  const size = 1200;
  const tile = 8;
  const solTex = texturedSol(SOLS_C[paletteName], tc.sol[0], tc.sol[1]);
  solTex.repeat.set(size / (2 * tile), size / (2 * tile));
  const floor = new Mesh(new PlaneGeometry(size, size), new MeshStandardMaterial({ map: solTex, flatShading: true }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  floor.userData.calque = "sol";
  scene.add(floor);

  // --- La nuit : éclairage de piste et quatre lampes réelles, posées à chaque image sur les lampadaires les plus proches de la voiture ---
  const lampes: PointLight[] = [];
  const sources: [number, number, number][] = [];
  if (tc.lampes && piste) {
    // Lot 43 : les lampadaires sont posés avec les éléments (`eclairagePisteP`, dans les calques : règles du lot 37) ; ici, les flaques de lumière.
    const pos: number[] = [];
    const uv: number[] = [];
    const R = 8;
    for (const f of piste.flaques) {
      for (const [dx, dz, u, v] of [[-R, -R, 0, 0], [R, -R, 1, 0], [R, R, 1, 1], [-R, -R, 0, 0], [R, R, 1, 1], [-R, R, 0, 1]] as const) {
        pos.push(f[0] + dx, f[1], f[2] + dz);
        uv.push(u, v);
      }
    }
    if (pos.length > 0) {
      const g = new BufferGeometry();
      g.setAttribute("position", new Float32BufferAttribute(pos, 3));
      g.setAttribute("uv", new Float32BufferAttribute(uv, 2));
      const flaques = new Mesh(g, new MeshBasicMaterial({ map: textureFlaque(tc.lampes.couleur), transparent: true, depthWrite: false, blending: AdditiveBlending, side: DoubleSide, polygonOffset: true, polygonOffsetFactor: -2 }));
      flaques.renderOrder = 3;
      scene.add(flaques);
    }
    sources.push(...piste.sources);
    if (sources.length > 0) {
      for (let i = 0; i < tc.lampes.nombre; i++) {
        const l = new PointLight(tc.lampes.couleur, tc.lampes.intensite, tc.lampes.portee, 1.6);
        l.userData.level = 1;
        lampes.push(l);
        scene.add(l);
      }
    }
  }
  const choix = new Int32Array(lampes.length);
  const dist = new Float64Array(lampes.length);
  const proches = (x: number, z: number) => {
    dist.fill(Infinity);
    choix.fill(-1);
    for (let i = 0; i < sources.length; i++) {
      const dd = (sources[i]![0] - x) ** 2 + (sources[i]![2] - z) ** 2;
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

  // --- Palier 3 : la vie, le ciel, la brume ---
  const temps: Temps = { uTemps: { value: 0 } };
  const animes: Mesh[] = [];
  if (drapeauxAnimesOn) animes.push(drapeauxAnimes(calques.drapeaux!, temps));
  const foule = calques.foule ? fouleAnimee(calques.foule, temps) : null;
  if (foule) scene.add(foule);
  let ruban: CanvasTexture | null = null;
  let chrono: Chronometre | null = null;
  if (calques.ecrans) {
    ruban = rubanDesEcrans(paletteName);
    const m = maillageEcrans(calques.ecrans, ruban);
    if (m) animes.push(m);
    chrono = new Chronometre();
    const c = maillageEcrans(calques.chrono!, chrono.texture);
    if (c) animes.push(c);
  }
  for (const m of animes) scene.add(m);
  const dome = r.nuages && vivant ? domeDuCiel(tc.ciel, sunDir, tc.soleil[0], t3) : null;
  if (dome) scene.add(dome);
  const poussiere = r.particules && vivant ? particules(t3, temps) : null;
  if (poussiere) scene.add(poussiere);
  // Toute surface a ses normales (les bandeaux et les écrans n'en avaient pas : sans éclairage, ils s'en passaient) — l'occlusion à l'écran les lit.
  scene.traverse((o) => {
    const g = (o as Mesh).geometry as { getAttribute?(n: string): unknown; computeVertexNormals?(): void } | undefined;
    if ((o as Mesh).isMesh && g?.getAttribute && !g.getAttribute("normal")) g.computeVertexNormals?.();
  });
  if (r.brume && vivant) {
    const u = uniformesBrume(t3, floorY, sunDir);
    const vus = new Set<Material>();
    scene.traverse((o) => {
      const m = (o as Mesh).material as Material | Material[] | undefined;
      for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
        if (vus.has(mat)) continue;
        vus.add(mat);
        brumeDeProfondeur(mat, u);
      }
    });
  }

  // --- Reflets : la carte d'environnement, au moment de la première image (elle demande le moteur de rendu) ---
  let env: ReturnType<typeof carteEnvironnement> | null = null;
  const preparer = (renderer: WebGLRenderer) => {
    if (!r.reflets || env) return;
    env = carteEnvironnement(renderer, { ciel: tc.ciel, sol: new Color(tc.sol[0]).getHex(), soleil: { direction: sunDir, couleur: tc.soleil[0], force: Math.min(1.5, tc.soleil[1] / 2) }, horizon: amb.silhouettes.corps });
    scene.environment = env.texture;
    scene.environmentIntensity = t3.environnement;
  };

  let shadowSize = 0;
  let currentLevel: 0 | 1 | 2 = 2;
  const setQuality = (level: 0 | 1 | 2, shadows = true) => {
    currentLevel = level;
    scene.traverse((o) => {
      const min = (o.userData.level as number | undefined) ?? (o.userData.heavy ? 1 : undefined);
      if (min !== undefined) o.visible = level >= min;
    });
    const want = aerien || !shadows ? 0 : level === 2 ? (r.ombres ? 2048 : 1024) : level === 1 ? 512 : 0;
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
  const texturesMs = matieresDessinees().reduce((n, m) => n + m.ms, 0) - avantTextures;

  return {
    scene,
    look,
    reglages: r,
    palette: paletteName,
    theme3: t3,
    dome,
    texturesMs,
    preparer,
    dispose: () => {
      scene.traverse((o) => (o as { shadow?: { map?: { dispose(): void } | null } }).shadow?.map?.dispose());
      // Les textures de matière, du grain et des nuages sont partagées entre les scènes (dessinées une fois) : on ne les libère pas ici.
      const partagees = new Set<Texture>([grain(), ...matieresDessinees().flatMap((m) => [m.map, m.normalMap, m.roughnessMap].filter((x): x is DataTexture => x !== null))]);
      if (dome) partagees.add(dome.material.uniforms.uNuages!.value as Texture);
      scene.traverse((o) => {
        const m = (o as Mesh).material as Material | Material[] | undefined;
        for (const mat of Array.isArray(m) ? m : m ? [m] : []) {
          for (const [k, v] of Object.entries(mat)) if (v instanceof Texture && partagees.has(v)) (mat as unknown as Record<string, unknown>)[k] = null;
          const u = (mat as { uniforms?: Record<string, { value: unknown }> }).uniforms;
          if (u) for (const x of Object.values(u)) if (x.value instanceof Texture && partagees.has(x.value)) x.value = null;
        }
      });
      foule?.dispose();
      disposeScene(scene);
      env?.dispose();
    },
    setQuality,
    setLite(on) {
      setQuality(on ? 0 : 2);
    },
    setView(heightPx, fovDeg) {
      halos?.setView(heightPx, fovDeg);
    },
    stats(): SceneStats {
      const fog = scene.fog as Fog | null;
      return { quality: currentLevel, shadowMap: sun.castShadow ? shadowSize : 0, headlights: head.visible ? head.intensity : 0, halos: { count: halos ? halos.points.geometry.getAttribute("position").count : 0, visible: !!halos?.points.visible }, denseDecor: denseMesh.visible, hills: currentLevel === 2, signs, fog: fog ? { near: fog.near, far: fog.far } : null };
    },
    followGround(x, z) {
      backdrop.position.set(x, floorY, z);
      floor.position.x = Math.round(x / (2 * tile)) * 2 * tile;
      floor.position.z = Math.round(z / (2 * tile)) * 2 * tile;
    },
    followCar(x, y, z, yaw, hood = false) {
      // Pas « ombres » : la fenêtre des ombres est posée devant la voiture (là où regarde la caméra de poursuite).
      const av = r.ombres ? OMBRES_AVANT : 0;
      const tx = Math.round(x + Math.sin(yaw) * av);
      const ty = Math.round(y);
      const tz = Math.round(z + Math.cos(yaw) * av);
      sun.target.position.set(tx, ty, tz);
      sun.position.set(tx + sunOffset.x, ty + sunOffset.y, tz + sunOffset.z);
      if (head.visible) {
        const s = Math.sin(yaw);
        const c = Math.cos(yaw);
        head.position.set(x + s * 1.2, y + 0.75, z + c * 1.2);
        head.target.position.set(x + s * 24, y - 0.4, z + c * 24);
        head.intensity = HEADLIGHT_POWER * look.headlights * (hood ? 0.1 : 1);
      }
      if (lampes.length > 0) {
        proches(x, z);
        lampes.forEach((l, i) => {
          const s = sources[choix[i]!];
          if (s) l.position.set(s[0], s[1] - 0.4, s[2]);
        });
      }
    },
    animer(t, camera, hauteurPx) {
      temps.uTemps.value = t;
      if (dome) {
        dome.position.copy(camera.position);
        dome.material.uniforms.uTemps!.value = t;
      }
      if (poussiere) suivreCamera(poussiere, camera, hauteurPx); // lot 46 : comme le jeu (le couloir de la piste devant la caméra)
      if (ruban) ruban.offset.x = (t * 0.06) % 1;
      chrono?.afficher(t);
    },
    memoire(): MemoireScene {
      return memoireScene(scene);
    },
    post(): ReglagesPost | null {
      if (!avecPost(r)) return null;
      return { occlusion: r.occlusion, halo: r.halo, etalonnage: r.etalonnage, anticrenelage: r.anticrenelage, theme: t3, exposition: look.exposure, dome };
    },
  };
}
