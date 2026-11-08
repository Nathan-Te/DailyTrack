import { indiceAmelioration } from "./ameliorations";
import { ANNONCE, BOSS, B_BELIER, B_CHENE, B_DUC, B_REINE, MARCHE, Z_BANDE, Z_INVOCATION, Z_SPORES } from "./bosses";
import { C_BOND, C_BOUCLIER, C_TOURBILLON, RAYON_ARENE, RAYON_CHEVALIER, cm } from "./constantes";
import { entree, type Changement } from "./entrees";
import type { Contenu } from "./generateur";
import { distance, distance2, dirVers, unitaire } from "./maths";
import { COS, SIN } from "./trig";
import { caseDe, centreDeCase, champDeDistance, descendre, INACCESSIBLE } from "./niveau";
import { CHAMAN, CHAUVE, COUP, CRACHEUR, GELATON, GELEE, ONDE, PLONGEON, PORTE_BOUCLIER, TOTEM, Partie, pointDuSegment, type Monstre, type Resultat } from "./partie";
import type { Choix } from "./rediffusion";
import { REGLAGES_DEFAUT, type Reglages } from "./reglagesSim";

// Le pilote : un joueur automatique qui lit l'état de la partie et rend l'octet d'entrée du tick. Il sert à trois choses : le Diamant (lot BR4 : la plus rapide de ses trois stratégies, `medailles.ts` ; avant, « foncer » seule), les mesures (une partie de
// plusieurs minutes dont les entrées ressemblent à celles d'un joueur) et les tests. Il ne triche pas : il lit ce que lit le
// rendu (positions, cercles annoncés) et n'a que les entrées d'un joueur au doigt : le déplacement, le coup (tenu), l'esquive, sans visée (visée assistée).
// Lot BR1 : il NAVIGUE dans le niveau — le chemin le plus court sur la grille jusqu'à l'arène (le champ de distance du niveau), et il ne combat que ce qui lui barre la route : c'est la stratégie « foncer ».
// Lot BR1b : il casse l'obstacle qui barre les pas qui viennent (le chemin le plus court passe par lui : 1 ou 2 coups) au lieu de le contourner ; la COURSE hors combat lui vient d'elle-même (il marche sans cesse et ne frappe que ce qui barre
// la route : la simulation fait monter sa vitesse après ~1,2 s de calme) ; la stratégie « nettoyer » peut ne viser que les monstres d'UN camp (la mesure du coût d'un détour : `jouerLePilote(…, camp)`).
// Lot BR2 : TROIS stratégies — FONCER (aucun détour), UN PEU D'XP (les monstres du chemin et les camps proches du chemin : `SEUIL_PEU_CM`) et BEAUCOUP D'XP (tous les camps) — chacune avec sa liste de priorités pour choisir
// une carte (`PRIORITES`, la première de la liste qui est proposée). Elles servent à l'ÉQUILIBRE : aucune ne doit gagner tous les jours (`tools/mesures.ts`, `test/equilibre.test.ts`).
// Lot BR5 : il choisit sa COMPÉTENCE au départ d'après le boss du jour (`competenceDuPilote`) et la lance quand elle est rechargée et que la cible vaut le coup ; les vases du chemin se brisent d'un coup au passage.
// Lot BR4 : il ne se laisse plus BLOQUER (`suivreLeProgres` : sans progrès pendant `BLOCAGE_TICKS`, il lâche ce qu'il visait) et il a une version HUMANISÉE (`HUMAIN`) qui sert à calibrer les médailles, jamais à les fixer. Tout changement du pilote monte `RUSH_BOT_VERSION`.
// Lot BR6 : il APPREND les nouveaux ennemis — le chaman et le totem d'abord (le bouclier du chaman et les gélatons du totem durent tant qu'ils vivent), le porte-bouclier par le flanc (sa garde para les coups de face), les projectiles du cracheur
// esquivés (de côté, puis l'esquive au dernier moment) — et il combat la salle d'épreuve (portes fermées : il chasse les vagues, sans naviguer).
// La stratégie « nettoyer » d'avant (une mesure, pas un Diamant) va d'abord à chaque monstre, du plus proche au plus loin, puis à l'arène : elle donne l'écart de temps entre foncer et tout nettoyer.

/** La direction de la croix (0 à 31) la plus proche d'un vecteur. */
const croix = (dx: number, dy: number): number => Math.trunc((dirVers(dx, dy) + 2) / 4) % 32;

export type Strategie = "foncer" | "peu" | "beaucoup";
export const STRATEGIES: readonly Strategie[] = ["foncer", "peu", "beaucoup"];
/** « Un peu d'XP » : un camp est « proche » quand le détour qui y mène est à cette distance (cm) du chemin principal au plus. */
export const SEUIL_PEU_CM = 3200;
/** Les cartes de chaque stratégie, de la plus voulue à la moins voulue (la première proposée est prise ; sinon la première carte offerte). */
export const PRIORITES: Readonly<Record<Strategie, readonly string[]>> = {
  foncer: ["bottes-legeres", "lame-lourde", "brise-pierre", "cadence", "esquive-vive", "moulinet", "onde-epee", "maitrise", "allonge", "recharge-vive", "coeur-en-plus", "soin", "signature", "echo", "esquive-longue", "vol-de-vie", "esquive-tranchante", "aimant"],
  peu: ["bottes-legeres", "lame-lourde", "brise-pierre", "cadence", "moulinet", "onde-epee", "maitrise", "allonge", "recharge-vive", "esquive-vive", "coeur-en-plus", "soin", "signature", "echo", "vol-de-vie", "esquive-longue", "esquive-tranchante", "aimant"],
  beaucoup: ["bottes-legeres", "moulinet", "recharge-vive", "cadence", "lame-lourde", "maitrise", "brise-pierre", "onde-epee", "signature", "allonge", "echo", "vol-de-vie", "aimant", "coeur-en-plus", "soin", "esquive-vive", "esquive-longue", "esquive-tranchante"],
};

/**
 * Lot BR5 — LA COMPÉTENCE du pilote, choisie au départ d'après le boss du jour (que tout le monde connaît) : la foule (la reine gelée, le vieux chêne et ses gelées) au tourbillon, le grand-duc (qui se joue à distance) au bouclier, le golem et le bélier
 * (qu'il faut aborder) au bond. Le pilote humanisé ne connaît pas le boss : le tourbillon, la compétence de la horde.
 */
export function competenceDuPilote(boss: number, humain = false): number {
  if (humain) return C_TOURBILLON;
  return boss === B_REINE || boss === B_CHENE ? C_TOURBILLON : boss === B_DUC ? C_BOUCLIER : C_BOND;
}

/**
 * Lot BR4 — LE PILOTE HUMANISÉ : un joueur qui n'est pas parfait. Le pilote de référence lit les annonces sans erreur, répond au tick près et connaît le boss ; celui-ci a (1) une **réaction retardée** (`reaction`, 12 ticks = 200 ms : ce qui le surprend — un anneau, un monstre
 * qui plonge ou qui arrive sur lui, une annonce qui apparaît — n'est traité qu'après cette durée), (2) une **lecture des annonces parfois tardive** (`tardifPct` % des annonces ne sont remarquées que
 * `tardifMax` ticks au plus après leur apparition), (3) une **esquive imparfaite** (`gigue` ticks de part et d'autre du bon moment, `rateEsquivePct` % d'esquives oubliées) et (4) **aucune connaissance du boss ni des cartes à venir** : il n'attire pas le bélier,
 * ne se poste pas pour le grand-duc, et choisit ses cartes dans la liste générale de sa stratégie. Tout le hasard vient d'une graine (celle du jour) : une partie humanisée se rejoue à l'identique. Il sert à CALIBRER les médailles
 * (leçon de Blocks : le robot parfait est très loin des joueurs), jamais à les fixer : `tools/medailles.ts`.
 */
export interface ProfilHumain {
  reaction: number;
  tardifPct: number;
  tardifMax: number;
  rateEsquivePct: number;
  gigue: number;
}
export const HUMAIN: ProfilHumain = { reaction: 12, tardifPct: 25, tardifMax: 40, rateEsquivePct: 10, gigue: 4 };
/** Ce que le pilote humanisé a décidé d'une annonce, la première fois qu'il la voit. */
interface VueZone {
  vue: number;
  retard: number;
  gigue: number;
  rate: boolean;
}

/** Ce que le pilote retient d'un tick à l'autre (la stratégie « foncer » n'en a pas besoin). */
export interface EtatPilote {
  strategie: Strategie;
  /** « nettoyer » : le monstre visé, le champ de distance vers sa case et la case pour laquelle il a été calculé. */
  cible: number;
  champ: Uint16Array | null;
  champCase: number;
  champDepuis: number;
  /** « peu » et « beaucoup » : −2, tous les monstres ; un indice de clairière : seulement les monstres de ce camp ; −1 : seulement ceux du chemin principal (groupes et épars). */
  camp: number;
  /** « peu » : les camps proches (indices de clairière), en plus des monstres du chemin ; `null` : on s'en tient à `camp`. */
  camps: ReadonlySet<number> | null;
  /** Anti-blocage : où il était au tick d'avant et depuis combien de ticks il veut avancer sans bouger (un coin de mur le retient). */
  px: number;
  py: number;
  immobile: number;
  /** Lot BR4 — anti-blocage GÉNÉRIQUE : l'ancre (où et quand le pilote a fait un progrès pour la dernière fois), la signature du progrès, ce que le pilote visait (`focus`, 0 : rien) et les cibles qu'il laisse tomber jusqu'à un tick (`ignores`). */
  ancreX: number;
  ancreY: number;
  ancreT: number;
  signature: number;
  focus: number;
  ignores: Map<number, number>;
  /** Combien de blocages d'affilée sans cible à lâcher (le pilote pousse alors de côté, de plus en plus longtemps). */
  contourne: number;
  contourneJusqua: number;
  /** Lot BR4 : combien de blocages le pilote a détectés dans la partie (un chiffre de mesure). */
  blocages: number;
  /** Lot BR4 — le pilote humanisé : son profil (`null` : le pilote de référence), son hasard, ce qu'il a décidé de chaque annonce et ce qu'il a fait il y a `reaction` ticks. */
  humain: ProfilHumain | null;
  alea: number;
  vues: Map<string, VueZone>;
  /** Depuis quand (et dernière fois vu) chaque chose que le pilote humanisé doit « remarquer » est là (`percu`). */
  depuis: Map<string, [number, number]>;
}
export const etatPilote = (strategie: Strategie = "foncer", camp = -2, p?: Partie, seuilPeu = SEUIL_PEU_CM, humain: ProfilHumain | null = null): EtatPilote => ({
  strategie,
  cible: -1,
  champ: null,
  champCase: -1,
  champDepuis: -1e9,
  camp: strategie === "peu" ? -1 : camp,
  px: -1,
  py: -1,
  immobile: 0,
  ancreX: -1,
  ancreY: -1,
  ancreT: 0,
  signature: -1,
  focus: 0,
  ignores: new Map(),
  contourne: 0,
  contourneJusqua: -1,
  blocages: 0,
  humain,
  alea: ((p?.contenu.graine ?? 1) ^ 0x9e3779b9) >>> 0,
  vues: new Map(),
  depuis: new Map(),
  camps: strategie === "peu" && p?.niveau ? new Set(p.niveau.detours.filter((d) => d.distanceCm <= seuilPeu).map((d) => d.camp)) : null,
});

/** Les gemmes que le pilote qui chasse ramasse : celles à moins de ce chemin (cm) de lui. */
const RAYON_GEMMES = 700;

/** Le camp d'un monstre du niveau (ses identifiants suivent l'ordre du niveau). */
const campDe = (p: Partie, id: number): number => p.niveau!.monstres[id - 1]?.camp ?? -1;

/** La direction (0 à 31) du pas vers la case voisine qui descend le champ de distance ; −1 si on y est. */
function pasVers(p: Partie, champ: Uint16Array): number {
  const n = p.niveau!;
  const idx = caseDe(n, p.c.x, p.c.y);
  const s = idx < 0 ? -1 : descendre(n, champ, idx);
  if (s < 0) return -1;
  const [tx, ty] = centreDeCase(n, s);
  return croix(tx - p.c.x, ty - p.c.y);
}

/** Lot BR4 — « sans progrès pendant N ticks » : au bout de 2,5 s sans qu'un monstre, un obstacle, une gemme ou l'XP n'ait changé et sans s'être éloigné de plus de 1,5 m de son ancre, le pilote lâche ce qu'il visait. */
export const BLOCAGE_TICKS = 150;
const BLOCAGE_CM = 150;
/** Une cible lâchée n'est plus visée pendant 15 s (un monstre derrière un mur peut l'attendre longtemps : il n'en est pas moins hors d'atteinte). */
const IGNORE_TICKS = 900;
const cleVase = (id: number): number => 1_000_000_000 + id;
const ignore = (p: Partie, etat: EtatPilote, id: number): boolean => (etat.ignores.get(id) ?? 0) > p.tick;

/**
 * Le suivi du progrès (lot BR4) : à appeler à chaque tick de navigation. Retourne vrai quand le pilote est bloqué depuis `BLOCAGE_TICKS` ; il a alors déjà décidé quoi faire : lâcher ce qu'il visait (il change de point de passage), sinon
 * pousser de côté un moment, de plus en plus longtemps. (Le jour 295 de la mesure du lot BR3 : 30 s coincé devant un mur à viser deux gelées qui ne pouvaient pas l'atteindre.)
 */
function suivreLeProgres(p: Partie, etat: EtatPilote): void {
  const c = p.c;
  let vivants = 0;
  let pvProches = 0;
  for (const m of p.monstres) {
    if (m.hp <= 0) continue;
    vivants++;
    if (distance(c.x, c.y, m.x, m.y) < cm(500)) pvProches += m.hp;
  }
  const signature = vivants * 1_000_000 + p.vases.length * 100_000 + p.xp * 7 + pvProches;
  if (signature !== etat.signature || distance(c.x, c.y, etat.ancreX, etat.ancreY) > cm(BLOCAGE_CM)) {
    etat.signature = signature;
    etat.ancreX = c.x;
    etat.ancreY = c.y;
    etat.ancreT = p.tick;
    etat.contourne = 0;
    return;
  }
  if (p.tick - etat.ancreT < BLOCAGE_TICKS) return;
  // bloqué : lâcher la cible, sinon contourner
  etat.ancreT = p.tick;
  etat.blocages++;
  if (etat.focus !== 0) {
    etat.ignores.set(etat.focus, p.tick + IGNORE_TICKS);
    if (etat.cible === etat.focus) {
      etat.cible = -1;
      etat.champCase = -1;
    }
  } else {
    etat.contourne++;
    etat.contourneJusqua = p.tick + 30 * etat.contourne;
  }
}

/** Lot BR6 — ce que vaut de tuer un type en premier : le chaman (qui protège tout le monde) puis le totem (qui invoque) puis le cracheur, en centimètres de distance « gagnée » dans le choix de la cible. */
const BONUS_CIBLE: readonly number[] = [0, 0, 0, 600, 1500, 1200, 0];

/**
 * Lot BR6 — le point d'où frapper un porte-bouclier SANS que sa garde pare le coup : sur son flanc (112° de son bouclier), du côté où se trouve déjà le chevalier, à portée de coup. Le bouclier se tourne lentement (56°/s) et le chevalier tourne plus vite autour de lui.
 */
function flancDe(p: Partie, m: Monstre): { x: number; y: number } {
  const c = p.c;
  const a = dirVers(c.x - m.x, c.y - m.y);
  const ecart = ((a - m.face + 64 + 128) % 128) - 64;
  const cote = ecart >= 0 ? 1 : -1;
  const k = (((m.face + cote * 40) % 128) + 128) % 128;
  const r = p.rayonM(m) + RAYON_CHEVALIER + cm(110);
  return { x: m.x + Math.trunc((COS[k]! * r) / 1024), y: m.y + Math.trunc((SIN[k]! * r) / 1024) };
}

/** Dans le niveau, avant l'arène : où aller et quoi frapper. */
function naviguer(p: Partie, etat: EtatPilote): { direction: number; coup: boolean } {
  const n = p.niveau!;
  const c = p.c;
  const aLArene = (): number => {
    const d = pasVers(p, n.dist);
    return d >= 0 ? d : croix(n.arene.x - c.x, n.arene.y - c.y);
  };
  // Les monstres qui barrent la route : tout proches, ou sur les quelques pas qui viennent.
  const idx = caseDe(n, c.x, c.y);
  let devant: [number, number] = [c.x, c.y];
  if (idx >= 0) {
    let k = idx;
    for (let i = 0; i < 3; i++) {
      const s = descendre(n, n.dist, k);
      if (s < 0) break;
      k = s;
    }
    devant = centreDeCase(n, k);
  }
  let bloque: { x: number; y: number; r: number; id: number; m?: Monstre } | null = null;
  let meilleur = Infinity;
  // Lot BR5 : une meute qui arrive (trois ennemis éveillés à moins de 5 m) ne se traverse pas en marchant : même « foncer » s'arrête pour la faucher.
  let proches = 0;
  for (const m of p.actifs) if (m.hp > 0 && m.alerte !== 0 && distance2(c.x, c.y, m.x, m.y) < cm(500) * cm(500)) proches++;
  const mobbe = proches >= 3;
  for (const m of p.monstres) {
    if (m.hp <= 0 || m.x - c.x > cm(400) || c.x - m.x > cm(400) || m.y - c.y > cm(400) || c.y - m.y > cm(400) || ignore(p, etat, m.id)) continue;
    const d = distance(c.x, c.y, m.x, m.y);
    const barre = etat.strategie !== "foncer" || mobbe ? d < cm(360) : d < cm(170) || (d < cm(300) && distance(m.x, m.y, devant[0], devant[1]) < cm(240));
    // Lot BR6 : un chaman ou un totem éveillé à portée passe avant le reste
    const note = d - (m.alerte === 1 || m.laisse === 0 ? BONUS_CIBLE[m.type]! : 0);
    if (barre && note < meilleur) {
      meilleur = note;
      bloque = { x: m.x, y: m.y, r: p.rayonM(m), id: m.id, m };
    }
  }
  etat.focus = 0;
  // Lot BR5 : une meute ou un camp qui s'éveille à moins de 10 m et qui n'est pas encore sur nous : on freine et on tient sa ligne (la course s'arrête quand on s'arrête) au lieu de foncer dedans à 7,5 m/s.
  if (p.course > 0 && !bloque) {
    let eveilles = 0;
    for (const m of p.actifs) if (m.hp > 0 && m.alerte === 1 && distance2(c.x, c.y, m.x, m.y) < cm(1000) * cm(1000)) eveilles++;
    if (eveilles >= 3) return { direction: -1, coup: false };
  }
  const portee = p.porteeCoup(0) - cm(50);
  // `champ` : un obstacle encore loin se rejoint en suivant le champ de distance (la ligne droite peut buter sur un mur et le bloquer pour toujours).
  const frapper = (b: { x: number; y: number; r: number; m?: Monstre }, champ?: Uint16Array): { direction: number; coup: boolean } => {
    const d = distance(c.x, c.y, b.x, b.y) - b.r - RAYON_CHEVALIER;
    // Lot BR6 : un porte-bouclier dont la garde parerait le coup se contourne par le flanc
    if (b.m && p.garde(b.m, c.x, c.y) && d < cm(500)) {
      const f = flancDe(p, b.m);
      return { direction: croix(f.x - c.x, f.y - c.y), coup: false };
    }
    if (d <= portee) return { direction: -1, coup: true };
    const pas = champ ? pasVers(p, champ) : -1;
    return { direction: pas >= 0 ? pas : croix(b.x - c.x, b.y - c.y), coup: false };
  };
  // Lot BR6 — la salle d'épreuve : les portes sont fermées, il chasse les vagues, le chaman et le totem d'abord ; entre deux vagues il attend au centre.
  if (p.epreuve.etat === 1) {
    let cible: Monstre | null = null;
    let note = Infinity;
    for (const m of p.actifs) {
      if (m.hp <= 0 || m.vague === 0 || ignore(p, etat, m.id)) continue;
      const v = distance(c.x, c.y, m.x, m.y) - BONUS_CIBLE[m.type]!;
      if (v < note) {
        note = v;
        cible = m;
      }
    }
    if (cible) {
      etat.focus = cible.id;
      return frapper({ x: cible.x, y: cible.y, r: p.rayonM(cible), m: cible });
    }
    const e = n.epreuve;
    return { direction: distance(c.x, c.y, e.x, e.y) > cm(250) ? croix(e.x - c.x, e.y - c.y) : -1, coup: false };
  }
  // Lot BR6 — un chaman ou un totem éveillé à moins de 11 m passe avant tout le reste, même loin : tant qu'il vit, son bouclier ou ses gélatons protègent les autres.
  {
    let prio: Monstre | null = null;
    let dp = Infinity;
    for (const m of p.actifs) {
      if ((m.type !== CHAMAN && m.type !== TOTEM) || m.hp <= 0 || m.alerte !== 1 || ignore(p, etat, m.id)) continue;
      const d = distance(c.x, c.y, m.x, m.y);
      if (d < cm(1100) && d < dp) {
        dp = d;
        prio = m;
      }
    }
    if (prio) bloque = { x: prio.x, y: prio.y, r: p.rayonM(prio), id: prio.id, m: prio };
  }
  if (bloque) {
    etat.focus = bloque.id;
    // Lot BR5 : on ne se jette pas dans une foule (le coup d'élan pousse le chevalier au milieu d'elle) : il freine d'abord, la course tombe en quelques ticks, puis il frappe.
    if (mobbe && p.course >= 30) return { direction: -1, coup: false };
    return frapper(bloque);
  }
  // Lot BR5 : un vase sur les pas qui viennent le long d'un champ de distance (il est plein pour le chevalier) : on le brise, un coup suffit.
  const obstacleSur = (champ: Uint16Array): { x: number; y: number; r: number; id: number } | null => {
    if (p.vases.length === 0 || idx < 0) return null;
    let k = idx;
    let [ax, ay] = [c.x, c.y];
    for (let i = 0; i < 3; i++) {
      const s = descendre(n, champ, k);
      if (s < 0) break;
      k = s;
      const [bx, by] = centreDeCase(n, k);
      for (const v of p.vases) {
        if (v.id < 0 || ignore(p, etat, cleVase(v.id))) continue;
        const [qx, qy] = pointDuSegment(v.x, v.y, ax, ay, bx, by);
        if (distance(v.x, v.y, qx, qy) < v.r + RAYON_CHEVALIER + cm(35)) return { x: v.x, y: v.y, r: v.r, id: cleVase(v.id) };
      }
      ax = bx;
      ay = by;
    }
    return null;
  };
  const vises = (m: { id: number; hp: number }): boolean => m.hp > 0 && !ignore(p, etat, m.id) && (etat.camps ? campDe(p, m.id) === -1 || etat.camps.has(campDe(p, m.id)) : etat.camp === -2 || campDe(p, m.id) === etat.camp);
  // Lot BR2 : qui chasse ramasse aussi les gemmes proches (l'aimant n'en prend que dans 3 m : un monstre repoussé meurt parfois plus loin). Une gemme est une cible d'identifiant négatif.
  const GEMME = -1000;
  // (un cœur attend au sol tant que les cœurs sont pleins : le pilote ne le poursuit pas)
  const gemmesProches = etat.strategie !== "foncer" ? p.gemmes.filter((g) => distance(c.x, c.y, g.x, g.y) < cm(RAYON_GEMMES) && !ignore(p, etat, GEMME - g.id) && !(g.k === 2 && c.coeurs >= c.coeursMax)) : [];
  if (etat.strategie !== "foncer" && (p.monstres.some(vises) || gemmesProches.length > 0)) {
    // La cible la plus proche par le chemin (monstre visé ou gemme) : un champ de distance depuis la case du chevalier.
    type Cible = { id: number; x: number; y: number };
    const toutes: Cible[] = [...p.monstres.filter(vises), ...gemmesProches.map((g) => ({ id: GEMME - g.id, x: g.x, y: g.y }))];
    let cible: Cible | undefined = toutes.find((m) => m.id === etat.cible);
    if (!cible) {
      const depuis = champDeDistance(n, idx >= 0 ? [idx] : []);
      let dm = Infinity;
      for (const m of toutes) {
        const k = caseDe(n, m.x, m.y);
        // Le détour que la cible coûte : le chemin jusqu'à elle PLUS ce qui lui reste jusqu'à l'arène (la moins coûteuse à insérer sur la route ; une cible qu'on ne peut pas rejoindre ne compte pas).
        const dk = k >= 0 && depuis[k]! !== INACCESSIBLE ? depuis[k]! + n.dist[k]! : INACCESSIBLE;
        // une gemme avant un monstre à coût égal : l'XP posée au sol est la plus sûre
        if (dk < dm || (dk === dm && m.id <= GEMME)) {
          dm = dk;
          cible = m;
        }
      }
      etat.cible = cible ? cible.id : -1;
      etat.champCase = -1;
    }
    if (cible) {
      const kc = caseDe(n, cible.x, cible.y);
      if (kc >= 0 && (kc !== etat.champCase || p.tick - etat.champDepuis > 60)) {
        etat.champ = champDeDistance(n, [kc]);
        etat.champCase = kc;
        etat.champDepuis = p.tick;
      }
      const gene = etat.champ ? obstacleSur(etat.champ) : null;
      if (gene) {
        etat.focus = gene.id;
        return frapper(gene, etat.champ ?? undefined);
      }
      etat.focus = cible.id;
      const d = etat.champ ? pasVers(p, etat.champ) : -1;
      return { direction: d >= 0 ? d : croix(cible.x - c.x, cible.y - c.y), coup: false };
    }
  }
  const gene = obstacleSur(n.dist);
  if (gene) {
    etat.focus = gene.id;
    return frapper(gene, n.dist);
  }
  return { direction: aLArene(), coup: false };
}

/**
 * La direction pour s'éloigner d'un point : parmi 16 directions, celle qui, un pas plus loin, est la plus éloignée du danger sans entrer dans le boss ni sortir de l'arène (contre le muret ou le boss, partir tout droit ne mène nulle part :
 * on glisse le long). Hors de l'arène (avant la barrière), tout droit.
 */
function fuirDe(p: Partie, de: { x: number; y: number }): number {
  const c = p.c;
  const fx = c.x - de.x;
  const fy = c.y - de.y;
  if (p.niveau && p.barriere < 0) return croix(fx, fy);
  const g = p.golem;
  const pas = cm(160);
  let meilleur = croix(fx, fy);
  let note = -Infinity;
  for (let k = 0; k < 32; k += 2) {
    const nx = c.x + Math.trunc((COS[k * 4]! * pas) / 1024);
    const ny = c.y + Math.trunc((SIN[k * 4]! * pas) / 1024);
    let n = distance(nx, ny, de.x, de.y);
    if (distance(nx, ny, p.ax, p.ay) > RAYON_ARENE - RAYON_CHEVALIER - cm(20)) n -= cm(600);
    if (g && g.hp > 0 && g.sol === 1 && distance(nx, ny, g.x, g.y) < g.r + RAYON_CHEVALIER + cm(20)) n -= cm(600);
    // à égalité, on préfère le centre de l'arène (on y a de la place)
    // (face au bélier, c'est l'inverse : on reste contre le muret pour que sa charge s'y écrase)
    n -= Math.trunc((distance(nx, ny, p.ax, p.ay) / 40) * (g && g.kind === B_BELIER ? -1 : 1));
    if (n > note) {
      note = n;
      meilleur = k;
    }
  }
  return meilleur;
}

/** Un entier tiré du hasard du pilote humanisé (congruentiel linéaire : ni `Math.random` ni horloge), de 0 à `n` − 1. */
function tirer(etat: EtatPilote, n: number): number {
  etat.alea = (Math.imul(etat.alea, 1664525) + 1013904223) >>> 0;
  return (etat.alea >>> 8) % n;
}
/** Ce que le pilote humanisé a décidé d'une annonce : créé à la première vue, gardé tant qu'elle existe. */
function vueDe(p: Partie, etat: EtatPilote, z: { type: number; ti: number; x: number; y: number }): VueZone {
  const cle = `${z.type}:${z.ti}:${z.x}:${z.y}`;
  let v = etat.vues.get(cle);
  if (!v) {
    const h = etat.humain!;
    v = { vue: p.tick, retard: tirer(etat, 100) < h.tardifPct ? 10 + tirer(etat, Math.max(1, h.tardifMax - 9)) : 0, gigue: tirer(etat, 2 * h.gigue + 1) - h.gigue, rate: tirer(etat, 100) < h.rateEsquivePct };
    etat.vues.set(cle, v);
    if (etat.vues.size > 64) for (const [k] of etat.vues) { etat.vues.delete(k); if (etat.vues.size <= 32) break; }
  }
  return v;
}
/**
 * La RÉACTION du pilote humanisé : ce qui le surprend (`vrai` : un monstre sur lui, un anneau qui approche…) n'est traité qu'après `reaction` ticks de présence continue ; le pilote de référence réagit à l'instant. À appeler à chaque tick pour la même `cle`.
 */
function percu(p: Partie, etat: EtatPilote, cle: string, vrai: boolean): boolean {
  const h = etat.humain;
  if (!h) return vrai;
  if (!vrai) {
    etat.depuis.delete(cle);
    return false;
  }
  const v = etat.depuis.get(cle);
  if (!v || p.tick - v[1] > 1) {
    etat.depuis.set(cle, [p.tick, p.tick]);
    return h.reaction <= 0;
  }
  v[1] = p.tick;
  return p.tick - v[0] >= h.reaction;
}

/** Un ennemi éveillé : un monstre qui poursuit (ou n'a pas de laisse) ou le boss réveillé. */
const eveille = (m: { laisse: number; alerte: number }): boolean => m.laisse === 0 || m.alerte === 1;

/**
 * Lot BR5 — la compétence : le pilote la lance dès qu'elle est rechargée et que la cible vaut le coup. Rend la direction (0 à 31) vers laquelle appuyer — ou −2 pour « sans changer la direction » —, ou `null` pour ne rien lancer.
 * Tourbillon : au moins trois ennemis éveillés tout autour, ou le boss à portée. Bond : un groupe (ou le boss) à 4 à 9 m, que l'onde de choc écrasera. Bouclier : un ennemi (ou deux alignés, ou le boss) à 3 à 9 m en ligne droite.
 */
function competenceDuMoment(p: Partie): number | null {
  const c = p.c;
  if (!p.competencePrete) return null;
  const g = p.golem && p.golem.hp > 0 && p.golemEveille && p.golem.etat !== 3 ? p.golem : null;
  const ennemis: { x: number; y: number; r: number; boss: boolean }[] = [];
  for (const m of p.actifs) if (m.hp > 0 && eveille(m)) ennemis.push({ x: m.x, y: m.y, r: p.rayonM(m), boss: false });
  if (g) ennemis.push({ x: g.x, y: g.y, r: g.r, boss: true });
  if (ennemis.length === 0) return null;
  const d = (e: { x: number; y: number; r: number }): number => distance(c.x, c.y, e.x, e.y) - e.r;
  if (c.comp === C_TOURBILLON) {
    const rayon = p.rayonTourbillon() - cm(30);
    const dedans = ennemis.filter((e) => d(e) <= rayon);
    return dedans.length >= 3 || dedans.some((e) => e.boss) ? -2 : null;
  }
  let cible = ennemis[0]!;
  for (const e of ennemis) if (d(e) < d(cible)) cible = e;
  // Lot BR6 : un chaman éveillé à portée (3 à 9 m) est visé de préférence (le bond l'atteint derrière la foule, le bouclier lancé la traverse)
  if (c.comp !== C_TOURBILLON) {
    for (const m of p.actifs) {
      if (m.type !== CHAMAN || m.hp <= 0 || !eveille(m)) continue;
      const dm = distance(c.x, c.y, m.x, m.y);
      if (dm > cm(300) && dm < cm(850)) cible = { x: m.x, y: m.y, r: p.rayonM(m), boss: true };
    }
  }
  const v = croix(cible.x - c.x, cible.y - c.y);
  if (c.comp === C_BOND) {
    const portee = d(cible) + cible.r;
    if (portee < cm(400) || portee > cm(900)) return null;
    const autour = ennemis.filter((e) => distance(e.x, e.y, cible.x, cible.y) < p.rayonBond() - cm(40)).length;
    return autour >= 2 || cible.boss ? v : null;
  }
  // bouclier
  const portee = distance(c.x, c.y, cible.x, cible.y);
  if (portee < cm(300) || portee > cm(850)) return null;
  const [ux, uy] = unitaire(cible.x - c.x, cible.y - c.y);
  const alignes = ennemis.filter((e) => {
    const t = ((e.x - c.x) * ux + (e.y - c.y) * uy) / 1024;
    return t > 0 && Math.abs(((e.x - c.x) * -uy + (e.y - c.y) * ux) / 1024) < e.r + cm(50);
  }).length;
  return alignes >= 2 || cible.boss ? v : null;
}

export function pilote(p: Partie, etat: EtatPilote = etatPilote()): number {
  const c = p.c;
  const tick = p.tick;
  const h = etat.humain;
  // 1. Les cercles qui vont tomber : partir, et esquiver au dernier moment.
  let fuite: { x: number; y: number } | null = null;
  let esquiver = false;
  let dirEsquive = -1;
  for (const z of p.zones) {
    const reste = z.ti - tick;
    if (z.type === Z_INVOCATION) continue; // un anneau qui annonce une naissance : aucun danger
    // Lot BR4 : le pilote humanisé remarque l'annonce après sa réaction (et parfois bien plus tard), anticipe le minuteur de sa réaction et de sa gigue, et oublie parfois d'esquiver.
    const vz = h ? vueDe(p, etat, z) : null;
    if (vz && tick - vz.vue < h!.reaction + vz.retard) continue;
    const anti = vz ? vz.gigue : 0;
    const peutEsquiver = !vz || !vz.rate;
    if (z.type === Z_BANDE) {
      // Lot BR3 : une bande (plongeon, charge, racines) : on s'en écarte par le côté ; on esquive à travers si on y est encore à l'arrivée.
      const [bx, by] = pointDuSegment(c.x, c.y, z.x, z.y, z.x2, z.y2);
      const db = distance(c.x, c.y, bx, by);
      if (reste <= 90 && db < z.r + cm(130)) {
        // sur la ligne même : on part de travers
        fuite = db > 0 ? { x: bx, y: by } : { x: c.x - (z.y2 - z.y), y: c.y + (z.x2 - z.x) };
        if (reste <= (c.etat === COUP ? 16 : 8) + anti && db < z.r && peutEsquiver) esquiver = true;
      }
      continue;
    }
    const d = distance(c.x, c.y, z.x, z.y);
    if (z.type === Z_SPORES) {
      if (reste <= 90 && d < z.r + cm(150)) {
        fuite = { x: z.x, y: z.y };
        // un coup en cours retient (40 % de la vitesse) : l'esquive le coupe et emporte hors du nuage
        if (d < z.r && peutEsquiver && (reste <= 22 + anti || (reste <= 55 + anti && c.etat === COUP))) {
          esquiver = true;
          dirEsquive = croix(c.x - z.x, c.y - z.y);
        }
      }
      continue;
    }
    if (z.type === ONDE) {
      // L'anneau part du bord du golem à `ti` et file à la vitesse de l'onde (`vOnde`, 9,5 m/s au rythme 100 %) : on esquive quand il est à moins de trois ticks de nous.
      // (lot BR0c : le bord de l'anneau touche dès qu'il est à ~80 cm : collé au golem, le chevalier doit déjà esquiver à l'instant où l'onde part)
      const arrivee = reste + Math.max(0, Math.trunc((d - (p.golem?.r ?? cm(170)) - cm(80)) / p.vOnde()));
      if (arrivee <= 3 + anti && d < z.r && peutEsquiver) {
        esquiver = true;
        dirEsquive = croix(z.x - c.x, z.y - c.y); // à travers l'anneau, vers le golem
      }
      continue;
    }
    // Lot BR0c : un coup dure 30 ticks et engage le chevalier (il ne marche qu'à 40 % de sa vitesse tant qu'il frappe) : il part dès que le cercle est posé, et esquive (ce qui coupe le coup) s'il est encore dedans à l'approche.
    if (reste <= 80 && d < z.r + cm(z.r > cm(300) ? 70 : 150)) {
      fuite = { x: z.x, y: z.y };
      if (reste <= (c.etat === COUP ? 16 : 8) + anti && d < z.r && peutEsquiver) esquiver = true;
    }
  }
  // 2. Les ondes : l'esquive quand l'anneau arrive.
  for (const o of p.ondes) {
    const d = distance(c.x, c.y, o.x, o.y);
    // Lot BR4 : un anneau qui approche se voit venir de loin ; le pilote humanisé l'esquive avec la gigue de son geste (±4 ticks, 64 cm) et l'oublie parfois.
    const vr = h ? vueDe(p, etat, { type: -1, ti: 0, x: o.x, y: o.y }) : null;
    if (!o.touche && Math.abs(d - o.r) < cm(110) + (vr ? vr.gigue * cm(16) : 0) && o.r < d + cm(40) && !vr?.rate) {
      esquiver = true;
      dirEsquive = croix(o.x - c.x, o.y - c.y);
    }
  }
  // Lot BR3 : un nuage de spores : on n'y reste pas.
  for (const n of p.nuages) if (distance(c.x, c.y, n.x, n.y) < n.r + cm(120)) fuite = { x: n.x, y: n.y };
  // 3. Un monstre qui fonce sur nous : l'esquive est gardée pour l'onde quand elle approche (lot BR0c : l'esquive met 40 ticks à revenir).
  const ondeProche = p.zones.some((z) => z.type === ONDE && z.ti - tick <= 60) || p.ondes.some((o) => !o.touche);
  // Lot BR6 : plus de dégât de contact — on esquive ce qui est ANNONCÉ et arrive : le bond d'une gelée ou d'un gélaton (pendant son bond), le plongeon d'une chauve-souris.
  for (const m of p.actifs) {
    if (c.degat > 0 || m.gel > 0 || ondeProche || m.hp <= 0) continue;
    const d = distance(c.x, c.y, m.x, m.y);
    let danger = false;
    if (m.type === CHAUVE) danger = m.etat === PLONGEON && d < cm(230);
    else if (m.type === GELEE || m.type === GELATON) {
      const du = p.dureesDe(m);
      const a = m.type === GELATON ? du.gelatonAnnonce : du.geleeAnnonce;
      const b = m.type === GELATON ? du.gelatonBond : du.geleeBond;
      danger = m.alerte !== 2 && m.t >= a && m.t < a + b && d < cm(48 + 42 + 70);
    }
    if (percu(p, etat, `e${m.id}`, danger)) esquiver = true;
  }
  // Lot BR6 : les projectiles des cracheurs — on se décale s'ils arrivent (de côté), on esquive au dernier moment ; un coup les détruit aussi, mais on ne parie pas dessus.
  let lateral: { dx: number; dy: number } | null = null;
  for (const q of p.projectiles) {
    const rx = c.x - q.x;
    const ry = c.y - q.y;
    const v2 = q.vx * q.vx + q.vy * q.vy;
    if (v2 === 0) continue;
    const tcpa = (rx * q.vx + ry * q.vy) / v2;
    if (tcpa < 0 || tcpa > 40) continue;
    const px = rx - q.vx * tcpa;
    const py = ry - q.vy * tcpa;
    if (Math.hypot(px, py) > cm(26) + RAYON_CHEVALIER + cm(30)) continue;
    if (!percu(p, etat, `q${q.id}`, true)) continue;
    // le côté : celui où le chevalier se trouve déjà par rapport à la ligne du tir
    const cote = px * -q.vy + py * q.vx >= 0 ? 1 : -1;
    const dx = -q.vy * cote;
    const dy = q.vx * cote;
    if (tcpa <= 7 && c.attente === 0 && (!h || tirer(etat, 100) >= h.rateEsquivePct)) {
      esquiver = true;
      dirEsquive = croix(dx, dy);
    } else lateral = { dx, dy };
  }

  // 4. Dans le niveau, avant l'arène : naviguer (et ne frapper que ce qui barre la route). Dans l'arène : le combat.
  if (p.niveau && p.barriere < 0) {
    suivreLeProgres(p, etat);
    const nav = naviguer(p, etat);
    // Lot BR6 : un projectile qui arrive : on se décale d'abord (le coup attendra)
    if (lateral) {
      nav.direction = croix(lateral.dx, lateral.dy);
      nav.coup = false;
    }
    // Lot BR4 : bloqué sans rien à lâcher : il pousse de côté un moment (le côté change à chaque fois).
    if (p.tick < etat.contourneJusqua && nav.direction >= 0 && !nav.coup) nav.direction = (nav.direction + (etat.contourne % 2 === 0 ? 8 : 24)) % 32;
    // Coincé contre le coin d'un mur en voulant avancer : il se décale de côté (alternativement) jusqu'à repartir.
    etat.immobile = nav.direction >= 0 && !nav.coup && c.x === etat.px && c.y === etat.py ? etat.immobile + 1 : 0;
    etat.px = c.x;
    etat.py = c.y;
    if (etat.immobile > 12 && nav.direction >= 0) nav.direction = (nav.direction + (etat.immobile % 48 < 24 ? 6 : 26)) % 32;
    const esq = esquiver && c.attente === 0;
    const dirNav = esq && dirEsquive >= 0 ? dirEsquive : esq && nav.direction < 0 ? croix(c.x - (p.niveau.arene.x), c.y - p.niveau.arene.y) : nav.direction;
    const comp = !fuite && !esquiver ? competenceDuMoment(p) : null;
    return entree(comp !== null && comp >= 0 ? comp : dirNav, nav.coup, esq, -1, comp !== null);
  }
  // Où frapper : les monstres tout proches d'abord, sinon le golem.
  let cible: { x: number; y: number; r: number } | null = null;
  let meilleur = Infinity;
  for (const m of p.actifs) {
    const d = distance(c.x, c.y, m.x, m.y);
    if (d < meilleur && d < cm(360) && m.hp > 0) {
      meilleur = d;
      cible = { x: m.x, y: m.y, r: p.rayonM(m) };
    }
  }
  if (!cible && p.golem && p.golem.hp > 0) cible = { x: p.golem.x, y: p.golem.y, r: p.golem.r };
  if (!cible && p.monstres.length > 0) {
    const m = p.monstres[0]!;
    cible = { x: m.x, y: m.y, r: cm(40) };
  }

  let direction = -1;
  let coup = false;
  const g = p.golem;
  // Lot BR3 — le bélier : sa charge file droit sur le chevalier et ne s'arrête qu'au muret si celui-ci est juste derrière lui. Le pilote l'ATTIRE : il se tient contre le muret, du côté opposé au bélier, s'écarte de la ligne annoncée, puis
  // profite de l'étourdissement. (Pendant que le bélier marche ou annonce, il n'attaque que ce qui est à portée.)
  let lureX = 0;
  let lureY = 0;
  let leurre = false;
  if (!h && g && g.kind === B_BELIER && g.hp > 0 && (g.etat === MARCHE || g.etat === ANNONCE)) {
    const [ux, uy] = unitaire(c.x - g.x, c.y - g.y);
    lureX = c.x + ux * 2;
    lureY = c.y + uy * 2;
    const dx = lureX - p.ax;
    const dy = lureY - p.ay;
    const dd = distance(lureX, lureY, p.ax, p.ay);
    const max = RAYON_ARENE - cm(250);
    if (dd > max) {
      lureX = p.ax + Math.trunc((dx * max) / dd);
      lureY = p.ay + Math.trunc((dy * max) / dd);
    }
    leurre = true;
  }
  // Lot BR3 — le grand-duc : pendant qu'il plonge, le pilote file se poster à côté de l'endroit où il va se poser (au bout de la dernière bande), hors des bandes ; dès qu'il est à terre il frappe.
  let postX = 0;
  let postY = 0;
  let poster = false;
  if (!h && g && g.kind === B_DUC && g.hp > 0 && g.etat === ANNONCE) {
    let derniere: (typeof p.zones)[number] | null = null;
    for (const z of p.zones) if (z.type === Z_BANDE && (!derniere || z.ti > derniere.ti)) derniere = z;
    if (derniere) {
      const [ux, uy] = unitaire(derniere.x2 - derniere.x, derniere.y2 - derniere.y);
      // à côté du point d'atterrissage, du côté du chevalier, à une demi-largeur de bande + 1,3 m
      const cote = (c.x - derniere.x2) * -uy + (c.y - derniere.y2) * ux >= 0 ? 1 : -1;
      const dec = derniere.r + cm(140);
      postX = derniere.x2 + Math.trunc((-uy * cote * dec) / 1024);
      postY = derniere.y2 + Math.trunc((ux * cote * dec) / 1024);
      poster = true;
    }
  }
  if (fuite) direction = fuirDe(p, fuite);
  else if (poster) direction = distance(c.x, c.y, postX, postY) > cm(100) ? croix(postX - c.x, postY - c.y) : -1;
  else if (leurre && distance(c.x, c.y, lureX, lureY) > cm(120) && !(cible && cible !== null && g && distance(c.x, c.y, cible.x, cible.y) - cible.r - RAYON_CHEVALIER <= p.porteeCoup(0) - cm(50))) direction = croix(lureX - c.x, lureY - c.y);
  else if (cible) {
    const d = distance(c.x, c.y, cible.x, cible.y) - cible.r - RAYON_CHEVALIER;
    const portee = p.porteeCoup(0) - cm(50);
    // le grand-duc en l'air n'encaisse qu'un quart : on ne le poursuit pas, on l'attend (on le frappe s'il passe à portée, et surtout à terre)
    const attendre = g && g.kind === B_DUC && g.sol === 0 && cible.x === g.x && cible.y === g.y;
    if (d > portee) direction = leurre || attendre ? -1 : croix(cible.x - c.x, cible.y - c.y);
    else coup = true;
  }
  if (lateral && !fuite) {
    direction = croix(lateral.dx, lateral.dy);
    coup = false;
  }
  // Le coup est TENU : la simulation enchaîne les trois coups en boucle (lot BR0b).
  const bouton = coup;
  const esq = esquiver && c.attente === 0;
  const dirFinale = esq && dirEsquive >= 0 ? dirEsquive : esq && direction < 0 ? croix(c.x - (p.golem?.x ?? 0), c.y - (p.golem?.y ?? 0)) : direction;
  // Lot BR5 : la compétence, sauf quand un cercle ou une onde oblige à fuir ou à esquiver (le boss d'abord) ; le pilote humanisé la lance aussi, mais après sa réaction.
  let comp = !fuite && !esquiver && !poster && !leurre ? competenceDuMoment(p) : null;
  if (comp !== null && !percu(p, etat, "competence", true)) comp = null;
  return entree(comp !== null && comp >= 0 ? comp : dirFinale, comp !== null ? false : bouton, esq, -1, comp !== null);
}

/**
 * La liste de priorités d'une stratégie CONTRE un boss (lot BR3) : la première carte de la stratégie, puis les cartes que le boss favorise, puis le reste ; « Brise-pierre » passe en dernier contre un boss qui l'encaisse mal.
 * Le boss du jour est connu de tous les joueurs : un bon choix en tient compte.
 */
export function prioritesContre(strategie: Strategie, boss: number): readonly string[] {
  const base = PRIORITES[strategie];
  const def = BOSS[boss]!;
  const reste = base.filter((id) => !def.favorise.includes(id) && !(id === "brise-pierre" && def.brise < 100));
  const mal = def.brise < 100 && !def.favorise.includes("brise-pierre") ? ["brise-pierre"] : [];
  return [...reste.slice(0, 1), ...def.favorise, ...reste.slice(1), ...mal];
}

/** La carte que la stratégie prend parmi les trois proposées (l'index 0 à 2) : la première de sa liste de priorités contre le boss du jour qui est offerte, sinon la première carte. */
export function choisirCarte(p: Partie, strategie: Strategie, humain = false): number {
  const cartes = p.choix?.cartes ?? [];
  // Lot BR4 : le pilote humanisé ne connaît pas ce que le boss favorise : il suit la liste générale de sa stratégie.
  const liste = humain ? PRIORITES[strategie] : prioritesContre(strategie, p.golem?.kind ?? 0);
  let meilleur = 0;
  let rang = Infinity;
  cartes.forEach((carte, i) => {
    const r = liste.findIndex((id) => indiceAmelioration(id) === carte);
    if ((r < 0 ? 1e6 : r) < rang) {
      rang = r < 0 ? 1e6 : r;
      meilleur = i;
    }
  });
  return meilleur;
}

/**
 * Un pas du pilote (lot BR2) : si la partie attend un choix d'amélioration, il le fait (la carte de sa stratégie ; `choix` le note) ; puis il rend l'entrée du tick et la partie avance. La partie n'avance pas d'un tick quand elle vient de s'ouvrir un choix : un
 * appel suivant joue le choix, puis le tick.
 */
export function pasDuPilote(p: Partie, etat: EtatPilote, choix?: Choix[]): number {
  if (p.attenteDepart) p.choisirCompetence(competenceDuPilote(p.contenu.boss, etat.humain !== null));
  while (p.choix) {
    const carte = choisirCarte(p, etat.strategie, etat.humain !== null);
    choix?.push({ tick: p.tick, nv: p.choix.nv, carte });
    p.choisir(p.choix.nv, carte);
  }
  const e = pilote(p, etat);
  p.avancer(e);
  return e;
}

/** La partie du pilote sur un contenu : ses changements d'entrée et ses choix (la rediffusion) et son résultat. `max` borne le nombre de ticks (les mesures de plusieurs minutes). */
export function jouerLePilote(contenu: Contenu, reglages: Reglages = REGLAGES_DEFAUT, max = Infinity, strategie: Strategie = "foncer", camp = -2, humain: ProfilHumain | null = null): { changements: Changement[]; choix: Choix[]; competence: number; resultat: Resultat; ticks: number; blocages: number } {
  const p = new Partie(contenu, reglages);
  // Lot BR5 : la compétence se choisit avant de partir (le chrono ne tourne pas).
  if (p.attenteDepart) p.choisirCompetence(competenceDuPilote(contenu.boss, humain !== null));
  const competence = p.c.comp;
  const changements: Changement[] = [];
  const choix: Choix[] = [];
  const etat = etatPilote(strategie, camp, p, SEUIL_PEU_CM, humain);
  let avant = 0;
  while (!p.finie && p.tick < max) {
    // Les choix d'abord (le monde est figé), puis l'entrée du tick.
    while (p.choix) {
      const carte = choisirCarte(p, strategie, humain !== null);
      choix.push({ tick: p.tick, nv: p.choix.nv, carte });
      p.choisir(p.choix.nv, carte);
    }
    const e = pilote(p, etat);
    if (e !== avant) {
      changements.push({ tick: p.tick, e });
      avant = e;
    }
    p.avancer(e);
  }
  return { changements, choix, competence, resultat: p.resultat(), ticks: p.tick, blocages: etat.blocages };
}
