import { ConeGeometry, Group, Mesh, MeshBasicMaterial, OctahedronGeometry, type BufferGeometry, type MeshToonMaterial } from "three";
import { ANNONCE, B_BELIER, B_CHENE, B_DUC, B_REINE, BOND, ETOURDI, INVOCATION, MARCHE, RACINES_CERCLES, RACINES_LIGNES, RECUPERE, RUGIT, SPORES, Z_BANDE, type Golem, type Zone } from "@cdj/rush-sim";
import { aplat, piece, type Piece } from "./cel";
import { ajouter, animerGolem, bornes, clignement, creerGolem, geleeDome, lerp, PIERRE, sortie, sph, yeux, type Acteur, type EntreeGolem, type GolemVu, type Yeux } from "./acteurs";
import { bloc, fusionner, placer, teindre } from "./formes";
import { COULEURS } from "./palette";

// Les CINQ boss de Rush (lot BR3) côté vue : le golem (`acteurs.ts`, inchangé), la reine gelée, le grand-duc, le bélier de carrière, le vieux chêne. Même langage que le golem — de gros BLOCS arrondis à l'ombrage lisse, un
// contour d'encre, des yeux qui brillent — et la DA figée du lot : **de la lisibilité, pas d'embellissement**. Chaque boss a UNE couleur dominante qui tranche sur le sol de chaque thème (`test/lisibilite.test.ts` : ΔE ≥ 40) et se
// reconnaît à sa silhouette. Tout est procédural : `animerBoss` pose le corps d'après l'état de la simulation (état, temps dans l'état, attaque, zones annoncées). Repères : le boss regarde vers +Z, l'unité est le mètre, les pieds
// sont à y = 0 ; `racine.position.y` est la hauteur de vol (le grand-duc, le bond de la reine), lue par la scène pour l'ombre et la caméra.

export const COULEURS_BOSS = {
  reine: { couleur: 0x2f78b8, clair: 0xa6d6f2, couronne: COULEURS.armure },
  duc: { couleur: 0x3a4a72, dessus: 0x5a6c9c, sombre: 0x252f4d, creme: 0xd9d0b8, bec: 0xe0a030, aile: 0x4a5c8c, oeil: 0xffd23a },
  belier: { couleur: 0x4d5660, dessus: 0x6f7a86, sombre: 0x33383f, plaque: 0x6a7480, corne: 0xd8cfb8, oeil: 0xffe08a },
  chene: { ecorce: 0x4e3624, dessus: 0x6b4a32, sombre: 0x33231a, feuillage: 0x2f6b34, feuillageClair: 0x4f8c3e, oeil: 0xd9f06a, bouche: 0x1c120c },
} as const;

/** La couleur DOMINANTE de chaque boss (celle qui doit trancher sur le sol de chaque thème : écart ≥ 40) et ses autres grandes masses, dans l'ordre de `BOSS_IDS`. */
export const DOMINANTES_BOSS: readonly (readonly number[])[] = [
  [PIERRE.couleur],
  [COULEURS_BOSS.reine.couleur],
  [COULEURS_BOSS.duc.couleur, COULEURS_BOSS.duc.aile],
  [COULEURS_BOSS.belier.couleur, COULEURS_BOSS.belier.sombre],
  [COULEURS_BOSS.chene.ecorce, COULEURS_BOSS.chene.feuillage],
];

const p = (g: BufferGeometry): Piece => piece(g, 0xffffff, true, true);
const cone = (r: number, h: number, seg: number, pose: Parameters<typeof placer>[1], couleur: number): BufferGeometry => teindre(placer(new ConeGeometry(r, h, seg), pose), couleur);
const boule = (r: number, pose: Parameters<typeof placer>[1], couleur: number): BufferGeometry => teindre(placer(sph(r, 14, 10), pose), couleur);

// --- Ce que l'animation lit ----------------------------------------------------------------------------------------------------------------------------------------------------------------------
export interface EntreeBoss extends EntreeGolem {
  /** Le tick de simulation vu (fractionnaire, comme les zones) et les zones annoncées : les fenêtres de course du grand-duc et du bélier. */
  tick: number;
  zones: readonly Zone[];
  /** Les ticks de l'élan de la reine (24 au rythme 100 %). */
  elan: number;
  /** Le boss dort au fond de l'arène (il n'est pas réveillé) : yeux éteints, aucune attitude de combat. */
  dort: boolean;
}

interface BaseBoss extends Acteur {
  /** La hauteur du corps au-dessus du sol (mètres) : le bond de la reine, le vol du grand-duc. */
  haut: number;
  /** Un reflet blanc de 0 à 1 que la scène ajoute à l'éclair (le grand-duc essoufflé, posé au sol, clignote : c'est LE moment où le frapper). */
  reflet: number;
}
export type GolemBoss = GolemVu & BaseBoss & { kind: 0 };
export interface ReineVu extends BaseBoss {
  kind: 1;
  corps: Group;
  yeux: Yeux;
}
export interface DucVu extends BaseBoss {
  kind: 2;
  pivot: Group;
  tete: Group;
  ailes: [Group, Group];
  yeux: Yeux;
  phase: number;
}
export interface BelierVu extends BaseBoss {
  kind: 3;
  corps: Group;
  tete: Group;
  pattes: [Group, Group, Group, Group];
  etoiles: Group;
  yeux: Yeux;
  phase: number;
}
export interface CheneVu extends BaseBoss {
  kind: 4;
  corps: Group;
  cime: Group;
  bras: [Group, Group];
  yeux: Mesh[];
}
export type BossVu = GolemBoss | ReineVu | DucVu | BelierVu | CheneVu;

// --- La course : les bandes que le boss parcourt ---------------------------------------------------------------------------------------------------------------------------------------------
/** La bande que le boss parcourt à cet instant (sa fenêtre `dash`, les derniers ticks avant l'impact), avec son avancement de 0 à 1, ou `null`. */
export function courseEnCours(zones: readonly Zone[], tick: number): { z: Zone; u: number } | null {
  for (const z of zones) if (z.type === Z_BANDE && z.dash > 0 && tick >= z.ti - z.dash && tick < z.ti) return { z, u: (tick - (z.ti - z.dash)) / z.dash };
  return null;
}
/** La prochaine bande à parcourir (celle qui frappe le plus tôt), ou `null`. */
export function prochaineCourse(zones: readonly Zone[]): Zone | null {
  let b: Zone | null = null;
  for (const z of zones) if (z.type === Z_BANDE && z.dash > 0 && (!b || z.ti < b.ti)) b = z;
  return b;
}
/** Vers où regarde le boss (radians, repère de la scène : `atan2(dx, dz)`) : le long de sa bande quand il charge ou plonge, dans le sens de son vol quand le grand-duc tourne, sinon vers le chevalier. `mouvement` : son déplacement du dernier tick. */
export function capDuBoss(g: Golem, zones: readonly Zone[], cible: { x: number; y: number }, mouvement: { dx: number; dy: number }): number {
  if (g.etat === ANNONCE && (g.kind === B_DUC || g.kind === B_BELIER)) {
    const b = prochaineCourse(zones);
    if (b) return Math.atan2(b.x2 - b.x, b.y2 - b.y);
  }
  if (g.kind === B_DUC && g.sol === 0 && Math.hypot(mouvement.dx, mouvement.dy) > 30) return Math.atan2(mouvement.dx, mouvement.dy);
  return Math.atan2(cible.x - g.x, cible.y - g.y);
}
/** Ce que la caméra garde dans l'image pour chaque boss : la hauteur à laquelle il monte (têtes, cime, ailes) et le rayon qu'il prend au sol (mètres). */
export function cadreDuBoss(kind: number, haut = 0): { haut: number; r: number } {
  switch (kind) {
    case B_REINE:
      return { haut: 3 + haut, r: 2.6 };
    case B_DUC:
      return { haut: 4.2 + haut, r: 3.6 };
    case B_BELIER:
      return { haut: 3.8, r: 3.6 };
    case B_CHENE:
      return { haut: 8.2, r: 3.4 };
    default:
      return { haut: 5.1, r: 3.0 };
  }
}
/** Un boss pour la vitrine et le bestiaire : l'état d'attente de la simulation (il marche sur place, ne frappe pas), au sol sauf le grand-duc qui plane. */
export function bossFictif(kind: number): Golem {
  return { x: 0, y: 0, hp: 1, hpMax: 1, phase: 1, etat: MARCHE, t: 0, duree: 0, t1: 0, attaque: 0, repos: 999, compteur: 0, flash: 0, dir: 32, recup: 0, coup: 0, kind, r: 0, sol: kind === B_DUC ? 0 : 1, div: 0, a: 0, ex: 0, ey: 0, ft: 0, mur: 0 };
}

// =====================================================================================================================================================================================================
// La reine gelée : une GROSSE gelée en dôme (le langage de la gelée, une couleur à elle), une couronne de petits blocs, de grands yeux.
// =====================================================================================================================================================================================================
function couronne(): BufferGeometry {
  const or = COULEURS_BOSS.reine.couronne;
  const dents = Array.from({ length: 5 }, (_, i) => {
    const a = (i / 5) * Math.PI * 2;
    return cone(0.2, 0.62, 6, { x: Math.cos(a) * 0.82, y: 0.38, z: Math.sin(a) * 0.82 }, or);
  });
  return fusionner([placer(bloc(2.0, 0.3, 2.0, { couleur: or, dessus: 0xf6cc62, graine: 301, rayon: 0.13, irregulier: 0.03 }), {}), ...dents]);
}

function creerReine(): ReineVu {
  const racine = new Group();
  const corps = new Group();
  racine.add(corps);
  const dome = p(geleeDome(COULEURS_BOSS.reine.couleur, COULEURS_BOSS.reine.clair));
  dome.groupe.scale.set(4.0, 4.4, 4.0); // rayon 2 m, 2,2 m de haut
  corps.add(dome.groupe);
  const cour = p(couronne());
  cour.groupe.position.set(0, 1.9, 0.2);
  cour.groupe.rotation.x = 0.12;
  corps.add(cour.groupe);
  const o = yeux(0.72, 1.1, 1.58, 0.37, 0.55);
  corps.add(o.mesh);
  return { kind: 1, racine, matieres: [dome.matiere, cour.matiere], corps, yeux: o, haut: 0, reflet: 0 };
}

/** Le bond de la reine : les impacts (ticks de l'annonce) et l'avancement. Avant l'élan elle s'écrase de plus en plus ; pendant l'élan elle monte et retombe ; au contact elle s'aplatit. */
function bondDeLaReine(g: Golem, e: EntreeBoss): { sy: number; sxz: number; haut: number; tremble: number } {
  const impacts = g.phase === 2 ? [g.t1, g.duree] : [g.duree];
  let debut = 0;
  let T = impacts[impacts.length - 1]!;
  for (const i of impacts) {
    if (e.t < i + 7) {
      T = i;
      break;
    }
    debut = i;
  }
  const avant = T - e.elan;
  if (e.t < avant) {
    const u = bornes((e.t - debut) / Math.max(1, avant - debut), 0, 1);
    const c = sortie(u);
    return { sy: 1 - 0.38 * c, sxz: 1 + 0.2 * c, haut: 0, tremble: u > 0.6 ? Math.sin(e.temps * 70) * 0.05 * (u - 0.6) : 0 };
  }
  if (e.t < T) {
    const u = bornes((e.t - avant) / Math.max(1, e.elan), 0, 1);
    const air = Math.sin(Math.PI * u);
    // étirée en montant, ramassée en retombant
    const sy = u < 0.5 ? lerp(0.62, 1.28, sortie(u * 2)) : lerp(1.28, 0.9, (u - 0.5) * 2);
    return { sy, sxz: 1 / Math.sqrt(sy), haut: 3.3 * air, tremble: 0 };
  }
  const u = bornes((e.t - T) / 7, 0, 1);
  return { sy: 0.55 + 0.45 * u, sxz: 1.3 - 0.3 * u, haut: 0, tremble: 0 };
}

function animerReine(a: ReineVu, g: Golem, e: EntreeBoss): void {
  let sy = 1 + Math.sin(e.temps * 2.4) * 0.03 + (g.etat === MARCHE && !e.dort ? Math.sin(e.temps * 5.6) * 0.03 : 0);
  let sxz = 1 / Math.sqrt(sy);
  let haut = 0;
  let tremble = 0;
  let fermer = 0;
  if (g.etat === ANNONCE && g.attaque === BOND) {
    const b = bondDeLaReine(g, e);
    ({ sy, sxz, haut, tremble } = b);
  } else if (g.etat === RECUPERE) {
    const u = bornes(e.t / Math.max(1, g.recup), 0, 1);
    sy = 1 - 0.34 * Math.exp(-u * 4) * Math.cos(u * 12); // elle retombe en gélatine, essoufflée
    sxz = 1 / Math.sqrt(sy);
    fermer = 0.45 * (1 - u);
  } else if (g.etat === RUGIT) {
    sy = 1 + Math.abs(Math.sin(e.temps * 9)) * 0.14;
    sxz = 1 / Math.sqrt(sy);
    tremble = Math.sin(e.temps * 55) * 0.06;
  }
  if (!e.vivant) {
    const u = bornes(e.mort / 90, 0, 1);
    sy = 1 - 0.8 * sortie(u); // elle fond
    sxz = 1 + 0.55 * sortie(u);
    haut = 0;
  }
  sy *= 1 - 0.09 * e.sursaut; // un coup la fait onduler, une division aussi (la scène le déclenche)
  sxz *= 1 + 0.05 * e.sursaut;
  a.corps.scale.set(sxz, sy, sxz);
  a.corps.position.x = tremble;
  a.racine.position.y = haut;
  a.haut = haut;
  a.yeux.fermer(Math.max(fermer, e.dort ? 1 : clignement(e.temps, 2)));
}

// =====================================================================================================================================================================================================
// Le grand-duc : une grande chouette en blocs, de grandes ailes ; il vole entre ses attaques et se POSE au sol, ailes repliées et essoufflé, quand il récupère.
// =====================================================================================================================================================================================================
const D = COULEURS_BOSS.duc;
function corpsDuDuc(): BufferGeometry {
  return fusionner([
    placer(bloc(1.9, 2.1, 1.7, { couleur: D.couleur, dessus: D.dessus, graine: 201, rayon: 0.6 }), { y: 1.7 }),
    placer(bloc(1.2, 1.5, 0.55, { couleur: D.creme, dessus: 0xeee6d0, graine: 202, rayon: 0.25, irregulier: 0.04 }), { y: 1.5, z: 0.78 }),
    placer(bloc(1.1, 0.16, 1.7, { couleur: D.sombre, graine: 203, rayon: 0.07 }), { y: 0.95, z: -1.45, rx: 0.25 }),
    ...[-1, 1].map((s) => placer(bloc(0.4, 0.55, 0.7, { couleur: D.bec, graine: 204 + s, rayon: 0.12 }), { x: s * 0.5, y: 0.45, z: 0.35 })),
  ]);
}
function teteDuDuc(): BufferGeometry {
  return fusionner([
    bloc(2.2, 1.4, 1.6, { couleur: D.couleur, dessus: D.dessus, graine: 211, rayon: 0.55 }),
    ...[-1, 1].map((s) => cone(0.28, 0.9, 6, { x: s * 0.8, y: 1.0, z: -0.1, rz: -s * 0.25 }, D.sombre)),
    ...[-1, 1].map((s) => teindre(placer(sph(0.6, 14, 10), { x: s * 0.52, y: -0.02, z: 0.62, s: [1, 1, 0.45] }), D.creme)),
    cone(0.22, 0.6, 6, { y: -0.18, z: 1.0, rx: Math.PI / 2 }, D.bec),
  ]);
}
/** Une aile (vers +x pour `cote` 1) : un large avant-bras et trois rémiges sombres en éventail. Le pivot est l'épaule. */
function aileDuDuc(cote: 1 | -1): BufferGeometry {
  const f = (x: number, z: number, w: number, h: number, d: number, couleur: number, graine: number, ry = 0): BufferGeometry =>
    placer(bloc(w, h, d, { couleur, dessus: couleur, graine, rayon: Math.min(h * 0.45, 0.1), irregulier: 0.03, variation: 0.06 }), { x: x * cote, y: 0, z, ry: ry * cote });
  return fusionner([f(0.8, 0, 1.7, 0.3, 1.5, D.aile, 221), f(2.2, -0.1, 1.5, 0.22, 1.7, D.aile, 222), f(3.4, 0.3, 1.4, 0.16, 0.6, D.sombre, 223, -0.18), f(3.5, -0.45, 1.5, 0.16, 0.6, D.sombre, 224), f(3.2, -1.15, 1.3, 0.16, 0.6, D.sombre, 225, 0.22)]);
}

function creerDuc(): DucVu {
  const racine = new Group();
  const pivot = new Group();
  pivot.position.y = 1.9;
  racine.add(pivot);
  const interieur = new Group();
  interieur.position.y = -1.9;
  pivot.add(interieur);
  const matieres: MeshToonMaterial[] = [];
  const noter = (q: Piece): Piece => {
    matieres.push(q.matiere);
    return q;
  };
  ajouter(interieur, noter(p(corpsDuDuc())), 0, 0, 0);
  const tete = new Group();
  tete.position.set(0, 2.7, 0.15);
  ajouter(tete, noter(p(teteDuDuc())), 0, 0, 0);
  const o = yeux(0.52, 0.02, 0.86, 0.3, 0.5);
  (o.mesh.material as MeshBasicMaterial).color.set(D.oeil).multiplyScalar(2.2); // les grands yeux jaunes brillent (le bloom les fait fleurir)
  tete.add(o.mesh);
  interieur.add(tete);
  const ailes: Group[] = [];
  for (const s of [-1, 1] as const) {
    const aile = new Group();
    aile.position.set(s * 0.85, 2.6, 0);
    aile.scale.setScalar(0.82);
    ajouter(aile, noter(p(aileDuDuc(s))), 0, 0, 0);
    interieur.add(aile);
    ailes.push(aile);
  }
  return { kind: 2, racine, matieres, pivot, tete, ailes: [ailes[0]!, ailes[1]!], yeux: o, phase: 0, haut: 0, reflet: 0 };
}

const VOL_DUC = 3.6;
const HAUT_ANNONCE_DUC = 4.7;
function animerDuc(a: DucVu, g: Golem, e: EntreeBoss): void {
  const vol = g.sol === 0;
  const course = g.etat === ANNONCE ? courseEnCours(e.zones, e.tick) : null;
  let cible = 0;
  let battement = 0; // la fréquence des ailes
  let amplitude = 0;
  let relevee = 0.2; // l'inclinaison moyenne des ailes (positif : vers le haut, pour l'aile droite)
  let tangage = 0;
  let balayage = vol ? 0 : 0.35; // les ailes ramenées en arrière
  let souffle = 0;
  let tetePenche = 0;
  let fermer = 0;
  a.reflet = 0;
  if (vol) {
    cible = g.etat === ANNONCE ? HAUT_ANNONCE_DUC : VOL_DUC;
    battement = g.etat === ANNONCE ? 8 : 10.5;
    amplitude = g.etat === ANNONCE ? 0.95 : 0.6;
    if (g.etat === ANNONCE) tangage = -0.22 + 0.04 * Math.sin(e.temps * 9); // il se cabre, plane, guette
    if (g.etat === RUGIT) {
      amplitude = 0.4;
      relevee = 0.9;
    }
  } else {
    // posé : les ailes repliées le long du corps ; en récupération, essoufflé et clignotant
    relevee = -1.38;
    if (g.etat === RECUPERE) {
      souffle = Math.sin(e.temps * 13);
      tetePenche = 0.28;
      fermer = 0.35;
      a.reflet = 0.14 + 0.14 * Math.sin(e.temps * 12);
    }
  }
  if (course) {
    // le plongeon : il file le long de la bande, les ailes en arrière, le bec en avant ; il descend jusqu'à la fin de la bande
    const u = course.u;
    a.haut = HAUT_ANNONCE_DUC * (1 - Math.pow(u, 1.6)) + 0.45;
    tangage = 0.95;
    relevee = -0.35;
    balayage = 1.05; // les ailes balayées en arrière
    amplitude = 0.08;
    battement = 14;
  } else {
    // sinon la hauteur rejoint la cible (il décolle, il remonte entre deux plongeons)
    const k = 1 - Math.exp(-e.dt * 5);
    a.haut += (cible - a.haut) * k;
    if (!vol && a.haut < 0.02) a.haut = 0;
  }
  a.phase += e.dt * battement;
  const battue = Math.sin(a.phase) * amplitude;
  a.ailes[1].rotation.z = relevee + battue;
  a.ailes[0].rotation.z = -(relevee + battue);
  a.ailes[1].rotation.y = balayage;
  a.ailes[0].rotation.y = -balayage;
  const bob = vol && !course ? Math.sin(e.temps * 3) * 0.12 + battue * 0.25 : 0;
  a.pivot.rotation.x = tangage + (vol ? 0 : 0.06 * souffle);
  a.pivot.scale.setScalar(1 + (vol ? 0 : 0.035 * souffle));
  a.tete.rotation.x = tetePenche;
  a.racine.position.y = a.haut + bob;
  if (e.dort) fermer = 1;
  a.yeux.fermer(Math.max(fermer, e.dort ? 1 : clignement(e.temps, 4)));
  if (!e.vivant) {
    const u = bornes(e.mort / 90, 0, 1);
    a.pivot.rotation.z = 1.45 * sortie(u); // il bascule sur le flanc
    a.racine.position.y = Math.max(0, a.haut * (1 - sortie(u)));
    a.yeux.fermer(1);
    a.reflet = 0;
  } else a.pivot.rotation.z = 0;
}

// =====================================================================================================================================================================================================
// Le bélier de carrière : un gros bélier trapu en pierre bleu-gris, cornes de os, plaques sur le dos. Il gratte le sol avant de charger ; étourdi contre le muret, la tête au sol, des étoiles tournent.
// =====================================================================================================================================================================================================
const B = COULEURS_BOSS.belier;
function corpsDuBelier(): BufferGeometry {
  return fusionner([
    placer(bloc(3.0, 2.0, 3.8, { couleur: B.couleur, dessus: B.dessus, graine: 301, rayon: 0.75, irregulier: 0.06 }), { y: 1.9 }),
    placer(bloc(2.2, 0.55, 1.0, { couleur: B.plaque, dessus: 0x8a95a2, graine: 302, rayon: 0.2 }), { y: 3.0, z: -1.15 }),
    placer(bloc(2.5, 0.6, 1.1, { couleur: B.plaque, dessus: 0x8a95a2, graine: 303, rayon: 0.2 }), { y: 3.1, z: 0.1 }),
    placer(bloc(2.0, 0.55, 0.9, { couleur: B.plaque, dessus: 0x8a95a2, graine: 304, rayon: 0.2 }), { y: 2.95, z: 1.2 }),
    placer(bloc(1.5, 1.0, 0.9, { couleur: B.sombre, graine: 305, rayon: 0.3 }), { y: 1.5, z: -1.95 }),
  ]);
}
function teteDuBelier(): BufferGeometry {
  const corne = (s: 1 | -1): BufferGeometry[] => [
    cone(0.6, 1.9, 8, { x: s * 1.2, y: 0.6, z: 0.35, rz: -s * 0.85, rx: 0.35 }, B.corne),
    cone(0.42, 1.8, 8, { x: s * 1.95, y: 1.15, z: 1.05, rz: -s * 0.2, rx: 1.25 }, B.corne),
  ];
  return fusionner([
    placer(bloc(1.9, 1.7, 1.7, { couleur: B.couleur, dessus: B.dessus, graine: 311, rayon: 0.55 }), { y: 0, z: 0.5 }),
    placer(bloc(1.2, 0.8, 0.8, { couleur: B.sombre, graine: 312, rayon: 0.25 }), { y: -0.45, z: 1.5 }),
    placer(bloc(2.1, 0.4, 0.5, { couleur: B.sombre, graine: 313, rayon: 0.14 }), { y: 0.45, z: 1.1 }),
    ...corne(-1),
    ...corne(1),
  ]);
}
const patteDuBelier = (graine: number): BufferGeometry => placer(bloc(0.95, 1.7, 0.95, { couleur: B.sombre, dessus: B.couleur, graine, rayon: 0.3 }), { y: -0.65 });
function etoilesFusionnees(): BufferGeometry {
  return fusionner(
    [0, 1, 2].map((i) => {
      const a = (i / 3) * Math.PI * 2;
      return teindre(placer(new OctahedronGeometry(0.34, 0), { x: Math.cos(a) * 1.3, z: Math.sin(a) * 1.3, s: [1, 0.6, 1] }), 0xffe14a);
    }),
  );
}

function creerBelier(): BelierVu {
  const racine = new Group();
  const corps = new Group();
  racine.add(corps);
  const matieres: MeshToonMaterial[] = [];
  const noter = (q: Piece): Piece => {
    matieres.push(q.matiere);
    return q;
  };
  ajouter(corps, noter(p(corpsDuBelier())), 0, 0, 0);
  const tete = new Group();
  tete.position.set(0, 2.3, 1.7);
  ajouter(tete, noter(p(teteDuBelier())), 0, 0, 0);
  const o = yeux(0.62, 0.3, 1.38, 0.17, 0.6);
  (o.mesh.material as MeshBasicMaterial).color.set(B.oeil).multiplyScalar(1.8);
  tete.add(o.mesh);
  corps.add(tete);
  const pattes: Group[] = [];
  [[-1, 1, 311], [1, 1, 312], [-1, -1, 313], [1, -1, 314]].forEach(([sx, sz, g]) => {
    const pt = new Group();
    pt.position.set(sx! * 1.05, 1.5, sz! * 1.35);
    ajouter(pt, noter(p(patteDuBelier(g!))), 0, 0, 0);
    corps.add(pt);
    pattes.push(pt);
  });
  const etoiles = new Group();
  etoiles.position.set(0, 4.4, 1.9);
  etoiles.add(aplat(etoilesFusionnees(), 0xffffff, 1.6));
  etoiles.visible = false;
  corps.add(etoiles);
  return { kind: 3, racine, matieres, corps, tete, pattes: [pattes[0]!, pattes[1]!, pattes[2]!, pattes[3]!], etoiles, yeux: o, phase: 0, haut: 0, reflet: 0 };
}

function animerBelier(a: BelierVu, g: Golem, e: EntreeBoss): void {
  const course = g.etat === ANNONCE ? courseEnCours(e.zones, e.tick) : null;
  if (e.marche && g.etat === MARCHE) a.phase += e.dt * 6.5;
  const [fg, fd, bg, bd] = a.pattes;
  let bobine = 0;
  let nez = 0.12; // la tête : positif = vers le bas
  let corpsX = 0;
  let corpsY = 0;
  let corpsZ = 0;
  let ecrase = 1;
  let fermer = 0;
  let ecartement = 0;
  let tremble = 0;
  a.etoiles.visible = false;
  let pas = [0, 0, 0, 0];
  if (g.etat === MARCHE) {
    const s = e.marche ? Math.sin(a.phase) * 0.5 : 0;
    pas = [s, -s, -s, s];
    bobine = e.marche ? Math.abs(Math.sin(a.phase)) * 0.07 : Math.sin(e.temps * 2.4) * 0.02;
  } else if (g.etat === ANNONCE) {
    if (course) {
      // la charge : au galop, la tête basse
      const s = Math.sin(e.temps * 30) * 0.95;
      pas = [s, s, -s * 0.9, -s * 0.9];
      bobine = Math.abs(Math.sin(e.temps * 30)) * 0.14;
      nez = 0.55;
      corpsX = 0.1;
    } else {
      // il gratte le sol : la patte avant qui racle, la tête baissée, le corps qui tremble
      const u = bornes(e.t / Math.max(1, g.t1), 0, 1);
      pas = [0, -0.7 + Math.sin(e.temps * 22) * 0.8, 0, 0];
      nez = 0.2 + 0.45 * sortie(u);
      corpsX = 0.1 * u;
      corpsY = -0.18 * u;
      tremble = Math.sin(e.temps * 48) * 0.05 * u;
    }
  } else if (g.etat === ETOURDI) {
    const u = bornes(e.t / 10, 0, 1);
    nez = 1.05;
    corpsX = 0.2;
    corpsY = -0.3;
    corpsZ = -0.6 * (1 - u); // le contre-coup : repoussé en arrière
    ecrase = 1 - 0.1 * (1 - u);
    ecartement = 0.3;
    pas = [0.25, 0.25, -0.3, -0.3];
    fermer = 0.95;
    a.etoiles.visible = true;
    a.etoiles.rotation.y = e.temps * 4;
    a.etoiles.position.y = 3.9 + Math.sin(e.temps * 5) * 0.12;
  } else if (g.etat === RECUPERE) {
    const u = bornes(e.t / Math.max(1, g.recup), 0, 1);
    nez = 0.4 * (1 - u) + 0.15;
    ecrase = 1 + Math.sin(e.temps * 11) * 0.025;
    corpsY = -0.1 * (1 - u);
    fermer = 0.3 * (1 - u);
  } else if (g.etat === RUGIT) {
    corpsX = -0.4; // il se cabre
    pas = [-1.0, -1.0, 0.15, 0.15];
    nez = -0.1;
    tremble = Math.sin(e.temps * 50) * 0.06;
  }
  if (!e.vivant) {
    const u = bornes(e.mort / 90, 0, 1);
    a.corps.rotation.z = 1.5 * sortie(u); // il s'écroule sur le flanc
    a.corps.position.y = 0;
    fermer = 1;
  } else a.corps.rotation.z = 0;
  ecrase *= 1 - 0.06 * e.sursaut;
  if (e.vivant) {
    a.corps.rotation.x = corpsX;
    a.corps.position.set(tremble, corpsY + bobine, corpsZ - 0.08 * e.sursaut);
  }
  a.corps.scale.set(1 / Math.sqrt(ecrase), ecrase, 1 / Math.sqrt(ecrase));
  a.tete.rotation.x = nez;
  fg.rotation.x = pas[0]!;
  fd.rotation.x = pas[1]!;
  bg.rotation.x = pas[2]!;
  bd.rotation.x = pas[3]!;
  fg.rotation.z = -ecartement;
  bg.rotation.z = -ecartement;
  fd.rotation.z = ecartement;
  bd.rotation.z = ecartement;
  a.yeux.fermer(Math.max(fermer, e.dort ? 1 : clignement(e.temps, 6)));
  (a.yeux.mesh.material as MeshBasicMaterial).color.set(B.oeil).multiplyScalar(g.etat === ANNONCE ? 2.6 : 1.6);
}

// =====================================================================================================================================================================================================
// Le vieux chêne : un arbre-souche en gros blocs — un tronc, des racines apparentes, des yeux dans l'écorce, deux branches-bras, une cime. Il ne bouge jamais.
// =====================================================================================================================================================================================================
const C = COULEURS_BOSS.chene;
function troncDuChene(): BufferGeometry {
  const racines = [0.4, 1.75, 3.1, 4.4, 5.6].map((a, i) => placer(bloc(1.0, 0.8, 2.9, { couleur: C.sombre, dessus: C.ecorce, graine: 401 + i, rayon: 0.3, irregulier: 0.08 }), { x: Math.sin(a) * 2.3, y: 0.38, z: Math.cos(a) * 2.3, ry: a, rx: -0.12 }));
  return fusionner([
    ...racines,
    placer(bloc(3.7, 3.3, 3.5, { couleur: C.ecorce, dessus: C.dessus, graine: 410, rayon: 0.95, irregulier: 0.07 }), { y: 1.75 }),
    placer(bloc(3.0, 2.7, 2.9, { couleur: C.ecorce, dessus: C.dessus, graine: 411, rayon: 0.8, irregulier: 0.08 }), { y: 4.35, z: 0.1 }),
    // le visage : une arcade épaisse, un creux pour la bouche, un nœud
    placer(bloc(2.2, 0.42, 0.6, { couleur: C.sombre, graine: 412, rayon: 0.16 }), { y: 5.05, z: 1.45 }),
    placer(bloc(1.5, 0.85, 0.4, { couleur: C.bouche, graine: 413, rayon: 0.2, irregulier: 0.02 }), { y: 3.75, z: 1.48 }),
    placer(bloc(0.8, 0.8, 0.5, { couleur: C.dessus, graine: 414, rayon: 0.25 }), { x: -1.05, y: 3.2, z: 1.5 }),
  ]);
}
function cimeDuChene(): BufferGeometry {
  const f = (x: number, y: number, z: number, w: number, h: number, d: number, graine: number): BufferGeometry => placer(bloc(w, h, d, { couleur: C.feuillage, dessus: C.feuillageClair, graine, rayon: Math.min(w, h, d) * 0.42, irregulier: 0.1, variation: 0.14 }), { x, y, z });
  return fusionner([f(0, 0.9, 0, 3.8, 2.7, 3.8, 421), f(-2.0, 0.2, 0.3, 2.5, 2.1, 2.5, 422), f(2.0, 0.3, -0.2, 2.5, 2.1, 2.5, 423), f(0.2, 2.2, -0.4, 2.6, 1.8, 2.6, 424), f(0, 0.1, 1.7, 2.2, 1.7, 2.0, 425)]);
}
/** Une branche-bras qui pend sous son épaule (−y) : un long bloc de bois, une fourche et une touffe de feuilles au bout. */
function brasDuChene(s: 1 | -1): BufferGeometry {
  return fusionner([
    placer(bloc(0.9, 2.6, 0.9, { couleur: C.ecorce, dessus: C.dessus, graine: 430 + s, rayon: 0.32, irregulier: 0.08 }), { y: -1.15 }),
    placer(bloc(0.55, 1.5, 0.55, { couleur: C.sombre, dessus: C.ecorce, graine: 432 + s, rayon: 0.2 }), { x: s * 0.55, y: -2.6, z: 0.15, rz: s * 0.5 }),
    placer(bloc(1.5, 1.2, 1.5, { couleur: C.feuillage, dessus: C.feuillageClair, graine: 434 + s, rayon: 0.5, irregulier: 0.1 }), { x: s * 0.2, y: -3.35, z: 0.1 }),
  ]);
}

function creerChene(): CheneVu {
  const racine = new Group();
  racine.scale.setScalar(0.8); // ~8 m de haut : plus grand que le golem, mais la caméra le garde dans l'image
  const corps = new Group();
  racine.add(corps);
  const matieres: MeshToonMaterial[] = [];
  const noter = (q: Piece): Piece => {
    matieres.push(q.matiere);
    return q;
  };
  ajouter(corps, noter(p(troncDuChene())), 0, 0, 0);
  const cime = new Group();
  cime.position.set(0, 5.7, 0);
  ajouter(cime, noter(p(cimeDuChene())), 0, 0.9, 0);
  corps.add(cime);
  const bras: Group[] = [];
  for (const s of [-1, 1] as const) {
    const b = new Group();
    b.position.set(s * 1.75, 4.9, 0.1);
    ajouter(b, noter(p(brasDuChene(s))), 0, 0, 0);
    corps.add(b);
    bras.push(b);
  }
  // Les yeux : deux fentes vert-jaune dans l'écorce, sous l'arcade (aplats sans lumière, une lueur au-dessus de 1).
  const ye: Mesh[] = [];
  for (const s of [-1, 1]) {
    const y = aplat(sph(1, 10, 7), C.oeil, 2.6);
    y.scale.set(0.36, 0.18, 0.1);
    y.position.set(s * 0.68, 4.72, 1.52);
    y.rotation.z = s * 0.3;
    corps.add(y);
    ye.push(y);
  }
  return { kind: 4, racine, matieres, corps, cime, bras: [bras[0]!, bras[1]!], yeux: ye, haut: 0, reflet: 0 };
}

function animerChene(a: CheneVu, g: Golem, e: EntreeBoss): void {
  let levee = 0.5; // l'élévation des bras (0 : pendants, 2,6 : en l'air), symétrique
  let penche = 0;
  let ecrase = 1;
  let tremble = 0;
  let enflee = 1;
  let lueur = e.dort ? 0 : 1;
  let teinteViolette = false;
  const balance = Math.sin(e.temps * 1.3) * 0.05;
  if (g.etat === MARCHE) {
    levee = 0.5 + Math.sin(e.temps * 1.3) * 0.08;
    lueur = e.dort ? 0 : 0.9 + Math.sin(e.temps * 3) * 0.1;
  } else if (g.etat === ANNONCE) {
    const T = Math.max(1, g.duree);
    const u = bornes(e.t / T, 0, 1);
    lueur = 1.5 + Math.sin(e.temps * 20) * 0.25;
    if (g.attaque === RACINES_LIGNES) {
      // les bras se lèvent, le tronc se cabre et tremble, puis tout s'abat à l'impact
      const monte = bornes(e.t / Math.max(1, T - 6), 0, 1);
      const abat = bornes((e.t - (T - 6)) / 8, 0, 1);
      levee = 0.5 + 2.1 * sortie(monte) * (1 - abat) + 0.0 * abat;
      penche = -0.12 * monte + 0.4 * abat;
      tremble = Math.sin(e.temps * 55) * 0.05 * monte * (1 - abat);
    } else if (g.attaque === RACINES_CERCLES) {
      // il piétine : quatre coups, une flexion avant chaque impact
      const ecart = (g.duree - g.t1) / 3;
      let bump = 0;
      for (let i = 0; i < 4; i++) bump = Math.max(bump, Math.exp(-(((e.t - (g.t1 + i * ecart)) / 5) ** 2)));
      const prep = bornes(e.t / Math.max(1, g.t1), 0, 1);
      levee = 1.5 * (1 - bump) * Math.min(1, prep * 2);
      ecrase = 1 - 0.13 * bump;
      penche = 0.22 * bump;
      tremble = Math.sin(e.temps * 40) * 0.04 * (1 - bump);
    } else if (g.attaque === SPORES) {
      // la cime gonfle et tremble, les bras s'écartent ; au lâcher elle se dégonfle
      enflee = 1 + 0.42 * sortie(u);
      levee = 1.5 + 0.6 * sortie(u);
      tremble = Math.sin(e.temps * 38) * 0.06 * u;
      penche = -0.08 * u;
    } else if (g.attaque === INVOCATION) {
      levee = 0.5 + 1.9 * sortie(bornes(u * 1.5, 0, 1));
      ecrase = 1 + Math.sin(e.temps * 7) * 0.025;
      lueur = 1.7;
      teinteViolette = true;
    }
  } else if (g.etat === RECUPERE) {
    const u = bornes(e.t / Math.max(1, g.recup), 0, 1);
    penche = 0.2 * (1 - u * u);
    levee = 0.2 + 0.3 * u;
    lueur = 0.35;
    enflee = 1 - 0.05 * (1 - u);
  } else if (g.etat === RUGIT) {
    levee = 2.3 + Math.sin(e.temps * 14) * 0.25;
    tremble = Math.sin(e.temps * 55) * 0.07;
    penche = -0.1;
    lueur = 1.8;
    ecrase = 1 + Math.abs(Math.sin(e.temps * 11)) * 0.05;
  }
  if (!e.vivant) {
    const u = bornes(e.mort / 90, 0, 1);
    penche = 1.1 * sortie(u); // le chêne s'abat
    levee = 0.5 + 1.6 * u;
    lueur = Math.max(0, 1 - u * 1.8);
    tremble = Math.sin(e.temps * 50) * 0.07 * (1 - u);
    enflee = 1 - 0.3 * u;
  }
  ecrase *= 1 - 0.04 * e.sursaut;
  penche -= 0.05 * e.sursaut;
  a.corps.rotation.x = penche;
  a.corps.position.x = tremble;
  a.corps.scale.set(1 / Math.sqrt(ecrase), ecrase, 1 / Math.sqrt(ecrase));
  a.cime.rotation.z = balance;
  a.cime.scale.setScalar(enflee);
  a.bras[0].rotation.z = -(levee + balance * 2);
  a.bras[1].rotation.z = levee + balance * 2;
  for (const y of a.yeux) {
    y.scale.y = 0.18 * Math.max(0.05, lueur);
    y.visible = lueur > 0.02;
    (y.material as MeshBasicMaterial).color.set(teinteViolette ? 0xd0bcff : C.oeil).multiplyScalar(1.4 + 1.4 * Math.min(1.6, lueur));
  }
}

// =====================================================================================================================================================================================================
// L'entrée unique : créer et animer un boss d'après son indice.
// =====================================================================================================================================================================================================
/** Le boss `kind` (indice dans `BOSS_IDS`) : le golem de `acteurs.ts` ou l'un des quatre nouveaux. */
export function creerBoss(kind: number): BossVu {
  switch (kind) {
    case B_REINE:
      return creerReine();
    case B_DUC:
      return creerDuc();
    case B_BELIER:
      return creerBelier();
    case B_CHENE:
      return creerChene();
    default:
      return { ...creerGolem(), kind: 0, haut: 0, reflet: 0 } as GolemBoss;
  }
}

/** Pose le corps du boss d'après l'état de la simulation. Le golem garde son animation (et ses yeux éteints quand il dort) ; la scène a déjà posé `racine.position` (x, z) et le cap. */
export function animerBoss(a: BossVu, g: Golem, e: EntreeBoss): void {
  switch (a.kind) {
    case 1:
      return animerReine(a, g, e);
    case 2:
      return animerDuc(a, g, e);
    case 3:
      return animerBelier(a, g, e);
    case 4:
      return animerChene(a, g, e);
    default: {
      animerGolem(a, g, e);
      for (const y of a.yeux) y.visible = !e.dort;
      for (const h of a.halos) h.visible = !e.dort;
    }
  }
}

