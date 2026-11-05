import { ConeGeometry, CylinderGeometry, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, Shape, SphereGeometry, Vector3, type BufferGeometry, type MeshToonMaterial } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ANNONCE, ANNONCE_PLONGEON, CHAUVE, COUP, ESQUIVE, MARCHE, ONDE, PIERRES, PLONGEON, POING, RECUPERE, REPOS, RUGIT, type Chevalier, type Durees, type Golem, type Monstre } from "@cdj/rush-sim";
import { aplat, piece, type Piece } from "./cel";
import { colorier, colorierParFace, fusionner, placer, roche, teindre } from "./formes";
import { BLANC, COULEURS, ENCRE } from "./palette";

// Les personnages de Rush : des formes simples (sphères, cônes, boîtes arrondies ; le golem, des rochers anguleux), un contour d'encre relatif à leur taille, de petits yeux. **Tout est procédural** : chaque image, `animer*`
// pose le corps selon l'état de la simulation (balancement, écrasement, rotation), sans animation enregistrée. Les repères : le personnage regarde vers +Z, l'unité est le mètre, les pieds sont à y = 0.
// Lot BR0b : les pièces qui bougent ensemble sont FUSIONNÉES (une forme, un contour : deux appels de dessin au lieu de dix) et les deux yeux d'un personnage sont un seul maillage.

const sph = (r: number, l = 18, h = 12): SphereGeometry => new SphereGeometry(r, l, h);
const bornes = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const sortie = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);

// --- Les formes (construites une fois, partagées) ---------------------------------------------------------------------------------------------------------------------------------------------------
/** Une sphère non indexée dont les faces tournées vers le haut-gauche-devant sont plus claires : le reflet d'une gelée, en aplat net. */
function geleeColoree(): BufferGeometry {
  const lumiere = new Vector3(-0.45, 0.8, 0.4).normalize();
  return colorierParFace(sph(0.5, 14, 9).toNonIndexed(), (_c, n) => (n.dot(lumiere) > 0.8 ? COULEURS.geleeClair : COULEURS.gelee));
}

/** Une aile de chauve-souris : une membrane à trois doigts et au bord arrière festonné, couchée à plat (plan x, z), qui part de l'épaule vers +x (`cote` 1) ou −x (−1). */
function aileMembrane(cote: 1 | -1): BufferGeometry {
  const pts: [number, number][] = [[0.04, 0.16], [0.5, 0.3], [1.0, 0.06], [0.8, -0.08], [0.86, -0.3], [0.6, -0.17], [0.6, -0.44], [0.34, -0.2], [0.04, -0.22]];
  const e = 0.62;
  const f = new Shape();
  pts.forEach(([x, y], i) => (i === 0 ? f.moveTo(x * e * cote, y * e) : f.lineTo(x * e * cote, y * e)));
  f.closePath();
  const g = new ExtrudeGeometry(f, { depth: 0.04, bevelEnabled: false });
  g.rotateX(Math.PI / 2); // la forme se couche : y → z (vers l'avant), l'épaisseur vers le bas
  return g;
}

const GEO = {
  corps: sph(0.45, 22, 16),
  tete: sph(0.4, 22, 16),
  pied: sph(0.15, 12, 8),
  plume: new ConeGeometry(0.12, 0.5, 10),
  bouclier: new CylinderGeometry(0.3, 0.3, 0.08, 18),
  geleeC: geleeColoree(),
  chauve: fusionner([teindre(sph(0.28, 12, 8), COULEURS.chauve), ...[-1, 1].map((s) => teindre(placer(new ConeGeometry(0.08, 0.2, 5), { x: s * 0.14, y: 0.3, z: -0.02, rz: -s * 0.25 }), COULEURS.chauve))]),
  aileG: aileMembrane(-1),
  aileD: aileMembrane(1),
  coeur: sph(0.3, 14, 10),
  oeilBlanc: sph(1, 8, 5),
};

/** L'épée du chevalier : la main, la lame et la garde en une seule forme (deux couleurs par sommet). Le groupe pivote autour de la main. */
function epeeFusionnee(): BufferGeometry {
  return fusionner([
    teindre(sph(0.13, 12, 8), COULEURS.armure),
    teindre(placer(new RoundedBoxGeometry(0.12, 0.07, 1.0, 2, 0.03), { z: 0.62 }), COULEURS.acier),
    teindre(placer(new RoundedBoxGeometry(0.36, 0.08, 0.1, 2, 0.03), { z: 0.1 }), COULEURS.armure),
  ]);
}
const EPEE = epeeFusionnee();

// --- Les yeux --------------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
/** Les deux yeux d'un personnage : un blanc et une pupille chacun, fusionnés en UN maillage (aplat sans lumière, couleurs par sommet). `fermer` les ferme (clignement), `teinte` colore les blancs (rouge à l'annonce). */
export interface Yeux {
  mesh: Mesh;
  fermer(f: number): void;
  teinte(c: number): void;
}
const matiereYeux = new MeshBasicMaterial({ vertexColors: true });
function yeux(ecart: number, y: number, z: number, r: number, pupille = 0.55): Yeux {
  const formes: BufferGeometry[] = [];
  for (const s of [-1, 1]) {
    formes.push(teindre(placer(sph(1, 10, 7), { x: s * ecart, s: r }), BLANC));
    formes.push(teindre(placer(sph(1, 8, 6), { x: s * ecart, y: -r * 0.1, z: r * 0.62, s: r * pupille }), ENCRE));
  }
  const mesh = new Mesh(fusionner(formes), matiereYeux.clone());
  mesh.position.set(0, y, z);
  return {
    mesh,
    fermer: (f) => (mesh.scale.y = 1 - f * 0.9),
    teinte: (c) => (mesh.material as MeshBasicMaterial).color.set(c),
  };
}

/** Un clignement : 0 (ouvert) à 1 (fermé), toutes les ~3 s, décalé par `graine`. */
function clignement(temps: number, graine: number): number {
  const t = (temps + graine * 1.7) % 3.1;
  return t < 0.12 ? Math.sin((t / 0.12) * Math.PI) : 0;
}

export interface Acteur {
  racine: Group;
  matieres: MeshToonMaterial[];
}

function ajouter(parent: Group, p: Piece, x = 0, y = 0, z = 0): Piece {
  p.groupe.position.set(x, y, z);
  parent.add(p.groupe);
  return p;
}

// --- Le chevalier ------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface ChevalierVu extends Acteur {
  pivot: Group;
  interieur: Group;
  epee: Group;
  plume: Group;
  pieds: [Group, Group];
  yeux: Yeux;
  phase: number;
}

export function creerChevalier(): ChevalierVu {
  const racine = new Group();
  const pivot = new Group();
  pivot.position.y = 0.6;
  const interieur = new Group();
  interieur.position.y = -0.6;
  pivot.add(interieur);
  racine.add(pivot);
  const matieres: MeshToonMaterial[] = [];
  const noter = (p: Piece): Piece => {
    matieres.push(p.matiere);
    return p;
  };
  const corps = ajouter(interieur, noter(piece(GEO.corps, COULEURS.armure)), 0, 0.55, 0);
  corps.groupe.scale.set(1, 1.05, 0.92);
  ajouter(interieur, noter(piece(GEO.tete, COULEURS.acier)), 0, 1.12, 0);
  const o = yeux(0.14, 1.17, 0.33, 0.075);
  interieur.add(o.mesh);
  const plume = new Group();
  plume.position.set(0, 1.5, -0.1);
  const cone = noter(piece(GEO.plume, COULEURS.plume));
  cone.groupe.position.y = 0.25;
  plume.add(cone.groupe);
  interieur.add(plume);
  // L'épée, tenue à droite : le groupe pivote autour de la main.
  const epee = new Group();
  epee.position.set(0.55, 0.62, 0.1);
  ajouter(epee, noter(piece(EPEE, 0xffffff, true, true)), 0, 0, 0);
  interieur.add(epee);
  const bouclier = ajouter(interieur, noter(piece(GEO.bouclier, COULEURS.armure)), -0.55, 0.62, 0.1);
  bouclier.groupe.rotation.z = Math.PI / 2;
  const pg = new Group();
  const pd = new Group();
  for (const [g, s] of [[pg, -1], [pd, 1]] as const) {
    g.position.set(s * 0.2, 0.12, 0);
    const p = noter(piece(GEO.pied, COULEURS.plume));
    p.groupe.scale.set(1, 0.75, 1.35);
    g.add(p.groupe);
    interieur.add(g);
  }
  return { racine, matieres, pivot, interieur, epee, plume, pieds: [pg, pd], yeux: o, phase: 0 };
}

export interface EntreeChevalier {
  dt: number;
  temps: number;
  duree: number;
  /** Le tick de l'impact dans le coup. */
  impact: number;
  /** Vrai si le rendu doit le cacher cette image (clignement après un dégât). */
  cache: boolean;
}

export function animerChevalier(a: ChevalierVu, c: Chevalier, e: EntreeChevalier): void {
  a.racine.visible = !e.cache;
  const marche = c.marche && c.etat !== ESQUIVE;
  if (marche) a.phase += e.dt * 13;
  const p = a.phase;
  let rouleau = 0;
  let saut = 0;
  let ecrase = 1;
  let penche = marche ? 0.14 : 0;
  // Au repos : la respiration. En marche : le rebond.
  let hauteur = marche ? Math.abs(Math.sin(p)) * 0.09 : 0;
  ecrase = marche ? 1 - Math.abs(Math.sin(p)) * 0.04 : 1 + Math.sin(e.temps * 3.2) * 0.02;
  let ey = 0;
  let ex = -0.9;
  let torsion = 0;
  if (c.etat === COUP) {
    const t = c.t / e.duree;
    const impactP = e.impact / e.duree;
    const frappe = bornes((t - (impactP - 0.12)) / 0.24, 0, 1);
    const pre = bornes(t / (impactP - 0.12), 0, 1);
    const sens = c.combo === 1 ? -1 : 1;
    if (c.combo === 2) {
      // le grand coup : l'épée monte derrière la tête puis s'abat
      ex = frappe === 0 ? -2.7 * pre : lerp(-2.7, 0.7, sortie(frappe));
      penche = 0.1 + 0.5 * sortie(frappe);
      saut = 0.18 * Math.sin(Math.PI * bornes(t / 0.8, 0, 1));
      ecrase = 1 - 0.1 * sortie(frappe);
    } else {
      // le coup balayé : de droite à gauche, puis de gauche à droite
      ex = -0.12;
      ey = frappe === 0 ? sens * 1.9 * pre : lerp(sens * 1.9, -sens * 1.9, sortie(frappe));
      penche = 0.1 + 0.3 * sortie(frappe);
      torsion = t < 0.8 ? lerp(0, -sens * 0.45, sortie(frappe)) : 0;
    }
  }
  a.interieur.rotation.y = torsion;
  if (c.etat === ESQUIVE) {
    const t = bornes(c.t / 12, 0, 1);
    rouleau = t * Math.PI * 2;
    saut = Math.sin(Math.PI * t) * 0.3;
    ecrase = 1 - Math.sin(Math.PI * t) * 0.18;
  }
  a.pivot.rotation.x = rouleau + penche;
  a.pivot.position.y = 0.6 + hauteur + saut;
  a.pivot.scale.set(1 / Math.sqrt(ecrase), ecrase, 1 / Math.sqrt(ecrase));
  a.epee.rotation.set(ex, ey, 0);
  a.plume.rotation.x = -0.55 + Math.sin(e.temps * 6 + (marche ? 1.5 : 0)) * (marche ? 0.25 : 0.08) - penche * 0.6;
  const balancement = marche ? Math.sin(p) * 0.22 : 0;
  a.pieds[0].position.z = balancement;
  a.pieds[1].position.z = -balancement;
  a.pieds[0].position.y = 0.12 + (marche ? Math.max(0, Math.sin(p)) * 0.1 : 0);
  a.pieds[1].position.y = 0.12 + (marche ? Math.max(0, -Math.sin(p)) * 0.1 : 0);
  a.yeux.fermer(clignement(e.temps, 0));
}

// --- La gelée ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface BeteVue extends Acteur {
  corps: Group;
  yeux: Yeux;
  ailes?: [Group, Group];
  aleatoire: number;
  /** Le tick de la dernière image où la bête a servi (pour la rendre à la réserve). */
  vu: number;
}

export function creerGelee(): BeteVue {
  const racine = new Group();
  const corps = new Group();
  racine.add(corps);
  const b = piece(GEO.geleeC, 0xffffff, true, true);
  b.groupe.position.y = 0.48;
  b.groupe.scale.set(1.15, 0.97, 1.15);
  corps.add(b.groupe);
  const o = yeux(0.2, 0.55, 0.48, 0.1);
  corps.add(o.mesh);
  return { racine, matieres: [b.matiere], corps, yeux: o, aleatoire: 0, vu: 0 };
}

/** La gelée : elle s'écrase (annonce, `geleeAnnonce` ticks, en tremblant à la fin), bondit (`geleeBond`), se repose. Les durées sont celles de la partie (le rythme les change). */
export function animerGelee(a: BeteVue, m: Monstre, temps: number, tick: number, d: Durees): void {
  const t = m.t;
  const A = d.geleeAnnonce;
  const B = d.geleeBond;
  let sy = 1;
  let y = 0;
  let tremble = 0;
  if (m.gel > 0) {
    sy = 1 + Math.sin(temps * 30) * 0.08;
  } else if (t < A) {
    const u = t / A;
    sy = 1 - 0.3 * Math.sin(Math.min(1, u * 1.25) * Math.PI * 0.5);
    if (u > 0.7) tremble = Math.sin(temps * 80) * 0.035;
  } else if (t < A + B) {
    const u = (t - A) / B;
    y = Math.sin(Math.PI * u) * 0.95;
    sy = 0.72 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.3));
  } else {
    const u = (t - A - B) / Math.max(1, d.geleeCycle - A - B);
    sy = 1 - 0.3 * Math.exp(-u * 4) * Math.cos(u * 14);
  }
  const apparition = bornes((tick - m.age) / 18, 0, 1);
  const pop = apparition < 1 ? sortie(apparition) * (1 + 0.25 * Math.sin(apparition * Math.PI)) : 1;
  a.corps.scale.set(pop / Math.sqrt(sy), pop * sy, pop / Math.sqrt(sy));
  a.corps.position.set(tremble, y, 0);
  a.yeux.fermer(clignement(temps, a.aleatoire));
}

// --- La chauve-souris ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function creerChauve(): BeteVue {
  const racine = new Group();
  const corps = new Group();
  racine.add(corps);
  const b = piece(GEO.chauve, 0xffffff, true, true);
  corps.add(b.groupe);
  const matieres = [b.matiere];
  // Les ailes : de vraies membranes (trois doigts, bord festonné) qui battent autour de l'épaule.
  const ailes: Group[] = [];
  for (const s of [-1, 1]) {
    const pivot = new Group();
    pivot.position.set(s * 0.2, 0.05, 0);
    const w = piece(s === 1 ? GEO.aileD : GEO.aileG, COULEURS.chauveClair);
    pivot.add(w.groupe);
    matieres.push(w.matiere);
    corps.add(pivot);
    ailes.push(pivot);
  }
  const o = yeux(0.1, 0.06, 0.22, 0.062);
  corps.add(o.mesh);
  return { racine, matieres, corps, yeux: o, ailes: [ailes[0]!, ailes[1]!], aleatoire: 0, vu: 0 };
}

export function animerChauve(a: BeteVue, m: Monstre, temps: number, tick: number, d: Durees): void {
  const bat = temps * (m.etat === PLONGEON ? 6 : 17) + a.aleatoire * 5;
  let volet = Math.sin(bat) * 0.85;
  let tangage = 0;
  let hauteur = 1.25 + Math.sin(temps * 3 + a.aleatoire) * 0.1;
  let echelle = 1.25; // un peu plus grande que le corps de sa simulation : les ailes comptent
  let tremble = 0;
  if (m.etat === ANNONCE_PLONGEON) {
    tremble = Math.sin(temps * 70) * 0.05;
    echelle = 1.25 * (1 + 0.18 * Math.min(1, m.t / (d.chauveAnnonce * 0.4)));
    volet = Math.sin(bat * 1.5) * 1.1;
    hauteur += 0.18;
  } else if (m.etat === PLONGEON) {
    volet = 1.25;
    tangage = 0.6;
    hauteur = 1.25 - 0.55 * Math.sin(Math.PI * Math.min(1, m.t / d.chauvePlongeon));
  } else if (m.etat === REPOS) {
    volet = Math.sin(temps * 9) * 0.5;
    tangage = Math.sin(temps * 6) * 0.25;
    hauteur -= 0.25;
  }
  a.corps.position.set(tremble, hauteur, 0);
  a.corps.rotation.x = tangage;
  a.corps.scale.setScalar(echelle);
  a.ailes![0].rotation.z = volet;
  a.ailes![1].rotation.z = -volet;
  const apparition = bornes((tick - m.age) / 14, 0, 1);
  a.racine.scale.setScalar(sortie(apparition));
  a.yeux.teinte(m.etat === ANNONCE_PLONGEON ? COULEURS.danger : 0xffffff);
  a.yeux.fermer(m.etat === ANNONCE_PLONGEON ? 0 : clignement(temps, a.aleatoire));
}

/** La hauteur du corps d'une chauve-souris (pour poser son ombre sous elle). */
export const hauteurChauve = (m: Monstre): number => (m.type === CHAUVE ? 1.0 : 0);

// --- Le golem ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface GolemVu extends Acteur {
  corps: Group;
  bras: [Group, Group];
  tete: Group;
  coeur: Mesh;
  yeux: Mesh[];
  jambes: [Group, Group];
  phase: number;
  humeur: number;
}

/** Les tons de la pierre du golem (les faces d'un même rocher en changent : une pierre peinte) et sa mousse. */
const PIERRE = [COULEURS.golem, 0x916542, 0xb5885f, 0x8a5f3f];
const PIERRE_SOMBRE = [COULEURS.golemSombre, 0x593c26, 0x7d5738];
const PIERRE_CLAIRE = [0xb5885f, 0xc49a6c, 0xa97d55];
const MOUSSE = [COULEURS.golemMousse, 0x6f8a4e, 0x8aa866];

/** Le corps du golem : un bassin, un torse, deux GROSSES épaules écartées et un dos voûté en un seul tas de rochers anguleux (un appel de dessin, un contour). Il est TRAPU : large, bas, voûté, comme la cible. */
function corpsDuGolem(): BufferGeometry {
  return fusionner([
    colorier(placer(roche(1.0, 11, { bruit: 0.3, etire: [1.25, 0.75, 0.95] }), { y: 1.05 }), PIERRE_SOMBRE, 11),
    colorier(placer(roche(1.3, 12, { bruit: 0.3, etire: [1.1, 0.9, 0.9] }), { y: 2.35, z: 0.05 }), PIERRE, 12),
    colorier(placer(roche(1.0, 13, { bruit: 0.3 }), { x: -1.75, y: 3.1, z: 0.1 }), PIERRE, 13),
    colorier(placer(roche(1.0, 14, { bruit: 0.3 }), { x: 1.75, y: 3.1, z: 0.1 }), PIERRE_SOMBRE, 14),
    colorier(placer(roche(0.95, 15, { bruit: 0.3, etire: [1.3, 0.9, 0.9] }), { y: 3.2, z: -0.9 }), PIERRE, 15),
    colorier(placer(roche(0.5, 16, { detail: 0, bruit: 0.3 }), { x: -1.75, y: 4.0, z: 0.05 }), MOUSSE, 16),
    colorier(placer(roche(0.45, 17, { detail: 0, bruit: 0.3 }), { x: 0.5, y: 4.05, z: -0.95 }), MOUSSE, 17),
    colorier(placer(roche(0.4, 18, { detail: 0, bruit: 0.3 }), { x: 1.85, y: 3.95, z: -0.1 }), MOUSSE, 18),
  ]);
}

/** La tête : un rocher clair, bas entre les épaules, une mâchoire, deux arcades froncées (les extrémités intérieures plus bas : la colère). */
function teteDuGolem(): BufferGeometry {
  const arcade = (s: 1 | -1, graine: number): BufferGeometry => colorier(placer(roche(0.38, graine, { detail: 0, bruit: 0.2, etire: [1.8, 0.55, 0.8] }), { x: s * 0.36, y: 0.3, z: 0.64, rz: s * 0.5 }), PIERRE_SOMBRE, graine);
  return fusionner([
    colorier(placer(roche(0.86, 21, { bruit: 0.22, etire: [1.15, 0.9, 1.0] }), {}), PIERRE_CLAIRE, 21),
    colorier(placer(roche(0.5, 22, { detail: 0, bruit: 0.25, etire: [1.2, 0.8, 1] }), { y: -0.5, z: 0.32 }), PIERRE, 22),
    arcade(-1, 23),
    arcade(1, 24),
    colorier(placer(roche(0.32, 25, { detail: 0, bruit: 0.3 }), { x: 0.1, y: 0.84, z: -0.1 }), MOUSSE, 25),
  ]);
}

/** Un bras : l'avant-bras et un poing ÉNORME, en un seul bloc qui pend sous son pivot (−y), l'épaule étant dans le corps. */
function brasDuGolem(cote: 1 | -1): BufferGeometry {
  const g = cote === 1 ? 31 : 41;
  return fusionner([
    colorier(placer(roche(0.62, g, { bruit: 0.28, etire: [1, 1.5, 1] }), { y: -0.95, z: 0.1 }), PIERRE, g),
    colorier(placer(roche(1.2, g + 1, { bruit: 0.3, etire: [1.05, 0.95, 1.05] }), { y: -2.45, z: 0.4 }), PIERRE_SOMBRE, g + 1),
    colorier(placer(roche(0.5, g + 2, { detail: 0, bruit: 0.3 }), { x: cote * 0.3, y: -2.85, z: 1.05 }), PIERRE_CLAIRE, g + 2),
    colorier(placer(roche(0.44, g + 3, { detail: 0, bruit: 0.3 }), { x: -cote * 0.35, y: -2.1, z: 1.2 }), PIERRE_CLAIRE, g + 3),
  ]);
}

const JAMBE = (g: number): BufferGeometry => colorier(roche(0.8, g, { bruit: 0.28, etire: [1, 0.9, 1.15] }), PIERRE_SOMBRE, g);

export function creerGolem(): GolemVu {
  const racine = new Group();
  const corps = new Group();
  racine.add(corps);
  const matieres: MeshToonMaterial[] = [];
  const noter = (p: Piece): Piece => {
    matieres.push(p.matiere);
    return p;
  };
  ajouter(corps, noter(piece(corpsDuGolem(), 0xffffff, true, true)), 0, 0, 0);
  const tete = new Group();
  tete.position.set(0, 3.85, 0.9);
  ajouter(tete, noter(piece(teteDuGolem(), 0xffffff, true, true)), 0, 0, 0);
  // Les yeux : des fentes AMBRE lumineuses sous les arcades (aplats sans lumière, un peu penchés).
  const yeuxG: Mesh[] = [];
  for (const s of [-1, 1]) {
    const y = aplat(GEO.oeilBlanc, COULEURS.lueur);
    y.scale.set(0.3, 0.17, 0.1);
    y.position.set(s * 0.37, 0.02, 0.86);
    y.rotation.z = s * 0.35;
    tete.add(y);
    yeuxG.push(y);
  }
  corps.add(tete);
  const coeur = aplat(GEO.coeur, COULEURS.lueur);
  coeur.position.set(0, 3.0, 1.2);
  coeur.visible = false; // les yeux seuls brillent : un cœur au torse les ferait confondre
  corps.add(coeur);
  const bras: Group[] = [];
  for (const s of [-1, 1] as const) {
    const epaule = new Group();
    epaule.position.set(s * 1.95, 3.1, 0);
    ajouter(epaule, noter(piece(brasDuGolem(s), 0xffffff, true, true)), 0, 0, 0);
    corps.add(epaule);
    bras.push(epaule);
  }
  const jambes: Group[] = [];
  for (const s of [-1, 1]) {
    const j = new Group();
    j.position.set(s * 0.95, 0.85, 0);
    const p = noter(piece(JAMBE(s === 1 ? 51 : 52), 0xffffff, true, true));
    j.add(p.groupe);
    racine.add(j);
    jambes.push(j);
  }
  return { racine, matieres, corps, bras: [bras[0]!, bras[1]!], tete, coeur, yeux: yeuxG, jambes: [jambes[0]!, jambes[1]!], phase: 0, humeur: 0 };
}

export interface EntreeGolem {
  dt: number;
  temps: number;
  /** Les ticks dans l'état, interpolés. */
  t: number;
  vivant: boolean;
  /** Les ticks écoulés depuis la mort du golem, 0 s'il vit. */
  mort: number;
  marche: boolean;
}

export function animerGolem(a: GolemVu, g: Golem, e: EntreeGolem): void {
  if (e.marche) a.phase += e.dt * 4.2;
  const p = a.phase;
  let levG = 0; // l'élévation du bras gauche (rotation.x, négatif = vers le haut)
  let levD = 0;
  let penche = 0;
  let tetePenche = 0;
  let ecrase = 1;
  let tremble = 0;
  let lueur = 0.9 + Math.sin(e.temps * 4) * 0.1;
  if (g.etat === MARCHE) {
    penche = 0.2; // voûté : il avance penché en avant
    levG = Math.sin(p) * 0.3;
    levD = -Math.sin(p) * 0.3;
    ecrase = 1 + Math.abs(Math.sin(p)) * 0.025;
  } else if (g.etat === ANNONCE) {
    const t = e.t;
    const A = g.t1; // le premier impact ; `g.duree` : la fin de l'annonce (deux coups en phase 2)
    const D = g.duree;
    const frappe = (debut: number, fin: number): number => bornes((t - debut) / Math.max(1, fin - debut), 0, 1);
    if (g.attaque === POING) {
      // le bras droit se lève pendant l'annonce, puis s'abat à l'impact ; en phase 2 un second coup suit, annoncé de la même façon
      const monte = frappe(0, A - 4);
      const abat = frappe(A - 4, A + 2);
      levD = -2.9 * sortie(monte) * (1 - abat) + 0.5 * abat;
      penche = -0.15 * monte + 0.4 * abat;
      if (g.phase === 2 && t > A + 2) {
        const m2 = frappe(A + 2, D - 4);
        const a2 = frappe(D - 4, D + 2);
        levD = (-2.9 * sortie(m2) + 0.5 * (1 - m2)) * (1 - a2) + 0.5 * a2;
        penche = -0.15 * m2 + 0.4 * a2;
      }
    } else if (g.attaque === ONDE) {
      const monte = frappe(0, A - 5);
      const abat = frappe(A - 5, A + 1);
      levG = levD = -2.9 * sortie(monte) * (1 - abat) + 0.55 * abat;
      penche = -0.18 * monte + 0.45 * abat;
      ecrase = 1 - 0.1 * abat;
      if (g.phase === 2 && t > A + 1) {
        const m2 = frappe(A + 1, D - 5);
        const a2 = frappe(D - 5, D + 1);
        levG = levD = (-2.9 * sortie(m2) + 0.55 * (1 - m2)) * (1 - a2) + 0.55 * a2;
        penche = -0.18 * m2 + 0.45 * a2;
      }
    } else if (g.attaque === PIERRES) {
      const monte = frappe(0, Math.min(A, 40));
      levG = levD = -2.6 * sortie(monte);
      penche = -0.3 * monte;
      tetePenche = -0.4 * monte;
      tremble = Math.sin(e.temps * 60) * 0.04 * monte;
    }
    lueur = 1.2 + Math.sin(e.temps * 20) * 0.2;
  } else if (g.etat === RECUPERE) {
    const u = bornes(e.t / Math.max(1, g.recup), 0, 1);
    penche = 0.35 * (1 - u);
    levG = levD = 0.4 * (1 - u);
    lueur = 0.5;
    tetePenche = 0.3 * (1 - u);
  } else if (g.etat === RUGIT) {
    const t = e.temps * 11;
    levG = -1.2 + Math.sin(t) * 1.2 - 0.6;
    levD = -1.2 - Math.sin(t) * 1.2 - 0.6;
    penche = -0.2;
    ecrase = 1 + Math.abs(Math.sin(t)) * 0.06;
    tremble = Math.sin(e.temps * 55) * 0.06;
    lueur = 1.6;
    tetePenche = -0.5;
  }
  if (!e.vivant) {
    // La chute : il s'affaisse, tremble, puis s'éteint.
    const u = bornes(e.mort / 90, 0, 1);
    penche = 0.8 * sortie(u);
    ecrase = 1 - 0.45 * sortie(u);
    levG = levD = 0.8 * u;
    lueur = Math.max(0, 1 - u * 1.6);
    tremble = Math.sin(e.temps * 50) * 0.08 * (1 - u);
    tetePenche = 0.6 * u;
  }
  a.corps.rotation.x = penche;
  a.corps.position.set(tremble, 0, 0);
  a.corps.scale.set(1 / Math.sqrt(ecrase), ecrase, 1 / Math.sqrt(ecrase));
  a.bras[0].rotation.x = levG;
  a.bras[1].rotation.x = levD;
  a.tete.rotation.x = tetePenche + 0.22; // la tête est baissée vers ce qu'il regarde : le visage se voit d'en haut
  a.coeur.scale.setScalar(lueur);
  for (const y of a.yeux) y.scale.y = 0.13 * (e.vivant ? 0.9 + 0.35 * (lueur - 0.9) : Math.max(0.05, lueur));
  a.jambes[0].position.z = e.marche ? Math.sin(p) * 0.35 : 0;
  a.jambes[1].position.z = e.marche ? -Math.sin(p) * 0.35 : 0;
  a.racine.rotation.z = e.marche ? Math.sin(p) * 0.04 : 0;
}

/** Un bloc de pierre qui tombe (annonce « chute de pierres »). */
export function creerRocher(): { groupe: Group; matiere: MeshToonMaterial } {
  const p = piece(colorier(roche(0.95, 61, { bruit: 0.3 }), PIERRE, 61), 0xffffff, true, true);
  return { groupe: p.groupe, matiere: p.matiere };
}
