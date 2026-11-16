import {
  BoxGeometry,
  CanvasTexture,
  CircleGeometry,
  Color,
  DoubleSide,
  RepeatWrapping,
  ShapeGeometry,
  CylinderGeometry,
  DirectionalLight,
  EdgesGeometry,
  ExtrudeGeometry,
  Group,
  HemisphereLight,
  LineBasicMaterial,
  LineSegments,
  Material,
  Mesh,
  MeshBasicMaterial,
  MeshStandardMaterial,
  PCFSoftShadowMap,
  PerspectiveCamera,
  PlaneGeometry,
  PMREMGenerator,
  Scene,
  ShadowMaterial,
  Shape,
  SphereGeometry,
  SRGBColorSpace,
  TorusGeometry,
  Vector2,
  Vector3,
  WebGLRenderer,
  BufferGeometry,
  Float32BufferAttribute,
  Matrix4,
  Euler,
  Quaternion,
  type Object3D,
  type Texture,
} from "three";
import { RoomEnvironment } from "three/examples/jsm/environments/RoomEnvironment.js";
import { mergeGeometries } from "three/examples/jsm/utils/BufferGeometryUtils.js";
import { AXE, HAUTEUR, JET_GEYSER, LARGEUR, MULT_MAX, RAYON, TICKS_PAR_SECONDE, TOUR, type Partie, type ThemePinball } from "@cdj/pinball-sim";
import { COULEURS_ELEMENTS, ENCRE, PALETTES, PAPIER, MOUTARDE, TAU, clignote, comptePourLaMission, couleurModule, dessinerSol, flecheDe, lampesMission, pastille, placeDuNom, px, type Palette, type Rendu, type Surimpression } from "./dessin";
import type { Vue } from "./bornes";

// Le rendu three.js de « Pinball » (lot PB2), l'option B de la maquette : **la même simulation 2D, vue en 3D penchée**. **Chargé à la demande** (ligne `corps-` de `budget.aLaDemande`), jamais dans le premier chargement.
// Le sol de la table est le dessin à plat de `dessin.ts` (`dessinerSol`) posé en texture, avec ses bandes, ses lampes éteintes, ses flèches et le nom du thème, dans la palette du thème ; par-dessus, en volume : le meuble en
// bois, les rails, les poteaux, les lance-pierres, les bumpers (qui s'enfoncent et s'allument au contact, avec des yeux qui suivent la bille), les cibles (qui tombent), les spinners, les trous, les batteurs, le lanceur et la
// bille en métal. Rien ici ne décide quoi que ce soit : ce fichier **lit** la partie (`Partie`) à chaque image, l'état entre deux pas étant interpolé (la bille, les batteurs). Les ombres sont celles d'une lumière directionnelle.
// La caméra CADRE TOUTE LA TABLE (`cadrer`) : elle cherche la distance et le point visé qui font tenir le terrain de jeu dans l'image, quelle que soit la taille de l'écran ; les batteurs, au bord bas de la table, restent donc
// toujours à l'image. Les étiquettes des modules sont des plaques à part (grossies d'autant que la perspective les rapetisse : lot PB2, le seul défaut de la maquette) et non du sol.
// L'unité de la scène est le pixel de la table : `X(x)` et `Z(y)` centrent le plateau, +z est le bas de la table (les batteurs), y est la hauteur.

const X = (x: number): number => x - LARGEUR / 2;
const Z = (y: number): number => y - HAUTEUR / 2;
const BOIS = "#5A3A22";
const rad = (d: number): number => (d * Math.PI) / 180;
const TEXTURE_L = 1024;

export interface OptionsCorps {
  theme: ThemePinball;
  /** Le nom d'un module posé (déjà traduit), ou `null`. */
  nom: (module: string) => string | null;
  /** Le nom du thème peint sur la table. */
  titre: string;
  police: string;
  vue: Vue;
  /** Le joueur préfère moins de mouvement : pas de secousse de caméra à la mission réussie. */
  reduit: boolean;
  /** Un écran tactile : moins de pixels (1,5 au plus). */
  tactile: boolean;
  /** `?debug&fps` : les images par seconde, la durée d'une image, les appels de dessin. */
  fps: boolean;
  /** Le contexte WebGL est perdu : le jeu repasse au rendu de secours. */
  surPerte(): void;
}

/** Le rendu three.js : le rendu commun, plus ce qui n'existe qu'ici. */
export interface RenduTrois extends Rendu {
  /** Change la vue (caméra, lumière, étiquettes) tout de suite : le panneau des réglages. */
  regler(v: Vue): void;
  /** Ce que mesure `?debug&fps` et que les essais lisent : les appels de dessin et les triangles de la dernière image, et, pour les essais, où tombent les points du terrain à l'écran (`cadre` : le plus grand |x| et les y extrêmes, en coordonnées d'écran de −1 à 1 : tout est à l'image si |x| ≤ 1 et −1 ≤ y ≤ 1) ; `ms` : le temps moyen que le fil principal y passe (la mise à jour de la scène et l'envoi des commandes à la carte graphique, pas le travail de la carte). */
  info(): { appels: number; triangles: number; ms: number; cadre: { x: number; y0: number; y1: number } };
}

/** Crée le rendu three.js d'une partie sur `canvas` (qui reste à l'appelant). Lève une erreur si le navigateur n'a pas de WebGL : l'appelant retombe alors sur le rendu à plat. */
export function creerCorps(canvas: HTMLCanvasElement, partie: Partie, o: OptionsCorps): RenduTrois {
  const P: Palette = PALETTES[o.theme];
  const t = partie.table;
  let vue = { ...o.vue };
  const renderer = new WebGLRenderer({ canvas, antialias: true, powerPreference: "high-performance" });
  renderer.shadowMap.enabled = true;
  renderer.shadowMap.type = PCFSoftShadowMap;
  renderer.outputColorSpace = SRGBColorSpace;
  const surPerte = (e: Event): void => {
    e.preventDefault();
    o.surPerte();
  };
  canvas.addEventListener("webglcontextlost", surPerte);
  const scene = new Scene();
  scene.background = new Color("#1c140e");
  const pmrem = new PMREMGenerator(renderer);
  const env = pmrem.fromScene(new RoomEnvironment(), 0.04);
  scene.environment = env.texture;
  pmrem.dispose();
  const camera = new PerspectiveCamera(30, TEXTURE_L / HAUTEUR, 10, 6000);
  const hemi = new HemisphereLight("#fff6e0", "#6b5847", 0.9);
  const soleil = new DirectionalLight("#fff1d6", 1.1);
  soleil.position.set(-180, 650, 300);
  soleil.castShadow = true;
  soleil.shadow.mapSize.set(2048, 2048);
  Object.assign(soleil.shadow.camera, { left: -300, right: 300, top: 460, bottom: -460, near: 50, far: 1600 });
  soleil.shadow.bias = -0.0006;
  soleil.shadow.normalBias = 0.4;
  scene.add(hemi, soleil, soleil.target);
  const lumiere = (): void => {
    const k = vue.lumiere / 100;
    hemi.intensity = 0.9 * k;
    soleil.intensity = 1.1 * k;
  };
  lumiere();

  // --- Les matériaux et les petites fabriques (tout est libéré par `detruire`)
  const aLiberer: { dispose(): void }[] = [env];
  const materiaux = new Map<string, MeshStandardMaterial>();
  const mat = (couleur: string, opt: { roughness?: number; metalness?: number; emissive?: string; envMapIntensity?: number; unique?: boolean } = {}): MeshStandardMaterial => {
    const cle = `${couleur}|${opt.roughness ?? ""}|${opt.metalness ?? ""}|${opt.emissive ?? ""}|${opt.envMapIntensity ?? ""}`;
    const connu = opt.unique ? undefined : materiaux.get(cle);
    if (connu) return connu;
    const m = new MeshStandardMaterial({ color: couleur, roughness: opt.roughness ?? 0.55, metalness: opt.metalness ?? 0, envMapIntensity: opt.envMapIntensity ?? 0.35, emissive: opt.emissive ?? "#000000" });
    if (!opt.unique) materiaux.set(cle, m);
    aLiberer.push(m);
    return m;
  };
  const trait = new LineBasicMaterial({ color: ENCRE });
  aLiberer.push(trait);
  const geo = <G extends BufferGeometry>(g: G): G => {
    aLiberer.push(g);
    return g;
  };
  const contour = (g: BufferGeometry, seuil = 30): LineSegments => {
    const e = geo(new EdgesGeometry(g, seuil));
    return new LineSegments(e, trait);
  };
  const ombrageur = <M extends Object3D>(m: M, projette = true): M => {
    m.castShadow = projette;
    m.receiveShadow = true;
    return m;
  };
  const cylindre = (r: number, h: number, couleur: string, opt?: Parameters<typeof mat>[1]): Mesh => ombrageur(new Mesh(geo(new CylinderGeometry(r, r, h, 32)), mat(couleur, opt)));
  const toile = (l: number, h: number, dessin: (c: CanvasRenderingContext2D) => void): CanvasTexture => {
    const cv = document.createElement("canvas");
    cv.width = l;
    cv.height = h;
    dessin(cv.getContext("2d")!);
    const tex = new CanvasTexture(cv);
    tex.colorSpace = SRGBColorSpace;
    tex.anisotropy = Math.min(8, renderer.capabilities.getMaxAnisotropy());
    aLiberer.push(tex);
    return tex;
  };
  const groupe = new Group();
  scene.add(groupe);

  // --- Le sol : le dessin à plat, en texture (non éclairé : il garde les couleurs exactes de la palette) ; les ombres viennent d'un calque à part
  const texH = Math.round((TEXTURE_L * HAUTEUR) / LARGEUR);
  const sol = toile(TEXTURE_L, texH, (c) => {
    c.scale(TEXTURE_L / LARGEUR, texH / HAUTEUR);
    dessinerSol(c, { theme: o.theme, table: t, titre: o.titre, police: o.police, hors: BOIS });
  });
  const plan = new Mesh(geo(new PlaneGeometry(LARGEUR, HAUTEUR)), new MeshBasicMaterial({ map: sol }));
  aLiberer.push(plan.material as Material);
  plan.rotation.x = -Math.PI / 2;
  groupe.add(plan);
  const ombres = new Mesh(geo(new PlaneGeometry(LARGEUR, HAUTEUR)), new ShadowMaterial({ opacity: 0.32, color: "#2a1a10" }));
  aLiberer.push(ombres.material as Material);
  ombres.rotation.x = -Math.PI / 2;
  ombres.position.y = 0.3;
  ombres.receiveShadow = true;
  groupe.add(ombres);
  // le meuble en bois autour de la table
  const bois = mat(BOIS, { roughness: 0.7 });
  for (const [x, z, l, p] of [[-LARGEUR / 2 - 10, 0, 20, HAUTEUR + 40], [LARGEUR / 2 + 10, 0, 20, HAUTEUR + 40], [0, -HAUTEUR / 2 - 10, LARGEUR + 40, 20], [0, HAUTEUR / 2 + 10, LARGEUR + 40, 20]] as const) {
    const m = ombrageur(new Mesh(geo(new BoxGeometry(l, 46, p)), bois));
    m.position.set(x, 10, z);
    groupe.add(m);
  }

  // --- Les murs : des rails ; les poteaux
  // les rails du châssis et des modules ne bougent jamais : un seul maillage (un appel de dessin, un de plus pour les ombres), pas quarante
  const rail = mat(P.sombre ? "#3b3f66" : "#4a3426", { roughness: 0.4, metalness: 0.2 });
  const morceaux: BufferGeometry[] = [];
  for (const m of t.murs) {
    if (m.type !== 0) continue;
    const ax = px(m.ax);
    const ay = px(m.ay);
    const bx = px(m.bx);
    const by = px(m.by);
    const g = new BoxGeometry(Math.hypot(bx - ax, by - ay) + 6, 18, 7);
    g.applyMatrix4(new Matrix4().compose(new Vector3(X((ax + bx) / 2), 9, Z((ay + by) / 2)), new Quaternion().setFromEuler(new Euler(0, -Math.atan2(by - ay, bx - ax), 0)), new Vector3(1, 1, 1)));
    morceaux.push(g);
  }
  groupe.add(ombrageur(new Mesh(geo(mergeGeometries(morceaux)!), rail)));
  for (const g of morceaux) g.dispose();
  for (const p of t.poteaux) {
    const m = cylindre(px(p.r) + 1, 22, PAPIER);
    m.position.set(X(px(p.x)), 11, Z(px(p.y)));
    groupe.add(m);
  }

  // --- Les lance-pierres : un prisme et son caoutchouc, qui s'allume au choc
  const caoutchoucs: Mesh[] = [];
  for (const sens of [1, -1]) {
    const x = (v: number): number => (sens > 0 ? v : 2 * AXE - v);
    const forme = new Shape([new Vector2(X(x(42)), Z(468)), new Vector2(X(x(42)), Z(546)), new Vector2(X(x(92)), Z(574))]);
    const g = geo(new ExtrudeGeometry(forme, { depth: 16, bevelEnabled: false }));
    g.rotateX(Math.PI / 2);
    g.translate(0, 16, 0);
    const m = ombrageur(new Mesh(g, mat(P.sling)));
    groupe.add(m, contour(g));
    const dx = x(89) - x(44);
    const dy = 568 - 472;
    const caou = ombrageur(new Mesh(geo(new BoxGeometry(Math.hypot(dx, dy), 12, 4)), mat(PAPIER, { emissive: MOUTARDE, unique: true })), false);
    (caou.material as MeshStandardMaterial).emissiveIntensity = 0;
    caou.position.set(X((x(44) + x(89)) / 2) + sens * 1.5, 8, Z((472 + 568) / 2) - 1.5);
    caou.rotation.y = -Math.atan2(dy, dx);
    groupe.add(caou);
    caoutchoucs.push(caou);
  }

  // --- Les bumpers : jupe, corps, chapeau, deux yeux qui suivent la bille
  const bumpers = t.bumpers.map((b) => {  // (lot PB3 : `g` suit l'astéroïde, qui se déplace)
    const r = px(b.r);
    const g = new Group();
    g.position.set(X(px(b.x)), 0, Z(px(b.y)));
    const jupe = cylindre(r * 1.22, 5, P.accent);
    jupe.position.y = 2.5;
    const haut = new Group();
    haut.position.y = 2;
    const corps = cylindre(r, 20, b.mobile ? "#9AA3B5" : P.bumper, { emissive: MOUTARDE, unique: true }); // l'astéroïde est gris
    corps.position.y = 10;
    (corps.material as MeshStandardMaterial).emissiveIntensity = 0;
    corps.add(contour(corps.geometry));
    const chapeau = cylindre(r * 0.66, 4, PAPIER);
    chapeau.position.y = 22;
    haut.add(corps, chapeau);
    const pupilles: Mesh[] = [];
    for (const sx of [-1, 1]) {
      const blanc = ombrageur(new Mesh(geo(new SphereGeometry(r * 0.2, 16, 12)), mat(PAPIER)), false);
      blanc.scale.y = 0.6;
      blanc.position.set(sx * r * 0.28, 24, r * 0.12);
      const pupille = new Mesh(geo(new SphereGeometry(r * 0.1, 12, 8)), mat(ENCRE));
      pupille.position.set(sx * r * 0.28, 25.5, r * 0.16);
      haut.add(blanc, pupille);
      pupilles.push(pupille);
    }
    g.add(jupe, haut);
    groupe.add(g);
    return { b, g, r, haut, corps, pupilles, x: px(b.x), y: px(b.y) };
  });

  // --- Les cibles : des blocs qui tombent (et leur trace pointillée au sol)
  const cibles: { i: number; m: Mesh; trace: Mesh }[] = [];
  t.murs.forEach((m, i) => {
    if (m.type !== 2) return;
    const ax = px(m.ax);
    const ay = px(m.ay);
    const bx = px(m.bx);
    const by = px(m.by);
    const l = Math.hypot(bx - ax, by - ay);
    const b = ombrageur(new Mesh(geo(new BoxGeometry(l - 1, 18, 6)), mat(o.theme === "volcan" ? "#8a8a94" : P.cible)));
    b.position.set(X((ax + bx) / 2), 9, Z((ay + by) / 2));
    b.rotation.y = -Math.atan2(by - ay, bx - ax);
    b.add(contour(b.geometry));
    const trace = new Mesh(geo(new BoxGeometry(l - 1, 0.4, 3)), new MeshBasicMaterial({ color: ENCRE, transparent: true, opacity: 0.4 }));
    aLiberer.push(trace.material as Material);
    trace.position.set(X((ax + bx) / 2), 0.5, Z((ay + by) / 2));
    trace.rotation.y = b.rotation.y;
    trace.visible = false;
    groupe.add(b, trace);
    cibles.push({ i, m: b, trace });
  });

  // --- Les spinners : une plaque sur un axe
  const roues = t.spinners.map((c) => {
    const g = new Group();
    g.position.set(X(px(c.x)), 14, Z(px(c.y)));
    const l = px(c.l);
    const plaque = ombrageur(new Mesh(geo(new BoxGeometry((l - 4) * 2, 2, 16)), mat(P.accent)));
    plaque.add(contour(plaque.geometry));
    const axe = new Mesh(geo(new CylinderGeometry(1.5, 1.5, l * 2 + 4, 8)), mat(ENCRE));
    axe.rotation.z = Math.PI / 2;
    g.add(plaque, axe);
    groupe.add(g);
    return { plaque, angle: 0 };
  });

  // --- Les trous : un anneau et un fond noir
  for (const tr of t.trous) {
    const r = px(tr.r);
    const anneau = ombrageur(new Mesh(geo(new TorusGeometry(r + 3, 3.5, 10, 32)), mat(P.accent)));
    anneau.rotation.x = Math.PI / 2;
    anneau.position.set(X(px(tr.x)), 2, Z(px(tr.y)));
    const fond = new Mesh(geo(new CircleGeometry(r, 32)), mat("#0c0806"));
    fond.rotation.x = -Math.PI / 2;
    fond.position.set(X(px(tr.x)), 0.6, Z(px(tr.y)));
    groupe.add(anneau, fond);
  }

  // --- Lot PB3 : les éléments des thèmes, animés en fonction du seul pas ; chaque mise à jour reçoit le pas (et la part de pas écoulée) et rien d'autre
  const C = COULEURS_ELEMENTS;
  const maj: ((tick: number, sec: number, dt: number) => void)[] = [];
  const plat = (g: BufferGeometry, y: number, m: Material | Material[]): Mesh => {
    const d = new Mesh(g, m);
    d.rotation.x = -Math.PI / 2;
    d.position.y = y;
    return d;
  };
  const disque = (r: number, y: number, tex: Texture, transparent = true): Mesh => {
    const m = new MeshBasicMaterial({ map: tex, transparent, depthWrite: false });
    aLiberer.push(m);
    return plat(geo(new CircleGeometry(r, 64)), y, m);
  };
  // le manège : un plateau de huit parts qui tourne contre les aiguilles, un moyeu, quatre chevaux
  for (const z of t.plateaux) {
    const r = px(z.r);
    const g = new Group();
    g.position.set(X(px(z.x)), 0, Z(px(z.y)));
    const socle = cylindre(r, 6, MOUTARDE);
    socle.position.y = 3;
    socle.add(contour(socle.geometry));
    const tourne = new Group();
    const parts = toile(512, 512, (c) => {
      c.translate(256, 256);
      c.scale(256 / (r - 7), 256 / (r - 7));
      for (let k = 0; k < 8; k++) {
        c.fillStyle = k % 2 ? C.manegeA : PAPIER;
        c.beginPath();
        c.moveTo(0, 0);
        c.arc(0, 0, r - 7, (k * Math.PI) / 4, ((k + 1) * Math.PI) / 4);
        c.closePath();
        c.fill();
      }
    });
    tourne.add(disque(r - 7, 6.2, parts, false));
    const hub = cylindre(10, 24, C.manegeHub);
    hub.position.y = 12;
    tourne.add(hub);
    for (let k = 0; k < 4; k++) {
      const a = (k * Math.PI) / 2;
      const poteau = cylindre(1.6, 20, ENCRE);
      poteau.position.set(Math.cos(a) * r * 0.58, 16, Math.sin(a) * r * 0.58);
      const cheval = ombrageur(new Mesh(geo(new SphereGeometry(5.5, 16, 12)), mat(k % 2 ? MOUTARDE : PAPIER)));
      cheval.position.set(Math.cos(a) * r * 0.58, 28, Math.sin(a) * r * 0.58);
      tourne.add(poteau, cheval);
    }
    g.add(socle, tourne);
    groupe.add(g);
    maj.push((_, sec) => (tourne.rotation.y = sec * 1.6));
  }
  // le tourbillon : trois bras en spirale qui tournent, un cœur sombre
  for (const z of t.tourbillons) {
    const r = px(z.r);
    const g = new Group();
    g.position.set(X(px(z.x)), 0, Z(px(z.y)));
    const spirale = toile(512, 512, (c) => {
      c.fillStyle = C.tourbillon;
      c.beginPath();
      c.arc(256, 256, 256, 0, TAU);
      c.fill();
      c.translate(256, 256);
      c.strokeStyle = C.tourbillonBras;
      c.lineWidth = 18;
      c.lineCap = "round";
      for (let k = 0; k < 3; k++) {
        c.rotate(2.094);
        c.beginPath();
        for (let a = 0; a < 5; a += 0.1) c.lineTo(Math.cos(a) * (240 - a * 40), Math.sin(a) * (240 - a * 40));
        c.stroke();
      }
    });
    const tourne = new Group();
    tourne.add(disque(r, 0.8, spirale));
    const coeur = ombrageur(new Mesh(geo(new CylinderGeometry(9, 9, 2, 24)), mat(C.tourbillonCentre)), false);
    coeur.position.y = 1.4;
    g.add(tourne, coeur);
    groupe.add(g);
    maj.push((_, sec) => (tourne.rotation.y = -sec * 4.8));
  }
  // le trou noir : un cœur sombre, un anneau d'or incliné, des anneaux en pointillés qui tournent
  for (const z of t.trousNoirs) {
    const g = new Group();
    g.position.set(X(px(z.x)), 0, Z(px(z.y)));
    const ondes = toile(512, 512, (c) => {
      c.translate(256, 256);
      for (let k = 4; k >= 1; k--) {
        c.beginPath();
        c.arc(0, 0, (250 * k) / 4, 0, TAU);
        c.strokeStyle = `rgba(${C.noirOnde},${0.3 + (4 - k) * 0.15})`;
        c.lineWidth = 6;
        c.setLineDash([22, 22]);
        c.stroke();
      }
    });
    const tourne = new Group();
    tourne.add(disque(px(z.r), 0.9, ondes));
    const noyau = ombrageur(new Mesh(geo(new SphereGeometry(15, 24, 16)), mat(C.noirCentre, { roughness: 0.2 })), false);
    noyau.position.y = 5;
    const anneau = ombrageur(new Mesh(geo(new TorusGeometry(26, 2.6, 10, 48)), mat(C.noirAnneau, { emissive: C.noirAnneau })), false);
    (anneau.material as MeshStandardMaterial).emissiveIntensity = 0.4;
    anneau.position.y = 11;
    anneau.rotation.set(Math.PI / 2 - 0.35, 0.2, 0);
    g.add(tourne, noyau, anneau);
    groupe.add(g);
    maj.push((_, sec) => {
      tourne.rotation.y = sec * 0.5;
      anneau.rotation.z = sec * 0.8;
    });
  }
  // les portails : trois anneaux qui battent, un fond sombre, la lettre
  for (const p of t.portails) {
    const g = new Group();
    g.position.set(X(px(p.x)), 0, Z(px(p.y)));
    const r = px(p.r);
    const anneaux = [0, 1, 2].map((k) => {
      const a = ombrageur(new Mesh(geo(new TorusGeometry(r + 5 + k * 5, 1.8, 8, 40)), mat(k % 2 ? C.portailB : C.portailA, { emissive: k % 2 ? C.portailB : C.portailA })), false);
      (a.material as MeshStandardMaterial).emissiveIntensity = 0.5;
      a.rotation.x = Math.PI / 2;
      a.position.y = 2.5;
      g.add(a);
      return a;
    });
    const lettre = toile(64, 64, (c) => {
      c.fillStyle = C.portailFond;
      c.beginPath();
      c.arc(32, 32, 32, 0, TAU);
      c.fill();
      c.fillStyle = PAPIER;
      c.font = `700 36px ${o.police}`;
      c.textAlign = "center";
      c.textBaseline = "middle";
      c.fillText(p.id === 0 ? "A" : "B", 32, 35);
    });
    g.add(disque(r, 1, lettre));
    groupe.add(g);
    maj.push((_, sec) => anneaux.forEach((a, k) => a.scale.setScalar(1 + Math.sin(sec * 4 + k) * 0.045)));
  }
  // le geyser : un cratère, de la lave qui rougit quand il est prêt, un jet de bulles qui monte quand il part
  t.geysers.forEach((z, i) => {
    const r = px(z.r);
    const g = new Group();
    g.position.set(X(px(z.x)), 0, Z(px(z.y)));
    const crat = cylindre(r, 8, C.geyser);
    crat.position.y = 4;
    crat.add(contour(crat.geometry));
    const lave = ombrageur(new Mesh(geo(new CircleGeometry(r - 7, 32)), mat(C.lave, { emissive: C.lave, unique: true })), false);
    lave.rotation.x = -Math.PI / 2;
    lave.position.y = 8.3;
    const jet = new Group();
    const bulles = [0, 1, 2, 3, 4, 5].map((k) => {
      const b = ombrageur(new Mesh(geo(new SphereGeometry(7 - k * 0.8, 12, 8)), mat(PAPIER)), false);
      jet.add(b);
      return b;
    });
    g.add(crat, lave, jet);
    groupe.add(g);
    maj.push((_, sec) => {
      const j = partie.geyserJet[i]! / JET_GEYSER;
      (lave.material as MeshStandardMaterial).emissiveIntensity = partie.geyserAttente[i]! > 0 ? 0.1 : 0.9;
      bulles.forEach((b, k) => {
        b.visible = j > 0;
        b.position.set(Math.sin(sec * 20 + k) * 6, 12 + k * 16 * (1 - j * 0.5), 0);
      });
    });
  });
  // la coulée : un couloir de lave dont les chevrons montent
  for (const z of t.coulees) {
    const tex = toile(128, 256, (c) => {
      c.fillStyle = C.lave;
      c.fillRect(0, 0, 128, 256);
      c.strokeStyle = C.chevron;
      c.lineWidth = 10;
      c.lineCap = "round";
      c.lineJoin = "round";
      for (let k = 0; k < 4; k++) {
        const y = 24 + k * 64;
        c.beginPath();
        c.moveTo(24, y + 28);
        c.lineTo(64, y);
        c.lineTo(104, y + 28);
        c.stroke();
      }
    });
    tex.wrapT = RepeatWrapping;
    const m = new MeshStandardMaterial({ map: tex, emissive: C.lave, emissiveIntensity: 0.35, roughness: 0.6 });
    aLiberer.push(m);
    const coul = plat(geo(new PlaneGeometry(px(z.l) * 2, px(z.h) * 2)), 0.7, m);
    coul.position.x = X(px(z.x));
    coul.position.z = Z(px(z.y));
    groupe.add(coul);
    maj.push((_, sec) => (tex.offset.y = -((sec * 0.8) % 1)));
  }
  // les lampes de la mission, autour de l'élément du thème : une allumée par pas de réussi
  const lampesM = lampesMission(t, o.theme, partie.but).map((l) => {
    const m = new MeshStandardMaterial({ color: PAPIER, emissive: MOUTARDE, emissiveIntensity: 0, roughness: 0.4 });
    aLiberer.push(m);
    const s = ombrageur(new Mesh(geo(new SphereGeometry(5.5, 16, 12)), m), false);
    s.position.set(X(l.x), 6, Z(l.y));
    groupe.add(s);
    return m;
  });
  // les flèches qui clignotent : celles des modules qui comptent pour la mission, tant qu'elle n'est pas réussie
  const forme = new Shape([new Vector2(13, 0), new Vector2(-7, -11), new Vector2(-3, 0), new Vector2(-7, 11)]);
  const flechesM = t.poses
    .filter((m) => comptePourLaMission(o.theme, m.type))
    .map((m) => {
      const f = flecheDe(m);
      const g = new Group();
      g.position.set(X(f.x), 0, Z(f.y));
      g.rotation.y = -f.a;
      const trait2 = new MeshBasicMaterial({ color: ENCRE, side: DoubleSide });
      const plein = new MeshBasicMaterial({ color: couleurModule(P, o.theme, m.type), side: DoubleSide });
      aLiberer.push(trait2, plein);
      const geoForme = geo(new ShapeGeometry(forme));
      geoForme.rotateX(Math.PI / 2);
      const dessous = new Mesh(geoForme, trait2);
      dessous.scale.setScalar(1.28);
      dessous.position.y = 0.95;
      dessous.renderOrder = 2;
      const dessus = new Mesh(geoForme, plein);
      dessus.position.y = 1.05;
      dessus.renderOrder = 3;
      g.add(dessous, dessus);
      g.visible = false;
      groupe.add(g);
      return g;
    });

  // --- Les lampes : les trois couloirs du haut et les multiplicateurs (allumées quand la partie les allume)
  const lueur = (): MeshStandardMaterial => mat(MOUTARDE, { emissive: MOUTARDE, unique: true });
  const lampesVoies = t.voies.map((v) => {
    const m = new Mesh(geo(new CylinderGeometry(6.5, 6.5, 1.5, 24)), lueur());
    (m.material as MeshStandardMaterial).emissiveIntensity = 1.2;
    m.position.set(X(px(v.x)), 1, Z(px(v.y) + 24));
    m.visible = false;
    groupe.add(m);
    return m;
  });
  const lampesMult: Mesh[] = [];
  for (let k = 2; k <= MULT_MAX; k++) {
    const m = new Mesh(geo(new BoxGeometry(22, 1.5, 16)), lueur());
    (m.material as MeshStandardMaterial).emissiveIntensity = 1.2;
    m.position.set(X(AXE + (k - 4) * 26), 1, Z(598));
    m.visible = false;
    groupe.add(m);
    lampesMult.push(m);
  }

  // --- Les batteurs : extrudés, avec leur contour ; leur cap suit l'angle de la partie
  const batteurs = [0, 1].map((i) => {
    const s = new Shape();
    s.moveTo(0, -9);
    s.lineTo(60, -5.5);
    s.absarc(60, 0, 5.5, -Math.PI / 2, Math.PI / 2, false);
    s.lineTo(0, 9);
    s.absarc(0, 0, 9, Math.PI / 2, Math.PI * 1.5, false);
    const g = geo(new ExtrudeGeometry(s, { depth: 14, bevelEnabled: true, bevelSize: 1, bevelThickness: 1, bevelSegments: 2 }));
    g.rotateX(Math.PI / 2);
    g.translate(0, 15, 0);
    const groupeB = new Group();
    const pivotX = i === 0 ? 112 : 2 * AXE - 112;
    groupeB.position.set(X(pivotX), 0, Z(640));
    groupeB.add(ombrageur(new Mesh(g, mat(P.sombre ? MOUTARDE : PAPIER))), contour(g, 40));
    const axe = cylindre(4, 17, P.bumper);
    axe.position.y = 8;
    groupeB.add(axe);
    groupe.add(groupeB);
    return groupeB;
  });

  // --- Le lanceur (le ressort et la tête) et la bille
  const ressort = ombrageur(new Mesh(geo(new BoxGeometry(17, 3, 1)), mat("#9AA1AC", { metalness: 0.5, roughness: 0.4 })), false);
  groupe.add(ressort);
  const tete = ombrageur(new Mesh(geo(new BoxGeometry(18, 14, 10)), mat("#9AA1AC", { metalness: 0.6, roughness: 0.3 })));
  groupe.add(tete);
  const bille = new Mesh(geo(new SphereGeometry(RAYON, 32, 24)), mat("#e6e9ee", { metalness: 1, roughness: 0.12, envMapIntensity: 1.2 }));
  bille.castShadow = true;
  groupe.add(bille);

  // --- Les étiquettes des modules : des plaques à part, tournées vers le joueur et grossies (voir `majEtiquettes`)
  const etiquettes: { plaque: Mesh; x: number; y: number; l: number }[] = [];
  for (const m of t.poses) {
    const n = o.nom(m.type);
    if (!n) continue;
    const texte = n.toLocaleUpperCase();
    const mesure = document.createElement("canvas").getContext("2d")!;
    mesure.font = `700 9px ${o.police}`;
    const l = Math.ceil(mesure.measureText(texte).width + 10) + 6;
    const echelle = 6;
    const tex = toile(l * echelle, 20 * echelle, (c) => {
      c.scale(echelle, echelle);
      pastille(c, o.police, l / 2, 10, texte);
    });
    const mat2 = new MeshBasicMaterial({ map: tex, transparent: true, depthWrite: false });
    aLiberer.push(mat2);
    const plaque = new Mesh(geo(new PlaneGeometry(l, 20)), mat2);
    plaque.renderOrder = 5;
    const p = placeDuNom(m);
    etiquettes.push({ plaque, x: p.x, y: p.y, l });
    groupe.add(plaque);
  }

  // --- Les contours de collision de `?debug`
  let debogage: { groupe: Group; batteurs: BufferGeometry; bille: Mesh } | null = null;
  const monterDebogage = (): void => {
    const g = new Group();
    const pts: number[] = [];
    for (const m of t.murs) pts.push(X(px(m.ax)), 20, Z(px(m.ay)), X(px(m.bx)), 20, Z(px(m.by)));
    const murs = geo(new BufferGeometry());
    murs.setAttribute("position", new Float32BufferAttribute(pts, 3));
    g.add(new LineSegments(murs, new LineBasicMaterial({ color: "#FF00AA", depthTest: false })));
    const cercle = (x: number, y: number, r: number, couleur: string): void => {
      const c: number[] = [];
      for (let k = 0; k < 24; k++) c.push(X(x + Math.cos((k / 24) * 2 * Math.PI) * r), 20, Z(y + Math.sin((k / 24) * 2 * Math.PI) * r), X(x + Math.cos(((k + 1) / 24) * 2 * Math.PI) * r), 20, Z(y + Math.sin(((k + 1) / 24) * 2 * Math.PI) * r));
      const gg = geo(new BufferGeometry());
      gg.setAttribute("position", new Float32BufferAttribute(c, 3));
      g.add(new LineSegments(gg, new LineBasicMaterial({ color: couleur, depthTest: false })));
    };
    for (const c of [...t.poteaux, ...t.bumpers]) cercle(px(c.x), px(c.y), px(c.r), "#00D0FF");
    for (const tr of t.trous) cercle(px(tr.x), px(tr.y), px(tr.r), "#00D0FF");
    const bat = geo(new BufferGeometry());
    bat.setAttribute("position", new Float32BufferAttribute(new Array(12).fill(0), 3));
    g.add(new LineSegments(bat, new LineBasicMaterial({ color: "#00FF66", depthTest: false })));
    const b = new Mesh(geo(new TorusGeometry(RAYON, 0.5, 4, 24)), new MeshBasicMaterial({ color: "#FFFF00", depthTest: false }));
    b.rotation.x = Math.PI / 2;
    g.add(b);
    groupe.add(g);
    debogage = { groupe: g, batteurs: bat, bille: b };
  };

  // --- La surcouche 2D (au-dessus du canvas WebGL) : « Bille sauvée ! », et pour `?debug` le compteur de pas et le score de chaque contact
  const surcouche = document.createElement("canvas");
  surcouche.className = "pinball-surcouche";
  Object.assign(surcouche.style, { position: "absolute", left: "50%", top: "50%", transform: "translate(-50%,-50%)", pointerEvents: "none" });
  canvas.after(surcouche);
  const sc = surcouche.getContext("2d")!;
  let surcoucheVide = true;

  // --- La caméra : elle cadre toute la table
  let L = 1;
  let H = 1;
  /** Les points du terrain de jeu qui doivent toujours être à l'image : les coins bas, les épaules de l'arc (y = 205) et son sommet (y = 29), les rails. */
  const CADRE: readonly (readonly [number, number, number])[] = [
    [-LARGEUR / 2 - 4, 0, Z(760) + 4], [LARGEUR / 2 + 4, 0, Z(760) + 4], [-LARGEUR / 2 - 4, 24, Z(760) + 4], [LARGEUR / 2 + 4, 24, Z(760) + 4],
    [-LARGEUR / 2 + 4, 24, Z(205)], [LARGEUR / 2 - 4, 24, Z(205)], [0, 24, Z(24)], [0, 0, Z(24)],
  ];
  const v3 = new Vector3();
  const extremes = (): { x: number; y0: number; y1: number } => {
    camera.updateMatrixWorld(true);
    let x = 0;
    let y0 = Infinity;
    let y1 = -Infinity;
    for (const [a, b, c] of CADRE) {
      v3.set(a, b, c).project(camera);
      x = Math.max(x, Math.abs(v3.x));
      y0 = Math.min(y0, v3.y);
      y1 = Math.max(y1, v3.y);
    }
    return { x, y0, y1 };
  };
  /** Où la caméra se tient et ce qu'elle vise : la secousse de la mission réussie s'en écarte un instant, puis y revient. */
  const base = new Vector3();
  const cible = new Vector3();
  let secouee = false;
  const cadrer = (): void => {
    const el = rad(vue.angle);
    camera.fov = vue.champ;
    camera.aspect = L / H;
    camera.updateProjectionMatrix();
    let d = 900;
    let tz = 0;
    const marge = 0.03;
    for (let it = 0; it < 40; it++) {
      camera.position.set(0, d * Math.sin(el), tz + d * Math.cos(el));
      camera.lookAt(0, 0, tz);
      const e = extremes();
      const demi = (e.y1 - e.y0) / 2;
      const s = Math.max(e.x / (1 - marge), demi / (1 - marge));
      d *= 1 + (s - 1) * 0.8;
      const centre = (e.y0 + e.y1) / 2;
      tz -= (centre * d * Math.tan(rad(vue.champ / 2))) / Math.sin(el);
    }
    d *= vue.distance / 100;
    camera.position.set(0, d * Math.sin(el), tz + d * Math.cos(el));
    camera.lookAt(0, 0, tz);
    camera.updateMatrixWorld(true);
    base.copy(camera.position);
    cible.set(0, 0, tz);
    majEtiquettes();
  };
  function majEtiquettes(): void {
    const k = vue.etiquettes / 100;
    const el = rad(vue.angle);
    const reference = camera.position.distanceTo(v3.set(0, 0, 0));
    const lean = (Math.PI / 2 - el) * 0.75; // la plaque se penche vers le joueur sans se dresser tout à fait
    for (const e of etiquettes) {
      // la perspective rapetisse ce qui est loin : une plaque grossit avec sa distance, pour que le haut de la table se lise comme le bas
      const dist = camera.position.distanceTo(v3.set(X(e.x), 0, Z(e.y)));
      const echelle = k * (dist / reference);
      e.plaque.scale.set(echelle, echelle / Math.max(0.5, Math.cos(Math.PI / 2 - el - lean)) * 0.95, 1);
      e.plaque.rotation.x = -Math.PI / 2 + lean;
      e.plaque.position.set(X(e.x), 1 + Math.sin(lean) * 10 * echelle, Z(e.y));
    }
  }

  // --- Une image
  const ecranDe = (x: number, y: number): { x: number; y: number } => {
    v3.set(X(x), 0, Z(y)).project(camera);
    return { x: ((v3.x + 1) / 2) * L, y: ((1 - v3.y) / 2) * H };
  };
  let dernier = performance.now();
  let fpsMoy = 60;
  let msMoy = 0;
  let msImage = 0;

  function dessiner(s: Surimpression): void {
    const debut = performance.now();
    const dt = Math.min(0.05, (debut - dernier) / 1000);
    dernier = debut;
    const a = s.alpha;
    // les batteurs : le cap interpolé entre deux pas (à gauche l'angle de la partie, à droite son image)
    for (const i of [0, 1] as const) {
      const ang = ((partie.aAvant[i]! + (partie.a[i]! - partie.aAvant[i]!) * a) * 2 * Math.PI) / TOUR;
      batteurs[i]!.rotation.y = i === 0 ? -ang : -(Math.PI - ang);
    }
    // la bille
    const cache = partie.finie || partie.captif > 0;
    bille.visible = !cache;
    const bx = px(partie.px) + (px(partie.x) - px(partie.px)) * a;
    const by = px(partie.py) + (px(partie.y) - px(partie.py)) * a;
    bille.position.set(X(bx), RAYON, Z(by));
    // le lanceur : le ressort se comprime avec la charge
    const haut = 709 + (partie.charge * 22) / 1000;
    const long = Math.max(1, 718 - haut);
    ressort.scale.z = long;
    ressort.position.set(X(360.5), 3, Z((haut + 718) / 2));
    tete.position.set(X(360.5), 7, Z(haut - 5));
    // les éléments des thèmes, la mission : tout est fonction du pas ; l'astéroïde se déplace (son bumper suit la table)
    const sec = (s.tick + a) / TICKS_PAR_SECONDE;
    for (const f of maj) f(s.tick, sec, dt);
    lampesM.forEach((m, i) => (m.emissiveIntensity = i < partie.compteur ? 1.4 : 0));
    const clignotante = !partie.missionFaite && clignote(s.tick);
    for (const f of flechesM) f.visible = clignotante;
    // les bumpers : ils s'enfoncent, s'allument et leurs yeux suivent la bille
    t.bumpers.forEach((b, i) => {
      const d = bumpers[i]!;
      if (b.mobile) {
        d.x = px(b.x);
        d.g.position.x = X(d.x);
      }
      const e = partie.choc[i]! / 40;
      d.haut.scale.set(1 + e * 0.12, 1 - e * 0.28, 1 + e * 0.12);
      (d.corps.material as MeshStandardMaterial).emissiveIntensity = e * 1.4;
      const dx = bx - d.x;
      const dy = by - d.y;
      const n = Math.hypot(dx, dy) || 1;
      d.pupilles.forEach((p, k) => {
        p.position.x = (k ? 1 : -1) * d.r * 0.28 + (dx / n) * d.r * 0.08;
        p.position.z = d.r * 0.12 + (dy / n) * d.r * 0.08;
      });
    });
    caoutchoucs.forEach((m, k) => ((m.material as MeshStandardMaterial).emissiveIntensity = Math.min(1, partie.chocSling[k]! / 40) * 1.2));
    for (const c of cibles) {
      const bas = partie.bas[c.i]!;
      c.m.position.y += ((bas ? -9 : 9) - c.m.position.y) * Math.min(1, dt * 18);
      c.trace.visible = bas;
    }
    roues.forEach((r, i) => {
      r.angle += (partie.spin[i]! / 1000) * dt * 60 * 0.016;
      r.plaque.rotation.x = r.angle;
    });
    lampesVoies.forEach((m, i) => (m.visible = !!partie.voiesAllumees[i]));
    lampesMult.forEach((m, i) => (m.visible = partie.mult >= i + 2));
    if (s.debug) {
      if (!debogage) monterDebogage();
      for (const i of [0, 1] as const) {
        const ang = (partie.a[i]! * 2 * Math.PI) / TOUR;
        const sens = i === 0 ? 1 : -1;
        const px0 = i === 0 ? 112 : 2 * AXE - 112;
        const attr = debogage!.batteurs.getAttribute("position");
        const p = [X(px0), 20, Z(640), X(px0 + sens * Math.cos(ang) * 60), 20, Z(640 + Math.sin(ang) * 60)];
        for (let k = 0; k < 6; k++) attr.array[i * 6 + k] = p[k]!;
        attr.needsUpdate = true;
      }
      debogage!.bille.position.set(X(bx), 20, Z(by));
    }
    if (debogage) debogage.groupe.visible = s.debug;

    // la mission réussie : une brève secousse de la caméra, qui s'éteint avec l'éclat (jamais si le joueur préfère moins de mouvement)
    if (s.eclat > 0.35 && !o.reduit) {
      const e = (s.eclat - 0.35) / 0.65;
      camera.position.set(base.x + Math.sin(s.tick * 0.9) * 3 * e * e, base.y + Math.cos(s.tick * 1.3) * 2 * e * e, base.z);
      camera.lookAt(cible);
      camera.updateMatrixWorld(true);
      secouee = true;
    } else if (secouee) {
      camera.position.copy(base);
      camera.lookAt(cible);
      camera.updateMatrixWorld(true);
      secouee = false;
    }
    renderer.info.reset();
    renderer.render(scene, camera);
    msImage += (performance.now() - debut - msImage) * 0.05;

    // la surcouche : « Bille sauvée ! », et pour `?debug` le compteur de pas et les gains
    const dessus = s.sauvee > 0 || s.eclat > 0 || s.debug || o.fps;
    if (dessus || !surcoucheVide) {
      const dpr = Math.min(2, devicePixelRatio || 1);
      sc.setTransform(dpr, 0, 0, dpr, 0, 0);
      sc.clearRect(0, 0, L, H);
      surcoucheVide = !dessus;
      if (s.eclat > 0) {
        // l'éclat doré de la mission réussie, sur tout l'écran
        sc.fillStyle = `rgba(232,178,58,${s.eclat * 0.38})`;
        sc.fillRect(0, 0, L, H);
      }
      if (s.sauvee > 0) {
        const c = ecranDe(AXE, 520);
        sc.globalAlpha = Math.min(1, s.sauvee * 2);
        pastille(sc, o.police, c.x, c.y - (1 - s.sauvee) * 20, s.texteSauvee.toLocaleUpperCase(), (L / LARGEUR) * 1.6 * (vue.etiquettes / 170));
        sc.globalAlpha = 1;
      }
      if (s.debug) {
        sc.font = `700 11px ${o.police}`;
        sc.textAlign = "left";
        sc.fillStyle = "#FFFF00";
        sc.fillText(`pas ${s.tick}`, 8, 14);
        sc.textAlign = "center";
        for (const g of s.gains) {
          const c = ecranDe(px(g.x), px(g.y));
          sc.globalAlpha = g.vie;
          sc.fillStyle = "#FFFFFF";
          sc.fillText(`+${g.points}`, c.x, c.y - 14 - (1 - g.vie) * 18);
        }
        sc.globalAlpha = 1;
      }
      if (o.fps) {
        fpsMoy += (1 / Math.max(dt, 0.001) - fpsMoy) * 0.05;
        msMoy += (performance.now() - debut - msMoy) * 0.05;
        sc.font = `700 11px ${o.police}`;
        sc.textAlign = "left";
        sc.fillStyle = "#00FF66";
        sc.fillText(`${fpsMoy.toFixed(0)} i/s · ${msMoy.toFixed(1)} ms · ${renderer.info.render.calls} appels · ${renderer.info.render.triangles} triangles`, 8, s.debug ? 28 : 14);
      }
    }
  }

  function redimensionner(l: number, h: number): void {
    L = Math.max(1, Math.floor(l));
    H = Math.max(1, Math.floor(h));
    renderer.setPixelRatio(Math.min(devicePixelRatio || 1, o.tactile ? 1.5 : 2));
    renderer.setSize(L, H);
    const dpr = Math.min(2, devicePixelRatio || 1);
    surcouche.width = Math.floor(L * dpr);
    surcouche.height = Math.floor(H * dpr);
    surcouche.style.width = `${L}px`;
    surcouche.style.height = `${H}px`;
    surcoucheVide = false;
    cadrer();
  }

  return {
    redimensionner,
    dessiner,
    regler(v: Vue): void {
      vue = { ...v };
      lumiere();
      cadrer();
    },
    info: () => ({ appels: renderer.info.render.calls, triangles: renderer.info.render.triangles, ms: msImage, cadre: extremes() }),
    detruire(): void {
      canvas.removeEventListener("webglcontextlost", surPerte);
      surcouche.remove();
      scene.traverse((n) => {
        const m = (n as Mesh).material as Material | Material[] | undefined;
        if (Array.isArray(m)) m.forEach((x) => x.dispose());
        else m?.dispose();
      });
      for (const x of aLiberer) x.dispose();
      (scene.environment as Texture | null)?.dispose();
      renderer.dispose();
      renderer.forceContextLoss();
    },
  };
}
