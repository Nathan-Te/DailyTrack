import { formatDay } from "@cdj/core";
import {
  PINBALL_GENERATOR_VERSION,
  PINBALL_SIM_VERSION,
  TICKS_PAR_SECONDE,
  type Contenu,
  type Seuils,
  dailyPinball,
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
} from "@cdj/pinball-sim";
import { FICHES_SERVEUR } from "./fiches.generated";
import type { GameDefinition } from "./games";
import { type ContratMinimal, definirJeuNeuf, type FicheServeur, RefusJeu, type RejeuNeuf } from "./jeux/index";

// « Pinball » (`pinball`) : le serveur du flipper du jour (lot PB1), arcade, classé au **score** du plus grand au plus petit (puis la durée en pas, du plus petit au plus grand). **Le contrat minimal d'un jeu neuf**, rien d'autre :
// le niveau du jour (le fichier figé de l'image s'il se relit et se régénère à l'identique, sinon le générateur courant — avec les seuils des médailles **figés dans le fichier**, jamais recalculés pour un jour figé), le
// décodage et le rejeu de la rediffusion (la liste des instants où une commande change : le serveur rejoue la partie **jusqu'à sa fin** — dernière bille perdue ou 15 minutes — et retrouve le score **lui-même** : la plateforme
// ne lit jamais un score annoncé par le client), les colonnes de classement de la fiche, l'empreinte des entrées (refus des copies). Les routes, l'ordre de validation, le classement, les copies, l'aperçu, l'effacement et
// les crochets sont ceux du module des jeux (`jeux/`), la table est la table commune `resultats_jeu`. Pas d'empreinte de la partie de l'auteur (le robot donne les seuils des médailles, pas un fantôme) ; **lot PB4 : les seuils sont ceux du fichier de jour, sinon ceux du robot** (`seuils.ts` de `@cdj/pinball-sim`, quelques secondes la première fois pour une table, gardés en mémoire : en production les jours servis ont leur fichier).
// **Le coût d'un rejeu suit sa durée** (`rejeu.ticksParUnite` de la fiche, mesuré au README du lot PB1) : une partie de 15 minutes (540 000 pas) pèse 60 unités du plafond global.

const fiche = FICHES_SERVEUR.find((f) => f.id === "pinball") as unknown as FicheServeur;

interface Niveau {
  jour: number;
  contenu: Contenu;
  /** Les seuils des médailles du jour (ceux du fichier de jour s'il y en a un), calculés une fois. */
  seuils: Seuils;
}
type Mesure = Resultat;
interface Rejeu extends RejeuNeuf {
  evenements: Rediffusion["evenements"];
}

/** Les options propres de « Pinball » : les jours figés de l'image (date → contenu du fichier). */
export interface PinballOptions {
  frozen?: Readonly<Record<string, unknown>>;
}

const texteDesEntrees = (evenements: Rediffusion["evenements"]): string => `pinball|${evenements.map((e) => `${e.tick}:${e.c}${e.enfonce ? "+" : "-"}`).join(",")}`;

/** Le contenu d'un jour : le fichier figé s'il se vérifie, sinon le générateur courant. */
export function contenuDePinball(jour: number, frozen: Readonly<Record<string, unknown>> = {}): Contenu {
  const fichier = frozen[formatDay(jour)];
  const fige = fichier === undefined ? null : lireJourFige(fichier);
  return fige && fige.jour === jour ? fige : dailyPinball(jour);
}

const refus = (e: unknown): never => {
  if (e instanceof ErreurRediffusion) {
    if (e.code === "version_inconnue") throw new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
    throw new RefusJeu("invalid_replay", e.message);
  }
  if (e instanceof ErreurGenerateur) throw new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
  throw e;
};

export const contratPinball = (o: PinballOptions = {}): ContratMinimal<Niveau, Rejeu, Mesure> => ({
  versions: () => ({ simVersion: PINBALL_SIM_VERSION, generatorVersion: PINBALL_GENERATOR_VERSION }),
  niveauDuJour(jour) {
    const contenu = contenuDePinball(jour, o.frozen);
    return { jour, contenu, seuils: seuilsDe(contenu) };
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
  score: (m) => scoreParColonnes(m), // les colonnes de la fiche : le score, puis la durée (`variante.ts`)
  seuils: (niveau) => niveau.seuils,
  entrees: (r) => texteDesEntrees(r.evenements),
  theme: (niveau) => themeDuJour(niveau.jour),
  mesures: (m) => ({ billes: m.billes, multMax: m.multMax }),
  ticksParSeconde: TICKS_PAR_SECONDE,
  joursFiges: Object.keys(o.frozen ?? {}).sort(),
});

export const PINBALL_GAME: GameDefinition<PinballOptions> = definirJeuNeuf<Niveau, Rejeu, Mesure, PinballOptions>({ fiche, nom: "Pinball" }, (_platform, o) => contratPinball(o ?? {}));
