import { formatDay } from "@cdj/core";
import {
  VERTIGE_GENERATOR_VERSION,
  VERTIGE_SIM_VERSION,
  type Contenu,
  type Resultat,
  type Rediffusion,
  chargeDe,
  dailyVertige,
  decoderRediffusion,
  ErreurGenerateur,
  ErreurRediffusion,
  lireJourFige,
  rejouer,
  scoreParColonnes,
  themeDuJour,
} from "@cdj/vertige-sim";
import { FICHES_SERVEUR } from "./fiches.generated";
import type { GameDefinition } from "./games";
import { type ContratMinimal, definirJeuNeuf, type FicheServeur, RefusJeu, type RejeuNeuf } from "./jeux/index";

// « Vertige » (`vertige`) : le serveur du plateformer à la première personne (lot V0, prototype). **C'est le contrat minimal d'un jeu neuf**, rien d'autre : le niveau du jour (le fichier figé de l'image
// s'il se relit et se régénère à l'identique, sinon le générateur courant — au prototype, toujours le même parcours), le décodage et le rejeu de la rediffusion (les commandes de chaque pas, 120 par seconde),
// la colonne de classement de la fiche (le temps, en pas de 1/120 s, le plus court d'abord), l'empreinte des entrées. Pas de médaille (`seuils` rend `null` : le robot qui donne le Diamant est le lot V3),
// pas de preuve de l'auteur. Les routes, l'ordre de validation, le classement, les copies, l'aperçu, l'effacement et les crochets sont ceux du module des jeux (`jeux/`), la table est la table commune
// `resultats_jeu`. Le jeu est `off` : il n'est ni servi ni classé en production tant que Nathan ne le publie pas.

const fiche = FICHES_SERVEUR.find((f) => f.id === "vertige") as unknown as FicheServeur;

interface Niveau {
  jour: number;
  contenu: Contenu;
}
type Mesure = Resultat;
interface Rejeu extends RejeuNeuf {
  commandes: Rediffusion["commandes"];
}

/** Les options propres de « Vertige » : les jours figés de l'image (date → contenu du fichier). */
export interface VertigeOptions {
  frozen?: Readonly<Record<string, unknown>>;
}

/** Les entrées d'une partie en texte canonique (leur empreinte refuse les copies) : la charge des commandes, octet par octet. */
const texteDesEntrees = (commandes: Rediffusion["commandes"]): string => `vertige|${chargeDe(commandes).join(",")}`;

/** Le contenu d'un jour : le fichier figé s'il se vérifie, sinon le générateur courant. */
export function contenuDeVertige(jour: number, frozen: Readonly<Record<string, unknown>> = {}): Contenu {
  const fichier = frozen[formatDay(jour)];
  const fige = fichier === undefined ? null : lireJourFige(fichier);
  return fige && fige.jour === jour ? fige : dailyVertige(jour);
}

const refus = (e: unknown): never => {
  if (e instanceof ErreurRediffusion) {
    if (e.code === "version_inconnue") throw new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
    throw new RefusJeu("invalid_replay", e.message);
  }
  if (e instanceof ErreurGenerateur) throw new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
  throw e;
};

export const contratVertige = (o: VertigeOptions = {}): ContratMinimal<Niveau, Rejeu, Mesure> => ({
  versions: () => ({ simVersion: VERTIGE_SIM_VERSION, generatorVersion: VERTIGE_GENERATOR_VERSION }),
  niveauDuJour(jour) {
    return { jour, contenu: contenuDeVertige(jour, o.frozen) };
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
  score: (m) => scoreParColonnes(m), // les colonnes de la fiche (la variante du jeu, `variante.ts`)
  seuils: () => null, // au prototype, pas de médaille : le Diamant vient du robot (lot V3)
  entrees: (r) => texteDesEntrees(r.commandes),
  theme: (niveau) => themeDuJour(niveau.jour),
  empreinteAuteur: () => null,
  mesures: (m) => ({ pas: m.pas, gemmes: m.gemmes, chutes: m.chutes }),
  ticksParSeconde: 120,
  joursFiges: Object.keys(o.frozen ?? {}).sort(),
});

export const VERTIGE_GAME: GameDefinition<VertigeOptions> = definirJeuNeuf<Niveau, Rejeu, Mesure, VertigeOptions>({ fiche, nom: "Vertige" }, (_platform, o) => contratVertige(o ?? {}));
