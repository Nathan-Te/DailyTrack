import { PILEPOIL_GENERATOR_VERSION, PILEPOIL_SIM_VERSION, TICKS_PAR_SECONDE, decoderRediffusion, ErreurGenerateur, ErreurRediffusion, type Rediffusion, rejouer, type Resultat, scoreParColonnes, tirerJauges } from "@cdj/pilepoil-sim";
import { FICHES_SERVEUR } from "./fiches.generated";
import type { GameDefinition } from "./games";
import { type ContratParty, definirJeuParty, type FicheServeur, RefusJeu, type RejeuNeuf } from "./jeux/index";

// « Pile poil » (lot PA2) : **le contrat serveur d'un jeu Party** (`jeux/party.ts`), rien d'autre. Le « niveau » d'un jour est la graine du jour (`graineDuJour(code, jour)`, la même fonction que le jeu) : le serveur
// en tire les dix jauges et rejoue les pas des appuis (dix au plus) avec les réglages du jeu — le rejeu valide le score. Ni générateur de niveaux, ni thème, ni médailles, ni jours figés, ni robot. Les routes, l'ordre de
// validation, le classement, les copies, l'aperçu, l'effacement et les crochets sont ceux du module des jeux ; la table est la table commune `resultats_jeu`.

const fiche = FICHES_SERVEUR.find((f) => f.id === "pilepoil") as unknown as FicheServeur;

type Mesure = Resultat;
interface Rejeu extends RejeuNeuf {
  appuis: Rediffusion["appuis"];
}

/** Les entrées d'une partie (les copies) : les pas des appuis. */
const texteDesEntrees = (appuis: readonly number[]): string => `pilepoil|${appuis.join(",")}`;

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
      return rejouer({ jour: niveau.jour, g: PILEPOIL_GENERATOR_VERSION, graine: niveau.graine, jauges: tirerJauges(niveau.graine) }, texte);
    } catch (e) {
      return refus(e);
    }
  },
  score: (m) => scoreParColonnes(m), // les colonnes de la fiche : le score, puis les « pile »
  entrees: (r) => texteDesEntrees(r.appuis),
  mesures: (m) => ({ enchaineMax: m.enchaineMax, ratees: m.ratees }),
  ticksParSeconde: TICKS_PAR_SECONDE,
});

export const PILEPOIL_GAME: GameDefinition<undefined> = definirJeuParty<Rejeu, Mesure>({ fiche, nom: "Pile poil" }, () => contratPilepoil());
