import { formatDay } from "@cdj/core";
import {
  CIBLES_GENERATOR_VERSION,
  CIBLES_SIM_VERSION,
  type Contenu,
  dailyCibles,
  decoderRediffusion,
  ErreurGenerateur,
  ErreurRediffusion,
  lireJourFige,
  type Rediffusion,
  rejouer,
  type Resultat,
  seuilsDe,
  themeDuJour,
  touchesDuBot,
} from "@cdj/cibles-sim";
import { inputsHash } from "./copies";
import { FICHES_SERVEUR } from "./fiches.generated";
import type { GameDefinition } from "./games";
import { type ContratMinimal, definirJeuNeuf, type FicheServeur, RefusJeu, type RejeuNeuf } from "./jeux/index";

// « Cibles » (`cibles`) : le serveur du jeu témoin du kit (lot K4f). **C'est le contrat minimal d'un jeu neuf**, rien d'autre : le niveau du jour (le fichier figé de l'image s'il se relit et se régénère
// à l'identique, sinon le générateur courant), le décodage et le rejeu de la rediffusion, les colonnes de classement de la fiche (cibles touchées ↓, tick de la dernière touche ↑), les seuils des médailles
// (le Diamant est la partie du bot), l'empreinte des entrées. Les routes, l'ordre de validation, le classement, les copies, l'aperçu, l'effacement et les crochets sont ceux du module des jeux (`jeux/`),
// la table est la table commune `resultats_jeu`. Jamais en production : la fiche dit `temoin: true` (le registre d'un serveur de production ne le monte pas).

const fiche = FICHES_SERVEUR.find((f) => f.id === "cibles") as unknown as FicheServeur;

interface Niveau {
  jour: number;
  contenu: Contenu;
  /** L'empreinte des entrées de la partie de l'auteur (le bot) : une partie qui la porte est une copie. */
  authorHash: string;
}
type Mesure = Resultat;
interface Rejeu extends RejeuNeuf {
  touches: Rediffusion["touches"];
}

/** Les options propres de « Cibles » : les jours figés de l'image (date → contenu du fichier). */
export interface CiblesOptions {
  frozen?: Readonly<Record<string, unknown>>;
}

const texteDesEntrees = (touches: readonly { tick: number; c: number }[]): string => `cibles|${touches.map((t) => `${t.tick}:${t.c}`).join(",")}`;

/** Le contenu d'un jour : le fichier figé s'il se vérifie, sinon le générateur courant. */
export function contenuDeCibles(jour: number, frozen: Readonly<Record<string, unknown>> = {}): Contenu {
  const fichier = frozen[formatDay(jour)];
  const fige = fichier === undefined ? null : lireJourFige(fichier);
  return fige && fige.jour === jour ? fige : dailyCibles(jour);
}

const refus = (e: unknown): never => {
  if (e instanceof ErreurRediffusion) {
    if (e.code === "version_inconnue") throw new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
    throw new RefusJeu("invalid_replay", e.message);
  }
  if (e instanceof ErreurGenerateur) throw new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
  throw e;
};

export const contratCibles = (o: CiblesOptions = {}): ContratMinimal<Niveau, Rejeu, Mesure> => ({
  versions: () => ({ simVersion: CIBLES_SIM_VERSION, generatorVersion: CIBLES_GENERATOR_VERSION }),
  async niveauDuJour(jour) {
    const contenu = contenuDeCibles(jour, o.frozen);
    return { jour, contenu, authorHash: await inputsHash(texteDesEntrees(touchesDuBot(contenu))) };
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
  score: (m) => ({ touches: m.touches, dernier: m.dernier }),
  seuils: (niveau) => seuilsDe(niveau.contenu),
  entrees: (r) => texteDesEntrees(r.touches),
  theme: (niveau) => themeDuJour(niveau.jour),
  empreinteAuteur: (niveau) => niveau.authorHash,
  mesures: (m) => ({ ratees: m.ratees }),
  ticksParSeconde: 30,
  joursFiges: Object.keys(o.frozen ?? {}).sort(),
});

export const CIBLES_GAME: GameDefinition<CiblesOptions> = definirJeuNeuf<Niveau, Rejeu, Mesure, CiblesOptions>({ fiche, nom: "Cibles" }, (_platform, o) => contratCibles(o ?? {}));
