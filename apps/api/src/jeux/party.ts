import { graineDuJour } from "@cdj/core/graine";
import type { GameDefinition, Platform } from "../games";
import { type ContratMinimal, definirJeuNeuf, type OptionsJeuNeuf, type RejeuNeuf } from "./defauts";

// Lot PA1 — **le contrat serveur d'un jeu Party** (catégorie `party`, `docs/party/seed.md`). Un jeu Party ne change pas d'un jour à l'autre : **le « niveau » d'un jour est la graine du jour et rien d'autre**
// (`graineDuJour(code, jour)` de `@cdj/core/graine`, la même fonction côté client), donc ni générateur de niveaux, ni thème, ni robot, ni médailles, ni jour figé. Le rejeu reçoit la graine et **valide le score**,
// comme pour tout jeu : la table, les routes, l'ordre de validation, le classement, les copies, l'aperçu et l'effacement sont ceux du module des jeux (`definirJeuNeuf`).
// `versions().generatorVersion` est la version de **la dérivation de la graine** (la constante que la fiche nomme dans `versions.generateur`) : une rediffusion qui en nomme une autre est refusée (« recharge la page »).

/** Le niveau d'un jour de Party : sa graine, rien d'autre. */
export interface NiveauParty {
  jour: number;
  graine: number;
}

/** **Le contrat d'un jeu Party** — ce que le jeu écrit ; le niveau (la graine), les seuils (aucun), le thème (aucun) et le jour figé (aucun) sont ceux de la catégorie. */
export interface ContratParty<Rejeu extends RejeuNeuf, Mesure> {
  /** `{ simVersion, generatorVersion }` : la simulation qui rejoue et la dérivation de la graine. */
  versions: ContratMinimal<NiveauParty, Rejeu, Mesure>["versions"];
  /** Le texte envoyé, décodé et contrôlé (`decoderEnveloppe` + `refusDEnveloppe`) ; lève `RefusJeu`. */
  decoder: ContratMinimal<NiveauParty, Rejeu, Mesure>["decoder"];
  /** Le rejeu **sur le niveau du jour** (`{ jour, graine }`) : la seule source du résultat ; lève `RefusJeu` pour une partie refusée. */
  rejouer(niveau: NiveauParty, texte: string): Mesure | Promise<Mesure>;
  /** Les colonnes de classement de la fiche (sans les deux départages ultimes). */
  score: ContratMinimal<NiveauParty, Rejeu, Mesure>["score"];
  /**
   * Les entrées effectivement jouées, en texte canonique (l'empreinte refuse les copies) ; **`null` quand la partie n'a joué aucune entrée** (aucun appui) : deux parties sans entrée ne sont pas des copies l'une de l'autre,
   * le module ne les compare jamais (lot PA1c). Le reste de la règle des copies ne change pas.
   */
  entrees(rejeu: Rejeu): string | null;
  mesures?: ContratMinimal<NiveauParty, Rejeu, Mesure>["mesures"];
  ticksParSeconde?: number;
}

/** Le contrat minimal que le module comprend, tiré d'un contrat Party : niveau = graine, aucune médaille, aucun thème, aucun jour figé. Pur. */
export function contratMinimalDeParty<Rejeu extends RejeuNeuf, Mesure>(code: string, c: ContratParty<Rejeu, Mesure>): ContratMinimal<NiveauParty, Rejeu, Mesure> {
  return {
    versions: c.versions,
    niveauDuJour: (jour) => ({ jour, graine: graineDuJour(code, jour) }),
    decoder: c.decoder,
    rejouer: c.rejouer,
    score: c.score,
    seuils: () => null, // pas de médaille (les médailles des jeux Party ne sont pas décidées : PA1, hors périmètre)
    entrees: (r) => c.entrees(r) ?? "", // le texte d'une partie sans entrée (l'empreinte est gardée avec le résultat) : `sansEntree` dit qu'elle n'est jamais comparée
    sansEntree: (r) => c.entrees(r) === null,
    contenuPublic: (niveau) => ({ graine: niveau.graine }),
    ...(c.mesures ? { mesures: c.mesures } : {}),
    ...(c.ticksParSeconde !== undefined ? { ticksParSeconde: c.ticksParSeconde } : {}),
  };
}

/** Un jeu Party prêt pour le registre : les routes sous `/api/<code>`, la table `resultats_jeu`, le classement de la fiche. Le jeu écrit son contrat Party ; **rien d'autre**. */
export function definirJeuParty<Rejeu extends RejeuNeuf, Mesure, O = undefined>(
  options: OptionsJeuNeuf,
  contrat: (platform: Platform, o: O) => ContratParty<Rejeu, Mesure>,
): GameDefinition<O> {
  return definirJeuNeuf<NiveauParty, Rejeu, Mesure, O>(options, (platform, o) => contratMinimalDeParty(options.fiche.code, contrat(platform, o)));
}
