import { vitesseCamera } from "./camera";
import * as K from "./constantes";
import type { Terrain } from "./monde";
import { Partie } from "./partie";
const { CASE, LARGEUR_MORCEAU, MODE_AVION, MODE_GRAVITE, MODE_ONDE, MODE_RESSORT, TAILLE, TICKS_PAR_SECONDE } = K;

// LE PILOTE DES MODES DE VOL (lot GR6). Le robot de gravité cherche ses appuis dans un graphe d'états (`robot.ts`) : à chaque pas un appui est possible, mais l'inversion de la gravité ne se fait qu'au contact d'une
// surface, donc il y en a peu. **Dans l'avion, l'onde et le ressort, le bouton change de sens à tout moment** : une recherche exhaustive exploserait. Le robot y est donc **un pilote** : une loi de commande qui suit
// l'**axe** du morceau (`Morceau.axe`, le centre du couloir ou la hauteur à tenir), **vérifiée par la simulation** — c'est la même preuve que pour la gravité, par un autre chemin.
//
// **Contraintes d'humain, nommées** (elles sont celles du lot GR6) :
//  - `ROBOT_MAINTIEN_MIN` : en avion et en onde, un appui ou un relâché dure au moins 6 pas ;
//  - `ROBOT_ECART_MIN` (robot.ts) : au moins 12 pas entre deux appuis en gravité ou en ressort ;
//  - `ROBOT_MARGE` (robot.ts) : **chaque changement garde une fenêtre de ± 4 pas** — avant de changer d'état le pilote rejoue, sur des copies, le même changement 4 pas plus tôt, 4 pas plus tard (et tous ceux entre), puis
//    continue de piloter `VERIF_PAS` pas : si l'un meurt, il attend un pas de plus et recommence (au plus `ATTENTE_MAX` pas), sinon il note une entorse (le générateur est à corriger : jamais le robot) ;
//  - **toujours sans bouclier** (les copies n'en ont pas).

/** Un appui ou un relâché dure au moins 6 pas en avion et en onde : 50 ms. */
export const ROBOT_MAINTIEN_MIN = 6;
/** Le pilote regarde l'axe 0,3 s devant lui. */
const REGARD_PAS = 36;
/** Dans l'onde, qui change de sens en un instant, il regarde plus près : 0,2 s. */
const REGARD_ONDE = 24;
/** Combien de pas le pilote continue de piloter sur une copie pour juger un changement décalé : 1,5 s (ou jusqu'à la fin de la section). */
const VERIF_PAS = 180;
/** Au plus 10 pas d'attente pour trouver un instant dont toute la fenêtre passe. */
export const ATTENTE_MAX = 10;
const DEMI_JOUEUR = TAILLE >> 1;
/** La marge de chaque côté du changement (± 4 pas). Même valeur que `ROBOT_MARGE` de `robot.ts` (définie ici pour ne pas importer le robot). */
export const MARGE_PILOTE = 4;

const idiv = (a: number, b: number): number => Math.trunc(a / b);

/** L'axe du morceau à la colonne qui est `pas` pas devant le joueur (centre de la boîte), ou null s'il n'y en a pas. */
function axeDevant(p: Partie, pas: number): number | null {
  const vit = vitesseCamera(p.cam, p.regles, p.facteur);
  const xa = p.x + DEMI_JOUEUR + idiv(vit * pas, TICKS_PAR_SECONDE);
  const col = idiv(xa, CASE);
  const k = idiv(col, LARGEUR_MORCEAU);
  const axe = p.terrain.morceau(k).axe;
  return axe.length === 0 ? null : axe[col - k * LARGEUR_MORCEAU]!;
}

/**
 * La hauteur visée : la moyenne de l'axe ici, à mi-chemin et à `pas` pas devant (0,3 s ; l'onde regarde 0,2 s) — **la hauteur se met en route avant que le couloir change de rangée**, au milieu entre l'ancien et le nouveau
 * couloir, là où les deux se recouvrent —, ou la hauteur actuelle s'il n'y a pas d'axe.
 */
export function viser(p: Partie, pas = p.mode === MODE_ONDE ? REGARD_ONDE : REGARD_PAS): number {
  const a = axeDevant(p, 0);
  const b = axeDevant(p, pas >> 1);
  const c = axeDevant(p, pas);
  const connus = [a, b, c].filter((v): v is number => v !== null);
  if (connus.length === 0) return p.y + DEMI_JOUEUR;
  return idiv(connus.reduce((x, y) => x + y, 0), connus.length);
}

/**
 * L'état que le pilote veut pour le bouton au pas courant de `p` (avant `avancer`) : vrai = appuyé. **L'avion** : une loi de poursuite — la vitesse verticale voulue est proportionnelle à l'écart avec l'axe (5 par seconde,
 * au plus 6 cases/s), on appuie si on descend plus vite que voulu. **L'onde** : on monte tant que l'axe est au-dessus de la boîte, on descend tant qu'il est au-dessous, avec une zone morte autour. **Le ressort** : on bondit
 * quand la boîte est plus bas que l'axe et qu'elle ne monte pas déjà vite. Dans les deux premiers modes le pilote ne change pas d'état avant `ROBOT_MAINTIEN_MIN` pas.
 */
export function decider(p: Partie): boolean {
  const yc = p.y + DEMI_JOUEUR;
  const cible = viser(p);
  const e = cible - yc; // positif : l'axe est plus bas que la boîte
  const tenu = p.tick - p.dernierChg;
  if (p.mode === MODE_AVION) {
    const voulu = Math.max(-6 * CASE, Math.min(6 * CASE, 5 * e));
    const veut = p.vy > voulu;
    if (veut === p.bouton) return p.bouton;
    return tenu >= ROBOT_MAINTIEN_MIN ? veut : p.bouton;
  }
  if (p.mode === MODE_ONDE) {
    const zone = CASE >> 2;
    let veut = p.bouton;
    if (e < -zone) veut = true;
    else if (e > zone) veut = false;
    return veut === p.bouton || tenu >= ROBOT_MAINTIEN_MIN ? veut : p.bouton;
  }
  if (p.mode === MODE_RESSORT) {
    if (p.bouton) return false; // un appui d'un pas : le bond est pris dès qu'il est permis
    return e < -(CASE >> 2) && p.vy > -2 * CASE && p.peutBondir && p.tick - p.dernierAppui >= K.RESSORT_ATTENTE;
  }
  return false;
}

/**
 * Joue la copie `c` en pilotant, `pas` pas au plus (ou jusqu'à la sortie du mode) : vrai si elle survit. 
 */
function survit(c: Partie, pas: number): boolean {
  for (let i = 0; i < pas; i++) {
    if (c.mode === MODE_GRAVITE) return true;
    const veut = decider(c);
    if (veut !== c.bouton) {
      if (veut) c.appuyer();
      else c.relacher();
    }
    c.avancer();
    if (c.finie) return false;
  }
  return true;
}

/** Le résultat du jugement d'un changement : la fenêtre (pas consécutifs autour du changement, lui compris, qui passent) sur `2 × MARGE + 1`. */
export interface Jugement {
  fenetre: number;
  /** Tous les décalages de − 4 à + 4 passent. */
  respecte: boolean;
}

/**
 * Juge un changement d'état du bouton que le pilote veut faire **maintenant** (au pas de `p`) : rejoue le même changement avec chaque décalage de −`MARGE` à +`MARGE` pas, sur des copies sans bouclier, puis pilote 1,5 s.
 * `passe` : les copies de `p` aux `MARGE` pas qui précèdent (la plus récente en dernier), pour les décalages négatifs. Le décalage 0 est jugé aussi.
 */
export function juger(p: Partie, passe: readonly Partie[]): Jugement {
  const veut = !p.bouton;
  const ok = new Array<boolean>(2 * MARGE_PILOTE + 1).fill(false);
  for (let delta = -MARGE_PILOTE; delta <= MARGE_PILOTE; delta++) {
    let c: Partie;
    if (delta < 0) {
      const source = passe[passe.length + delta];
      if (!source) {
        ok[delta + MARGE_PILOTE] = false;
        continue;
      }
      c = source.copier(true);
    } else {
      c = p.copier(true);
      for (let i = 0; i < delta && !c.finie; i++) c.avancer();
      if (c.finie) continue;
    }
    if (c.mode === MODE_GRAVITE) {
      ok[delta + MARGE_PILOTE] = true;
      continue;
    }
    if (veut) c.appuyer();
    else c.relacher();
    c.avancer();
    ok[delta + MARGE_PILOTE] = !c.finie && survit(c, VERIF_PAS);
  }
  // La fenêtre : la plage consécutive de décalages qui passent, autour de 0.
  let a = MARGE_PILOTE;
  while (a - 1 >= 0 && ok[a - 1]) a--;
  let b = MARGE_PILOTE;
  while (b + 1 < ok.length && ok[b + 1]) b++;
  const fenetre = ok[MARGE_PILOTE] ? b - a + 1 : 0;
  return { fenetre, respecte: ok.every(Boolean) };
}


