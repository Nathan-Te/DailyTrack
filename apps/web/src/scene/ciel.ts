// Le ciel et l'horizon de la scène (lot 38, repris par le palier 1 au lot 43) : l'ambiance d'un thème (`ambianceDOrigine`), le ciel (dégradé, étoiles,
// soleil ou lune posé d'où vient la lumière) et les silhouettes lointaines par forme d'horizon (`HORIZONS`). Lot 44 : le reste du compositeur des
// directions du lot 38 (`composerScene`, les places du décor) est parti avec elles ; les places du décor sont dans `decor/commun.ts`.
import {
  AdditiveBlending,
  BufferGeometry,
  CanvasTexture,
  Color,
  DoubleSide,
  Float32BufferAttribute,
  Group,
  Mesh,
  MeshBasicMaterial,
  NearestFilter,
  PlaneGeometry,
  Points,
  PointsMaterial,
  SRGBColorSpace,
  type Vector3,
} from "three";
import { Builder, mix, shade } from "../meshKit";
import { boite, face, repereSol } from "./outils";
import type { Look, Palette } from "../trackMesh";
import type { Ambiance } from "./types";

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
