import { formatDay } from "@cdj/core";
import {
  RUSH_GENERATOR_VERSION,
  RUSH_SIM_VERSION,
  TICKS_PAR_SECONDE,
  type Contenu,
  dailyRush,
  decoderRediffusion,
  ErreurGenerateur,
  ErreurRediffusion,
  lireJourFige,
  type Rediffusion,
  rejouer,
  type Resultat,
  scoreParColonnes,
  seuilsDuJour,
  themeDuJour,
  entreesDuBot,
} from "@cdj/rush-sim";
import { inputsHash } from "./copies";
import { FICHES_SERVEUR } from "./fiches.generated";
import type { GameDefinition } from "./games";
import { type ContratMinimal, definirJeuNeuf, type FicheServeur, RefusJeu, type RejeuNeuf } from "./jeux/index";

// « Rush » (`rush`) : le serveur du prototype de boss rush (lot BR0). **C'est le contrat minimal d'un jeu neuf**, rien d'autre : le niveau du jour (le fichier figé de l'image s'il se relit et se régénère
// à l'identique, sinon le générateur courant), le décodage et le rejeu de la rediffusion (la suite des changements d'entrée), la colonne de classement de la fiche (le temps de la chute du golem, ↑), les seuils
// des médailles (le Diamant est la partie du pilote, provisoire), l'empreinte des entrées. **Lot BR2 : les choix d'amélioration font partie des entrées** ; `rejouer` les valide (un choix n'est accepté qu'à un niveau gagné, au niveau qui vient
// d'être gagné, avec une carte qui existe ; un choix manquant ou en trop : la rediffusion est refusée, `invalid_replay`). Les routes, l'ordre de validation, le classement, les copies, l'aperçu, l'effacement et les crochets sont ceux du module
// des jeux (`jeux/`), la table est la table commune `resultats_jeu`. Le jeu naît `off` : le registre le monte, l'état de la table `jeux` le ferme.
// **Lot BR4 : les médailles.** Le Diamant est la meilleure des trois parties du pilote (`diamantDuJour`) : les seuils sont ceux du fichier du jour s'il est figé (`seuilsDuJour`), sinon calculés par le pilote ; l'empreinte de l'auteur est celle de
// SA rediffusion (celle du Diamant). **Le coût d'un rejeu est proportionnel à sa durée** (`rejeu.ticksParUnite` de la fiche, comme Track et Jump) : le module compte `unitesServeur` avant le rejeu, le reste est compté juste après (le contrat
// minimal des jeux neufs ne donne pas la durée avant de rejouer).
// **Lot BR5 : la COMPÉTENCE choisie au départ est un événement d'entrée** (le premier de la rediffusion, au tick 0) : `rejouer` la valide (absente ou refusée : `invalid_replay`) et elle entre dans l'empreinte des entrées (copies).

const fiche = FICHES_SERVEUR.find((f) => f.id === "rush") as unknown as FicheServeur;

interface Niveau {
  jour: number;
  contenu: Contenu;
  /** L'empreinte des entrées de la partie de l'auteur (le bot) : une partie qui la porte est une copie. */
  authorHash: string;
}
type Mesure = Resultat;
interface Rejeu extends RejeuNeuf {
  changements: Rediffusion["changements"];
  /** Lot BR2 : les choix d'amélioration (le niveau gagné et la carte choisie) : un événement d'entrée comme les autres. */
  choix: Rediffusion["choix"];
  /** Lot BR5 : la compétence choisie au départ (0 à 2) : un événement d'entrée, le premier de la rediffusion. */
  competence: number;
}

/** Les options propres de « Rush » : les jours figés de l'image (date → contenu du fichier). */
export interface RushOptions {
  frozen?: Readonly<Record<string, unknown>>;
}

const texteDesEntrees = (r: { changements: readonly { tick: number; e: number }[]; choix: readonly { tick: number; nv: number; carte: number }[]; competence: number }): string =>
  `rush|${r.changements.map((t) => `${t.tick}:${t.e}`).join(",")}|${r.choix.map((c) => `${c.tick}:${c.nv}.${c.carte}`).join(",")}|${r.competence}`;

/** Le contenu d'un jour : le fichier figé s'il se vérifie, sinon le générateur courant. */
export function contenuDeRush(jour: number, frozen: Readonly<Record<string, unknown>> = {}): Contenu {
  const fichier = frozen[formatDay(jour)];
  const fige = fichier === undefined ? null : lireJourFige(fichier);
  return fige && fige.jour === jour ? fige : dailyRush(jour);
}

const refus = (e: unknown): never => {
  if (e instanceof ErreurRediffusion) {
    if (e.code === "version_inconnue") throw new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
    throw new RefusJeu("invalid_replay", e.message);
  }
  if (e instanceof ErreurGenerateur) throw new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
  throw e;
};

/** Lot BR4 : les unités du plafond global de rejeux (`REPLAYS_PER_MINUTE`) que coûte une partie de `ticks` ticks : une unité par `ticksParUnite` ticks (2 500 : une partie normale de ~3 500 ticks en vaut 2, la pire, 36 000 ticks, 15), au moins `unitesServeur`. */
export const unitesDuRejeu = (ticks: number): number => Math.max(fiche.rejeu.unitesServeur, Math.ceil(ticks / ((fiche.rejeu as { ticksParUnite?: number }).ticksParUnite ?? 5000)));

export const contratRush = (o: RushOptions = {}, platform?: { spendReplays(units?: number): void }): ContratMinimal<Niveau, Rejeu, Mesure> => ({
  versions: () => ({ simVersion: RUSH_SIM_VERSION, generatorVersion: RUSH_GENERATOR_VERSION }),
  async niveauDuJour(jour) {
    const contenu = contenuDeRush(jour, o.frozen);
    return { jour, contenu, authorHash: await inputsHash(texteDesEntrees(entreesDuBot(contenu))) };
  },
  decoder(texte) {
    try {
      return decoderRediffusion(texte);
    } catch (e) {
      return refus(e);
    }
  },
  rejouer(niveau, texte) {
    let mesure: Mesure;
    try {
      mesure = rejouer(niveau.contenu, texte);
    } catch (e) {
      return refus(e);
    }
    const reste = unitesDuRejeu(mesure.ticks) - fiche.rejeu.unitesServeur; // le module a déjà compté `unitesServeur`
    if (reste > 0) platform?.spendReplays(reste);
    return mesure;
  },
  score: (m) => scoreParColonnes(m), // les colonnes de la fiche, selon la variante du jeu (`variante.ts`)
  seuils: (niveau) => seuilsDuJour(niveau.contenu), // lot BR4 : ceux du fichier figé, sinon le Diamant du pilote (meilleur des trois stratégies)
  entrees: (r) => texteDesEntrees(r),
  theme: (niveau) => themeDuJour(niveau.jour),
  empreinteAuteur: (niveau) => niveau.authorHash,
  mesures: (m) => ({ subis: m.subis, tues: m.tues }),
  ticksParSeconde: TICKS_PAR_SECONDE,
  joursFiges: Object.keys(o.frozen ?? {}).sort(),
});

export const RUSH_GAME: GameDefinition<RushOptions> = definirJeuNeuf<Niveau, Rejeu, Mesure, RushOptions>({ fiche, nom: "Rush" }, (platform, o) => contratRush(o ?? {}, platform));
