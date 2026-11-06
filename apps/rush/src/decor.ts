import { Vector3, BoxGeometry, CanvasTexture, CircleGeometry, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, RepeatWrapping, SRGBColorSpace, SphereGeometry, type BufferGeometry, type Texture } from "three";
import { aleatoire, bloc, colorier, fusionner, placer, teindre } from "./formes";
import { piece, plat } from "./cel";
import type { PaletteMonde } from "./palette";

// Le décor de Rush (lots BR0b, BR0c), en code : un PLATEAU circulaire de petites dalles (deux tons de sable, une variation par dalle, des joints fins, quelques dalles fêlées), un MURET de bois TRAPU (de gros poteaux, de minces planches) avec des touffes d'herbe et des
// cailloux, posé sur une ÎLE FLOTTANTE (des falaises de gros blocs rocheux sous le bord), quelques ÎLES lointaines à sommet d'herbe, des nuages (sphères fusionnées), un ciel en dégradé. **Peu d'appels de dessin** : tout ce qui est fixe est fusionné. Le hasard
// vient d'une graine : le décor est le même à chaque lancement. Les textures sont PEINTES SUR UN CANVAS (permis : aucun fichier d'asset).

const css = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
const teinte = (n: number, k: number): string => {
  const c = (s: number): number => Math.max(0, Math.min(255, Math.round(((n >> s) & 255) * k)));
  return `rgb(${c(16)},${c(8)},${c(0)})`;
};

/** Les dalles du plateau : une seule texture pour toute l'arène (un carré qui contient le disque), de ~1,3 m par dalle — deux tons en damier, une variation de clarté par dalle, un biseau, des joints fins, quelques dalles fêlées, des taches, un bord un peu plus sombre. */
function textureSol(a: PaletteMonde, R: number): CanvasTexture {
  const S = 1536;
  const N = Math.round((2 * R) / 1.3);
  const T = S / N;
  const rnd = aleatoire(404);
  const c = document.createElement("canvas");
  c.width = c.height = S;
  const g = c.getContext("2d")!;
  for (let i = 0; i < N; i++) {
    for (let j = 0; j < N; j++) {
      const base = (i + j) % 2 === 0 ? a.sol : a.sol2;
      g.fillStyle = teinte(base, 0.95 + rnd() * 0.1);
      g.fillRect(i * T, j * T, T + 1, T + 1);
      // un biseau clair en haut à gauche, sombre en bas à droite
      g.fillStyle = "rgba(255,255,255,0.2)";
      g.fillRect(i * T + 2, j * T + 2, T - 4, 3);
      g.fillRect(i * T + 2, j * T + 2, 3, T - 4);
      g.fillStyle = "rgba(70,42,12,0.12)";
      g.fillRect(i * T + 2, (j + 1) * T - 5, T - 4, 3);
      g.fillRect((i + 1) * T - 5, j * T + 2, 3, T - 4);
      // une dalle sur douze est fêlée
      if (rnd() < 0.085) {
        g.strokeStyle = "rgba(96,64,26,0.55)";
        g.lineWidth = 2;
        g.beginPath();
        let x = i * T + T * (0.2 + rnd() * 0.6);
        let y = j * T + T * (0.15 + rnd() * 0.2);
        g.moveTo(x, y);
        for (let k = 0; k < 5; k++) {
          x += (rnd() - 0.5) * T * 0.3;
          y += T * 0.16 + rnd() * T * 0.06;
          g.lineTo(x, y);
        }
        g.stroke();
      }
    }
  }
  // les joints : deux traits fins sombres entre les dalles
  g.strokeStyle = "rgba(86,54,20,0.34)";
  g.lineWidth = 2;
  g.beginPath();
  for (let k = 0; k <= N; k++) {
    g.moveTo(k * T, 0);
    g.lineTo(k * T, S);
    g.moveTo(0, k * T);
    g.lineTo(S, k * T);
  }
  g.stroke();
  // des taches de poussière et des grains
  for (let k = 0; k < 1800; k++) {
    g.fillStyle = rnd() < 0.5 ? "rgba(255,255,255,0.1)" : "rgba(90,58,24,0.1)";
    const r = 1 + rnd() * 3;
    g.fillRect(rnd() * S, rnd() * S, r, r);
  }
  // le bord du plateau, un peu plus sombre (les pieds du muret)
  const d = g.createRadialGradient(S / 2, S / 2, S * 0.4, S / 2, S / 2, S * 0.5);
  d.addColorStop(0, "rgba(80,50,20,0)");
  d.addColorStop(1, "rgba(80,50,20,0.26)");
  g.fillStyle = d;
  g.fillRect(0, 0, S, S);
  const t = new CanvasTexture(c);
  t.wrapS = t.wrapT = RepeatWrapping;
  t.colorSpace = SRGBColorSpace;
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
  d.addColorStop(0, css(a.cielHaut));
  d.addColorStop(0.55, css(a.cielBas));
  d.addColorStop(1, css(a.cielBas));
  g.fillStyle = d;
  g.fillRect(0, 0, 4, 256);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}

/** Le muret de bois TRAPU : de GROS poteaux arrondis (un chapeau plus large) reliés par de minces planches, des touffes d'herbe au pied et des cailloux ; tout en un seul maillage coloré par sommet. */
function muret(R: number, a: PaletteMonde, ouverture?: Ouverture): BufferGeometry {
  const rnd = aleatoire(77);
  const formes: BufferGeometry[] = [];
  const N = 18;
  const rayon = R + 0.55;
  // Lot BR1 : une OUVERTURE dans le muret (l'entrée de l'arène) : ni poteau, ni planche, ni touffe dans l'angle ouvert.
  const dansOuverture = (t: number): boolean => {
    if (!ouverture) return false;
    const d = Math.abs(((t - ouverture.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI);
    return d < ouverture.largeur / 2 / rayon;
  };
  for (let i = 0; i < N; i++) {
    const t = (i / N) * Math.PI * 2;
    const x = Math.cos(t) * rayon;
    const z = Math.sin(t) * rayon;
    const h = 1.2 + rnd() * 0.4;
    const l = 0.8 + rnd() * 0.12;
    if (dansOuverture(t) && dansOuverture(t + Math.PI / N)) {
      rnd();
      rnd();
      rnd();
      continue;
    }
    // le poteau : un gros fût arrondi et un chapeau plus large
    formes.push(placer(bloc(l, h, l, { couleur: a.bois, dessus: a.bois, variation: 0.12, graine: 100 + i, rayon: 0.14, irregulier: 0.05, segments: 3 }), { x, y: h / 2, z, ry: -t + (rnd() - 0.5) * 0.15 }));
    formes.push(placer(bloc(l * 1.2, 0.26, l * 1.2, { couleur: a.bois2, dessus: a.bois, variation: 0.1, graine: 200 + i, rayon: 0.09, irregulier: 0.03, segments: 2 }), { x, y: h + 0.1, z, ry: -t }));
    // les planches (deux, minces) jusqu'au poteau suivant
    const t2 = ((i + 0.5) / N) * Math.PI * 2;
    if (dansOuverture(t2)) continue;
    const cx = Math.cos(t2) * rayon;
    const cz = Math.sin(t2) * rayon;
    const corde = 2 * rayon * Math.sin(Math.PI / N);
    formes.push(colorier(placer(new BoxGeometry(corde, 0.2, 0.14), { x: cx, y: 0.95, z: cz, ry: -t2 - Math.PI / 2 }), [a.bois, a.bois2], 300 + i));
    formes.push(colorier(placer(new BoxGeometry(corde, 0.2, 0.14), { x: cx, y: 0.45, z: cz, ry: -t2 - Math.PI / 2 }), [a.bois2, a.bois], 400 + i));
  }
  // des touffes d'herbe au pied du muret (des cônes serrés) et des cailloux
  for (let i = 0; i < 40; i++) {
    const t = rnd() * Math.PI * 2;
    const r = R + 0.05 + rnd() * 0.3;
    if (dansOuverture(t)) continue;
    for (let k = 0; k < 4; k++) {
      const dx = (rnd() - 0.5) * 0.4;
      const dz = (rnd() - 0.5) * 0.4;
      formes.push(teindre(placer(new ConeGeometry(0.09, 0.45 + rnd() * 0.3, 4), { x: Math.cos(t) * r + dx, y: 0.22, z: Math.sin(t) * r + dz, rz: (rnd() - 0.5) * 0.6, rx: (rnd() - 0.5) * 0.6 }), rnd() < 0.5 ? a.herbe : a.herbe2));
    }
  }
  for (let i = 0; i < 16; i++) {
    const t = rnd() * Math.PI * 2;
    const r = R - 0.2 - rnd() * 3.2;
    const d = 0.2 + rnd() * 0.25;
    formes.push(placer(bloc(d * 1.4, d, d * 1.2, { couleur: a.falaise2, dessus: a.falaise2, graine: 500 + i, rayon: d * 0.4, irregulier: 0.1, segments: 2 }), { x: Math.cos(t) * r, y: d * 0.35, z: Math.sin(t) * r, ry: rnd() * 3 }));
  }
  return fusionner(formes);
}

/** L'île : la tranche des dalles, des falaises de gros BLOCS rocheux qui rétrécissent vers le bas, quelques plaques d'herbe sur les corniches. */
function falaises(R: number, a: PaletteMonde): BufferGeometry {
  const rnd = aleatoire(31);
  const formes: BufferGeometry[] = [];
  // La tranche : un anneau de pierre pâle sous le bord du plateau.
  formes.push(colorier(placer(new CylinderGeometry(R + 0.05, R - 0.1, 0.7, 48, 1, true), { y: -0.35 }).toNonIndexed(), [a.tranche], 3));
  // Quatre couronnes de blocs, de plus en plus petits et bas : l'île s'effile. Chaque bloc est posé pour que son sommet reste sous le bord du plateau.
  const couronnes: [number, number, number, number][] = [
    [18, R - 0.5, 2.6, 0],
    [13, R - 3.0, 3.0, 2.4],
    [9, R - 6.0, 3.1, 5.6],
    [5, R - 9.0, 2.8, 8.8],
  ];
  couronnes.forEach(([n, r, taille, creux], c) => {
    for (let i = 0; i < n; i++) {
      const t = ((i + rnd() * 0.6) / n) * Math.PI * 2;
      const k = 0.8 + rnd() * 0.4;
      const alto = taille * k * 1.4;
      formes.push(
        placer(bloc(taille * k * 1.3, taille * k * 1.5, taille * k * 1.3, { couleur: i % 3 === 0 ? a.falaise2 : a.falaise, dessus: a.falaise2, variation: 0.12, graine: 600 + c * 40 + i, rayon: taille * 0.3, irregulier: 0.12, segments: 2 }), {
          x: Math.cos(t) * r,
          y: -alto * 0.5 - 0.5 - creux - rnd() * 0.5,
          z: Math.sin(t) * r,
          ry: rnd() * 3,
        }),
      );
    }
  });
  formes.push(placer(bloc(7, 11, 7, { couleur: a.falaise, dessus: a.falaise2, graine: 9, rayon: 2.4, irregulier: 0.1, segments: 2 }), { y: -15 }));
  // de l'herbe sur les corniches du haut
  for (let i = 0; i < 14; i++) {
    const t = rnd() * Math.PI * 2;
    formes.push(placer(bloc(2.2 + rnd() * 1.4, 0.7, 2.2 + rnd() * 1.4, { couleur: a.herbe, dessus: a.herbe2, graine: 800 + i, rayon: 0.3, irregulier: 0.1, segments: 2 }), { x: Math.cos(t) * (R - 0.4), y: -0.8 - rnd() * 0.4, z: Math.sin(t) * (R - 0.2), ry: rnd() * 3 }));
  }
  return fusionner(formes);
}

/** Les îles lointaines (quatre à cinq) : un plateau d'herbe, des blocs de roche dessous, un arbre ; toutes en un seul maillage. Elles sont posées là où la caméra haute les voit : sur les côtés, un peu sous le niveau de l'arène. */
function ilesLointaines(a: PaletteMonde): BufferGeometry {
  const rnd = aleatoire(5);
  const formes: BufferGeometry[] = [];
  const iles: [number, number, number, number][] = [
    [-27, -5, -17, 4.8], [28, -6, -15, 5.2], [-36, -9, 1, 4.6], [37, -8, 6, 5], [3, -10, -44, 9],
  ];
  iles.forEach(([x, y, z, r], i) => {
    formes.push(placer(bloc(r * 2, 1.4, r * 2, { couleur: a.herbe, dessus: a.herbe2, variation: 0.1, graine: 900 + i, rayon: 0.6, irregulier: 0.05, segments: 2 }), { x, y, z }));
    formes.push(placer(bloc(r * 1.7, r * 1.2, r * 1.7, { couleur: a.falaise, dessus: a.falaise2, variation: 0.1, graine: 950 + i, rayon: r * 0.5, irregulier: 0.08, segments: 2 }), { x, y: y - 0.7 - r * 0.6, z }));
    formes.push(placer(bloc(r * 0.9, r * 1.1, r * 0.9, { couleur: a.falaise2, dessus: a.falaise2, graine: 970 + i, rayon: r * 0.3, segments: 2 }), { x: x + r * 0.1, y: y - 1.2 - r * 1.2, z: z - r * 0.1 }));
    if (rnd() < 0.85) {
      formes.push(teindre(placer(new CylinderGeometry(0.3, 0.4, 2, 8), { x: x + r * 0.25, y: y + 1.6, z: z + r * 0.1 }), a.bois2));
      formes.push(teindre(placer(new SphereGeometry(1.7, 12, 9), { x: x + r * 0.25, y: y + 3.9, z: z + r * 0.1, s: [1, 1.15, 1] }), a.herbe2));
    }
  });
  return fusionner(formes);
}

/** Les nuages : des paquets de sphères blanches aplaties, au loin et sous l'arène, en un seul maillage sans lumière. */
export function nuages(a: PaletteMonde, zone?: { x0: number; x1: number; z0: number; z1: number }, graine = 13): BufferGeometry {
  const rnd = aleatoire(graine);
  const formes: BufferGeometry[] = [];
  // Lot BR1 : dans un niveau, les nuages se répartissent sur toute son étendue (un tous les ~1 000 m²), pas seulement autour de l'arène.
  const n = zone ? Math.max(2, Math.round(((zone.x1 - zone.x0) * (zone.z1 - zone.z0)) / 1400)) : 12;
  for (let i = 0; i < n; i++) {
    const cx = zone ? zone.x0 + rnd() * (zone.x1 - zone.x0) : (rnd() - 0.5) * 120;
    const cz = zone ? zone.z0 + rnd() * (zone.z1 - zone.z0) : -34 + rnd() * 76;
    const cy = (zone ? -32 : -16) - rnd() * 12;
    for (let k = 0; k < 4; k++) {
      const r = 2.6 + rnd() * 2.8;
      formes.push(teindre(placer(new SphereGeometry(1, zone ? 8 : 12, zone ? 5 : 8), { x: cx + (k - 1.5) * 2.8, y: cy + rnd() * 1.4, z: cz + (rnd() - 0.5) * 2.4, s: [r * 1.5, r * 0.75, r] }), a.nuage));
    }
  }
  return fusionner(formes);
}

/** Une ouverture dans le muret de l'arène (lot BR1) : `angle` en radians de +x vers +z, `largeur` en mètres. */
export interface Ouverture {
  angle: number;
  largeur: number;
}
export interface OptionsDecor {
  ouverture?: Ouverture;
  /** Dans le niveau : ni îles lointaines ni nuages (le niveau a les siens) ; le ciel et l'arène restent. */
  niveau?: boolean;
}

export interface Decor {
  groupe: Group;
  /** Rien dans le décor d'arène seule ; le décor du niveau (`niveauVue.ts`) lit le chevalier, la caméra et la barrière. */
  maj?(chevalier: { x: number; z: number }, camera: Vector3, fermeture: number): void;
  /** La texture du ciel (`scene.background`). */
  ciel: Texture;
  detruire(): void;
}

/** Monte tout le décor de l'arène de rayon `R` (mètres) pour une palette. */
export function monterDecor(R: number, a: PaletteMonde, opt: OptionsDecor = {}): Decor {
  const groupe = new Group();
  const textures: Texture[] = [];
  const sol = new Mesh(new CircleGeometry(R, 72).rotateX(-Math.PI / 2), plat(0xffffff, false, 0));
  const carte = textureSol(a, R);
  textures.push(carte);
  (sol.material as ReturnType<typeof plat>).map = carte;
  sol.receiveShadow = true;
  groupe.add(sol);
  const mur = piece(muret(R, a, opt.ouverture), 0xffffff, true, true);
  mur.corps.castShadow = true;
  groupe.add(mur.groupe);
  const ile = piece(falaises(R, a), 0xffffff, true, true);
  ile.corps.castShadow = false;
  groupe.add(ile.groupe);
  if (!opt.niveau) {
    const loin = piece(ilesLointaines(a), 0xffffff, true, true);
    loin.corps.castShadow = false;
    groupe.add(loin.groupe);
  }
  const ciel = textureCiel(a);
  if (!opt.niveau) {
    const nuage = new Mesh(nuages(a), new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.94 }));
    groupe.add(nuage);
  }
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
