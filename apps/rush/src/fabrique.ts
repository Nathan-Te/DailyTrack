import { BoxGeometry, BufferAttribute, BufferGeometry, ConeGeometry, CylinderGeometry, IcosahedronGeometry, Vector3 } from "three";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { aleatoire, bloc, bruitDoux, colorier, colorierParFace, fusionner, placer, roche, teindre } from "./formes";
import type { PaletteMonde } from "./palette";

// LA FABRIQUE DE PIÈCES DU DÉCOR (lot BR-A2). Le décor du niveau ne dessine jamais une forme lui-même : il DEMANDE une pièce à la fabrique (`fabriquer("arbre", contexte, variante)`) et la pose. Une pièce est une géométrie fusionnée aux attributs
// `position`, `normal`, `color` et `vent` (de 0 au pied à 1 à la pointe : le balancement léger du vent, calculé dans le sommet), en MÈTRES, posée sur le sol à y = 0, centrée en (0, 0).
// **Pour y brancher des modèles plus tard** (des pièces dessinées dans Blender, par exemple) : `brancher("arbre", (contexte, variante) => …)` remplace le constructeur d'un genre ; rien d'autre ne change (la pose, le regroupement par morceaux, le fondu devant le chevalier,
// le vent). Un modèle chargé doit rendre une géométrie de ces quatre attributs (`fabriquer` ajoute `vent` à 0 s'il manque) ; sa hauteur reste celle de son genre (`HAUTEUR_MAX_MUR`), pour que les murs bas restent bas.

export type ThemeDeFabrique = "prairie" | "carriere" | "sousbois";

export const GENRES = ["rocher", "poteau", "haie", "buisson", "herbeHaute", "fleurs", "arbre", "souche", "champignons", "cristaux", "pilier", "linteau", "planchePont", "poteauPont", "caisse", "fougere", "pierreDressee", "rocherPointu"] as const;
export type Genre = (typeof GENRES)[number];

export interface ContexteFabrique {
  a: PaletteMonde;
  theme: ThemeDeFabrique;
}
export type Constructeur = (c: ContexteFabrique, variante: number) => BufferGeometry;

/** Combien de variantes un genre en a (le décor tire la sienne d'un hasard de position). */
export const VARIANTES: Readonly<Record<Genre, number>> = {
  rocher: 4,
  poteau: 3,
  haie: 4,
  buisson: 3,
  herbeHaute: 3,
  fleurs: 3,
  arbre: 3,
  souche: 2,
  champignons: 2,
  cristaux: 3,
  pilier: 1,
  linteau: 1,
  planchePont: 1,
  poteauPont: 1,
  caisse: 2,
  fougere: 2,
  pierreDressee: 3,
  rocherPointu: 3,
};

/** La hauteur (mètres) au plus d'un mur bas (poteau, haie, rocher) : on voit toujours par-dessus. Gardée par `test/fabrique.test.ts`. */
export const HAUTEUR_MAX_MUR = 1.3;

const FLEUR = [0xff7a8a, 0xffd447, 0xffffff, 0xb48ee6];
const CRISTAL = [0x8fd0ff, 0xc9a0ff];
const CHAMPIGNON = { chapeau: 0xd8473a, pied: 0xf2ead8 };

// --- Les briques ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** Pose l'attribut `vent` : 0 à `base`, 1 à `haut` (une courbe douce ; `haut` peut être sous `base` : le drap qui pend), multiplié par `force`. */
export function vent<T extends BufferGeometry>(g: T, base: number, haut: number, force = 1): T {
  const p = g.getAttribute("position");
  const v = new Float32Array(p.count);
  const d = Math.abs(haut - base) < 1e-3 ? 1e-3 : haut - base;
  for (let i = 0; i < p.count; i++) {
    const t = Math.min(1, Math.max(0, (p.getY(i) - base) / d));
    v[i] = t * t * (3 - 2 * t) * force;
  }
  g.setAttribute("vent", new BufferAttribute(v, 1));
  return g;
}
/** Une géométrie sans vent : l'attribut à 0 (tout ce qui ne bouge pas). */
function immobile<T extends BufferGeometry>(g: T): T {
  if (!g.getAttribute("vent")) g.setAttribute("vent", new BufferAttribute(new Float32Array(g.getAttribute("position").count), 1));
  return g;
}
/** Fusionne des pièces en une seule (un appel de dessin) : `position`, `normal`, `color`, `vent` (les formes de `formes.ts` n'en ont pas : `immobile` le leur ajoute ; une forme sans couleur est teinte en blanc). */
export function fondre(formes: readonly BufferGeometry[]): BufferGeometry {
  const prets = formes.map((g) => {
    const f = g.index || !g.getAttribute("color") || !g.getAttribute("normal") ? fusionner([g]) : g.clone();
    f.deleteAttribute("uv");
    return immobile(f);
  });
  const f = mergeGeometries(prets, false);
  if (!f) throw new Error("fusion impossible : attributs différents");
  return f;
}
const cone = (r: number, h: number, seg: number, p: { x?: number; y?: number; z?: number; rx?: number; rz?: number }, c: number): BufferGeometry => teindre(placer(new ConeGeometry(r, h, seg), { ...p, y: (p.y ?? 0) + h / 2 }), c);
const cyl = (r0: number, r1: number, h: number, p: { x?: number; y?: number; z?: number; rx?: number; rz?: number }, c: number, seg = 7): BufferGeometry => teindre(placer(new CylinderGeometry(r1, r0, h, seg), { ...p, y: (p.y ?? 0) + h / 2 }), c);
const boite = (l: number, h: number, p: number, pose: { x?: number; y?: number; z?: number; ry?: number; rz?: number }, c: number): BufferGeometry => teindre(placer(new BoxGeometry(l, h, p), pose), c);

/** Une boule de feuillage ou de roche : un icosaèdre déformé aux normales lisses, coloré par face du clair (dessus) au sombre (dessous), un peu de variété. */
function boule(r: number, p: { x?: number; y?: number; z?: number; s?: readonly [number, number, number] }, clair: number, sombre: number, graine: number, detail = 1, bruit = 0.12): BufferGeometry {
  const g = new IcosahedronGeometry(r, detail);
  const pos = g.getAttribute("position");
  const v = new Vector3();
  const rnd = bruitDoux(graine);
  for (let i = 0; i < pos.count; i++) {
    v.fromBufferAttribute(pos, i);
    const f = 1 + rnd(v.x * 2.1, v.y * 2.1, v.z * 2.1) * bruit;
    pos.setXYZ(i, v.x * f, v.y * f, v.z * f);
  }
  g.deleteAttribute("uv");
  const m = (c1: number, c2: number, u: number): number => {
    const ch = (sh: number): number => Math.round(((c1 >> sh) & 255) * (1 - u) + ((c2 >> sh) & 255) * u);
    return (ch(16) << 16) | (ch(8) << 8) | ch(0);
  };
  return colorierParFace(placer(g, { ...p }), (centre, normale) => {
    const t = Math.min(1, Math.max(0, normale.y * 0.5 + 0.5 + rnd(centre.x * 3, centre.y * 3, centre.z * 3) * 0.18));
    return m(sombre, clair, t);
  });
}

// --- Les constructeurs par défaut ------------------------------------------------------------------------------------------------------------------------------------------------------------------
const CONSTRUCTEURS: Record<Genre, Constructeur> = {
  /** Un rocher bas (0,45 à 0,8 m) : de la pierre du thème (les murs de la carrière), grise-brune ailleurs. */
  rocher: ({ a, theme }, v) => {
    const rnd = aleatoire(900 + v);
    const r = 0.38 + v * 0.1 + rnd() * 0.06;
    const base = theme === "carriere" ? [a.mur, a.murHaut, a.mur] : [a.falaise, a.falaise2, a.falaise2];
    return fondre([colorier(roche(r, 410 + v, { detail: 1, bruit: 0.2, etire: [1.15, 0.62 + rnd() * 0.2, 1] }), base, 40 + v)]);
  },
  /** Un rocher pointu : une pierre dressée, un peu penchée, qui dépasse du décor (carrière, sous-bois) : 1,2 à 2,4 m. */
  rocherPointu: ({ a }, v) => {
    const h = 1.3 + v * 0.55;
    return fondre([
      colorier(placer(roche(0.62, 520 + v, { detail: 1, bruit: 0.18, etire: [0.75, h / 0.62 / 1.5, 0.7] }), { y: h * 0.42, rz: (v - 1) * 0.1, ry: v }), [a.mur, a.murHaut, a.falaise2], 60 + v),
      colorier(placer(roche(0.34, 530 + v, { detail: 1, bruit: 0.2, etire: [1.1, 0.7, 1] }), { x: 0.6, z: 0.2, y: 0.2 }), [a.falaise, a.falaise2], 70 + v),
    ]);
  },
  /** Le poteau du muret de bois : un GROS fût arrondi, un chapeau plus large (≤ 1,2 m). */
  poteau: ({ a }, v) => {
    const h = 0.9 + v * 0.06;
    const l = 0.7 + (v % 2) * 0.05;
    return fondre([
      placer(bloc(l, h, l, { couleur: a.bois, dessus: a.bois, variation: 0.14, graine: 100 + v, rayon: 0.16, irregulier: 0.05, segments: 1 }), { y: h / 2 }),
      placer(bloc(l * 1.2, 0.2, l * 1.2, { couleur: a.bois2, dessus: a.bois, variation: 0.1, graine: 200 + v, rayon: 0.09, irregulier: 0.03, segments: 1 }), { y: h + 0.1 }),
    ]);
  },
  /** Une haie : un bloc de feuillage arrondi et irrégulier, un liseré clair sur le dessus (≤ 1,2 m). */
  haie: ({ a }, v) => {
    const rnd = aleatoire(300 + v);
    return fondre([
      placer(bloc(1.7 + rnd() * 0.2, 0.85 + rnd() * 0.3, 1.7 + rnd() * 0.2, { couleur: a.mur, dessus: a.murHaut, variation: 0.16, graine: 300 + v, rayon: 0.55, irregulier: 0.16, segments: 1 }), { y: 0.48 }),
      placer(boule(0.5, {}, a.murHaut, a.mur, 320 + v, 0, 0.14), { x: 0.4, z: -0.3, y: 0.95, s: [1, 0.6, 1] }),
    ]);
  },
  /** Un buisson : trois boules de feuillage et, sur certains, des baies (0,6 à 1,1 m). */
  buisson: ({ a, theme }, v) => {
    const rnd = aleatoire(600 + v);
    const f: BufferGeometry[] = [
      boule(0.62 + rnd() * 0.12, { y: 0.45, s: [1, 0.85, 1] }, a.herbe, a.herbe2, 610 + v),
      boule(0.45, { x: 0.5, z: 0.15, y: 0.34, s: [1, 0.85, 1] }, a.herbe, a.herbe2, 620 + v, 0),
      boule(0.4, { x: -0.38, z: -0.25, y: 0.32, s: [1, 0.85, 1] }, a.herbe, a.herbe2, 630 + v, 0),
    ];
    if (v === 1) for (let k = 0; k < 4; k++) f.push(teindre(placer(new IcosahedronGeometry(0.07, 0), { x: (rnd() - 0.5) * 1.0, y: 0.5 + rnd() * 0.4, z: 0.4 + rnd() * 0.3 }), theme === "sousbois" ? 0xd86a5a : 0xff7a8a));
    return vent(fondre(f), 0.1, 1.1, 0.35);
  },
  /** De l'herbe haute : sept à neuf brins pointus qui plient au vent (0,45 à 0,9 m). */
  herbeHaute: ({ a }, v) => {
    const rnd = aleatoire(700 + v);
    const f: BufferGeometry[] = [];
    const n = 7 + v;
    for (let k = 0; k < n; k++) {
      const t = (k / n) * Math.PI * 2 + rnd();
      const d = 0.08 + rnd() * 0.22;
      const h = 0.45 + rnd() * 0.45;
      f.push(cone(0.07 + rnd() * 0.04, h, 4, { x: Math.cos(t) * d, z: Math.sin(t) * d, rz: (rnd() - 0.5) * 0.5, rx: (rnd() - 0.5) * 0.5 }, rnd() < 0.5 ? a.herbe : a.herbe2));
    }
    return vent(fondre(f), 0, 0.9, 1);
  },
  /** Des fleurs : des tiges vertes et de petites têtes de couleur (0,35 à 0,55 m). */
  fleurs: ({ a }, v) => {
    const rnd = aleatoire(800 + v);
    const f: BufferGeometry[] = [];
    for (let k = 0; k < 5; k++) {
      const x = (rnd() - 0.5) * 0.7;
      const z = (rnd() - 0.5) * 0.7;
      const h = 0.3 + rnd() * 0.22;
      f.push(cone(0.03, h, 4, { x, z }, a.herbe2));
      f.push(teindre(placer(new IcosahedronGeometry(0.1, 0), { x, y: h + 0.03, z, s: [1, 0.7, 1] }), FLEUR[(k + v) % FLEUR.length]!));
    }
    return vent(fondre(f), 0.05, 0.55, 0.9);
  },
  /** Un arbre : un tronc, une couronne de feuillage en boules (prairie, sous-bois) ou en étages de cônes (sapin, sous-bois) ou un arbre sec (carrière) : 4 à 5,5 m. */
  arbre: ({ a, theme }, v) => {
    const rnd = aleatoire(1000 + v);
    if (theme === "sousbois" && v !== 1) {
      // un sapin : quatre étages de cônes sur un tronc
      const s = 1 + v * 0.12;
      return vent(fondre([cyl(0.26, 0.2, 1.2, {}, a.bois2), cone(1.4 * s, 2.0, 8, { y: 0.9 }, a.herbe2), cone(1.05 * s, 1.8, 8, { y: 2.2 }, a.herbe), cone(0.7 * s, 1.6, 8, { y: 3.5 }, a.herbe2), cone(0.35 * s, 0.9, 8, { y: 4.6 }, a.herbe)]), 0.9, 5.3, 0.55);
    }
    if (theme === "carriere") {
      // un arbre sec : un tronc tordu, deux branches, quelques touffes ocre
      const h = 2.6 + v * 0.5;
      return vent(
        fondre([
          cyl(0.3, 0.14, h, { rz: 0.06 * (v - 1) }, a.bois2, 6),
          cyl(0.13, 0.05, 1.5, { x: 0.1, y: h * 0.6, rz: -0.9 }, a.bois, 5),
          cyl(0.12, 0.05, 1.3, { x: -0.1, y: h * 0.75, rz: 0.95 }, a.bois, 5),
          boule(0.7, { x: 1.0, y: h * 0.6 + 0.9, s: [1, 0.7, 1] }, a.herbe, a.herbe2, 1010 + v, 0, 0.16),
          boule(0.8, { y: h + 0.3, s: [1, 0.7, 1] }, a.herbe, a.herbe2, 1020 + v, 1, 0.16),
          boule(0.55, { x: -1.0, y: h * 0.75 + 0.8, s: [1, 0.7, 1] }, a.herbe, a.herbe2, 1030 + v, 0, 0.16),
        ]),
        h * 0.5,
        h + 1,
        0.4,
      );
    }
    const h = 1.7 + v * 0.3 + rnd() * 0.2;
    return vent(
      fondre([
        cyl(0.3, 0.19, h, {}, a.bois2),
        boule(1.45 + v * 0.12, { y: h + 1.0, s: [1, 0.88, 1] }, a.herbe, a.herbe2, 1100 + v, 1, 0.1),
        boule(0.95, { x: 0.85, y: h + 1.45, z: 0.25 }, a.herbe, a.herbe2, 1110 + v, 0, 0.1),
        boule(0.8, { x: -0.8, y: h + 0.85, z: -0.3 }, a.herbe, a.herbe2, 1120 + v, 0, 0.1),
      ]),
      h * 0.8,
      h + 2.7,
      0.45,
    );
  },
  /** Une souche : un cylindre de bois, un dessus clair (0,6 m). */
  souche: ({ a }, v) => fondre([cyl(0.5 + v * 0.1, 0.42, 0.55, {}, a.bois2), teindre(placer(new CylinderGeometry(0.42, 0.42, 0.04, 8), { y: 0.57 }), a.bois)]),
  /** Des champignons : un pied clair, un chapeau rond (sous-bois). */
  champignons: (_c, v) =>
    fondre([cyl(0.09, 0.08, 0.35, { x: 0.25 }, CHAMPIGNON.pied, 5), teindre(placer(new IcosahedronGeometry(0.25, 0), { x: 0.25, y: 0.4, s: [1, 0.55, 1] }), CHAMPIGNON.chapeau), cyl(0.07, 0.06, 0.25, { x: -0.3, z: 0.25 }, CHAMPIGNON.pied, 5), teindre(placer(new IcosahedronGeometry(0.18, 0), { x: -0.3, y: 0.29, z: 0.25, s: [1, 0.55, 1] }), v ? 0xe6a23a : CHAMPIGNON.chapeau)]),
  /** Des cristaux : trois pointes bleutées (carrière). */
  cristaux: (_c, v) => fondre([cone(0.16, 0.9 + v * 0.25, 5, { x: 0, z: 0 }, CRISTAL[v % 2]!), cone(0.12, 0.6, 5, { x: 0.28, z: 0.1, rz: -0.25 }, CRISTAL[(v + 1) % 2]!), cone(0.1, 0.5, 5, { x: -0.25, z: -0.12, rz: 0.3 }, CRISTAL[v % 2]!)]),
  /** Un pilier de l'arène (l'entrée) : un socle, un fût de pierre, un chapeau, un brasier sur le dessus (4,6 m). */
  pilier: ({ a }) =>
    fondre([
      placer(bloc(1.7, 0.55, 1.7, { couleur: a.tranche, dessus: a.falaise2, variation: 0.08, graine: 41, rayon: 0.2, irregulier: 0.04, segments: 2 }), { y: 0.27 }),
      placer(bloc(1.1, 3.1, 1.1, { couleur: a.falaise2, dessus: a.tranche, variation: 0.12, graine: 42, rayon: 0.3, irregulier: 0.05, segments: 2 }), { y: 2.1 }),
      placer(bloc(1.5, 0.45, 1.5, { couleur: a.tranche, dessus: a.falaise2, variation: 0.08, graine: 43, rayon: 0.15, irregulier: 0.03, segments: 2 }), { y: 3.85 }),
      cone(0.38, 0.6, 6, { y: 4.05 }, 0xffb43a),
    ]),
  /** Le linteau qui relie les deux piliers de l'entrée de l'arène : une poutre de bois (largeur 1 m : on l'étire à la mesure de l'ouverture). */
  linteau: ({ a }) => fondre([placer(bloc(1, 0.5, 0.8, { couleur: a.bois, dessus: a.bois, variation: 0.1, graine: 51, rayon: 0.12, irregulier: 0.02, segments: 1 }), { y: 4.2 }), boite(1, 0.12, 0.9, { y: 4.52 }, a.bois2)]),
  /** Une planche de pont : une planche large de 2 m (1 case). */
  planchePont: ({ a }) => fondre([boite(0.42, 0.12, 1.94, { y: 0 }, a.bois)]),
  /** Un poteau de pont : un fût et un chapeau (1,1 m). */
  poteauPont: ({ a }) => fondre([boite(0.32, 1.0, 0.32, { y: 0.5 }, a.bois2), boite(0.42, 0.14, 0.42, { y: 1.05 }, a.bois)]),
  /** Une caisse de bois (carrière : une petite pile). */
  caisse: ({ a }, v) => fondre([boite(0.9, 0.7, 0.9, { y: 0.35, ry: 0.3 * v }, a.bois), boite(0.62, 0.5, 0.62, { y: 0.95, ry: 0.5 + v, x: 0.05 }, a.bois2)]),
  /** Une fougère : des feuilles longues qui s'ouvrent en étoile (sous-bois). */
  fougere: ({ a }, v) => {
    const rnd = aleatoire(1300 + v);
    const f: BufferGeometry[] = [];
    for (let k = 0; k < 8; k++) {
      const t = (k / 8) * Math.PI * 2 + rnd() * 0.3;
      f.push(cone(0.11, 0.9 + rnd() * 0.3, 3, { x: Math.cos(t) * 0.18, z: Math.sin(t) * 0.18, rz: Math.cos(t) * 1.0, rx: -Math.sin(t) * 1.0 }, k % 2 ? a.herbe : a.herbe2));
    }
    return vent(fondre(f), 0, 0.7, 0.8);
  },
  /** Une pierre dressée (menhir) : une dalle de pierre plantée droite (carrière, 1,6 à 2,6 m). */
  pierreDressee: ({ a }, v) => {
    const h = 1.6 + v * 0.5;
    return fondre([
      placer(bloc(0.75, h, 0.5, { couleur: a.mur, dessus: a.murHaut, variation: 0.14, graine: 1400 + v, rayon: 0.2, irregulier: 0.06, segments: 1 }), { y: h / 2 - 0.1, ry: v * 0.8, rz: (v - 1) * 0.05 }),
      colorier(placer(roche(0.3, 1410 + v, { detail: 1, bruit: 0.2, etire: [1.2, 0.6, 1] }), { x: 0.5, y: 0.15, z: 0.2 }), [a.mur, a.murHaut], 1420 + v),
    ]);
  },
};

// --- La fabrique -----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
const branches = new Map<Genre, Constructeur>();
const memoire = new Map<string, BufferGeometry>();
const paletteId = new WeakMap<PaletteMonde, number>();
let prochainId = 1;
const idDe = (a: PaletteMonde): number => {
  let i = paletteId.get(a);
  if (i === undefined) paletteId.set(a, (i = prochainId++));
  return i;
};

/** Branche un constructeur à la place de celui d'un genre (un modèle Blender, par exemple). Vide la mémoire. */
export function brancher(genre: Genre, constructeur: Constructeur): void {
  branches.set(genre, constructeur);
  memoire.clear();
}
/** Retire tous les constructeurs branchés (les tests). */
export function debrancher(): void {
  branches.clear();
  memoire.clear();
}

/** Une pièce du genre demandé, à la variante demandée (modulo le nombre de variantes), pour la palette et le thème du contexte. **Mise en mémoire** : la même pièce est rendue à chaque demande, ne jamais la modifier (copier : `placer(g.clone(), …)`). */
export function fabriquer(genre: Genre, c: ContexteFabrique, variante = 0): BufferGeometry {
  const v = ((Math.trunc(variante) % VARIANTES[genre]) + VARIANTES[genre]) % VARIANTES[genre];
  const cle = `${idDe(c.a)}|${c.theme}|${genre}|${v}`;
  let g = memoire.get(cle);
  if (!g) {
    g = immobile((branches.get(genre) ?? CONSTRUCTEURS[genre])(c, v));
    if (!g.getAttribute("normal")) g.computeVertexNormals();
    memoire.set(cle, g);
  }
  return g;
}

/** Un rail de muret de bois : deux lisses de `longueur` mètres posées de bout en bout (le long de x, à y = 0), à 0,5 et 0,85 m. */
export function rail(c: ContexteFabrique, longueur: number): BufferGeometry {
  const cle = `${idDe(c.a)}|rail|${longueur.toFixed(2)}`;
  let g = memoire.get(cle);
  if (!g) {
    const L = Math.max(0.2, longueur);
    g = fondre([boite(L, 0.15, 0.1, { y: 0.5 }, c.a.bois), boite(L, 0.15, 0.1, { y: 0.86 }, c.a.bois2)]);
    memoire.set(cle, g);
  }
  return g;
}

/** La hauteur du sommet de la pièce (mètres, y = 0 au sol). */
export function hauteurDe(g: BufferGeometry): number {
  g.computeBoundingBox();
  return g.boundingBox!.max.y;
}
