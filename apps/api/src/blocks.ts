import { formatDay } from "@cdj/core";
import {
  BLOCKS_BOT_VERSION,
  BLOCKS_GENERATOR_VERSION,
  BLOCKS_SIM_VERSION,
  type Contenu,
  dailyBlocks,
  decoderRediffusion,
  empreinteContenu,
  ErreurGenerateur,
  ErreurRediffusion,
  lireJourFige,
  type Rediffusion,
  rejouer,
  type Resultat,
  scoreParColonnes,
  type Seuils,
  themeDuJour,
} from "@cdj/blocks-sim";
import { seuilsDe, seuilsDuJour } from "@cdj/blocks-sim/diamant";
import { activerReglesV1 } from "@cdj/blocks-sim/v1";
import type { GameDefinition } from "./games";
import { FICHES_SERVEUR } from "./fiches.generated";
import { type ContratMinimal, definirJeuNeuf, type FicheServeur, RefusJeu, type RejeuNeuf } from "./jeux/index";

// « Blocks » (`blocks`) : le serveur du jeu (lot B1). **C'est le contrat minimal d'un jeu neuf**, rien d'autre : le niveau du jour (la suite de pièces : le fichier figé de l'image s'il se relit et se régénère à
// l'identique, sinon le générateur courant), le décodage et le rejeu de la rediffusion (la liste des poses, un octet chacune : emplacement, ligne, colonne), les colonnes de classement de la fiche (score ↓, combo maximal ↓ ; puis le premier
// arrivé, `submitted_at`, que toute table de résultats départage nativement). Le serveur REFUSE une pose illégale, une pose après la fin, une suite au-delà du plafond de 2 000 pièces et une partie non terminée
// (`invalid_replay`). Les routes, l'ordre de validation, le classement, les copies, l'aperçu, l'effacement et les crochets sont ceux du module des jeux (`jeux/`) ; la table est la table commune `resultats_jeu`.
// Médailles (lots B3 et B8) : le Diamant est la partie du bot de `@cdj/blocks-sim/diamant` sur la suite du jour (clé `auteur`), bronze / argent / or sont les références mesurées sur les bots faible et moyen (`medailles.ts`). **Le calcul (le
// bot joue la partie entière, en faisceau : 53 ms en médiane, 152 ms au pire sur 1 000 jours) est gardé en mémoire**, par suite du jour et version du bot : le module des jeux demande les seuils à chaque envoi et à chaque lecture du portail.
// **Règles v1 (lot B8)** : le rejeu (`rejouer` de `@cdj/blocks-sim`) rejoue toujours les règles v1 pour un jour figé avant le lot B8 (fichier de jour `sim` 1, tirage 3) et ses seuils sont ceux du fichier ; v2 pour tous les autres jours.
// La route d'envoi ne les accepte pourtant pas encore de bout en bout : le contrôle de version du module (`memeContenu`, `jeux/defauts.ts`, zone de la plateforme) compare la rediffusion au SEUL générateur courant — manque de plateforme, README du lot B8.

activerReglesV1(); // le serveur rejoue les règles v1 d'un jour figé avant le lot B8 ; le jeu, lui, ne les embarque pas (`v1.ts`)

const fiche = FICHES_SERVEUR.find((f) => f.id === "blocks") as unknown as FicheServeur;

interface Niveau {
  jour: number;
  contenu: Contenu;
}
type Mesure = Resultat;
interface Rejeu extends RejeuNeuf {
  actions: Rediffusion["actions"];
}

/** Les options propres de « Blocks » : les jours figés de l'image (date → contenu du fichier). */
export interface BlocksOptions {
  frozen?: Readonly<Record<string, unknown>>;
}

/** Les entrées effectivement jouées, en texte canonique (le module en prend l'empreinte pour refuser les copies). */
const texteDesEntrees = (actions: readonly number[]): string => `blocks|${actions.join(",")}`;

/** Le contenu d'un jour : le fichier figé s'il se vérifie, sinon le générateur courant. */
export function contenuDeBlocks(jour: number, frozen: Readonly<Record<string, unknown>> = {}): Contenu {
  const fichier = frozen[formatDay(jour)];
  const fige = fichier === undefined ? null : lireJourFige(fichier);
  return fige && fige.jour === jour ? fige : dailyBlocks(jour);
}

const MEMO_MAX = 64;
const memoSeuils = new Map<string, Seuils>();
/** Les seuils des médailles d'un jour : **ceux figés avec le jour** s'il vient d'un fichier de jour (le bot n'est pas appelé : un changement du bot ne change jamais un jour figé), sinon ceux du bot (bot Diamant), calculés une fois par suite du jour et version du bot. */
export function seuilsDeBlocks(contenu: Contenu): Seuils {
  if (contenu.seuilsFiges) return seuilsDuJour(contenu);
  const cle = `${BLOCKS_BOT_VERSION}:${empreinteContenu(contenu)}`;
  let s = memoSeuils.get(cle);
  if (!s) {
    if (memoSeuils.size >= MEMO_MAX) memoSeuils.clear();
    s = seuilsDe(contenu);
    memoSeuils.set(cle, s);
  }
  return s;
}

const refus = (e: unknown): never => {
  if (e instanceof ErreurRediffusion) {
    if (e.code === "version_inconnue") throw new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
    throw new RefusJeu("invalid_replay", e.message);
  }
  if (e instanceof ErreurGenerateur) throw new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
  throw e;
};

export const contratBlocks = (o: BlocksOptions = {}): ContratMinimal<Niveau, Rejeu, Mesure> => ({
  versions: () => ({ simVersion: BLOCKS_SIM_VERSION, generatorVersion: BLOCKS_GENERATOR_VERSION }),
  niveauDuJour: (jour) => ({ jour, contenu: contenuDeBlocks(jour, o.frozen) }),
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
  seuils: (niveau) => seuilsDeBlocks(niveau.contenu), // le Diamant (bot) et ses fractions : `@cdj/blocks-sim` (lot B3)
  entrees: (r) => texteDesEntrees(r.actions),
  theme: (niveau) => themeDuJour(niveau.jour),
  mesures: (m) => ({ poses: m.poses }),
  joursFiges: Object.keys(o.frozen ?? {}).sort(),
  premier: true, // `GET /api/blocks/day/<date>/first` : la partie du n° 1 du jour, pour la revoir (lot « manques de Blocks »)
});

export const BLOCKS_GAME: GameDefinition<BlocksOptions> = definirJeuNeuf<Niveau, Rejeu, Mesure, BlocksOptions>({ fiche, nom: "Blocks" }, (_platform, o) => contratBlocks(o ?? {}));
