import { BoxGeometry, ConeGeometry, CylinderGeometry, DodecahedronGeometry, Group, Mesh, SphereGeometry, type BufferGeometry, type MeshToonMaterial } from "three";
import { RoundedBoxGeometry } from "three/examples/jsm/geometries/RoundedBoxGeometry.js";
import { ANNONCE, ANNONCE_PLONGEON, CHAUVE, COUP, ESQUIVE, MARCHE, ONDE, PIERRES, PLONGEON, POING, RECUPERE, REPOS, RUGIT, type Chevalier, type Golem, type Monstre } from "@cdj/rush-sim";
import { aplat, piece, type Piece } from "./cel";
import { BLANC, COULEURS, ENCRE } from "./palette";

// Les personnages de Rush : des formes simples (sphères, cônes, boîtes arrondies), un contour d'encre, de petits yeux. **Tout est procédural** : chaque image, `animer*` pose le corps selon l'état de la simulation
// (balancement, écrasement, rotation), sans animation enregistrée. Les repères : le personnage regarde vers +Z, l'unité est le mètre, les pieds sont à y = 0.

const sph = (r: number, l = 18, h = 12): SphereGeometry => new SphereGeometry(r, l, h);
const GEO = {
  corps: sph(0.45, 22, 16),
  tete: sph(0.4, 22, 16),
  pied: sph(0.15, 12, 8),
  main: sph(0.13, 12, 8),
  lame: new RoundedBoxGeometry(0.12, 0.07, 1.0, 2, 0.03),
  garde: new RoundedBoxGeometry(0.36, 0.08, 0.1, 2, 0.03),
  plume: new ConeGeometry(0.12, 0.5, 10),
  bouclier: new CylinderGeometry(0.3, 0.3, 0.08, 18),
  gelee: sph(0.5, 24, 16),
  reflet: sph(0.1, 10, 8),
  chauve: sph(0.28, 18, 12),
  aile: sph(0.5, 14, 8),
  oreille: new ConeGeometry(0.08, 0.2, 8),
  oeilBlanc: sph(1, 12, 8),
  torse: sph(1.25, 26, 18),
  hanches: sph(0.95, 22, 14),
  tetegolem: new RoundedBoxGeometry(1.0, 0.8, 0.85, 3, 0.18),
  bras: new CylinderGeometry(0.34, 0.4, 1.3, 14),
  poing: sph(0.66, 18, 12),
  jambe: sph(0.58, 16, 10),
  caillou: new DodecahedronGeometry(0.32, 0),
  coeur: sph(0.3, 14, 10),
  sourcil: new RoundedBoxGeometry(0.9, 0.12, 0.2, 2, 0.04),
};

const bornes = (v: number, a: number, b: number): number => Math.min(b, Math.max(a, v));
const lerp = (a: number, b: number, t: number): number => a + (b - a) * t;
const sortie = (t: number): number => 1 - (1 - t) * (1 - t) * (1 - t);

/** Deux petits yeux : un blanc et une pupille chacun. Rend le groupe et de quoi les faire cligner. */
function yeux(ecart: number, y: number, z: number, r: number, pupille = 0.55): { groupe: Group; blancs: Mesh[]; pupilles: Mesh[] } {
  const groupe = new Group();
  const blancs: Mesh[] = [];
  const pupilles: Mesh[] = [];
  for (const s of [-1, 1]) {
    const o = new Group();
    const b = aplat(GEO.oeilBlanc, BLANC);
    b.scale.setScalar(r);
    const p = aplat(GEO.oeilBlanc, ENCRE);
    p.scale.setScalar(r * pupille);
    p.position.set(0, -r * 0.1, r * 0.62);
    o.add(b, p);
    o.position.set(s * ecart, y, z);
    groupe.add(o);
    blancs.push(b);
    pupilles.push(p);
  }
  return { groupe, blancs, pupilles };
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
  yeux: ReturnType<typeof yeux>;
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
  interieur.add(o.groupe);
  const bouche = aplat(new BoxGeometry(0.2, 0.035, 0.05), ENCRE);
  bouche.position.set(0, 1.02, 0.385);
  interieur.add(bouche);
  const plume = new Group();
  plume.position.set(0, 1.5, -0.1);
  const cone = noter(piece(GEO.plume, COULEURS.plume));
  cone.groupe.position.y = 0.25;
  plume.add(cone.groupe);
  interieur.add(plume);
  // L'épée, tenue à droite : le groupe pivote autour de la main.
  const epee = new Group();
  epee.position.set(0.55, 0.62, 0.1);
  ajouter(epee, noter(piece(GEO.main, COULEURS.armure)), 0, 0, 0);
  ajouter(epee, noter(piece(GEO.lame, COULEURS.acier)), 0, 0, 0.62);
  ajouter(epee, noter(piece(GEO.garde, COULEURS.armure)), 0, 0, 0.1);
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
  const fermeture = clignement(e.temps, 0);
  for (const b of a.yeux.blancs) b.scale.y = b.scale.x * (1 - fermeture * 0.9);
}

// --- La gelée ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface BeteVue extends Acteur {
  corps: Group;
  yeux: ReturnType<typeof yeux>;
  ailes?: [Group, Group];
  aleatoire: number;
  /** Le tick de la dernière image où la bête a servi (pour la rendre à la réserve). */
  vu: number;
}

export function creerGelee(): BeteVue {
  const racine = new Group();
  const corps = new Group();
  racine.add(corps);
  const b = piece(GEO.gelee, COULEURS.gelee);
  b.groupe.position.y = 0.42;
  b.groupe.scale.set(1, 0.84, 1);
  corps.add(b.groupe);
  const r = aplat(GEO.reflet, COULEURS.geleeClair);
  r.position.set(-0.22, 0.78, 0.2);
  r.scale.set(1.3, 0.8, 0.8);
  corps.add(r);
  const o = yeux(0.17, 0.5, 0.42, 0.085);
  corps.add(o.groupe);
  return { racine, matieres: [b.matiere], corps, yeux: o, aleatoire: 0, vu: 0 };
}

export function animerGelee(a: BeteVue, m: Monstre, temps: number, tick: number): void {
  const t = m.t;
  let sy = 1;
  let y = 0;
  if (m.gel > 0) {
    sy = 1 + Math.sin(temps * 30) * 0.08;
  } else if (t < 10) sy = 1 - 0.28 * Math.sin((t / 10) * Math.PI * 0.5);
  else if (t < 28) {
    const u = (t - 10) / 18;
    y = Math.sin(Math.PI * u) * 0.95;
    sy = 0.72 + 0.55 * Math.sin(Math.PI * Math.min(1, u * 1.3)) ;
  } else {
    const u = (t - 28) / 12;
    sy = 1 - 0.3 * Math.exp(-u * 4) * Math.cos(u * 14);
  }
  const apparition = bornes((tick - m.age) / 18, 0, 1);
  const pop = apparition < 1 ? sortie(apparition) * (1 + 0.25 * Math.sin(apparition * Math.PI)) : 1;
  a.corps.scale.set(pop / Math.sqrt(sy), pop * sy, pop / Math.sqrt(sy));
  a.corps.position.y = y;
  const f = clignement(temps, a.aleatoire);
  for (const b of a.yeux.blancs) b.scale.y = b.scale.x * (1 - f * 0.9);
}

// --- La chauve-souris ----------------------------------------------------------------------------------------------------------------------------------------------------------------------------
export function creerChauve(): BeteVue {
  const racine = new Group();
  const corps = new Group();
  racine.add(corps);
  const b = piece(GEO.chauve, COULEURS.chauve);
  corps.add(b.groupe);
  const matieres = [b.matiere];
  for (const s of [-1, 1]) {
    const o = piece(GEO.oreille, COULEURS.chauve);
    o.groupe.position.set(s * 0.14, 0.3, -0.02);
    o.groupe.rotation.z = -s * 0.25;
    corps.add(o.groupe);
    matieres.push(o.matiere);
  }
  const ailes: Group[] = [];
  for (const s of [-1, 1]) {
    const pivot = new Group();
    pivot.position.set(s * 0.2, 0.05, 0);
    const w = piece(GEO.aile, COULEURS.chauveClair);
    w.groupe.position.x = s * 0.4;
    w.groupe.scale.set(1, 0.09, 0.62);
    pivot.add(w.groupe);
    matieres.push(w.matiere);
    corps.add(pivot);
    ailes.push(pivot);
  }
  const o = yeux(0.1, 0.06, 0.22, 0.062);
  corps.add(o.groupe);
  return { racine, matieres, corps, yeux: o, ailes: [ailes[0]!, ailes[1]!], aleatoire: 0, vu: 0 };
}

export function animerChauve(a: BeteVue, m: Monstre, temps: number, tick: number): void {
  const bat = temps * (m.etat === PLONGEON ? 6 : 17) + a.aleatoire * 5;
  let volet = Math.sin(bat) * 0.85;
  let tangage = 0;
  let hauteur = 1.25 + Math.sin(temps * 3 + a.aleatoire) * 0.1;
  let echelle = 1;
  let tremble = 0;
  if (m.etat === ANNONCE_PLONGEON) {
    tremble = Math.sin(temps * 70) * 0.05;
    echelle = 1 + 0.18 * Math.min(1, m.t / 12);
    volet = Math.sin(bat * 1.5) * 1.1;
    hauteur += 0.18;
  } else if (m.etat === PLONGEON) {
    volet = 1.25;
    tangage = 0.6;
    hauteur = 1.25 - 0.55 * Math.sin(Math.PI * Math.min(1, m.t / 26));
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
  const rouge = m.etat === ANNONCE_PLONGEON;
  for (const b of a.yeux.blancs) (b.material as unknown as { color: { set(c: number): void } }).color.set(rouge ? COULEURS.danger : BLANC);
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

export function creerGolem(): GolemVu {
  const racine = new Group();
  const corps = new Group();
  racine.add(corps);
  const matieres: MeshToonMaterial[] = [];
  const noter = (p: Piece): Piece => {
    matieres.push(p.matiere);
    return p;
  };
  const hanches = ajouter(corps, noter(piece(GEO.hanches, COULEURS.golemSombre)), 0, 1.0, 0);
  hanches.groupe.scale.set(1.05, 0.8, 0.9);
  const torse = ajouter(corps, noter(piece(GEO.torse, COULEURS.golem)), 0, 2.2, 0);
  torse.groupe.scale.set(1.05, 0.92, 0.88);
  const tete = new Group();
  tete.position.set(0, 3.55, 0.15);
  ajouter(tete, noter(piece(GEO.tetegolem, COULEURS.golem)), 0, 0, 0);
  const sourcils = ajouter(tete, noter(piece(GEO.sourcil, COULEURS.golemSombre)), 0, 0.14, 0.38);
  sourcils.groupe.rotation.x = 0.0;
  const yeuxG: Mesh[] = [];
  for (const s of [-1, 1]) {
    const y = aplat(GEO.oeilBlanc, COULEURS.lueur);
    y.scale.set(0.11, 0.085, 0.06);
    y.position.set(s * 0.24, 0.02, 0.43);
    tete.add(y);
    yeuxG.push(y);
  }
  corps.add(tete);
  const coeur = aplat(GEO.coeur, COULEURS.lueur);
  coeur.position.set(0, 2.25, 1.0);
  corps.add(coeur);
  for (const [x, y, z, s, c] of [[-1.15, 3.25, 0.05, 1.4, COULEURS.golemMousse], [1.2, 3.1, -0.1, 1.1, COULEURS.golemSombre], [0.2, 3.62, -0.55, 0.9, COULEURS.golemMousse]] as const) {
    const k = ajouter(corps, noter(piece(GEO.caillou, c)), x, y, z);
    k.groupe.scale.setScalar(s);
  }
  const bras: Group[] = [];
  for (const s of [-1, 1]) {
    const epaule = new Group();
    epaule.position.set(s * 1.5, 2.85, 0);
    const haut = ajouter(epaule, noter(piece(GEO.bras, COULEURS.golem)), 0, -0.6, 0);
    haut.groupe.rotation.z = s * 0.1;
    ajouter(epaule, noter(piece(GEO.poing, COULEURS.golemSombre)), s * 0.05, -1.4, 0.1);
    corps.add(epaule);
    bras.push(epaule);
  }
  const jambes: Group[] = [];
  for (const s of [-1, 1]) {
    const j = new Group();
    j.position.set(s * 0.75, 0.55, 0);
    const p = noter(piece(GEO.jambe, COULEURS.golemSombre));
    p.groupe.scale.set(1, 0.9, 1.15);
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
    penche = 0.04;
    levG = Math.sin(p) * 0.3;
    levD = -Math.sin(p) * 0.3;
    ecrase = 1 + Math.abs(Math.sin(p)) * 0.025;
  } else if (g.etat === ANNONCE) {
    const t = e.t;
    const frappe = (debut: number, fin: number): number => bornes((t - debut) / (fin - debut), 0, 1);
    if (g.attaque === POING) {
      // le bras droit se lève pendant l'annonce, puis s'abat à l'impact (tick 50 ; le second coup de la phase 2 : 72)
      const monte = frappe(0, 46);
      const abat = frappe(46, 52);
      levD = -2.9 * sortie(monte) * (1 - abat) + 0.5 * abat;
      penche = -0.15 * monte + 0.4 * abat;
      if (g.phase === 2 && t > 52) {
        const m2 = frappe(52, 68);
        const a2 = frappe(68, 74);
        levD = (-2.9 * sortie(m2) + 0.5 * (1 - m2)) * (1 - a2) + 0.5 * a2;
        penche = -0.15 * m2 + 0.4 * a2;
      }
    } else if (g.attaque === ONDE) {
      const monte = frappe(0, 50);
      const abat = frappe(50, 56);
      levG = levD = -2.9 * sortie(monte) * (1 - abat) + 0.55 * abat;
      penche = -0.18 * monte + 0.45 * abat;
      ecrase = 1 - 0.1 * abat;
      if (g.phase === 2 && t > 56) {
        const m2 = frappe(56, 98);
        const a2 = frappe(98, 104);
        levG = levD = (-2.9 * sortie(m2) + 0.55 * (1 - m2)) * (1 - a2) + 0.55 * a2;
        penche = -0.18 * m2 + 0.45 * a2;
      }
    } else if (g.attaque === PIERRES) {
      const monte = frappe(0, 26);
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
  a.tete.rotation.x = tetePenche;
  a.coeur.scale.setScalar(lueur);
  for (const y of a.yeux) y.scale.y = 0.085 * (e.vivant ? 1 : Math.max(0.05, lueur));
  a.jambes[0].position.z = e.marche ? Math.sin(p) * 0.35 : 0;
  a.jambes[1].position.z = e.marche ? -Math.sin(p) * 0.35 : 0;
  a.racine.rotation.z = e.marche ? Math.sin(p) * 0.04 : 0;
}

/** Un bloc de pierre qui tombe (annonce « chute de pierres »). */
export function creerRocher(): { groupe: Group; matiere: MeshToonMaterial } {
  const p = piece(new DodecahedronGeometry(0.85, 0) as BufferGeometry, COULEURS.golem);
  return { groupe: p.groupe, matiere: p.matiere };
}
