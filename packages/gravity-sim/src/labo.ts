import { CASE, LARGEUR_MORCEAU, LIGNES } from "./constantes";
import { genererMorceau } from "./generateur";
import { BLOC, VIDE, type Morceau, type Terrain } from "./monde";
import { Partie } from "./partie";
import { PlanDuJour } from "./plan";
import { GRAVITY_SIM_VERSION } from "./constantes";
import { reglesDe, type Regles } from "./regles";
import { jouerRobot, ROBOT_FENETRE_MIN } from "./robot";
import { THEMES_GRAVITY, type ThemeGravity } from "./themes";

// LE LABORATOIRE DES MOTIFS (lot GR7) : un motif forcé, abordé **à une vitesse constante** (les réglages d'essai : départ = plafond), **du côté d'arrivée voulu**, rejoué par le robot (strict : une fenêtre de ± 4 pas à chaque appui) et par
// un joueur qui ne touche à rien (« jamais tout droit »). C'est ainsi qu'on règle un motif sur toutes les vitesses sans jouer un jour entier ; `npm run labo:gravity -w @cdj/gravity-sim`, et `test/labo.test.ts`.

/** Le morceau où le motif essayé est posé : trois morceaux calmes, un morceau qui force le côté d'arrivée, puis lui. */
export const MORCEAU_ESSAYE = 4;
const JOUR_DU_LABO = 20000;

export interface Scenario {
  id: string;
  variante: number;
  /** Le côté d'où l'on arrive : +1 le sol, −1 le plafond. */
  entree: 1 | -1;
  /** La vitesse constante, en cases par seconde (nombre pouvant porter une décimale). */
  vitesse: number;
}
export interface ResultatLabo extends Scenario {
  /** Le robot (strict, fenêtre ± 4 pas) a joué les morceaux d'avant, le motif et deux morceaux calmes sans mourir ni entorse. */
  robot: boolean;
  /** Le joueur qui ne fait rien traverse le morceau vivant (sauf les motifs de repos : c'est voulu). */
  passif: boolean;
  /** La fenêtre la plus étroite des appuis dans le morceau essayé (et le suivant), ou 99 s'il n'y en a pas. */
  fenetre: number;
  /** Pourquoi le robot échoue, sinon vide. */
  detail: string;
}

/** Cases par seconde (au plus un chiffre après la virgule) en unités par seconde, sans flottant : `12.5` → 51 200. */
const enUnites = (casesParSeconde: number): number => Math.trunc((casesParSeconde * 10 * CASE + 5) / 10);

/** Un morceau d'un seul tenant : tout le plafond (ou tout le sol) est un trou, l'autre surface reste : il force le robot à être de ce côté. */
function morceauForceur(m: number, cote: 1 | -1, base: Morceau): Morceau {
  const cases = new Uint8Array(LARGEUR_MORCEAU * LIGNES);
  for (let c = 0; c < LARGEUR_MORCEAU; c++) for (let r = 0; r < LIGNES; r++) cases[c * LIGNES + r] = r < 2 || r >= LIGNES - 2 ? BLOC : VIDE;
  // Pour arriver sur le sol : le plafond est troué ; pour arriver au plafond : le sol est troué (3 colonnes plus loin : de quoi se préparer).
  for (let c = 0; c < LARGEUR_MORCEAU; c++) for (const r of cote === 1 ? [0, 1] : [10, 11]) if (c >= 2) cases[c * LIGNES + r] = VIDE;
  return { ...base, m, motif: "calme", cases, pieces: [], gemmes: [], bonus: [], chemin: [{ c0: 0, c1: 16, y: cote === 1 ? 9 : 2, g: cote }], portails: [], scies: [], lasers: [], axe: [], decalage: 0, entree: cote, sortie: cote };
}

/** Le terrain d'un scénario : le morceau d'avant le motif force le côté d'arrivée. */
export function terrainDuScenario(s: Scenario): { terrain: Terrain; regles: Regles } {
  const v = enUnites(s.vitesse);
  const regles = reglesDe(GRAVITY_SIM_VERSION, 19, { vitesseBase: v, vitesseMax: v });
  const theme: ThemeGravity = (s.id.startsWith("special-") ? s.id.slice(8) : "foret") as ThemeGravity;
  const ordre = [theme, ...THEMES_GRAVITY.filter((t) => t !== theme)];
  const forcer = new Map([[MORCEAU_ESSAYE, { id: s.id, variante: s.variante }], [MORCEAU_ESSAYE + 1, { id: "calme", variante: 0 }], [MORCEAU_ESSAYE + 2, { id: "calme", variante: 0 }]]);
  const plan = new PlanDuJour(JOUR_DU_LABO, regles, { sansSections: true, forcer, calmeDepuis: MORCEAU_ESSAYE + 1 }, ordre);
  const morceaux: Morceau[] = [];
  const terrain: Terrain = {
    regles,
    morceau(k) {
      while (morceaux.length <= k) {
        const m = morceaux.length;
        const avant = morceaux[m - 1];
        if (m === MORCEAU_ESSAYE - 1) morceaux.push(morceauForceur(m, s.entree, avant!));
        else morceaux.push(genererMorceau(JOUR_DU_LABO, m, ordre, m === 0 ? 1 : avant!.sortie, null, regles, plan));
      }
      return morceaux[k]!;
    },
  };
  return { terrain, regles };
}

/** Joue un scénario : le robot, puis le joueur passif. */
export function jouerScenario(s: Scenario): ResultatLabo {
  const { terrain } = terrainDuScenario(s);
  const finDistance = (MORCEAU_ESSAYE + 3) * LARGEUR_MORCEAU - 3;
  const r = jouerRobot(terrain, { maxDistance: finDistance, strict: true });
  const entorses = r.rapport.entorses;
  const fenetres = r.rapport.appuis.filter((a) => a.morceau >= MORCEAU_ESSAYE && a.morceau <= MORCEAU_ESSAYE + 1).map((a) => a.fenetre);
  const mort = r.partie.finie && r.partie.distance < finDistance;
  const robot = !mort && entorses.length === 0 && r.rapport.appuis.every((a) => a.respecte && a.fenetre >= ROBOT_FENETRE_MIN);
  const detail = mort ? `mort à ${r.partie.distance} m (morceau ${Math.trunc(r.partie.x / (LARGEUR_MORCEAU * CASE))}, cause ${r.partie.mort})` : entorses.length > 0 ? `sans fenêtre au morceau ${entorses[0]!.morceau} (pas ${entorses[0]!.tick})` : robot ? "" : "fenêtre trop étroite";
  // Le passif : un terrain dont le morceau forceur est un couloir.
  const passif = passifNeutre(s);
  return { ...s, robot, passif, fenetre: fenetres.length ? Math.min(...fenetres) : 99, detail };
}

/** Le joueur passif sur un terrain où le morceau d'avant le motif est un couloir complet. */
function passifNeutre(s: Scenario): boolean {
  const v = enUnites(s.vitesse);
  const regles = reglesDe(GRAVITY_SIM_VERSION, 19, { vitesseBase: v, vitesseMax: v });
  const theme: ThemeGravity = (s.id.startsWith("special-") ? s.id.slice(8) : "foret") as ThemeGravity;
  const ordre = [theme, ...THEMES_GRAVITY.filter((t) => t !== theme)];
  const forcer = new Map([[MORCEAU_ESSAYE, { id: s.id, variante: s.variante }], [MORCEAU_ESSAYE + 1, { id: "calme", variante: 0 }], [MORCEAU_ESSAYE + 2, { id: "calme", variante: 0 }]]);
  const plan = new PlanDuJour(JOUR_DU_LABO, regles, { sansSections: true, forcer, calmeDepuis: MORCEAU_ESSAYE + 1 }, ordre);
  const morceaux: Morceau[] = [];
  const terrain: Terrain = {
    regles,
    morceau(k) {
      while (morceaux.length <= k) {
        const m = morceaux.length;
        morceaux.push(genererMorceau(JOUR_DU_LABO, m, ordre, m === 0 ? 1 : (morceaux[m - 1]!.sortie ?? 1), null, regles, plan));
      }
      return morceaux[k]!;
    },
  };
  const p = new Partie(terrain);
  const fin = (MORCEAU_ESSAYE + 1) * LARGEUR_MORCEAU * CASE;
  while (!p.finie && p.x < fin) {
    if (s.entree === -1 && p.tick === 1) p.appuyer();
    else if (p.bouton && p.tick === 3) p.relacher();
    p.avancer();
  }
  return !p.finie;
}
