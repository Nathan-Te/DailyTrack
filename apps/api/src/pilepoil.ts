import {
  PILEPOIL_GENERATOR_VERSION,
  PILEPOIL_SIM_VERSION,
  decoderRediffusion,
  ErreurGenerateur,
  ErreurRediffusion,
  type Rediffusion,
  rejouer,
  type Resultat,
  scoreParColonnes,
  tirerPilepoil,
} from "@cdj/pilepoil-sim";
import { FICHES_SERVEUR } from "./fiches.generated";
import type { GameDefinition } from "./games";
import { type ContratParty, definirJeuParty, type FicheServeur, RefusJeu, type RejeuNeuf } from "./jeux/index";

// Le jeu Party de départ (`pilepoil`, lot PA1 : copié de « Pile poil » par `npm run nouveau-jeu -- --categorie party`) : **le contrat serveur d'un jeu Party** (`jeux/party.ts`), rien d'autre. Le « niveau » d'un jour est la
// graine du jour (`graineDuJour(code, jour)`, la même fonction que le jeu) — ni générateur de niveaux, ni thème, ni médailles, ni jours figés, ni robot. Le rejeu reçoit ce niveau et valide le score ; les routes, l'ordre
// de validation, le classement, les copies, l'aperçu, l'effacement et les crochets sont ceux du module des jeux, la table est la table commune `resultats_jeu`.

const fiche = FICHES_SERVEUR.find((f) => f.id === "pilepoil") as unknown as FicheServeur;

type Mesure = Resultat;
interface Rejeu extends RejeuNeuf {
  touches: Rediffusion["touches"];
}

const texteDesEntrees = (touches: readonly { tick: number; c: number }[]): string => `pilepoil|${touches.map((t) => `${t.tick}:${t.c}`).join(",")}`;

const refus = (e: unknown): never => {
  if (e instanceof ErreurRediffusion) {
    if (e.code === "version_inconnue") throw new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
    throw new RefusJeu("invalid_replay", e.message);
  }
  if (e instanceof ErreurGenerateur) throw new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
  throw e;
};

export const contratPilepoil = (): ContratParty<Rejeu, Mesure> => ({
  versions: () => ({ simVersion: PILEPOIL_SIM_VERSION, generatorVersion: PILEPOIL_GENERATOR_VERSION }),
  decoder(texte) {
    try {
      return decoderRediffusion(texte);
    } catch (e) {
      return refus(e);
    }
  },
  rejouer(niveau, texte) {
    try {
      return rejouer({ jour: niveau.jour, g: PILEPOIL_GENERATOR_VERSION, graine: niveau.graine, pilepoil: tirerPilepoil(niveau.graine) }, texte);
    } catch (e) {
      return refus(e);
    }
  },
  score: (m) => scoreParColonnes(m), // les colonnes de la fiche, selon la variante du jeu (`variante.ts`)
  entrees: (r) => texteDesEntrees(r.touches),
  mesures: (m) => ({ ratees: m.ratees }),
  ticksParSeconde: 30,
});

export const PILEPOIL_GAME: GameDefinition<undefined> = definirJeuParty<Rejeu, Mesure>({ fiche, nom: "Pilepoil" }, () => contratPilepoil());
