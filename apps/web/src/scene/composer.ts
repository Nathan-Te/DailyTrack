// Lot 38 — le compositeur : la scène d'un circuit construite par une direction (route paramétrable, éléments, décor, ciel, lumière). Même interface
// que `buildTrackScene` (`TrackScene`) : la vitrine traite l'existant et les directions de la même façon, et un lot de mise en œuvre pourra faire de ce
// module la scène du jeu. Présentation seule : rien ne touche à `sim`.
import {
  AdditiveBlending,
  AmbientLight,
  BufferGeometry,
  CanvasTexture,
  Color,
  DataTexture,
  DirectionalLight,
  DoubleSide,
  Float32BufferAttribute,
  Fog,
  Group,
  HemisphereLight,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  MeshToonMaterial,
  NearestFilter,
  PlaneGeometry,
  Points,
  PointsMaterial,
  RedFormat,
  RepeatWrapping,
  Scene,
  SpotLight,
  SRGBColorSpace,
  type Texture,
  type Vector3,
} from "three";
import { CELL, FALL_DEPTH, cellKey, type PaletteName, type Track } from "@cdj/sim";
import { buildHalos } from "../halo";
import { Builder, mix, seeded, shade, world } from "../meshKit";
import { signsFor } from "../signage";
import { fastZones } from "../speedFeel";
import { PALETTE_DEFS, LOOKS, disposeScene, type Look, type Palette, type SceneStats, type TrackScene } from "../trackMesh";
import { construireRoute } from "./route";
import { Affiches, boite, face, repereSol } from "./outils";
import type { Ambiance, Calques, Contexte, Direction, PlaceDecor } from "./types";

const hex = (c: number) => `#${c.toString(16).padStart(6, "0")}`;

/** L'ambiance de l'existant (trackMesh.ts, lots 21 et 23), décrite par les champs d'une `Ambiance` : le point de départ de chaque direction. */
export function ambianceDOrigine(pal: Palette, look: Look): Ambiance {
  return {
    look,
    ciel: { zenith: pal.zenith, horizon: pal.sky, bandes: false },
    disque: pal.disc === null ? null : { couleur: pal.disc, taille: pal.scenery === "lamps" || pal.scenery === "pylons" ? 70 : 110, net: false },
    etoiles: pal.scenery === "lamps" || pal.scenery === "pylons" ? 160 : 0,
    hemi: [mix(pal.ambient[0], pal.zenith, 0.35), new Color(pal.floorB).getHex(), pal.ambient[1] * 0.45],
    ambiante: [pal.ambient[0], pal.ambient[1] * 0.12],
    soleil: [pal.sun[0], pal.sun[1] * 0.85],
    hauteurSoleil: pal.sunHeight,
    brume: { couleur: pal.sky, near: pal.fogNear / look.haze, far: pal.fogFar / look.haze },
    silhouettes: { corps: pal.mountain, sommet: pal.mountainTop, plates: false, forme: pal.scenery === "city" ? "ville" : "pics" },
  };
}

/** Le fond du ciel : un dégradé (existant, C) ou des aplats nets (A : la charte refuse les dégradés ; en 3D, des bandes). */
export function texturedCiel(a: Ambiance): CanvasTexture {
  const canvas = document.createElement("canvas");
  canvas.width = 2;
  canvas.height = 256;
  const ctx = canvas.getContext("2d")!;
  const { zenith, horizon, bandes } = a.ciel;
  if (bandes) {
    // Trois aplats : le zénith, une bande intermédiaire, l'horizon (à 62 % de la hauteur, comme le dégradé).
    ctx.fillStyle = hex(zenith);
    ctx.fillRect(0, 0, 2, 96);
    ctx.fillStyle = hex(mix(zenith, horizon, 0.55));
    ctx.fillRect(0, 96, 2, 50);
    ctx.fillStyle = hex(horizon);
    ctx.fillRect(0, 146, 2, 110);
  } else {
    const grad = ctx.createLinearGradient(0, 0, 0, 256);
    grad.addColorStop(0, hex(zenith));
    grad.addColorStop(0.5, hex(mix(zenith, horizon, 0.78)));
    grad.addColorStop(0.62, hex(horizon));
    grad.addColorStop(1, hex(horizon));
    ctx.fillStyle = grad;
    ctx.fillRect(0, 0, 2, 256);
  }
  const tex = new CanvasTexture(canvas);
  tex.colorSpace = SRGBColorSpace;
  if (bandes) tex.magFilter = NearestFilter;
  return tex;
}

/**
 * Disque du soleil ou de la lune, et étoiles (comme `buildSky` de trackMesh.ts ; `net` : un disque plein, sans halo). `direction` (retouche 38b) :
 * le disque est posé **d'où vient la lumière** (dans le jeu et au lot 38, il était à l'opposé de la lumière du soleil).
 */
export function ciel(a: Ambiance, rnd: () => number, nuit: boolean, direction?: Vector3): Group {
  const group = new Group();
  if (a.disque) {
    const size = 128;
    const canvas = document.createElement("canvas");
    canvas.width = canvas.height = size;
    const ctx = canvas.getContext("2d")!;
    const c = new Color(a.disque.couleur);
    const rgb = `${Math.round(c.r * 255)},${Math.round(c.g * 255)},${Math.round(c.b * 255)}`;
    if (a.disque.net) {
      ctx.fillStyle = `rgb(${rgb})`;
      ctx.beginPath();
      ctx.arc(64, 64, 20, 0, Math.PI * 2);
      ctx.fill();
    } else {
      const grad = ctx.createRadialGradient(64, 64, 6, 64, 64, 62);
      grad.addColorStop(0, `rgba(${rgb},1)`);
      grad.addColorStop(0.18, `rgba(${rgb},0.95)`);
      grad.addColorStop(0.2, `rgba(${rgb},0.35)`);
      grad.addColorStop(1, `rgba(${rgb},0)`);
      ctx.fillStyle = grad;
      ctx.fillRect(0, 0, size, size);
    }
    const tex = new CanvasTexture(canvas);
    tex.colorSpace = SRGBColorSpace;
    const sprite = new Mesh(new PlaneGeometry(1, 1), new MeshBasicMaterial({ map: tex, transparent: true, fog: false, depthWrite: false, blending: AdditiveBlending }));
    sprite.scale.set(a.disque.taille, a.disque.taille, 1);
    if (direction) sprite.position.copy(direction).normalize().multiplyScalar(400);
    else sprite.position.set(-90, nuit ? 170 : 40 + 280 * a.hauteurSoleil, 380);
    sprite.renderOrder = -2;
    sprite.userData.heavy = true;
    sprite.lookAt(0, 0, 0);
    group.add(sprite);
  }
  if (a.etoiles > 0) {
    const stars: number[] = [];
    for (let i = 0; i < a.etoiles; i++) {
      const t = rnd() * Math.PI * 2;
      const e = 0.12 + rnd() * 0.85;
      stars.push(Math.cos(t) * Math.cos(e) * 400, Math.sin(e) * 400, Math.sin(t) * Math.cos(e) * 400);
    }
    const g = new BufferGeometry();
    g.setAttribute("position", new Float32BufferAttribute(stars, 3));
    const points = new Points(g, new PointsMaterial({ color: 0xffffff, size: 2.2, sizeAttenuation: false, fog: false, depthWrite: false, transparent: true, opacity: 0.85 }));
    points.renderOrder = -2;
    points.userData.heavy = true;
    group.add(points);
  }
  return group;
}

/**
 * Silhouettes lointaines en trois couches (comme `buildMountains`, lot 23) : une lointaine pâle, un anneau, des reliefs proches (qualité 2), fondus
 * vers l'horizon ; `plates` (A) : un aplat par pièce. La forme de chaque pièce suit l'horizon du thème (`FormeHorizon`).
 */
export function silhouettes(a: Ambiance, rnd: () => number): Group {
  const group = new Group();
  const horizon = a.ciel.horizon;
  const forme = a.silhouettes.forme;
  const layer = (n: number, rMin: number, rSpan: number, hMin: number, hSpan: number, wMin: number, wSpan: number, fadeTo: number, darker: number, twoPeaks: boolean, lum?: Builder, proches = false) => {
    const g = new Builder();
    const body = mix(a.silhouettes.corps, horizon, fadeTo);
    const tip = mix(a.silhouettes.sommet, horizon, fadeTo - 0.08);
    for (let i = 0; i < n; i++) {
      const t = (i / n) * Math.PI * 2 + rnd() * 0.12;
      const r = rMin + rnd() * rSpan;
      const h = hMin + rnd() * hSpan;
      const w = wMin + rnd() * wSpan;
      const v = a.silhouettes.plates ? 1 : 0.85 + rnd() * 0.25;
      const x = Math.cos(t) * r;
      const z = Math.sin(t) * r;
      const corps = shade(body, v * darker);
      if (forme === "ville" || (forme === "nuit" && i % 3 === 0 && fadeTo < 0.5)) {
        const bw = w * 0.45;
        const bh = h * 1.2;
        g.box(x - bw, -10, z - bw, x + bw, bh, z + bw, forme === "nuit" ? shade(body, 0.6) : corps);
        g.box(x - bw * 1.05, bh, z - bw * 1.05, x + bw * 1.05, bh + 2, z + bw * 1.05, forme === "nuit" ? shade(body, 0.5) : tip);
        if (lum) {
          // La nuit, des fenêtres allumées sur la face tournée vers le circuit.
          const r0 = repereSol(x, 0, z, Math.atan2(-x, -z));
          for (let y = 4; y < bh - 3; y += 7) for (let k = -bw + 3; k < bw - 3; k += 7) if (rnd() < 0.45) face(lum, r0, k, k + 3, y, y + 3.5, bw + 0.5, rnd() < 0.7 ? 0xffc46a : 0xbfe0ff);
        }
        continue;
      }
      if (forme === "tribunes" && !proches) {
        // L'anneau d'un stade : des tribunes tournées vers le circuit (gradins à bandes de foule, toit), et des mâts d'éclairage. Lot 43 : deux gradins (au
        // lieu de quatre) et pas de tribunes dans les reliefs proches : l'horizon du Stade ne coûte pas plus de triangles que les pics de l'existant.
        const r0 = repereSol(x, 0, z, Math.atan2(-x, -z));
        const ww = w * 0.55;
        const hh = 14 + h * 0.18;
        boite(g, r0, -ww, ww, -10, hh * 0.35, -12, 12, corps);
        // Gradins : de plus en plus hauts en s'éloignant du circuit (le repère regarde vers lui).
        for (let k = 0; k < 2; k++) boite(g, r0, -ww, ww, hh * (0.35 + k * 0.3), hh * (0.65 + k * 0.3), -12, 12 - k * 10, k % 2 === 0 ? shade(corps, 1.1) : mix(corps, 0x2e7dff, 0.35));
        boite(g, r0, -ww - 2, ww + 2, hh * 1.05, hh * 1.12, -14, 14, tip);
        if (i % 4 === 0) {
          boite(g, r0, ww + 4, ww + 6, -10, hh * 2.1, -12, -10, corps);
          boite(g, r0, ww + 1, ww + 9, hh * 2.1, hh * 2.4, -13, -9, tip);
        }
        continue;
      }
      if (forme === "collines") {
        g.prism(x, -10, z, w * 1.1, w * 0.45, h * 0.4, 7, corps, tip, rnd() * 3); // lot 43 : sept pans (neuf avant)
        continue;
      }
      if (forme === "buttes") {
        g.prism(x, -10, z, w * 0.75, w * 0.6, h * 0.42, 6, corps, corps, rnd() * 3);
        g.prism(x, -10 + h * 0.42, z, w * 0.6, w * 0.57, h * 0.06, 6, tip, tip, rnd() * 3);
        continue;
      }
      if (forme === "mesas") {
        // Une mesa : un corps et un chapeau de strates plus clair (lot 43 : deux étages de six pans au lieu de trois de sept).
        const tw = rnd() * 3;
        g.prism(x, -10, z, w * 0.62, w * 0.52, h * 0.5, 6, corps, corps, tw);
        g.prism(x, -10 + h * 0.5, z, w * 0.52, w * 0.46, h * 0.3, 6, tip, shade(corps, 1.08), tw);
        continue;
      }
      g.prism(x, -10, z, w, 0.5, forme === "nuit" ? h * 0.45 : h, 5 + Math.floor(rnd() * 2), corps, tip, rnd() * 3);
      if (twoPeaks && rnd() < 0.6) g.prism(Math.cos(t + 0.09) * (r - 28), -10, Math.sin(t + 0.09) * (r - 28), w * 0.6, 0.5, h * 0.55 * (forme === "nuit" ? 0.45 : 1), 5, shade(body, (a.silhouettes.plates ? 0.92 : 0.95 + rnd() * 0.2) * darker), tip, rnd() * 3);
    }
    const mesh = new Mesh(g.geometry(), new MeshBasicMaterial({ vertexColors: true, fog: false, side: DoubleSide }));
    mesh.renderOrder = -1;
    mesh.userData.heavy = true;
    return mesh;
  };
  const fenetres = forme === "nuit" ? new Builder() : undefined;
  group.add(layer(34, 300, 70, 38, 70, 55, 60, 0.38, 1, true, fenetres));
  group.add(layer(26, 440, 40, 60, 80, 90, 80, 0.66, 1.05, false));
  const hills = layer(22, 205, 40, 9, 16, 38, 40, 0.14, 0.78, false, undefined, true);
  hills.userData.level = 2;
  group.add(hills);
  if (fenetres && fenetres.pos.length) {
    const f = new Mesh(fenetres.geometry(), new MeshBasicMaterial({ vertexColors: true, fog: false, side: DoubleSide }));
    f.renderOrder = -1;
    f.userData.heavy = true;
    group.add(f);
  }
  return group;
}

/** Damier du sol lointain (comme le jeu). */
export function textureDamier(a: string, b: string, repeat: number): Texture {
  const canvas = document.createElement("canvas");
  canvas.width = canvas.height = 2;
  const ctx = canvas.getContext("2d")!;
  ctx.fillStyle = a;
  ctx.fillRect(0, 0, 2, 2);
  ctx.fillStyle = b;
  ctx.fillRect(0, 0, 1, 1);
  ctx.fillRect(1, 1, 1, 1);
  const tex = new CanvasTexture(canvas);
  tex.magFilter = NearestFilter;
  tex.minFilter = NearestFilter;
  tex.wrapS = tex.wrapT = RepeatWrapping;
  tex.repeat.set(repeat, repeat);
  tex.colorSpace = SRGBColorSpace;
  return tex;
}

/**
 * Les places du décor : dans les cellules vides à moins de deux cellules d'un bloc (comme le jeu), `parCellule` tirages par cellule, à 3 m au moins
 * du bord de la cellule. **Règles de pose (lot 37, reprises par le document de direction)** : rien dans le passage — une cellule vide ne porte
 * jamais la route, et une cellule voisine **entourée par la piste** (trois cellules de piste ou plus autour d'elle : l'intérieur d'un virage, d'une
 * épingle) reste vide, car c'est là que le regard coupe vers la sortie ; rien en l'air — tout est posé au sol lointain (`floorY`) ou sur un socle
 * plein jusqu'à lui ; chaque élément a un rôle (la recette du thème le dit). Les tirages se font dans l'ordre des blocs : même graine, même décor.
 */
export function placesDeDecor(track: Track, rnd: () => number, parCellule: (anneau: 1 | 2) => number): PlaceDecor[] {
  const out: PlaceDecor[] = [];
  const seen = new Set<number>();
  const piste = (cx: number, cz: number) => track.cells.has(cellKey(cx, cz));
  for (const b of track.blocks) {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dz = -2; dz <= 2; dz++) {
        const cx = b.cx + dx;
        const cz = b.cz + dz;
        const key = cellKey(cx, cz);
        if (piste(cx, cz) || seen.has(key)) continue;
        seen.add(key);
        // L'anneau et le bloc le plus proche (distance de Tchebychev entre cellules).
        let best = b;
        let bestD = Infinity;
        for (const o of track.blocks) {
          const d = Math.max(Math.abs(o.cx - cx), Math.abs(o.cz - cz));
          if (d < bestD) {
            bestD = d;
            best = o;
          }
        }
        const anneau: 1 | 2 = bestD <= 1 ? 1 : 2;
        let voisines = 0;
        for (let i = -1; i <= 1; i++) for (let j = -1; j <= 1; j++) if ((i || j) && piste(cx + i, cz + j)) voisines++;
        const n = parCellule(anneau);
        if (anneau === 1 && voisines >= 3) continue; // le passage : tirage fait (même suite de nombres), rien de posé
        for (let i = 0; i < n; i++) {
          const x = cx * CELL + 3 + rnd() * (CELL - 6);
          const z = cz * CELL + 3 + rnd() * (CELL - 6);
          const c = world(best, CELL / 2, CELL / 2, best.y0);
          const vx = c[0] - x;
          const vz = c[2] - z;
          const l = Math.hypot(vx, vz) || 1;
          out.push({ x, z, anneau, versRoute: [vx / l, vz / l], yRoute: best.y0, cx, cz });
        }
      }
    }
  }
  return out;
}

export interface ComposerOptions {
  aerial?: boolean;
}

/**
 * Le matériau « toon » de la direction A : la lumière en trois tons nets (ombre, mi-teinte, plein jour) au lieu d'un dégradé continu — la règle
 * des aplats et des ombres nettes de la charte, en 3D. Moins cher qu'un matériau physique (pas de réflexions).
 */
export function materiauToon(): MeshToonMaterial {
  const data = new Uint8Array([110, 190, 255]);
  const gradient = new DataTexture(data, data.length, 1, RedFormat);
  gradient.minFilter = gradient.magFilter = NearestFilter;
  gradient.needsUpdate = true;
  return new MeshToonMaterial({ vertexColors: true, side: DoubleSide, gradientMap: gradient });
}

const SHADOW_HALF = 42;
const HEADLIGHT_POWER = 900;

/** Construit la scène d'un circuit selon une direction. */
export function composerScene(track: Track, paletteName: PaletteName, direction: Direction, options: ComposerOptions = {}): TrackScene {
  const base = PALETTE_DEFS[paletteName];
  const pal = direction.palette(paletteName, base);
  const amb = direction.ambiance(paletteName, pal, LOOKS[paletteName]);
  const look = amb.look;
  const floorY = track.voidY - FALL_DEPTH;
  const calques: Calques = { route: new Builder(), solide: new Builder(), lumineux: new Builder(), decor: new Builder(), decorLumineux: new Builder(), dense: new Builder(), rideau: new Builder(), affiches: new Affiches(), bandeaux: [], aerien: !!options.aerial };
  const ctx: Contexte = { palette: paletteName, pal, look, track, floorY };
  construireRoute(track, pal, direction.route(paletteName), { route: calques.route, lumineux: calques.lumineux }, floorY);
  const fast = fastZones(track);
  const rythme = new Builder();
  for (const b of track.blocks) {
    if (b.kind === "boost") direction.plaque(calques, ctx, b);
    if (b.kind === "turbo") direction.turbo(calques, ctx, b);
    if (b.kind === "cut") direction.coupure(calques, ctx, b);
    if (!options.aerial) direction.rythme({ ...calques, solide: rythme }, ctx, b, fast[b.index] ?? false);
    if (b.mark === "checkpoint") direction.porte(calques, ctx, b);
    if (b.mark === "finish") direction.arrivee(calques, ctx, b, CELL / 2);
    if (b.mark === "start") direction.portiqueDepart(calques, ctx, b, 26);
  }
  let signs = 0;
  if (!options.aerial) {
    for (const s of signsFor(track)) {
      direction.panneau(calques, ctx, track.blocks[s.block]!, s);
      signs++;
    }
  }
  direction.decor(calques, ctx, seeded(`${track.id}:${paletteName}`));

  const scene = new Scene();
  const nuit = pal.scenery === "lamps" || pal.scenery === "pylons";
  if (!options.aerial) {
    scene.background = texturedCiel(amb);
    scene.fog = new Fog(amb.brume.couleur, amb.brume.near, amb.brume.far);
  }
  scene.add(new HemisphereLight(amb.hemi[0], amb.hemi[1], amb.hemi[2]));
  scene.add(new AmbientLight(amb.ambiante[0], amb.ambiante[1]));
  const sun = new DirectionalLight(amb.soleil[0], amb.soleil[1]);
  const h = amb.hauteurSoleil;
  sun.position.set(40 * (1.2 - h) * 1.4, 30 + 110 * h, -30 * (1.2 - h) * 1.4);
  const sunOffset = sun.position.clone().normalize().multiplyScalar(150);
  scene.add(sun, sun.target);
  sun.shadow.camera.left = -SHADOW_HALF;
  sun.shadow.camera.right = SHADOW_HALF;
  sun.shadow.camera.top = SHADOW_HALF;
  sun.shadow.camera.bottom = -SHADOW_HALF;
  sun.shadow.camera.near = 1;
  sun.shadow.camera.far = 320;
  sun.shadow.bias = -0.0008;
  sun.shadow.normalBias = 0.06;
  sun.shadow.intensity = look.shadow;
  const head = new SpotLight(0xfff1d0, 0, 110, 0.62, 0.8, 1.2);
  scene.add(head, head.target);

  const mat = direction.materiau === "toon" ? materiauToon() : new MeshStandardMaterial({ vertexColors: true, flatShading: true, side: DoubleSide });
  const plain = new MeshBasicMaterial({ vertexColors: true, side: DoubleSide });
  const roadMesh = new Mesh(calques.route.geometry(), mat);
  roadMesh.receiveShadow = true;
  roadMesh.userData.calque = "route";
  const solidMesh = new Mesh(calques.solide.geometry(), mat);
  solidMesh.castShadow = solidMesh.receiveShadow = true;
  solidMesh.userData.calque = "solide";
  const glowMesh = new Mesh(calques.lumineux.geometry(), plain);
  glowMesh.userData.calque = "lumineux";
  const decorMesh = new Mesh(calques.decor.geometry(), mat);
  decorMesh.receiveShadow = true;
  decorMesh.userData.heavy = true;
  decorMesh.userData.calque = "decor";
  const decorGlow = new Mesh(calques.decorLumineux.geometry(), plain);
  decorGlow.userData.heavy = true;
  decorGlow.userData.calque = "decorLumineux";
  const denseMesh = new Mesh(calques.dense.geometry(), mat);
  denseMesh.receiveShadow = true;
  denseMesh.userData.level = 2;
  denseMesh.userData.calque = "dense";
  const rythmeMesh = new Mesh(rythme.geometry(), mat);
  rythmeMesh.userData.heavy = true;
  rythmeMesh.userData.calque = "rythme";
  for (const m of [roadMesh, solidMesh, glowMesh, decorMesh, decorGlow, denseMesh, rythmeMesh]) if (m.geometry.getAttribute("position").count > 0) scene.add(m);
  if (calques.rideau.pos.length > 0) {
    const rideau = new Mesh(calques.rideau.geometry(), new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.2, side: DoubleSide, depthWrite: false, blending: AdditiveBlending }));
    rideau.renderOrder = 4;
    scene.add(rideau);
  }
  for (const banner of calques.bandeaux) scene.add(banner);
  const atlas = calques.affiches.pos.length > 0 ? (direction.atlas?.() ?? null) : null;
  if (atlas) {
    const geo = new BufferGeometry();
    geo.setAttribute("position", new Float32BufferAttribute(calques.affiches.pos, 3));
    geo.setAttribute("uv", new Float32BufferAttribute(calques.affiches.uv, 2));
    geo.computeVertexNormals();
    const affiches = new Mesh(geo, new MeshStandardMaterial({ map: atlas, side: DoubleSide, roughness: 0.8 }));
    affiches.receiveShadow = true;
    affiches.userData.calque = "affiches";
    scene.add(affiches);
  }

  const all = [calques.route, calques.solide, calques.lumineux, calques.decor, calques.decorLumineux, calques.dense, rythme];
  const halos = options.aerial ? null : buildHalos(all.flatMap((b) => b.halos), look.halo);
  if (halos) scene.add(halos.points);

  const backdrop = new Group();
  if (!options.aerial) backdrop.add(ciel(amb, seeded(`${track.id}:${paletteName}`), nuit), silhouettes(amb, seeded(`${track.id}:${paletteName}:loin`)));
  scene.add(backdrop);

  const size = 1200;
  const tile = 8;
  const floor = new Mesh(new PlaneGeometry(size, size), new MeshStandardMaterial({ map: textureDamier(pal.floorA, pal.floorB, size / (2 * tile)), flatShading: true }));
  floor.rotation.x = -Math.PI / 2;
  floor.position.y = floorY;
  floor.receiveShadow = true;
  floor.userData.calque = "sol";
  scene.add(floor);

  let shadowSize = 0;
  let currentLevel: 0 | 1 | 2 = 2;
  const setQuality = (level: 0 | 1 | 2, shadows = true) => {
    currentLevel = level;
    scene.traverse((o) => {
      const min = (o.userData.level as number | undefined) ?? (o.userData.heavy ? 1 : undefined);
      if (min !== undefined) o.visible = level >= min;
    });
    const want = options.aerial || !shadows ? 0 : level === 2 ? 1024 : level === 1 ? 512 : 0;
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
      scene.traverse((o) => (o as { shadow?: { map?: { dispose(): void } | null } }).shadow?.map?.dispose());
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
      const fog = scene.fog as Fog | null;
      return { quality: currentLevel, shadowMap: sun.castShadow ? shadowSize : 0, headlights: head.visible ? head.intensity : 0, halos: { count: halos ? halos.points.geometry.getAttribute("position").count : 0, visible: !!halos?.points.visible }, denseDecor: denseMesh.visible, hills: currentLevel === 2, signs, fog: fog ? { near: fog.near, far: fog.far } : null };
    },
    followGround(x, z) {
      backdrop.position.set(x, floorY, z);
      floor.position.x = Math.round(x / (2 * tile)) * 2 * tile;
      floor.position.z = Math.round(z / (2 * tile)) * 2 * tile;
    },
    followCar(x, y, z, yaw, hood = false) {
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
        head.intensity = HEADLIGHT_POWER * look.headlights * (hood ? 0.1 : 1);
      }
    },
  };
}
