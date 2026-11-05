import { RAYON_CHEVALIER, RAYON_GOLEM, cm } from "./constantes";
import { entree, type Changement } from "./entrees";
import type { Contenu } from "./generateur";
import { distance, dirVers } from "./maths";
import { CHAUVE, ONDE, PLONGEON, Partie, type Resultat } from "./partie";
import { REGLAGES_DEFAUT, type Reglages } from "./reglagesSim";

// Le pilote : un joueur automatique qui lit l'état de la partie et rend l'octet d'entrée du tick. Il sert à trois choses : le Diamant provisoire du prototype (sa partie du jour), les mesures (une partie de
// plusieurs minutes dont les entrées ressemblent à celles d'un joueur) et les tests. **Ce n'est pas la méthode des médailles de la suite** (le README du lot BR0 la recommande). Il ne triche pas : il lit ce que lit le
// rendu (positions, cercles annoncés) et n'a que les entrées d'un joueur au doigt : le déplacement, le coup (tenu), l'esquive, sans visée (visée assistée).

/** La direction de la croix (0 à 31) la plus proche d'un vecteur. */
const croix = (dx: number, dy: number): number => Math.trunc((dirVers(dx, dy) + 2) / 4) % 32;

export function pilote(p: Partie): number {
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
      const arrivee = reste + Math.max(0, Math.trunc((d - RAYON_GOLEM) / p.vOnde()));
      if (arrivee <= 3 && d < z.r) {
        esquiver = true;
        dirEsquive = croix(z.x - c.x, z.y - c.y); // à travers l'anneau, vers le golem
      }
      continue;
    }
    if (reste <= 48 && d < z.r + cm(110)) {
      fuite = { x: z.x, y: z.y };
      if (reste <= 7 && d < z.r) esquiver = true;
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
  // 3. Une chauve-souris qui plonge sur nous.
  for (const m of p.monstres) {
    if (c.degat > 0 || m.gel > 0) continue;
    const d = distance(c.x, c.y, m.x, m.y);
    if (m.type === CHAUVE ? m.etat === PLONGEON && d < cm(230) : d < cm(48 + 42 + 35)) esquiver = true;
  }

  // 4. Où frapper : les monstres tout proches d'abord, sinon le golem.
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
export function jouerLePilote(contenu: Contenu, reglages: Reglages = REGLAGES_DEFAUT, max = Infinity): { changements: Changement[]; resultat: Resultat; ticks: number } {
  const p = new Partie(contenu, reglages);
  const changements: Changement[] = [];
  let avant = 0;
  while (!p.finie && p.tick < max) {
    const e = pilote(p);
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
