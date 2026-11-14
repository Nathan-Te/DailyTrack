import { formatDay } from "@cdj/core";
import {
  GRAVITY_GENERATOR_VERSION,
  GRAVITY_SIM_VERSION,
  TICKS_PAR_SECONDE,
  type Contenu,
  type Seuils,
  dailyGravity,
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
} from "@cdj/gravity-sim";
import { FICHES_SERVEUR } from "./fiches.generated";
import type { GameDefinition } from "./games";
import { type ContratMinimal, definirJeuNeuf, type FicheServeur, RefusJeu, type RejeuNeuf } from "./jeux/index";

// « Gravity » (`gravity`) : le serveur du coureur à gravité (lot GR1), arcade, classé au **score** du plus grand au plus petit (puis la durée en pas, du plus petit au plus grand). **Le contrat minimal d'un jeu neuf**, rien d'autre :
// le niveau du jour (le fichier figé de l'image s'il se relit et se régénère à l'identique, sinon le générateur courant — avec les seuils des médailles **figés dans le fichier**, jamais recalculés pour un jour figé), le
// décodage et le rejeu de la rediffusion (la liste des pas où le joueur a touché l'écran : le serveur rejoue jusqu'à la mort ou aux dix minutes et retrouve le score **lui-même** — la plateforme ne lit jamais un score
// annoncé par le client), les colonnes de classement de la fiche, l'empreinte des entrées (refus des copies). Les routes, l'ordre de validation, le classement, les copies, l'aperçu, l'effacement et les crochets sont
// ceux du module des jeux (`jeux/`), la table est la table commune `resultats_jeu`. Pas de robot en GR1 : pas d'empreinte de la partie de l'auteur ; les seuils sont provisoires (`seuils.ts` de `@cdj/gravity-sim`).

const fiche = FICHES_SERVEUR.find((f) => f.id === "gravity") as unknown as FicheServeur;

interface Niveau {
  jour: number;
  contenu: Contenu;
  /** Les seuils des médailles du jour (ceux du fichier de jour s'il y en a un), calculés une fois. */
  seuils: Seuils;
}
type Mesure = Resultat;
interface Rejeu extends RejeuNeuf {
  appuis: Rediffusion["appuis"];
}

/** Les options propres de « Gravity » : les jours figés de l'image (date → contenu du fichier). */
export interface GravityOptions {
  frozen?: Readonly<Record<string, unknown>>;
}

const texteDesEntrees = (appuis: readonly number[]): string => `gravity|${appuis.join(",")}`;

/** Le contenu d'un jour : le fichier figé s'il se vérifie, sinon le générateur courant. */
export function contenuDeGravity(jour: number, frozen: Readonly<Record<string, unknown>> = {}): Contenu {
  const fichier = frozen[formatDay(jour)];
  const fige = fichier === undefined ? null : lireJourFige(fichier);
  return fige && fige.jour === jour ? fige : dailyGravity(jour);
}

const refus = (e: unknown): never => {
  if (e instanceof ErreurRediffusion) {
    if (e.code === "version_inconnue") throw new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
    throw new RefusJeu("invalid_replay", e.message);
  }
  if (e instanceof ErreurGenerateur) throw new RefusJeu("version", "Une nouvelle version du jeu est disponible : recharge la page");
  throw e;
};

export const contratGravity = (o: GravityOptions = {}): ContratMinimal<Niveau, Rejeu, Mesure> => ({
  versions: () => ({ simVersion: GRAVITY_SIM_VERSION, generatorVersion: GRAVITY_GENERATOR_VERSION }),
  niveauDuJour(jour) {
    const contenu = contenuDeGravity(jour, o.frozen);
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
  entrees: (r) => texteDesEntrees(r.appuis),
  theme: (niveau) => themeDuJour(niveau.jour),
  mesures: (m) => ({ distance: m.distance, pieces: m.pieces, gemmes: m.gemmes, multMax: m.multMax }),
  ticksParSeconde: TICKS_PAR_SECONDE,
  joursFiges: Object.keys(o.frozen ?? {}).sort(),
});

export const GRAVITY_GAME: GameDefinition<GravityOptions> = definirJeuNeuf<Niveau, Rejeu, Mesure, GravityOptions>({ fiche, nom: "Gravity" }, (_platform, o) => contratGravity(o ?? {}));
