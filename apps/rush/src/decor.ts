import { CanvasTexture, CircleGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, MeshToonMaterial, NearestFilter, RepeatWrapping, SRGBColorSpace, SphereGeometry, ConeGeometry, BoxGeometry, type BufferGeometry, type Texture } from "three";
import { aleatoire, colorier, fusionner, placer, roche, teindre } from "./formes";
import { piece, plat } from "./cel";
import type { PaletteMonde } from "./palette";

// Le décor de Rush (lot BR0b), en code : un PLATEAU circulaire de dalles en damier sable, un MURET de bois bas à poteaux avec des touffes d'herbe, posé sur une ÎLE FLOTTANTE (des falaises sous le bord), d'AUTRES ÎLES et des
// nuages au loin, un ciel en dégradé. **Peu d'appels de dessin** : tout ce qui est fixe est fusionné (le muret, les falaises, les îles lointaines, les nuages : un maillage chacun). Le hasard vient d'une graine : le décor est
// le même à chaque lancement. Les couleurs sont celles de la palette du thème (`palette.ts`).

const css = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;

/** La texture d'un damier de quatre dalles (répétée) : une teinte par dalle, un biseau clair en haut à gauche et sombre en bas à droite, un joint. */
function textureSol(a: PaletteMonde): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = c.height = 256;
  const g = c.getContext("2d")!;
  const dalles: [number, number, number][] = [[0, 0, a.sol2], [128, 0, a.sol], [0, 128, a.sol], [128, 128, a.sol2]];
  for (const [x, y, couleur] of dalles) {
    g.fillStyle = css(couleur);
    g.fillRect(x, y, 128, 128);
    g.fillStyle = "rgba(255,255,255,0.22)";
    g.fillRect(x + 3, y + 3, 122, 5);
    g.fillRect(x + 3, y + 3, 5, 122);
    g.fillStyle = "rgba(60,36,10,0.16)";
    g.fillRect(x + 3, y + 120, 122, 5);
    g.fillRect(x + 120, y + 3, 5, 122);
  }
  g.strokeStyle = "rgba(70,44,16,0.28)";
  g.lineWidth = 3;
  g.beginPath();
  g.moveTo(128, 0);
  g.lineTo(128, 256);
  g.moveTo(0, 128);
  g.lineTo(256, 128);
  g.stroke();
  g.strokeRect(1.5, 1.5, 253, 253);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.repeat.set(6, 6);
  t.colorSpace = SRGBColorSpace;
  t.magFilter = NearestFilter;
  t.anisotropy = 4;
  return t;
}

/** Le ciel : un dégradé vertical peint sur un canvas (la texture de fond de la scène, tendue sur tout l'écran). */
function textureCiel(a: PaletteMonde): CanvasTexture {
  const c = document.createElement("canvas");
  c.width = 4;
  c.height = 256;
  const g = c.getContext("2d")!;
  const d = g.createLinearGradient(0, 0, 0, 256);
  d.addColorStop(0, css(a.cielBas));
  d.addColorStop(0.45, css(a.cielBas));
  d.addColorStop(1, css(a.cielHaut));
  g.fillStyle = d;
  g.fillRect(0, 0, 4, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Le muret de bois bas : des poteaux (grosses boîtes un peu inégales, un chapeau), des planches entre eux, des touffes d'herbe et quelques cailloux ; tout en un seul maillage coloré par sommet. */
function muret(R: number, a: PaletteMonde): BufferGeometry {
  const rnd = aleatoire(77);
  const formes: BufferGeometry[] = [];
  const N = 22;
  const rayon = R + 0.45;
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const x = Math.cos(t) * rayon;
    const z = Math.sin(t) * rayon;
    const h = 1.0 + rnd() * 0.45;
    const l = 0.6 + rnd() * 0.12;
    // le poteau : un fût et un chapeau plus large
    formes.push(colorier(placer(new BoxGeometry(l, h, l), { x, y: h / 2, z, ry: -t + (rnd() - 0.5) * 0.15 }), [a.bois, a.bois, a.bois2], 100 + i));
    formes.push(colorier(placer(new BoxGeometry(l * 1.18, 0.14, l * 1.18), { x, y: h + 0.05, z, ry: -t }), [a.bois2], 200 + i));
    // la planche jusqu'au poteau suivant
    const t2 = ((i + 0.5) / N) * Math.PI * 2;
    const cx = Math.cos(t2) * rayon;
    const cz = Math.sin(t2) * rayon;
    const corde = 2 * rayon * Math.sin(Math.PI / N);
    formes.push(colorier(placer(new BoxGeometry(corde, 0.22, 0.2), { x: cx, y: 0.62, z: cz, ry: -t2 - Math.PI / 2 }), [a.bois, a.bois2], 300 + i));
    formes.push(colorier(placer(new BoxGeometry(corde, 0.2, 0.2), { x: cx, y: 0.28, z: cz, ry: -t2 - Math.PI / 2 }), [a.bois2, a.bois], 400 + i));
  }
  // des touffes d'herbe au pied du muret (des cônes serrés) et des cailloux
  for (let i = 0; i < 26; i++) {
    const t = rnd() * Math.PI * 2;
    const r = R + 0.1 + rnd() * 0.3;
    for (let k = 0; k < 3; k++) {
      const dx = (rnd() - 0.5) * 0.3;
      const dz = (rnd() - 0.5) * 0.3;
      formes.push(teindre(placer(new ConeGeometry(0.07, 0.35 + rnd() * 0.25, 4), { x: Math.cos(t) * r + dx, y: 0.17, z: Math.sin(t) * r + dz, rz: (rnd() - 0.5) * 0.5, rx: (rnd() - 0.5) * 0.5 }), rnd() < 0.5 ? a.herbe : a.herbe2));
    }
  }
  for (let i = 0; i < 9; i++) {
    const t = rnd() * Math.PI * 2;
    const r = R - 0.3 - rnd() * 0.5;
    formes.push(colorier(placer(roche(0.16 + rnd() * 0.12, 500 + i, { detail: 0, bruit: 0.3 }), { x: Math.cos(t) * r, y: 0.1, z: Math.sin(t) * r }), [a.falaise2, a.falaise], 500 + i));
  }
  return fusionner(formes);
}

/** L'île : la tranche des dalles, des falaises de rochers anguleux qui rétrécissent vers le bas, quelques plaques d'herbe sur les corniches. */
function falaises(R: number, a: PaletteMonde): BufferGeometry {
  const rnd = aleatoire(31);
  const formes: BufferGeometry[] = [];
  // La tranche : un anneau de pierre pâle sous le bord du plateau.
  formes.push(colorier(placer(new CylinderGeometry(R + 0.05, R - 0.1, 0.7, 48, 1, true), { y: -0.35 }).toNonIndexed(), [a.tranche], 3));
  // Quatre couronnes de rochers, de plus en plus petites et basses : l'île s'effile. Chaque rocher est posé pour que son sommet reste sous le bord du plateau (jamais devant la scène).
  const couronnes: [number, number, number, number][] = [
    [20, R - 0.5, 1.9, 0],
    [15, R - 3.0, 2.2, 2.4],
    [10, R - 6.0, 2.3, 5.4],
    [6, R - 9.0, 2.1, 8.4],
  ];
  couronnes.forEach(([n, r, taille, creux], c) => {
    for (let i = 0; i < n; i++) {
      const t = ((i + rnd() * 0.6) / n) * Math.PI * 2;
      const k = 0.75 + rnd() * 0.4;
      const alto = taille * k * 1.3 * 1.25;
      formes.push(colorier(placer(roche(taille * k, 600 + c * 40 + i, { detail: c === 0 ? 1 : 0, bruit: 0.3, etire: [1.15, 1.25, 1.15] }), { x: Math.cos(t) * r, y: -alto - 0.35 - creux - rnd() * 0.6, z: Math.sin(t) * r }), [a.falaise, a.falaise, a.falaise2], 700 + c * 40 + i));
    }
  });
  formes.push(colorier(placer(roche(3.6, 9, { bruit: 0.28, etire: [1, 1.8, 1] }), { y: -15 }), [a.falaise, a.falaise2], 9));
  // de l'herbe sur les corniches du haut
  for (let i = 0; i < 14; i++) {
    const t = rnd() * Math.PI * 2;
    formes.push(colorier(placer(roche(0.9 + rnd() * 0.6, 800 + i, { detail: 0, bruit: 0.25, etire: [1.4, 0.35, 1.4] }), { x: Math.cos(t) * (R - 0.6), y: -0.75 - rnd() * 0.5, z: Math.sin(t) * (R - 0.3) }), [a.herbe, a.herbe2], 800 + i));
  }
  return fusionner(formes);
}

/** Les îles lointaines : un plateau d'herbe, un cône de roche dessous, parfois un arbre (un cône vert sur un tronc) ; toutes en un seul maillage. */
function ilesLointaines(a: PaletteMonde): BufferGeometry {
  const rnd = aleatoire(5);
  const formes: BufferGeometry[] = [];
  const iles: [number, number, number, number][] = [
    [-34, -4, -24, 7], [38, -6, -18, 9], [-46, -12, 8, 10], [52, -10, 20, 8], [8, -14, -52, 12], [-20, -16, 40, 8], [30, -20, 44, 10],
  ];
  iles.forEach(([x, y, z, r], i) => {
    formes.push(colorier(placer(new CylinderGeometry(r, r * 0.92, 1.2, 14).toNonIndexed(), { x, y, z }), [a.herbe, a.herbe2], 900 + i));
    formes.push(colorier(placer(new ConeGeometry(r * 0.92, r * 1.6, 10).toNonIndexed(), { x, y: y - 0.6 - r * 0.8, z, rx: Math.PI }), [a.falaise, a.falaise2], 950 + i));
    if (rnd() < 0.8) {
      formes.push(teindre(placer(new CylinderGeometry(0.3, 0.4, 2, 6).toNonIndexed(), { x: x + r * 0.2, y: y + 1.6, z: z + r * 0.1 }), a.bois2));
      formes.push(teindre(placer(new ConeGeometry(1.8, 4, 7).toNonIndexed(), { x: x + r * 0.2, y: y + 4.4, z: z + r * 0.1 }), a.herbe2));
    }
  });
  return fusionner(formes);
}

/** Les nuages : des paquets de sphères blanches aplaties, au loin et sous l'arène, en un seul maillage sans lumière. */
function nuages(a: PaletteMonde): BufferGeometry {
  const rnd = aleatoire(13);
  const formes: BufferGeometry[] = [];
  for (let i = 0; i < 10; i++) {
    const cx = (rnd() - 0.5) * 150;
    const cz = -20 - rnd() * 60 + (i % 3 === 0 ? 70 : 0);
    const cy = -22 + rnd() * 20;
    for (let k = 0; k < 3; k++) {
      const r = 2.4 + rnd() * 2.6;
      formes.push(teindre(placer(new SphereGeometry(1, 8, 5).toNonIndexed(), { x: cx + (k - 1.5) * 2.6, y: cy + rnd() * 1.2, z: cz + (rnd() - 0.5) * 2, s: [r * 1.5, r * 0.7, r] }), a.nuage));
    }
  }
  return fusionner(formes);
}

export interface Decor {
  groupe: Group;
  /** La texture du ciel (`scene.background`). */
  ciel: Texture;
  detruire(): void;
}

/** Monte tout le décor de l'arène de rayon `R` (mètres) pour une palette. */
export function monterDecor(R: number, a: PaletteMonde): Decor {
  const groupe = new Group();
  const textures: Texture[] = [];
  const sol = new Mesh(new CircleGeometry(R, 72).rotateX(-Math.PI / 2), new MeshToonMaterial({ map: (textures[textures.push(textureSol(a)) - 1] as CanvasTexture), color: 0xffffff }));
  groupe.add(sol);
  const mur = piece(muret(R, a), 0xffffff, true, true);
  groupe.add(mur.groupe);
  const ile = piece(falaises(R, a), 0xffffff, true, true);
  groupe.add(ile.groupe);
  const loin = new Mesh(ilesLointaines(a), plat(0xffffff, true));
  groupe.add(loin);
  const ciel = textureCiel(a);
  const nuage = new Mesh(nuages(a), new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.92 }));
  groupe.add(nuage);
  return {
    groupe,
    ciel,
    detruire() {
      for (const t of textures) t.dispose();
      ciel.dispose();
      groupe.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose?.();
      });
    },
  };
}
