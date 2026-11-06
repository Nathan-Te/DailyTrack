import { AdditiveBlending, BufferAttribute, BufferGeometry, CanvasTexture, Color, ConeGeometry, ExtrudeGeometry, Group, Mesh, MeshBasicMaterial, Shape, SphereGeometry, SRGBColorSpace, Sprite, SpriteMaterial, Vector3, type MeshToonMaterial } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ANNONCE, ANNONCE_PLONGEON, CHAUVE, COUP, ESQUIVE, MARCHE, ONDE, PIERRES, PLONGEON, POING, RECUPERE, REPOS, RUGIT, type Chevalier, type Durees, type Golem, type Monstre } from "@cdj/rush-sim";
import { aplat, piece, type Piece } from "./cel";
import { bloc, fusionner, placer, teindre } from "./formes";
import { BLANC, COULEURS, ENCRE } from "./palette";

// Les personnages de Rush (lot BR0c) : des GROS BLOCS arrondis à l'ombrage lisse (le golem), un chevalier CHIBI (gros casque rond à fente, petit corps), des gelées en dôme écrasé, des chauves-souris à grandes ailes à doigts. **Tout est procédural** :
// chaque image, `animer*` pose le corps selon l'état de la simulation (balancement, écrasement, rotation, le coup en trois temps : anticipation, phase active, récupération), sans animation enregistrée. Les repères : le personnage regarde vers +Z,
// l'unité est le mètre, les pieds sont à y = 0. Les pièces qui bougent ensemble sont FUSIONNÉES (une forme : un appel de dessin) ; le contour est celui du post-traitement (haute qualité) ou des coques (basse) : voir `cel.ts`.

const sph = (r: number, l = 18, h = 12): SphereGeometry => new SphereGeometry(r, l, h);
const bornes = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const sortie = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);
const entree = (t: number): number => t * t;
const lisser = (a: number, b: number, x: number): number => {
  const t = bornes((x - a) / (b - a), 0, 1);
  return t * t * (3 - 2 * t);
};

// --- Les formes (construites une fois, partagées) ---------------------------------------------------------------------------------------------------------------------------------------------------
/** Un dôme de gelée : une demi-sphère à l'ombrage lisse, un petit REFLET brillant en haut à gauche (un bouton de lumière, pas une grande tache), le bas un peu plus sombre. Posée au sol. */
function geleeDome(): BufferGeometry {
  const g = new SphereGeometry(0.5, 28, 14, 0, Math.PI * 2, 0, Math.PI / 2);
  const p = g.getAttribute("position");
  const n = g.getAttribute("normal");
  const lumiere = new Vector3(-0.42, 0.78, 0.46).normalize();
  const c = new Float32Array(p.count * 3);
  const base = new Color(COULEURS.gelee);
  const clair = new Color(COULEURS.geleeClair);
  const reflet = new Color(0xffffff);
  const t = new Color();
  const v = new Vector3();
  for (let i = 0; i < p.count; i++) {
    v.fromBufferAttribute(n, i);
    t.copy(base).multiplyScalar(0.86 + 0.24 * Math.max(0, v.y));
    t.lerp(clair, lisser(0.55, 0.9, v.dot(lumiere)) * 0.55);
    t.lerp(reflet, lisser(0.955, 0.985, v.dot(lumiere)));
    c[i * 3] = t.r;
    c[i * 3 + 1] = t.g;
    c[i * 3 + 2] = t.b;
  }
  g.setAttribute("color", new BufferAttribute(c, 3));
  return g;
}

/** Une aile de chauve-souris : une membrane festonnée tendue sur trois doigts (des nervures plus sombres), couchée à plat (plan x, z), qui part de l'épaule vers +x (`cote` 1) ou −x (−1). Plus large qu'au BR0b. */
function aileMembrane(cote: 1 | -1): BufferGeometry {
  const pts: [number, number][] = [[0.04, 0.2], [0.42, 0.4], [0.9, 0.34], [1.18, 0.1], [0.98, -0.04], [1.0, -0.3], [0.76, -0.16], [0.74, -0.5], [0.46, -0.24], [0.2, -0.46], [0.04, -0.26]];
  const e = 0.86;
  const f = new Shape();
  pts.forEach(([x, y], i) => (i === 0 ? f.moveTo(x * e * cote, y * e) : f.lineTo(x * e * cote, y * e)));
  f.closePath();
  const membrane = new ExtrudeGeometry(f, { depth: 0.035, bevelEnabled: false });
  membrane.rotateX(Math.PI / 2); // la forme se couche : y → z (vers l'avant), l'épaisseur vers le bas
  const formes: BufferGeometry[] = [teindre(membrane, COULEURS.chauveClair)];
  // Les trois doigts : de l'épaule vers les trois pointes de la membrane.
  for (const [x, y] of [[1.18, 0.1], [1.0, -0.3], [0.74, -0.5]] as const) {
    const bx = x * e * cote;
    const bz = y * e;
    const lon = Math.hypot(bx - 0.04 * cote, bz);
    const nervure = new RoundedBoxGeometry(lon, 0.05, 0.06, 1, 0.02);
    formes.push(teindre(placer(nervure, { x: (bx + 0.04 * cote) / 2, y: -0.01, z: bz / 2, ry: -Math.atan2(bz, bx - 0.04 * cote) }), COULEURS.chauve));
  }
  return fusionner(formes);
}

const GEO = {
  geleeD: geleeDome(),
  chauve: fusionner([teindre(sph(0.3, 16, 10), COULEURS.chauve), ...[-1, 1].map((s) => teindre(placer(new ConeGeometry(0.09, 0.24, 6), { x: s * 0.16, y: 0.3, z: -0.02, rz: -s * 0.25 }), COULEURS.chauve))]),
  aileG: aileMembrane(-1),
  aileD: aileMembrane(1),
  oeilBlanc: sph(1, 10, 7),
};

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
/** L'épée : la main, la lame claire, la garde et le pommel dorés en une seule forme (couleurs par sommet). Le groupe pivote autour de la main ; la lame est longue et large : elle se lit de loin. */
function epeeFusionnee(): BufferGeometry {
  return fusionner([
    teindre(sph(0.14, 12, 8), COULEURS.armure),
    teindre(placer(new RoundedBoxGeometry(0.17, 0.09, 1.05, 2, 0.04), { z: 0.7 }), COULEURS.acier),
    teindre(placer(new ConeGeometry(0.085, 0.2, 4), { z: 1.3, rx: Math.PI / 2 }), COULEURS.acier),
    teindre(placer(new RoundedBoxGeometry(0.46, 0.1, 0.13, 2, 0.04), { z: 0.15 }), COULEURS.armure),
    teindre(placer(sph(0.07, 8, 6), { z: -0.12 }), COULEURS.armure),
  ]);
}
const EPEE = epeeFusionnee();
/** Le casque : une grande sphère d'acier un peu aplatie, une FENTE sombre en travers du visage (les yeux y brillent) et un rebord. */
function casque(): BufferGeometry {
  return fusionner([
    teindre(placer(new SphereGeometry(0.33, 28, 18), { s: [1, 0.96, 1] }), COULEURS.acier),
    teindre(placer(new RoundedBoxGeometry(0.46, 0.12, 0.22, 2, 0.05), { y: 0.0, z: 0.24 }), ENCRE),
    teindre(placer(new RoundedBoxGeometry(0.62, 0.05, 0.62, 2, 0.03), { y: -0.13 }), 0xcfc7b4),
  ]);
}
const CASQUE = casque();
// Lot BR1 : le casque est plus petit et un peu en arrière, le corps plus large : vu d'en haut on voit l'armure jaune et, devant, la direction (la fente, l'épée).
const CORPS_CHEVALIER = placer(bloc(0.84, 0.56, 0.64, { couleur: COULEURS.armure, dessus: 0xf6cc62, variation: 0.03, irregulier: 0, graine: 5, rayon: 0.2 }), {});
const PLUME = fusionner([teindre(placer(new ConeGeometry(0.13, 0.52, 10), { y: 0.26 }), COULEURS.plume), teindre(placer(sph(0.11, 10, 8), { y: 0.05, z: 0.02 }), COULEURS.plume)]);

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
  racine.scale.setScalar(0.88); // chibi : le chevalier fait ~1,7 m, comme dans la cible (il tient ~8 % de la hauteur de l'écran)
  const pivot = new Group();
  pivot.position.y = 0.5;
  const interieur = new Group();
  interieur.position.y = -0.5;
  pivot.add(interieur);
  racine.add(pivot);
  const matieres: MeshToonMaterial[] = [];
  const noter = (p: Piece): Piece => {
    matieres.push(p.matiere);
    return p;
  };
  ajouter(interieur, noter(piece(CORPS_CHEVALIER, 0xffffff, true, true)), 0, 0.4, 0);
  const tete = ajouter(interieur, noter(piece(CASQUE, 0xffffff, true, true)), 0, 0.95, -0.16);
  tete.groupe.rotation.x = 0.1; // le casque penche un peu vers l'avant : la fente se voit d'en haut
  const o = yeux(0.12, 0.97, 0.26, 0.05, 0.5);
  interieur.add(o.mesh);
  const plume = new Group();
  plume.position.set(0, 1.24, -0.3);
  plume.add(noter(piece(PLUME, 0xffffff, true, true)).groupe);
  interieur.add(plume);
  // L'épée, tenue à droite : le groupe pivote autour de la main.
  const epee = new Group();
  epee.position.set(0.4, 0.5, 0.12);
  ajouter(epee, noter(piece(EPEE, 0xffffff, true, true)), 0, 0, 0);
  interieur.add(epee);
  // Un petit bouclier rond à gauche, de profil.
  const bouclier = ajouter(interieur, noter(piece(placer(new SphereGeometry(0.2, 14, 10), { s: [0.4, 1, 1] }), COULEURS.armure)), -0.34, 0.45, 0.1);
  bouclier.groupe.rotation.z = 0.1;
  const pg = new Group();
  const pd = new Group();
  for (const [g, s] of [[pg, -1], [pd, 1]] as const) {
    g.position.set(s * 0.15, 0.1, 0);
    const p = noter(piece(sph(0.15, 12, 8), COULEURS.plume));
    p.groupe.scale.set(1, 0.7, 1.4);
    g.add(p.groupe);
    interieur.add(g);
  }
  return { racine, matieres, pivot, interieur, epee, plume, pieds: [pg, pd], yeux: o, phase: 0 };
}
export interface EntreeChevalier {
  dt: number;
  temps: number;
  duree: number;
  /** Le tick de l'impact dans le coup (la fin de l'anticipation). */
  impact: number;
  /** Les ticks écoulés dans le coup (avec la fraction du tick courant : le geste est fluide à 120 Hz comme à 60). */
  ticks: number;
  /** Vrai si le rendu doit le cacher cette image (clignement après un dégât). */
  cache: boolean;
}

/** La phase active d'un coup, en ticks après l'impact : l'épée balaie. Le reste du coup est la récupération, qui va au bout du mouvement. */
export const PHASE_ACTIVE = 4;

export function animerChevalier(a: ChevalierVu, c: Chevalier, e: EntreeChevalier): void {
  a.racine.visible = !e.cache;
  const marche = c.marche && (c.etat !== ESQUIVE);
  if (marche) a.phase += e.dt * 13;
  const p = a.phase;
  let rouleau = 0;
  let saut = 0;
  let ecrase = 1;
  let penche = marche ? 0.14 : 0;
  // Au repos : la respiration. En marche : le rebond.
  let hauteur = marche ? Math.abs(Math.sin(p)) * 0.08 : 0;
  ecrase = marche ? 1 - Math.abs(Math.sin(p)) * 0.04 : 1 + Math.sin(e.temps * 3.2) * 0.02;
  let ey = 0;
  let ex = -0.9;
  let torsion = 0;
  let avance = 0;
  if (c.etat === COUP) {
    // Trois temps : l'ANTICIPATION (l'épée ramenée en arrière, le corps qui pivote et s'écrase), la phase ACTIVE (quatre ticks : le balayage), la RÉCUPÉRATION (le geste va au bout, puis revient doucement).
    const t = e.ticks;
    const pre = bornes(t / Math.max(1, e.impact), 0, 1);
    const act = bornes((t - e.impact) / PHASE_ACTIVE, 0, 1);
    const rec = bornes((t - e.impact - PHASE_ACTIVE) / Math.max(1, e.duree - e.impact - PHASE_ACTIVE), 0, 1);
    const sens = c.combo === 1 ? -1 : 1;
    if (c.combo === 2) {
      // le coup final : l'épée monte derrière la tête (le chevalier s'écrase puis se dresse), s'abat de toute sa force, reste plantée, puis se relève lentement
      const fin = t < e.impact ? lerp(-0.9, -2.9, sortie(pre)) : lerp(-2.9, 0.85, sortie(act));
      ex = lerp(fin, -0.9, entree(rec) * (act >= 1 ? 1 : 0));
      penche = t < e.impact ? -0.28 * sortie(pre) : lerp(-0.28, 0.62, sortie(act)) * (1 - entree(rec));
      ecrase = t < e.impact ? 1 - 0.1 * sortie(pre) : lerp(0.9, 1.1, sortie(act)) * (1 - entree(rec)) + entree(rec) * 1;
      saut = (t < e.impact ? 0.14 * Math.sin(Math.PI * pre * 0.9) : 0.14 * (1 - act)) * (rec < 1 ? 1 : 0);
      torsion = 0.25 * sens * (1 - act);
      avance = 0.4 * sortie(act) * (1 - entree(rec));
    } else {
      // le coup balayé : de droite à gauche, puis de gauche à droite
      ex = lerp(-0.1, -0.35, pre) * (1 - rec) + -0.9 * rec;
      const arriere = sens * 2.0;
      ey = t < e.impact ? lerp(0, arriere, sortie(pre)) : lerp(arriere, -sens * 2.3, sortie(act)) * (1 - entree(rec)) + 0 * rec;
      penche = (t < e.impact ? -0.12 * pre : lerp(-0.12, 0.34, sortie(act))) * (1 - entree(rec));
      torsion = (t < e.impact ? sens * 0.5 * sortie(pre) : lerp(sens * 0.5, -sens * 0.6, sortie(act))) * (1 - entree(rec));
      ecrase = (t < e.impact ? 1 - 0.07 * pre : lerp(0.93, 1.05, sortie(act))) * (1 - entree(rec)) + entree(rec);
      avance = 0.25 * sortie(act) * (1 - entree(rec));
    }
    a.interieur.position.z = avance;
  } else a.interieur.position.z = 0;
  a.interieur.rotation.y = torsion;
  if (c.etat === ESQUIVE) {
    const t = bornes(c.t / 12, 0, 1);
    rouleau = t * Math.PI * 2;
    saut = Math.sin(Math.PI * t) * 0.3;
    ecrase = 1 - Math.sin(Math.PI * t) * 0.18;
  }
  a.pivot.rotation.x = rouleau + penche;
  a.pivot.position.y = 0.5 + hauteur + saut;
  a.pivot.scale.set(1 / Math.sqrt(ecrase), ecrase, 1 / Math.sqrt(ecrase));
  a.epee.rotation.set(ex, ey, 0);
  a.plume.rotation.x = -0.55 + Math.sin(e.temps * 6 + (marche ? 1.5 : 0)) * (marche ? 0.25 : 0.08) - penche * 0.6;
  const balancement = marche ? Math.sin(p) * 0.22 : 0;
  a.pieds[0].position.z = balancement;
  a.pieds[1].position.z = -balancement;
  a.pieds[0].position.y = 0.1 + (marche ? Math.max(0, Math.sin(p)) * 0.1 : 0);
  a.pieds[1].position.y = 0.1 + (marche ? Math.max(0, -Math.sin(p)) * 0.1 : 0);
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
  const b = piece(GEO.geleeD, 0xffffff, true, true);
  b.groupe.position.y = 0;
  b.groupe.scale.set(1.5, 1.2, 1.5); // un dôme écrasé posé au sol (~1,5 m de large : les gelées de la cible sont grosses)
  corps.add(b.groupe);
  const o = yeux(0.23, 0.39, 0.6, 0.095, 0.58);
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
    sy = 1 + Math.sin(temps * 30) * 0.06; // elle titube
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
  // Les ailes : de larges membranes à trois doigts qui battent autour de l'épaule.
  const ailes: Group[] = [];
  for (const s of [-1, 1]) {
    const pivot = new Group();
    pivot.position.set(s * 0.22, 0.05, 0);
    const w = piece(s === 1 ? GEO.aileD : GEO.aileG, 0xffffff, true, true);
    pivot.add(w.groupe);
    matieres.push(w.matiere);
    corps.add(pivot);
    ailes.push(pivot);
  }
  const o = yeux(0.11, 0.06, 0.24, 0.07);
  corps.add(o.mesh);
  return { racine, matieres, corps, yeux: o, ailes: [ailes[0]!, ailes[1]!], aleatoire: 0, vu: 0 };
}

export function animerChauve(a: BeteVue, m: Monstre, temps: number, tick: number, d: Durees): void {
  const bat = temps * (m.etat === PLONGEON ? 6 : 17) + a.aleatoire * 5;
  let volet = Math.sin(bat) * 0.8;
  let tangage = 0;
  let hauteur = 1.25 + Math.sin(temps * 3 + a.aleatoire) * 0.1;
  let echelle = 1.1;
  let tremble = 0;
  if (m.etat === ANNONCE_PLONGEON) {
    tremble = Math.sin(temps * 70) * 0.05;
    echelle = 1.1 * (1 + 0.18 * Math.min(1, m.t / (d.chauveAnnonce * 0.4)));
    volet = Math.sin(bat * 1.5) * 1.05;
    hauteur += 0.18;
  } else if (m.etat === PLONGEON) {
    volet = 1.2;
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
  coudes: [Group, Group];
  tete: Group;
  yeux: Mesh[];
  halos: Sprite[];
  jambes: [Group, Group];
  phase: number;
  humeur: number;
}

/** Les pierres du golem : un brun chaud, un dessus plus clair (la lumière du ciel), un brun sombre pour les arcades, les jambes et le dessous. */
// Lot BR1 (lisibilité) : une pierre GRIS-BRUN nettement plus sombre que tous les sols (le golem se détache sur chaque thème : `test/lisibilite.test.ts` mesure l'écart de couleur).
export const PIERRE = { couleur: 0x6a5c52, dessus: 0x8a7a6c };
export const PIERRE_SOMBRE = { couleur: 0x40352f, dessus: 0x5a4c43 };
export const PIERRE_POING = { couleur: 0x54463e, dessus: 0x76675a };
export const PIERRE_CLAIRE = { couleur: 0x7c6e63, dessus: 0xa09082 };
export const PIERRE_TETE = { couleur: 0x84766a, dessus: 0xa89a8c };

/** Le tronc : le bassin, le torse massif (penché en avant par le groupe qui le porte) et une bosse dans le dos, en gros blocs arrondis soudés en une forme. */
function troncDuGolem(): BufferGeometry {
  return fusionner([
    placer(bloc(2.5, 1.05, 1.8, { ...PIERRE_SOMBRE, graine: 11, rayon: 0.4 }), { y: 1.35 }),
    placer(bloc(3.5, 2.5, 2.4, { ...PIERRE_CLAIRE, graine: 12, rayon: 0.75, irregulier: 0.06 }), { y: 2.9, z: 0.1 }),
    placer(bloc(2.4, 1.4, 1.4, { ...PIERRE, graine: 13, rayon: 0.55 }), { y: 3.85, z: -0.95 }),
  ]);
}

/** La tête : un gros bloc enfoncé entre les épaules, la mâchoire, une arcade épaisse et deux sourcils froncés (les extrémités intérieures plus bas : la colère). */
function teteDuGolem(): BufferGeometry {
  const sourcil = (s: 1 | -1, graine: number): BufferGeometry => placer(bloc(1.1, 0.38, 0.6, { ...PIERRE_SOMBRE, graine, rayon: 0.13, irregulier: 0.04 }), { x: s * 0.58, y: 0.38, z: 0.86, rz: s * 0.4 });
  return fusionner([
    bloc(2.3, 1.75, 1.8, { ...PIERRE_TETE, graine: 21, rayon: 0.5, irregulier: 0.05 }),
    placer(bloc(1.6, 0.7, 1.1, { ...PIERRE, graine: 22, rayon: 0.24 }), { y: -0.75, z: 0.4 }),
    placer(bloc(2.4, 0.38, 0.55, { ...PIERRE_SOMBRE, graine: 23, rayon: 0.14 }), { y: 0.18, z: 0.8 }),
    sourcil(-1, 24),
    sourcil(1, 25),
  ]);
}

/** Le haut du bras : une énorme épaule et le bras jusqu'au coude, en un bloc qui pend sous son pivot (−y). */
function hautDuBras(cote: 1 | -1): BufferGeometry {
  const g = cote === 1 ? 31 : 41;
  return fusionner([
    placer(bloc(2.0, 1.55, 2.0, { ...PIERRE_CLAIRE, graine: g, rayon: 0.65 }), { y: 0.0 }),
    placer(bloc(1.25, 1.4, 1.25, { ...PIERRE_SOMBRE, graine: g + 1, rayon: 0.35 }), { y: -1.05, z: 0.05 }),
  ]);
}
/** L'avant-bras et le POING ÉNORME (le plus gros bloc du golem), qui pend sous le coude. */
function avantBrasEtPoing(cote: 1 | -1): BufferGeometry {
  const g = cote === 1 ? 51 : 61;
  return fusionner([
    placer(bloc(1.3, 1.2, 1.35, { ...PIERRE, graine: g, rayon: 0.4 }), { y: -0.45, z: 0.1 }),
    placer(bloc(2.5, 2.0, 2.4, { ...PIERRE_POING, graine: g + 1, rayon: 0.75, irregulier: 0.09 }), { y: -1.55, z: 0.45 }),
  ]);
}
const JAMBE = (g: number): BufferGeometry => bloc(1.15, 1.25, 1.3, { ...PIERRE_SOMBRE, graine: g, rayon: 0.35 });

/** Un halo doux (un dégradé radial ambre) : posé derrière chaque œil du golem, il fait le « bloom » de la basse qualité ; en haute, le post-traitement le prolonge. */
function textureHalo(): CanvasTexture | null {
  if (typeof document === "undefined") return null; // les essais sous Node n'ont pas de canvas : un halo sans carte
  const c = document.createElement("canvas");
  c.width = c.height = 64;
  const x = c.getContext("2d")!;
  const d = x.createRadialGradient(32, 32, 0, 32, 32, 32);
  d.addColorStop(0, "rgba(255,200,90,0.95)");
  d.addColorStop(0.35, "rgba(255,170,60,0.45)");
  d.addColorStop(1, "rgba(255,150,40,0)");
  x.fillStyle = d;
  x.fillRect(0, 0, 64, 64);
  const t = new CanvasTexture(c);
  t.colorSpace = SRGBColorSpace;
  return t;
}
let HALO: CanvasTexture | null | undefined;

export function creerGolem(): GolemVu {
  const racine = new Group();
  const corps = new Group();
  racine.add(corps);
  const matieres: MeshToonMaterial[] = [];
  const noter = (p: Piece): Piece => {
    matieres.push(p.matiere);
    return p;
  };
  ajouter(corps, noter(piece(troncDuGolem(), 0xffffff, true, true)), 0, 0, 0);
  const tete = new Group();
  tete.position.set(0, 5.3, 1.05);
  ajouter(tete, noter(piece(teteDuGolem(), 0xffffff, true, true)), 0, 0, 0);
  // Les yeux : deux fentes AMBRE lumineuses sous les sourcils (aplats sans lumière, une lueur > 1 : le post-traitement la fait fleurir), chacune avec son halo.
  const yeuxG: Mesh[] = [];
  const halos: Sprite[] = [];
  if (HALO === undefined) HALO = textureHalo();
  for (const s of [-1, 1]) {
    const y = aplat(GEO.oeilBlanc, COULEURS.lueur, 3.4);
    y.scale.set(0.36, 0.17, 0.1);
    y.position.set(s * 0.46, 0.02, 1.0);
    y.rotation.z = s * 0.35;
    tete.add(y);
    yeuxG.push(y);
    const h = new Sprite(new SpriteMaterial({ map: HALO ?? null, blending: AdditiveBlending, depthWrite: false, transparent: true, fog: false }));
    h.position.set(s * 0.46, 0.02, 1.1);
    h.scale.setScalar(1.25);
    tete.add(h);
    halos.push(h);
  }
  corps.add(tete);
  const bras: Group[] = [];
  const coudes: Group[] = [];
  for (const s of [-1, 1] as const) {
    const epaule = new Group();
    epaule.position.set(s * 2.55, 3.15, 0);
    epaule.userData.reposZ = s * 0.32; // les bras s'écartent un peu : un gorille, pas un totem
    ajouter(epaule, noter(piece(hautDuBras(s), 0xffffff, true, true)), 0, 0, 0);
    const coude = new Group();
    coude.position.set(0, -1.45, 0);
    ajouter(coude, noter(piece(avantBrasEtPoing(s), 0xffffff, true, true)), 0, 0, 0);
    epaule.add(coude);
    corps.add(epaule);
    bras.push(epaule);
    coudes.push(coude);
  }
  const jambes: Group[] = [];
  for (const s of [-1, 1]) {
    const j = new Group();
    j.position.set(s * 0.85, 0.65, 0);
    const p = noter(piece(JAMBE(s === 1 ? 71 : 72), 0xffffff, true, true));
    j.add(p.groupe);
    racine.add(j);
    jambes.push(j);
  }
  return { racine, matieres, corps, bras: [bras[0]!, bras[1]!], coudes: [coudes[0]!, coudes[1]!], tete, yeux: yeuxG, halos, jambes: [jambes[0]!, jambes[1]!], phase: 0, humeur: 0 };
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
  /** Le sursaut sous un coup du chevalier, de 1 (juste touché) à 0 : il ne l'interrompt pas. */
  sursaut: number;
}

export function animerGolem(a: GolemVu, g: Golem, e: EntreeGolem): void {
  if (e.marche) a.phase += e.dt * 4.2;
  const p = a.phase;
  let levG = 0; // l'élévation du bras gauche (rotation.x, négatif = vers le haut)
  let levD = 0;
  let penche = 0.1; // le torse penché en avant : il se lit « massif et voûté »
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
      penche = 0.14 - 0.3 * monte + 0.55 * abat;
      if (g.phase === 2 && t > A + 2) {
        const m2 = frappe(A + 2, D - 4);
        const a2 = frappe(D - 4, D + 2);
        levD = (-2.9 * sortie(m2) + 0.5 * (1 - m2)) * (1 - a2) + 0.5 * a2;
        penche = 0.14 - 0.3 * m2 + 0.55 * a2;
      }
    } else if (g.attaque === ONDE) {
      const monte = frappe(0, A - 5);
      const abat = frappe(A - 5, A + 1);
      levG = levD = -2.9 * sortie(monte) * (1 - abat) + 0.55 * abat;
      penche = 0.14 - 0.3 * monte + 0.6 * abat;
      ecrase = 1 - 0.1 * abat;
      if (g.phase === 2 && t > A + 1) {
        const m2 = frappe(A + 1, D - 5);
        const a2 = frappe(D - 5, D + 1);
        levG = levD = (-2.9 * sortie(m2) + 0.55 * (1 - m2)) * (1 - a2) + 0.55 * a2;
        penche = 0.14 - 0.3 * m2 + 0.6 * a2;
      }
    } else if (g.attaque === PIERRES) {
      const monte = frappe(0, Math.min(A, 40));
      levG = levD = -2.6 * sortie(monte);
      penche = 0.14 - 0.4 * monte;
      tetePenche = -0.4 * monte;
      tremble = Math.sin(e.temps * 60) * 0.04 * monte;
    }
    lueur = 1.25 + Math.sin(e.temps * 20) * 0.2;
  } else if (g.etat === RECUPERE) {
    const u = bornes(e.t / Math.max(1, g.recup), 0, 1);
    penche = 0.14 + 0.45 * (1 - u);
    levG = levD = 0.4 * (1 - u);
    lueur = 0.55;
    tetePenche = 0.3 * (1 - u);
  } else if (g.etat === RUGIT) {
    const t = e.temps * 11;
    levG = -1.2 + Math.sin(t) * 1.2 - 0.6;
    levD = -1.2 - Math.sin(t) * 1.2 - 0.6;
    penche = -0.1;
    ecrase = 1 + Math.abs(Math.sin(t)) * 0.06;
    tremble = Math.sin(e.temps * 55) * 0.06;
    lueur = 1.7;
    tetePenche = -0.5;
  }
  if (!e.vivant) {
    // La chute : il s'affaisse, tremble, puis s'éteint.
    const u = bornes(e.mort / 90, 0, 1);
    penche = 0.14 + 0.7 * sortie(u);
    ecrase = 1 - 0.45 * sortie(u);
    levG = levD = 0.8 * u;
    lueur = Math.max(0, 1 - u * 1.6);
    tremble = Math.sin(e.temps * 50) * 0.08 * (1 - u);
    tetePenche = 0.6 * u;
  }
  // Le sursaut : un petit écrasement et un recul du torse sous chaque coup, sans interrompre ce qu'il fait.
  ecrase *= 1 - 0.05 * e.sursaut;
  penche -= 0.07 * e.sursaut;
  a.corps.rotation.x = penche;
  a.corps.position.set(tremble, 0, -0.1 * e.sursaut);
  a.corps.scale.set(1 / Math.sqrt(ecrase), ecrase, 1 / Math.sqrt(ecrase));
  a.bras[0].rotation.x = levG;
  a.bras[1].rotation.x = levD;
  a.bras[0].rotation.z = (a.bras[0].userData.reposZ as number) * (1 - Math.min(1, Math.abs(levG) / 2));
  a.bras[1].rotation.z = (a.bras[1].userData.reposZ as number) * (1 - Math.min(1, Math.abs(levD) / 2));
  a.coudes[0].rotation.x = levG < 0 ? levG * 0.2 - 0.1 : -0.12;
  a.coudes[1].rotation.x = levD < 0 ? levD * 0.2 - 0.1 : -0.12;
  a.tete.rotation.x = tetePenche + 0.12; // la tête est baissée vers ce qu'il regarde : le visage se voit d'en haut
  for (const y of a.yeux) y.scale.y = 0.15 * (e.vivant ? 0.9 + 0.35 * (lueur - 0.9) : Math.max(0.05, lueur));
  for (const h of a.halos) {
    h.scale.setScalar(1.05 + 0.45 * Math.max(0, lueur - 0.5));
    (h.material as SpriteMaterial).opacity = Math.min(1, 0.35 + 0.65 * lueur);
  }
  a.jambes[0].position.z = e.marche ? Math.sin(p) * 0.35 : 0;
  a.jambes[1].position.z = e.marche ? -Math.sin(p) * 0.35 : 0;
  a.racine.rotation.z = e.marche ? Math.sin(p) * 0.04 : 0;
}

/** Un bloc de pierre qui tombe (annonce « chute de pierres ») : un gros bloc arrondi. */
export function creerRocher(): { groupe: Group; matiere: MeshToonMaterial } {
  const p = piece(bloc(1.5, 1.3, 1.5, { ...PIERRE, graine: 61, rayon: 0.45, irregulier: 0.1 }), 0xffffff, true, true);
  return { groupe: p.groupe, matiere: p.matiere };
}
