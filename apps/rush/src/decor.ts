import { BufferAttribute, Vector3, BoxGeometry, CanvasTexture, CircleGeometry, Color, ConeGeometry, CylinderGeometry, Group, Mesh, MeshBasicMaterial, SRGBColorSpace, SphereGeometry, type BufferGeometry, type Material, type Texture } from "three";
import { aleatoire, bloc, colorier, fusionner, placer, roche, teindre } from "./formes";
import { piece } from "./cel";
import { fabriquer, fondre, vent, type ContexteFabrique } from "./fabrique";
import { themeDe, type PaletteMonde } from "./palette";
import { matiereDuSol } from "./sol";
import { VENT, platVent } from "./vent";

// Le décor de Rush (lots BR0b, BR0c, BR-A2), en code : un PLATEAU circulaire de dalles (le sol calculé de `sol.ts` : deux tons de sable, une variation par dalle, des joints, des dalles fêlées ; une lèvre d'herbe autour), un MURET de bois TRAPU (les gros poteaux de la fabrique, de minces planches) avec des touffes d'herbe et des
// cailloux, posé sur une ÎLE FLOTTANTE (des falaises de gros blocs rocheux sous le bord), quelques ÎLES lointaines à sommet d'herbe, des nuages (sphères fusionnées), un ciel en dégradé. **Peu d'appels de dessin** : tout ce qui est fixe est fusionné. Le hasard
// vient d'une graine : le décor est le même à chaque lancement. Les textures sont PEINTES SUR UN CANVAS (permis : aucun fichier d'asset).
// Lot BR-A2 : l'ENTRÉE de l'arène est marquée (deux piliers de pierre à brasier et un linteau de bois), l'arène porte les COULEURS DU BOSS (bannières, un anneau et des encoches incrustés au sol), le sol est celui de `sol.ts`.

const css = (n: number): string => `#${n.toString(16).padStart(6, "0")}`;
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
function muret(R: number, a: PaletteMonde, ctx: ContexteFabrique, ouverture?: Ouverture): BufferGeometry {
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
    if (dansOuverture(t) && dansOuverture(t + Math.PI / N)) {
      rnd();
      rnd();
      continue;
    }
    // le poteau : un gros fût arrondi et un chapeau plus large (la pièce de la fabrique)
    formes.push(placer(fabriquer("poteau", ctx, i).clone(), { x, z, ry: -t + (rnd() - 0.5) * 0.15, s: 1.12 + rnd() * 0.12 }));
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
  return fondre(formes);
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
  // des pierres pendantes sous le plateau : l'île s'effile en pointes
  for (let i = 0; i < 9; i++) {
    const t = ((i + rnd() * 0.5) / 9) * Math.PI * 2;
    const r = R - 2 - rnd() * 4;
    formes.push(colorier(placer(roche(1.2 + rnd() * 0.9, 1700 + i, { detail: 1, bruit: 0.2, etire: [0.7, 2.1, 0.7] }), { x: Math.cos(t) * r, y: -7.5 - rnd() * 6, z: Math.sin(t) * r, ry: rnd() * 3 }), [a.falaise, a.falaise2, a.tranche], 1700 + i));
  }
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

/** Les nuages : des paquets de sphères aplaties, au loin et sous l'arène, en un seul maillage sans lumière. **Ombrés à la main** (le dessus blanc, le ventre bleuté : un nuage de dessin animé) et lisses ; le matériau n'écrit pas la profondeur (`depthWrite` faux : le contour par
 * la profondeur ne les cerne pas, ce sont des formes douces). */
export function nuages(a: PaletteMonde, zone?: { x0: number; x1: number; z0: number; z1: number }, graine = 13): BufferGeometry {
  const rnd = aleatoire(graine);
  const formes: BufferGeometry[] = [];
  // Lot BR1 : dans un niveau, les nuages se répartissent sur toute son étendue (un tous les ~1 000 m²), pas seulement autour de l'arène.
  const n = zone ? Math.max(2, Math.round(((zone.x1 - zone.x0) * (zone.z1 - zone.z0)) / 1100)) : 12;
  const haut = new Color(a.nuage);
  const ventre = new Color(a.nuage).lerp(new Color(a.cielHaut), 0.5).multiplyScalar(0.93);
  const tmp = new Color();
  for (let i = 0; i < n; i++) {
    const cx = zone ? zone.x0 + rnd() * (zone.x1 - zone.x0) : (rnd() - 0.5) * 120;
    const cz = zone ? zone.z0 + rnd() * (zone.z1 - zone.z0) : -34 + rnd() * 76;
    const cy = (zone ? -22 : -16) - rnd() * 22;
    for (let k = 0; k < 4; k++) {
      const r = 2.6 + rnd() * 3.4;
      const py = cy + rnd() * 1.4;
      const g = placer(new SphereGeometry(1, zone ? 9 : 12, zone ? 6 : 8), { x: cx + (k - 1.5) * 2.8, y: py, z: cz + (rnd() - 0.5) * 2.4, s: [r * 1.5, r * 0.75, r] });
      const p = g.getAttribute("position");
      const c = new Float32Array(p.count * 3);
      for (let v = 0; v < p.count; v++) {
        const u = Math.min(1, Math.max(0, ((p.getY(v) - py) / (r * 0.75)) * 0.5 + 0.55));
        tmp.copy(ventre).lerp(haut, u * u * (3 - 2 * u));
        c[v * 3] = tmp.r;
        c[v * 3 + 1] = tmp.g;
        c[v * 3 + 2] = tmp.b;
      }
      g.setAttribute("color", new BufferAttribute(c, 3));
      formes.push(g);
    }
  }
  return fusionner(formes);
}

/** Une ouverture dans le muret de l'arène (lot BR1) : `angle` en radians de +x vers +z, `largeur` en mètres. */
export interface Ouverture {
  angle: number;
  largeur: number;
}
/** Ce que le décor lit à chaque image (lot BR-A2) : le temps du jeu (le vent, en secondes), la vague en cours et l'état de la salle d'épreuve (0 pas commencée, 1 en cours, 2 finie), la qualité de rendu. */
export interface EtatDecor {
  temps: number;
  vague: number;
  epreuve: number;
  qualite: "haute" | "basse";
}
export interface OptionsDecor {
  ouverture?: Ouverture;
  /** Dans le niveau : ni îles lointaines ni nuages (le niveau a les siens) ; le ciel et l'arène restent. */
  niveau?: boolean;
  /** Lot BR-A2 : l'indice du boss du jour (`BOSS_IDS`) : ses couleurs sur les bannières et au sol ; sans lui, l'arène n'a pas d'accent. */
  boss?: number;
  /** Le matériau des pièces hautes (piliers, linteau, bannières) : celui du niveau les efface devant le chevalier. Sans lui, un toon balancé par le vent. */
  hauts?: Material;
  /** Le centre de l'arène dans le monde (mètres : le groupe y est posé) et l'origine de la grille du niveau (les dalles s'alignent sur les cases). */
  centre?: { x: number; z: number };
  origine?: { x: number; z: number };
}

/** Les couleurs du boss (jamais de rouge : le rouge est réservé au danger) : l'ocre du golem, le turquoise de la reine gelée, le violet du grand-duc, le bleu d'acier du bélier, le vert mousse du vieux chêne ; et le nombre d'encoches de l'anneau au sol. */
export const ACCENTS_BOSS: readonly { couleur: number; encoches: number }[] = [
  { couleur: 0xd9a441, encoches: 4 },
  { couleur: 0x2fb7c4, encoches: 6 },
  { couleur: 0x8a5fd0, encoches: 8 },
  { couleur: 0x4f86c6, encoches: 5 },
  { couleur: 0x5f9a3c, encoches: 7 },
];

export interface Decor {
  groupe: Group;
  /** Le vent (le temps du jeu) ; le décor du niveau (`niveauVue.ts`) lit aussi le chevalier, la caméra et la barrière. */
  maj?(chevalier: { x: number; z: number }, camera: Vector3, fermeture: number, fermetureEpreuve?: number, etat?: EtatDecor): void;
  /** La texture du ciel (`scene.background`). */
  ciel: Texture;
  detruire(): void;
}

/** Une bannière : une hampe de bois, un drap de la couleur du boss qui pend et ondule, un liseré sombre (3 m). */
function banniere(a: PaletteMonde, couleur: number): BufferGeometry {
  const drap = vent(colorier(placer(new BoxGeometry(0.95, 1.5, 0.05, 3, 4, 1), { x: 0.52, y: 2.25 }), [couleur], 5), 3.0, 1.5, 1.2);
  const sombre = new Color(couleur).multiplyScalar(0.7).getHex();
  const liseres = [placer(new BoxGeometry(1.0, 0.1, 0.07), { x: 0.52, y: 3.02 }), placer(new BoxGeometry(1.0, 0.1, 0.07), { x: 0.52, y: 1.5 })].map((g) => teindre(g, sombre));
  const tige = [cyl(0.07, 3.3, a.bois2), teindre(placer(new SphereGeometry(0.13, 6, 4), { y: 3.38 }), a.bois)];
  return fondre([...tige, ...liseres, drap]);
}
function cyl(r: number, h: number, c: number): BufferGeometry {
  return teindre(placer(new CylinderGeometry(r, r * 1.2, h, 6), { y: h / 2 }), c);
}

/** Monte tout le décor de l'arène de rayon `R` (mètres) pour une palette. */
export function monterDecor(R: number, a: PaletteMonde, opt: OptionsDecor = {}): Decor {
  const groupe = new Group();
  const ctx: ContexteFabrique = { a, theme: themeDe(a) };
  const accent = opt.boss !== undefined ? ACCENTS_BOSS[opt.boss % ACCENTS_BOSS.length]! : null;
  const centre = opt.centre ?? { x: 0, z: 0 };
  // Le plateau : le sol calculé de `sol.ts` (dalles dedans, lèvre d'herbe dehors, l'anneau du boss) sur un disque un peu plus large que l'arène (la lèvre).
  const solMat = matiereDuSol(a, null, { x: centre.x, z: centre.z, r: R, accent: accent ? { couleur: accent.couleur, n: accent.encoches } : undefined }, opt.origine ?? centre);
  const sol = new Mesh(sansSolAttr(new CircleGeometry(R + 0.9, 72).rotateX(-Math.PI / 2), 1), solMat.matiere);
  sol.position.y = -0.02;
  sol.receiveShadow = true;
  groupe.add(sol);
  const mur = piece(muret(R, a, ctx, opt.ouverture), 0xffffff, true, true);
  mur.corps.castShadow = true;
  groupe.add(mur.groupe);
  const ile = piece(falaises(R + 0.9, a), 0xffffff, true, true);
  ile.corps.castShadow = false;
  groupe.add(ile.groupe);
  // L'entrée et les bannières : des pièces hautes (elles s'effacent devant le chevalier si le matériau du niveau les y invite).
  const mHauts = opt.hauts ?? platVent();
  const hauts: BufferGeometry[] = [];
  const rayon = R + 0.55;
  if (opt.ouverture) {
    const ang = opt.ouverture.angle;
    const demi = opt.ouverture.largeur / 2 + 0.9;
    for (const s of [-1, 1]) {
      const t = ang + (s * demi) / rayon;
      hauts.push(placer(fabriquer("pilier", ctx, 0).clone(), { x: Math.cos(t) * rayon, z: Math.sin(t) * rayon, ry: -t }));
    }
    hauts.push(placer(fabriquer("linteau", ctx, 0).clone(), { x: Math.cos(ang) * rayon, z: Math.sin(ang) * rayon, ry: -ang - Math.PI / 2, s: [2 * demi, 1, 1] }));
  }
  if (accent) {
    const N = 18;
    for (let i = 0; i < N; i++) {
      if (i % 3 !== 1) continue;
      const t = ((i + 0.5) / N) * Math.PI * 2;
      if (opt.ouverture && Math.abs(((t - opt.ouverture.angle + Math.PI * 3) % (Math.PI * 2)) - Math.PI) < (opt.ouverture.largeur / 2 + 2.4) / rayon) continue;
      hauts.push(placer(banniere(a, accent.couleur).clone(), { x: Math.cos(t) * (rayon + 0.2), z: Math.sin(t) * (rayon + 0.2), ry: -t - Math.PI / 2 }));
    }
  }
  let gHauts: BufferGeometry | null = null;
  if (hauts.length > 0) {
    gHauts = fondre(hauts);
    const m = new Mesh(gHauts, mHauts);
    m.castShadow = true;
    m.receiveShadow = true;
    m.renderOrder = 2;
    groupe.add(m);
  }
  if (!opt.niveau) {
    const loin = piece(ilesLointaines(a), 0xffffff, true, true);
    loin.corps.castShadow = false;
    groupe.add(loin.groupe);
  }
  const ciel = textureCiel(a);
  let nuage: Mesh | null = null;
  if (!opt.niveau) {
    nuage = new Mesh(nuages(a), new MeshBasicMaterial({ vertexColors: true, transparent: true, opacity: 0.96, depthWrite: false }));
    nuage.renderOrder = -1;
    groupe.add(nuage);
  }
  return {
    groupe,
    ciel,
    maj(_chev, _cam, _f, _fe, etat) {
      if (etat) {
        VENT.temps.value = etat.temps;
        VENT.force.value = etat.qualite === "haute" ? 1 : 0;
      }
    },
    detruire() {
      ciel.dispose();
      solMat.detruire();
      if (nuage) (nuage.material as MeshBasicMaterial).dispose();
      if (!opt.hauts) (mHauts as { dispose(): void }).dispose();
      gHauts?.dispose();
      groupe.traverse((o) => {
        const m = o as Mesh;
        m.geometry?.dispose?.();
      });
    },
  };
}

/** Un attribut `proc` constant (1 : le dessus de ce maillage est du sol calculé) ; la normale vers le haut, la couleur blanche. */
function sansSolAttr<T extends BufferGeometry>(g: T, proc: number): T {
  const n = g.getAttribute("position").count;
  g.setAttribute("proc", new BufferAttribute(new Float32Array(n).fill(proc), 1));
  g.setAttribute("color", new BufferAttribute(new Float32Array(n * 3).fill(1), 3));
  return g;
}
