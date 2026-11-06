import { RAYON_CHEVALIER, RAYON_GOLEM, cm } from "./constantes";
import { entree, type Changement } from "./entrees";
import type { Contenu } from "./generateur";
import { distance, dirVers } from "./maths";
import { caseDe, centreDeCase, champDeDistance, descendre, INACCESSIBLE } from "./niveau";
import { CHAUVE, COUP, ONDE, PLONGEON, Partie, type Resultat } from "./partie";
import { REGLAGES_DEFAUT, type Reglages } from "./reglagesSim";

// Le pilote : un joueur automatique qui lit l'état de la partie et rend l'octet d'entrée du tick. Il sert à trois choses : le Diamant provisoire du prototype (sa partie du jour), les mesures (une partie de
// plusieurs minutes dont les entrées ressemblent à celles d'un joueur) et les tests. **Ce n'est pas la méthode des médailles de la suite** (le README du lot BR0 la recommande). Il ne triche pas : il lit ce que lit le
// rendu (positions, cercles annoncés) et n'a que les entrées d'un joueur au doigt : le déplacement, le coup (tenu), l'esquive, sans visée (visée assistée).
// Lot BR1 : il NAVIGUE dans le niveau — le chemin le plus court sur la grille jusqu'à l'arène (le champ de distance du niveau), et il ne combat que ce qui lui barre la route : c'est le Diamant provisoire, « foncer ».
// Lot BR1b : il casse l'obstacle qui barre les pas qui viennent (le chemin le plus court passe par lui : 1 ou 2 coups) au lieu de le contourner ; la COURSE hors combat lui vient d'elle-même (il marche sans cesse et ne frappe que ce qui barre
// la route : la simulation fait monter sa vitesse après ~1,2 s de calme) ; la stratégie « nettoyer » peut ne viser que les monstres d'UN camp (la mesure du coût d'un détour : `jouerLePilote(…, camp)`).
// La stratégie « nettoyer » (une mesure, pas un Diamant) va d'abord à chaque monstre, du plus proche au plus loin, puis à l'arène : elle donne l'écart de temps entre foncer et tout nettoyer.

/** La direction de la croix (0 à 31) la plus proche d'un vecteur. */
const croix = (dx: number, dy: number): number => Math.trunc((dirVers(dx, dy) + 2) / 4) % 32;

export type Strategie = "foncer" | "nettoyer";
/** Ce que le pilote retient d'un tick à l'autre (la stratégie « foncer » n'en a pas besoin). */
export interface EtatPilote {
  strategie: Strategie;
  /** « nettoyer » : le monstre visé, le champ de distance vers sa case et la case pour laquelle il a été calculé. */
  cible: number;
  champ: Uint16Array | null;
  champCase: number;
  champDepuis: number;
  /** « nettoyer » : −2, tous les monstres ; un indice de clairière : seulement les monstres de ce camp ; −1 : seulement ceux du chemin principal (groupes et épars). */
  camp: number;
}
export const etatPilote = (strategie: Strategie = "foncer", camp = -2): EtatPilote => ({ strategie, cible: -1, champ: null, champCase: -1, champDepuis: -1e9, camp });

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
    const barre = etat.strategie === "nettoyer" ? d < cm(360) : d < cm(170) || (d < cm(300) && distance(m.x, m.y, devant[0], devant[1]) < cm(240));
    if (barre && d < meilleur) {
      meilleur = d;
      bloque = { x: m.x, y: m.y, r: m.type === CHAUVE ? cm(36) : cm(48) };
    }
  }
  const portee = cm(p.reglages.portee) - cm(50);
  const frapper = (b: { x: number; y: number; r: number }): { direction: number; coup: boolean } => {
    const d = distance(c.x, c.y, b.x, b.y) - b.r - RAYON_CHEVALIER;
    return d > portee ? { direction: croix(b.x - c.x, b.y - c.y), coup: false } : { direction: -1, coup: true };
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
  const vises = (m: { id: number; hp: number }): boolean => m.hp > 0 && (etat.camp === -2 || campDe(p, m.id) === etat.camp);
  if (etat.strategie === "nettoyer" && p.monstres.some(vises)) {
    // Le monstre le plus proche par le chemin : un champ de distance depuis la case du chevalier.
    let cible = p.monstres.find((m) => m.id === etat.cible && vises(m));
    if (!cible) {
      const depuis = champDeDistance(n, idx >= 0 ? [idx] : []);
      let dm = Infinity;
      for (const m of p.monstres) {
        const k = caseDe(n, m.x, m.y);
        const dk = k >= 0 ? depuis[k]! : INACCESSIBLE;
        if (vises(m) && dk < dm) {
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
      if (gene) return frapper(gene);
      const d = etat.champ ? pasVers(p, etat.champ) : -1;
      return { direction: d >= 0 ? d : croix(cible.x - c.x, cible.y - c.y), coup: false };
    }
  }
  const gene = obstacleSur(n.dist);
  if (gene) return frapper(gene);
  return { direction: aLArene(), coup: false };
}

export function pilote(p: Partie, etat: EtatPilote = etatPilote()): number {
  const c = p.c;
  const reg = p.reglages;
  const tick = p.tick;
  // 1. Les cercles qui vont tomber : partir, et esquiver au dernier moment.
  let fuite: { x: number; y: number } | null = null;
  let esquiver = false;
  let dirEsquive = -1;
  for (const z of p.zones) {
    const reste = z.ti - tick;
    const d = distance(c.x, c.y, z.x, z.y);
    if (z.type === ONDE) {
      // L'anneau part du bord du golem à `ti` et file à la vitesse de l'onde (`vOnde`, 9,5 m/s au rythme 100 %) : on esquive quand il est à moins de trois ticks de nous.
      // (lot BR0c : le bord de l'anneau touche dès qu'il est à ~80 cm : collé au golem, le chevalier doit déjà esquiver à l'instant où l'onde part)
      const arrivee = reste + Math.max(0, Math.trunc((d - RAYON_GOLEM - cm(80)) / p.vOnde()));
      if (arrivee <= 3 && d < z.r) {
        esquiver = true;
        dirEsquive = croix(z.x - c.x, z.y - c.y); // à travers l'anneau, vers le golem
      }
      continue;
    }
    // Lot BR0c : un coup dure 30 ticks et engage le chevalier (il ne marche qu'à 40 % de sa vitesse tant qu'il frappe) : il part dès que le cercle est posé, et esquive (ce qui coupe le coup) s'il est encore dedans à l'approche.
    if (reste <= 80 && d < z.r + cm(150)) {
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
  if (!cible && p.golem && p.golem.hp > 0) cible = { x: p.golem.x, y: p.golem.y, r: RAYON_GOLEM };
  if (!cible && p.monstres.length > 0) {
    const m = p.monstres[0]!;
    cible = { x: m.x, y: m.y, r: cm(40) };
  }

  let direction = -1;
  let coup = false;
  if (fuite) direction = croix(c.x - fuite.x, c.y - fuite.y);
  else if (cible) {
    const d = distance(c.x, c.y, cible.x, cible.y) - cible.r - RAYON_CHEVALIER;
    const portee = cm(reg.portee) - cm(50);
    if (d > portee) direction = croix(cible.x - c.x, cible.y - c.y);
    else coup = true;
  }
  // Le coup est TENU : la simulation enchaîne les trois coups en boucle (lot BR0b).
  const bouton = coup;
  const esq = esquiver && c.attente === 0;
  const dirFinale = esq && dirEsquive >= 0 ? dirEsquive : esq && direction < 0 ? croix(c.x - (p.golem?.x ?? 0), c.y - (p.golem?.y ?? 0)) : direction;
  return entree(dirFinale, bouton, esq);
}

/** La partie du pilote sur un contenu : ses changements d'entrée (la rediffusion) et son résultat. `max` borne le nombre de ticks (les mesures de plusieurs minutes). */
export function jouerLePilote(contenu: Contenu, reglages: Reglages = REGLAGES_DEFAUT, max = Infinity, strategie: Strategie = "foncer", camp = -2): { changements: Changement[]; resultat: Resultat; ticks: number } {
  const p = new Partie(contenu, reglages);
  const changements: Changement[] = [];
  const etat = etatPilote(strategie, camp);
  let avant = 0;
  while (!p.finie && p.tick < max) {
    const e = pilote(p, etat);
    if (e !== avant) {
      changements.push({ tick: p.tick, e });
      avant = e;
    }
    p.avancer(e);
  }
  return { changements, resultat: p.resultat(), ticks: p.tick };
}

export const touchesDuBot = (contenu: Contenu): Changement[] => jouerLePilote(contenu).changements;
export const partieDuBot = (contenu: Contenu): Resultat => jouerLePilote(contenu).resultat;
