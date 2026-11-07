import { indiceAmelioration } from "./ameliorations";
import { ANNONCE, BOSS, B_BELIER, B_DUC, MARCHE, Z_BANDE, Z_INVOCATION, Z_SPORES } from "./bosses";
import { RAYON_ARENE, RAYON_CHEVALIER, cm } from "./constantes";
import { entree, type Changement } from "./entrees";
import type { Contenu } from "./generateur";
import { distance, dirVers, unitaire } from "./maths";
import { COS, SIN } from "./trig";
import { caseDe, centreDeCase, champDeDistance, descendre, INACCESSIBLE } from "./niveau";
import { CHAUVE, COUP, ONDE, PLONGEON, Partie, pointDuSegment, type Resultat } from "./partie";
import type { Choix } from "./rediffusion";
import { REGLAGES_DEFAUT, type Reglages } from "./reglagesSim";

// Le pilote : un joueur automatique qui lit l'état de la partie et rend l'octet d'entrée du tick. Il sert à trois choses : le Diamant provisoire du prototype (sa partie du jour), les mesures (une partie de
// plusieurs minutes dont les entrées ressemblent à celles d'un joueur) et les tests. **Ce n'est pas la méthode des médailles de la suite** (le README du lot BR0 la recommande). Il ne triche pas : il lit ce que lit le
// rendu (positions, cercles annoncés) et n'a que les entrées d'un joueur au doigt : le déplacement, le coup (tenu), l'esquive, sans visée (visée assistée).
// Lot BR1 : il NAVIGUE dans le niveau — le chemin le plus court sur la grille jusqu'à l'arène (le champ de distance du niveau), et il ne combat que ce qui lui barre la route : c'est le Diamant provisoire, « foncer ».
// Lot BR1b : il casse l'obstacle qui barre les pas qui viennent (le chemin le plus court passe par lui : 1 ou 2 coups) au lieu de le contourner ; la COURSE hors combat lui vient d'elle-même (il marche sans cesse et ne frappe que ce qui barre
// la route : la simulation fait monter sa vitesse après ~1,2 s de calme) ; la stratégie « nettoyer » peut ne viser que les monstres d'UN camp (la mesure du coût d'un détour : `jouerLePilote(…, camp)`).
// Lot BR2 : TROIS stratégies — FONCER (le Diamant provisoire : aucun détour), UN PEU D'XP (les monstres du chemin et les camps proches du chemin : `SEUIL_PEU_CM`) et BEAUCOUP D'XP (tous les camps) — chacune avec sa liste de priorités pour choisir
// une carte (`PRIORITES`, la première de la liste qui est proposée). Elles servent à l'ÉQUILIBRE : aucune ne doit gagner tous les jours (`tools/mesures.ts`, `test/equilibre.test.ts`).
// La stratégie « nettoyer » d'avant (une mesure, pas un Diamant) va d'abord à chaque monstre, du plus proche au plus loin, puis à l'arène : elle donne l'écart de temps entre foncer et tout nettoyer.

/** La direction de la croix (0 à 31) la plus proche d'un vecteur. */
const croix = (dx: number, dy: number): number => Math.trunc((dirVers(dx, dy) + 2) / 4) % 32;

export type Strategie = "foncer" | "peu" | "beaucoup";
export const STRATEGIES: readonly Strategie[] = ["foncer", "peu", "beaucoup"];
/** « Un peu d'XP » : un camp est « proche » quand le détour qui y mène est à cette distance (cm) du chemin principal au plus. */
export const SEUIL_PEU_CM = 3200;
/** Les cartes de chaque stratégie, de la plus voulue à la moins voulue (la première proposée est prise ; sinon la première carte offerte). */
export const PRIORITES: Readonly<Record<Strategie, readonly string[]>> = {
  foncer: ["bottes-legeres", "lame-lourde", "brise-pierre", "cadence", "esquive-vive", "tourbillon", "onde-epee", "allonge", "coeur-en-plus", "soin", "esquive-longue", "vol-de-vie", "esquive-tranchante", "aimant"],
  peu: ["bottes-legeres", "lame-lourde", "brise-pierre", "cadence", "tourbillon", "onde-epee", "allonge", "esquive-vive", "coeur-en-plus", "soin", "vol-de-vie", "esquive-longue", "esquive-tranchante", "aimant"],
  beaucoup: ["bottes-legeres", "tourbillon", "cadence", "lame-lourde", "brise-pierre", "onde-epee", "allonge", "vol-de-vie", "aimant", "coeur-en-plus", "soin", "esquive-vive", "esquive-longue", "esquive-tranchante"],
};
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
}
export const etatPilote = (strategie: Strategie = "foncer", camp = -2, p?: Partie, seuilPeu = SEUIL_PEU_CM): EtatPilote => ({
  strategie,
  cible: -1,
  champ: null,
  champCase: -1,
  champDepuis: -1e9,
  camp: strategie === "peu" ? -1 : camp,
  px: -1,
  py: -1,
  immobile: 0,
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
  let bloque: { x: number; y: number; r: number } | null = null;
  let meilleur = Infinity;
  for (const m of p.monstres) {
    if (m.hp <= 0) continue;
    const d = distance(c.x, c.y, m.x, m.y);
    const barre = etat.strategie !== "foncer" ? d < cm(360) : d < cm(170) || (d < cm(300) && distance(m.x, m.y, devant[0], devant[1]) < cm(240));
    if (barre && d < meilleur) {
      meilleur = d;
      bloque = { x: m.x, y: m.y, r: m.type === CHAUVE ? cm(36) : cm(48) };
    }
  }
  const portee = p.porteeCoup(0) - cm(50);
  // `champ` : un obstacle encore loin se rejoint en suivant le champ de distance (la ligne droite peut buter sur un mur et le bloquer pour toujours).
  const frapper = (b: { x: number; y: number; r: number }, champ?: Uint16Array): { direction: number; coup: boolean } => {
    const d = distance(c.x, c.y, b.x, b.y) - b.r - RAYON_CHEVALIER;
    if (d <= portee) return { direction: -1, coup: true };
    const pas = champ ? pasVers(p, champ) : -1;
    return { direction: pas >= 0 ? pas : croix(b.x - c.x, b.y - c.y), coup: false };
  };
  if (bloque) return frapper(bloque);
  // Lot BR1b : un obstacle sur les pas qui viennent le long d'un champ de distance : on le brise.
  const obstacleSur = (champ: Uint16Array): { x: number; y: number; r: number } | null => {
    if (p.obstacles.length === 0 || idx < 0) return null;
    let k = idx;
    for (let i = 0; i < 3; i++) {
      const s = descendre(n, champ, k);
      if (s < 0) break;
      k = s;
      const o = p.obstacles.find((q) => q.cases.includes(k));
      if (o) return { x: o.x, y: o.y, r: o.r };
    }
    return null;
  };
  const vises = (m: { id: number; hp: number }): boolean => m.hp > 0 && (etat.camps ? campDe(p, m.id) === -1 || etat.camps.has(campDe(p, m.id)) : etat.camp === -2 || campDe(p, m.id) === etat.camp);
  // Lot BR2 : qui chasse ramasse aussi les gemmes proches (l'aimant n'en prend que dans 3 m : un monstre repoussé meurt parfois plus loin). Une gemme est une cible d'identifiant négatif.
  const GEMME = -1000;
  const gemmesProches = etat.strategie !== "foncer" ? p.gemmes.filter((g) => distance(c.x, c.y, g.x, g.y) < cm(RAYON_GEMMES)) : [];
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
      if (gene) return frapper(gene, etat.champ ?? undefined);
      const d = etat.champ ? pasVers(p, etat.champ) : -1;
      return { direction: d >= 0 ? d : croix(cible.x - c.x, cible.y - c.y), coup: false };
    }
  }
  const gene = obstacleSur(n.dist);
  if (gene) return frapper(gene, n.dist);
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

export function pilote(p: Partie, etat: EtatPilote = etatPilote()): number {
  const c = p.c;
  const tick = p.tick;
  // 1. Les cercles qui vont tomber : partir, et esquiver au dernier moment.
  let fuite: { x: number; y: number } | null = null;
  let esquiver = false;
  let dirEsquive = -1;
  for (const z of p.zones) {
    const reste = z.ti - tick;
    if (z.type === Z_INVOCATION) continue; // un anneau qui annonce une naissance : aucun danger
    if (z.type === Z_BANDE) {
      // Lot BR3 : une bande (plongeon, charge, racines) : on s'en écarte par le côté ; on esquive à travers si on y est encore à l'arrivée.
      const [bx, by] = pointDuSegment(c.x, c.y, z.x, z.y, z.x2, z.y2);
      const db = distance(c.x, c.y, bx, by);
      if (reste <= 90 && db < z.r + cm(130)) {
        // sur la ligne même : on part de travers
        fuite = db > 0 ? { x: bx, y: by } : { x: c.x - (z.y2 - z.y), y: c.y + (z.x2 - z.x) };
        if (reste <= (c.etat === COUP ? 16 : 8) && db < z.r) esquiver = true;
      }
      continue;
    }
    const d = distance(c.x, c.y, z.x, z.y);
    if (z.type === Z_SPORES) {
      if (reste <= 90 && d < z.r + cm(150)) {
        fuite = { x: z.x, y: z.y };
        // un coup en cours retient (40 % de la vitesse) : l'esquive le coupe et emporte hors du nuage
        if (d < z.r && (reste <= 22 || (reste <= 55 && c.etat === COUP))) {
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
      if (arrivee <= 3 && d < z.r) {
        esquiver = true;
        dirEsquive = croix(z.x - c.x, z.y - c.y); // à travers l'anneau, vers le golem
      }
      continue;
    }
    // Lot BR0c : un coup dure 30 ticks et engage le chevalier (il ne marche qu'à 40 % de sa vitesse tant qu'il frappe) : il part dès que le cercle est posé, et esquive (ce qui coupe le coup) s'il est encore dedans à l'approche.
    if (reste <= 80 && d < z.r + cm(z.r > cm(300) ? 70 : 150)) {
      fuite = { x: z.x, y: z.y };
      if (reste <= (c.etat === COUP ? 16 : 8) && d < z.r) esquiver = true;
    }
  }
  // 2. Les ondes : l'esquive quand l'anneau arrive.
  for (const o of p.ondes) {
    const d = distance(c.x, c.y, o.x, o.y);
    if (!o.touche && Math.abs(d - o.r) < cm(110) && o.r < d + cm(40)) {
      esquiver = true;
      dirEsquive = croix(o.x - c.x, o.y - c.y);
    }
  }
  // Lot BR3 : un nuage de spores : on n'y reste pas.
  for (const n of p.nuages) if (distance(c.x, c.y, n.x, n.y) < n.r + cm(120)) fuite = { x: n.x, y: n.y };
  // 3. Un monstre qui fonce sur nous : l'esquive est gardée pour l'onde quand elle approche (lot BR0c : l'esquive met 40 ticks à revenir).
  const ondeProche = p.zones.some((z) => z.type === ONDE && z.ti - tick <= 60) || p.ondes.some((o) => !o.touche);
  for (const m of p.monstres) {
    if (c.degat > 0 || m.gel > 0 || ondeProche) continue;
    const d = distance(c.x, c.y, m.x, m.y);
    if (m.type === CHAUVE ? m.etat === PLONGEON && d < cm(230) : d < cm(48 + 42 + 35)) esquiver = true;
  }

  // 4. Dans le niveau, avant l'arène : naviguer (et ne frapper que ce qui barre la route). Dans l'arène : le combat.
  if (p.niveau && p.barriere < 0) {
    const nav = naviguer(p, etat);
    // Coincé contre le coin d'un mur en voulant avancer : il se décale de côté (alternativement) jusqu'à repartir.
    etat.immobile = nav.direction >= 0 && !nav.coup && c.x === etat.px && c.y === etat.py ? etat.immobile + 1 : 0;
    etat.px = c.x;
    etat.py = c.y;
    if (etat.immobile > 12 && nav.direction >= 0) nav.direction = (nav.direction + (etat.immobile % 48 < 24 ? 6 : 26)) % 32;
    const esq = esquiver && c.attente === 0;
    const dirNav = esq && dirEsquive >= 0 ? dirEsquive : esq && nav.direction < 0 ? croix(c.x - (p.niveau.arene.x), c.y - p.niveau.arene.y) : nav.direction;
    return entree(dirNav, nav.coup, esq);
  }
  // Où frapper : les monstres tout proches d'abord, sinon le golem.
  let cible: { x: number; y: number; r: number } | null = null;
  let meilleur = Infinity;
  for (const m of p.monstres) {
    const d = distance(c.x, c.y, m.x, m.y);
    if (d < meilleur && d < cm(360)) {
      meilleur = d;
      cible = { x: m.x, y: m.y, r: m.type === CHAUVE ? cm(36) : cm(48) };
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
  if (g && g.kind === B_BELIER && g.hp > 0 && (g.etat === MARCHE || g.etat === ANNONCE)) {
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
  if (g && g.kind === B_DUC && g.hp > 0 && g.etat === ANNONCE) {
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
  // Le coup est TENU : la simulation enchaîne les trois coups en boucle (lot BR0b).
  const bouton = coup;
  const esq = esquiver && c.attente === 0;
  const dirFinale = esq && dirEsquive >= 0 ? dirEsquive : esq && direction < 0 ? croix(c.x - (p.golem?.x ?? 0), c.y - (p.golem?.y ?? 0)) : direction;
  return entree(dirFinale, bouton, esq);
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
export function choisirCarte(p: Partie, strategie: Strategie): number {
  const cartes = p.choix?.cartes ?? [];
  const liste = prioritesContre(strategie, p.golem?.kind ?? 0);
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
  while (p.choix) {
    const carte = choisirCarte(p, etat.strategie);
    choix?.push({ tick: p.tick, nv: p.choix.nv, carte });
    p.choisir(p.choix.nv, carte);
  }
  const e = pilote(p, etat);
  p.avancer(e);
  return e;
}

/** La partie du pilote sur un contenu : ses changements d'entrée et ses choix (la rediffusion) et son résultat. `max` borne le nombre de ticks (les mesures de plusieurs minutes). */
export function jouerLePilote(contenu: Contenu, reglages: Reglages = REGLAGES_DEFAUT, max = Infinity, strategie: Strategie = "foncer", camp = -2): { changements: Changement[]; choix: Choix[]; resultat: Resultat; ticks: number } {
  const p = new Partie(contenu, reglages);
  const changements: Changement[] = [];
  const choix: Choix[] = [];
  const etat = etatPilote(strategie, camp, p);
  let avant = 0;
  while (!p.finie && p.tick < max) {
    // Les choix d'abord (le monde est figé), puis l'entrée du tick.
    while (p.choix) {
      const carte = choisirCarte(p, strategie);
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
  return { changements, choix, resultat: p.resultat(), ticks: p.tick };
}

export const touchesDuBot = (contenu: Contenu): Changement[] => jouerLePilote(contenu).changements;
/** La partie du Diamant provisoire (foncer) : ses changements d'entrée ET ses choix d'amélioration. */
export const entreesDuBot = (contenu: Contenu): { changements: Changement[]; choix: Choix[] } => {
  const { changements, choix } = jouerLePilote(contenu);
  return { changements, choix };
};
export const partieDuBot = (contenu: Contenu): Resultat => jouerLePilote(contenu).resultat;
