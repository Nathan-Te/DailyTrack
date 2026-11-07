import { HUMAIN, STRATEGIES, jouerLePilote, type ProfilHumain, type Strategie } from "./bot";
import { DUREE_TICKS } from "./constantes";
import type { Contenu } from "./generateur";
import type { Resultat } from "./partie";
import type { Changement } from "./entrees";
import type { Choix } from "./rediffusion";
import { VARIANTE, type Medaille, type Seuils } from "./variante";

// **Les médailles de Rush (lot BR4).** Le Diamant est le MEILLEUR TEMPS DES TROIS STRATÉGIES du pilote (foncer, un peu d'XP, beaucoup d'XP) le jour même : une partie réelle, donc toujours rejouable par le serveur (pas de « temps
// théorique »). L'or, l'argent et le bronze en sont des pourcentages (130, 160 et 200 %, ceux de la fiche : `medailles.bareme`, repris par `VARIANTE.seuils`). Tout est déterministe et calculé par jour ; il se recalcule quand la version
// du jeu change (`RUSH_SIM_VERSION`, `RUSH_GENERATOR_VERSION`, `RUSH_BOT_VERSION`) puisque le calcul est refait à chaque lecture d'un jour non figé : les jours à venir se mettent à jour d'eux-mêmes. **Un jour figé garde ses seuils**
// (règle de la racine « un jour figé fige aussi ses seuils » : `Contenu.seuilsFiges`, `seuilsDuJour`). Le calcul coûte trois parties du pilote (`diamantDuJour`, gardé par contenu).
export type { Medaille, Seuils };
export const BAREME_PCT = VARIANTE.fiche.bareme;

/** Une partie du pilote : sa stratégie, son résultat et la rediffusion qui la rejoue (entrées et choix de cartes). */
export interface PartieDuPilote {
  strategie: Strategie;
  /** Le score de classement (les ticks d'une victoire, `DUREE_TICKS` sinon). */
  score: number;
  resultat: Resultat;
  changements: Changement[];
  choix: Choix[];
  blocages: number;
}
export interface DiamantDuJour {
  /** La stratégie du Diamant : la plus rapide (à égalité, la première de `STRATEGIES`). */
  strategie: Strategie;
  parties: Record<Strategie, PartieDuPilote>;
}

const partieDe = (contenu: Contenu, strategie: Strategie, humain: ProfilHumain | null = null): PartieDuPilote => {
  const j = jouerLePilote(contenu, undefined, Infinity, strategie, -2, humain);
  return { strategie, score: VARIANTE.score(j.resultat)[0]!, resultat: j.resultat, changements: j.changements, choix: j.choix, blocages: j.blocages };
};
const meilleure = (parties: Record<Strategie, PartieDuPilote>): Strategie => STRATEGIES.reduce((m, s) => (parties[s].score < parties[m].score ? s : m), STRATEGIES[0]!);

const gardees = new WeakMap<Contenu, DiamantDuJour>();
/** Les trois parties du pilote sur ce contenu et laquelle est le Diamant (gardé : le serveur et le fantôme le demandent plusieurs fois). */
export function diamantDuJour(contenu: Contenu): DiamantDuJour {
  let d = gardees.get(contenu);
  if (!d) {
    const parties = Object.fromEntries(STRATEGIES.map((s) => [s, partieDe(contenu, s)])) as Record<Strategie, PartieDuPilote>;
    d = { strategie: meilleure(parties), parties };
    gardees.set(contenu, d);
  }
  return d;
}

/** La partie du Diamant : son résultat. */
export const partieDuBot = (contenu: Contenu): Resultat => {
  const d = diamantDuJour(contenu);
  return d.parties[d.strategie].resultat;
};
/** Les entrées du Diamant : ses changements d'entrée ET ses choix de cartes (ce que le serveur compare, ce que le fantôme rejoue). */
export const entreesDuBot = (contenu: Contenu): { changements: Changement[]; choix: Choix[] } => {
  const d = diamantDuJour(contenu);
  const p = d.parties[d.strategie];
  return { changements: p.changements, choix: p.choix };
};

/** Les seuils CALCULÉS d'un contenu : le Diamant est la partie du pilote, les autres s'en déduisent. */
export const seuilsDe = (contenu: Contenu): Seuils => VARIANTE.seuils(partieDuBot(contenu));

/** Des seuils sont-ils valides (quatre entiers positifs, Diamant < or < argent < bronze : un temps, le plus court gagne) ? */
export const seuilsValides = (s: unknown): s is Seuils => {
  if (typeof s !== "object" || s === null) return false;
  const { bronze, silver, gold, author } = s as Partial<Seuils>;
  const ok = (n: unknown): n is number => typeof n === "number" && Number.isSafeInteger(n) && n >= 1;
  return ok(bronze) && ok(silver) && ok(gold) && ok(author) && author < gold && gold < silver && silver < bronze;
};

/**
 * **Les seuils d'un jour tel qu'on le sert** : ceux figés avec le jour s'il vient d'un fichier de jour (`Contenu.seuilsFiges`), sinon ceux que le pilote calcule. Le serveur et le jeu passent par là.
 */
export const seuilsDuJour = (contenu: Contenu): Seuils => contenu.seuilsFiges ?? seuilsDe(contenu);

/** La médaille d'un score (les colonnes de classement, dans l'ordre de la fiche). */
export const medailleDe = (score: readonly number[], s: Seuils): Medaille | null => VARIANTE.medaille(score, s);

/** La médaille d'un résultat rejoué. */
export const medailleDeResultat = (r: Pick<Resultat, "victoire" | "ticks">, s: Seuils): Medaille | null => VARIANTE.medaille(VARIANTE.score(r), s);

/** Le tableau d'un jour (`?scenario=medailles`, `npm run medailles:rush`) : les trois temps du pilote, la stratégie du Diamant, les quatre seuils et — pour calibrer — les trois temps du pilote HUMANISÉ. En ticks (`DUREE_TICKS` : perdu). */
export interface LigneMedailles {
  jour: number;
  boss: number;
  theme: string;
  temps: Record<Strategie, number>;
  diamant: Strategie;
  seuils: Seuils;
  humain: Record<Strategie, number>;
  /** Les blocages que le pilote de référence a détectés, par stratégie. */
  blocages: Record<Strategie, number>;
}
export function ligneDuJour(contenu: Contenu, humain: ProfilHumain | null = HUMAIN): LigneMedailles {
  const d = diamantDuJour(contenu);
  const hu = (humain ? Object.fromEntries(STRATEGIES.map((s) => [s, partieDe(contenu, s, humain).score])) : Object.fromEntries(STRATEGIES.map((s) => [s, DUREE_TICKS]))) as Record<Strategie, number>;
  return {
    jour: contenu.jour,
    boss: contenu.boss,
    theme: contenu.theme,
    temps: Object.fromEntries(STRATEGIES.map((s) => [s, d.parties[s].score])) as Record<Strategie, number>,
    diamant: d.strategie,
    seuils: VARIANTE.seuils(d.parties[d.strategie].resultat),
    humain: hu,
    blocages: Object.fromEntries(STRATEGIES.map((s) => [s, d.parties[s].blocages])) as Record<Strategie, number>,
  };
}
