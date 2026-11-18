import { CASE, DEPART_X, DEPART_Y, LARGEUR_MORCEAU, MORCEAUX_PAR_BOUCLE } from "./constantes";
import { terrainDuJour, type Contenu } from "./generateur";
import type { Morceau, Terrain } from "./monde";
import { planDuJour, type PlanDuJour } from "./plan";
import { Partie } from "./partie";
import { jouerRobot } from "./robot";

// LES MESURES DE LA VARIÉTÉ (lot GR7) : ce que le rapport du robot (`npm run robot:gravity -- --variete`) et les tests de « jamais tout droit » comptent. Pur : rien n'écrit nulle part.
//
// **Un morceau passif** est un morceau qu'un joueur qui ne touche à rien traverse vivant, à partir de l'état où le robot l'aborde (deux colonnes avant son début) : c'est ce que le seed interdit (« jamais tout droit ») pour
// tout passage en rythme, et ce que la part « passive » du rapport mesure sur les morceaux qui ne sont pas là pour souffler.

/** Le nom d'un motif tel que les mesures le comptent : `special-<thème>` pour la case spéciale d'un thème, `avion` / `onde` / `ressort` pour une section, avec son danger s'il en a (`avion+scies`). */
export const nomDuMotif = (m: Morceau): string => (m.motif === "special" ? `special-${m.theme}` : m.danger ? `${m.motif}+${m.danger}` : m.motif);

/** Un morceau de repos : celui où l'on souffle (pièces, aucun danger). Il n'est pas compté dans la part passive. */
export const estUnSouffle = (m: Morceau): boolean => m.motif === "calme" || m.motif === "souffle" || m.motif === "transition";

/**
 * La partie **posée à l'entrée du morceau `m`**, du côté d'où l'on y arrive (`entree` du morceau : le sol, ou le plafond), à la colonne 0, au pas où un joueur qui suit la caméra y arrive, à la vitesse du jour. C'est « l'entrée » du
 * seed : un joueur qui a suivi le chemin sûr jusque-là.
 */
export function partieALEntree(terrain: Terrain, plan: PlanDuJour, m: number): Partie {
  const p = new Partie(terrain);
  const mo = terrain.morceau(m);
  const x = m * LARGEUR_MORCEAU * CASE + 1;
  const tick = plan.trajectoire.tickOuLeJoueurArrive(x);
  p.tick = tick;
  p.cam = plan.trajectoire.camAu(tick);
  p.x = x;
  p.precX = x;
  p.facteur = plan.facteurAu(x + (CASE >> 1));
  p.g = mo.entree;
  p.y = mo.entree === 1 ? DEPART_Y : 2 * CASE + 1;
  p.precY = p.y;
  p.precCam = p.cam;
  p.vy = 0;
  p.sol = true;
  p.surface = 1;
  return p;
}

/** Joue sans toucher à rien depuis `p` (une copie de planification : sans bouclier) jusqu'à la fin du morceau `k` ou la mort : vrai si l'on y survit. */
export function survitSansRien(p: Partie, k: number): boolean {
  const c = p.copier(true);
  c.tampon = 0;
  c.bouton = false;
  const fin = (k + 1) * LARGEUR_MORCEAU * CASE;
  while (!c.finie && c.x < fin) c.avancer();
  return !c.finie;
}

export interface MesureDuJour {
  /** Les morceaux jusqu'à la distance demandée : nom du motif, et s'il se traverse sans rien faire **depuis son entrée**. */
  morceaux: { m: number; motif: string; variante: number; difficulte: number; souffle: boolean; passif: boolean; suite: boolean }[];
  /** Le robot a-t-il tenu jusqu'au bout ? */
  vivant: boolean;
}

/** Note, pour chaque morceau jusqu'à `distance` mètres, s'il se traverse sans rien faire depuis son entrée, et fait jouer le robot jusque-là. */
export function mesurerLeJour(contenu: Pick<Contenu, "jour" | "ordre" | "g" | "sim" | "reglages">, distance: number): MesureDuJour {
  const terrain = terrainDuJour(contenu);
  const plan = planDuJour(contenu.jour, terrain.regles!, contenu.ordre);
  const nb = Math.trunc((distance + 3) / LARGEUR_MORCEAU);
  const morceaux = [];
  for (let m = 0; m < nb; m++) {
    const mo = terrain.morceau(m);
    // Une section à mode est un seul passage : on la mesure d'un bout à l'autre (de son premier morceau au dernier morceau de contenu).
    let fin = m;
    while (fin + 1 < nb + 8 && terrain.morceau(fin + 1).suiteDeSection === true && terrain.morceau(fin + 1).motif === mo.motif) fin++;
    morceaux.push({ m, motif: nomDuMotif(mo), variante: mo.variante ?? 0, difficulte: mo.difficulte ?? 0, souffle: estUnSouffle(mo), passif: m === 0 ? true : mo.suiteDeSection === true ? false : survitSansRien(partieALEntree(terrain, plan, m), fin), suite: mo.suiteDeSection === true });
  }
  const r = jouerRobot(terrain, { maxDistance: distance });
  return { morceaux, vivant: !r.partie.finie };
}

/** Les motifs distincts de chaque boucle (de `MORCEAUX_PAR_BOUCLE` morceaux) : un nombre par boucle entière ou entamée. */
export function motifsParBoucle(morceaux: readonly { motif: string }[]): number[] {
  const sortie: number[] = [];
  for (let b = 0; b * MORCEAUX_PAR_BOUCLE < morceaux.length; b++) sortie.push(new Set(morceaux.slice(b * MORCEAUX_PAR_BOUCLE, (b + 1) * MORCEAUX_PAR_BOUCLE).map((x) => x.motif)).size);
  return sortie;
}

/** Les répétitions : combien de passages ont le même motif qu'un des `ecart − 1` morceaux d'avant (les morceaux de repos ne comptent pas ; les morceaux d'une même section sont un seul passage). */
export function repetitionsProches(morceaux: readonly { motif: string; souffle: boolean; suite?: boolean }[], ecart = 6): number {
  let n = 0;
  for (let i = 0; i < morceaux.length; i++) {
    if (morceaux[i]!.souffle || morceaux[i]!.suite) continue;
    for (let j = Math.max(0, i - ecart + 1); j < i; j++) {
      if (!morceaux[j]!.souffle && morceaux[j]!.motif === morceaux[i]!.motif) {
        n++;
        break;
      }
    }
  }
  return n;
}

/** Les variantes répétées : combien de morceaux repassent par un couple (motif, variante) déjà vu **dans la même boucle** (les repos ne comptent pas). */
export function variantesRepetees(morceaux: readonly { m: number; motif: string; variante: number; souffle: boolean; suite?: boolean }[]): number {
  let n = 0;
  const vus = new Set<string>();
  for (const x of morceaux) {
    if (x.souffle || x.suite) continue;
    const cle = `${Math.trunc(x.m / MORCEAUX_PAR_BOUCLE)}:${x.motif}:${x.variante}`;
    if (vus.has(cle)) n++;
    vus.add(cle);
  }
  return n;
}

/** La part (0 à 1) des morceaux de `morceaux` (hors repos, à partir du morceau `depuis`) qui se traversent sans rien faire. */
export function partPassive(morceaux: readonly { m: number; souffle: boolean; passif: boolean; suite?: boolean }[], depuis: number): number {
  const comptes = morceaux.filter((x) => x.m >= depuis && !x.souffle && !x.suite);
  return comptes.length === 0 ? 0 : comptes.filter((x) => x.passif).length / comptes.length;
}

/** Le x (unités) du début du morceau `m` : pour les tests. */
export const debutDuMorceau = (m: number): number => m * LARGEUR_MORCEAU * CASE;
export { DEPART_X };
