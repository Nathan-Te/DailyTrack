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
  seuilsDe,
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
}

/** Les options propres de « Rush » : les jours figés de l'image (date → contenu du fichier). */
export interface RushOptions {
  frozen?: Readonly<Record<string, unknown>>;
}

const texteDesEntrees = (r: { changements: readonly { tick: number; e: number }[]; choix: readonly { tick: number; nv: number; carte: number }[] }): string =>
  `rush|${r.changements.map((t) => `${t.tick}:${t.e}`).join(",")}|${r.choix.map((c) => `${c.tick}:${c.nv}.${c.carte}`).join(",")}`;

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

export const contratRush = (o: RushOptions = {}): ContratMinimal<Niveau, Rejeu, Mesure> => ({
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
    try {
      return rejouer(niveau.contenu, texte);
    } catch (e) {
      return refus(e);
    }
  },
  score: (m) => scoreParColonnes(m), // les colonnes de la fiche, selon la variante du jeu (`variante.ts`)
  seuils: (niveau) => seuilsDe(niveau.contenu),
  entrees: (r) => texteDesEntrees(r),
  theme: (niveau) => themeDuJour(niveau.jour),
  empreinteAuteur: (niveau) => niveau.authorHash,
  mesures: (m) => ({ subis: m.subis, tues: m.tues }),
  ticksParSeconde: TICKS_PAR_SECONDE,
  joursFiges: Object.keys(o.frozen ?? {}).sort(),
});

export const RUSH_GAME: GameDefinition<RushOptions> = definirJeuNeuf<Niveau, Rejeu, Mesure, RushOptions>({ fiche, nom: "Rush" }, (_platform, o) => contratRush(o ?? {}));
