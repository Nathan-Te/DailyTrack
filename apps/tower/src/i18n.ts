import { lireLangue } from "@cdj/profile";
import { CATALOGUE_COMMUN_FR, traducteur, type Catalogue, type Langue, type Parametres, type Traducteur } from "@cdj/ui";
import { CATALOGUE_FR } from "./catalogue.fr";

// La langue de Tower (lot T1), sur le patron de Jump et de Track : celle de la plateforme (`cdj:langue`, lue par `lireLangue` de `@cdj/profile` ; le jeu ne la change pas
// au lot T1, il n'a pas de Réglages), les catalogues du jeu puis le catalogue commun de `@cdj/ui`. L'anglais est un autre fichier, chargé à la demande
// (`chargerLangue`) : il ne pèse pas sur le premier chargement des joueurs en français. Tout texte passe par `t()`.

function stockage(): Pick<Storage, "getItem"> | null {
  try {
    return localStorage;
  } catch {
    return null; // stockage refusé : la langue du navigateur
  }
}

let langue: Langue = lireLangue(stockage(), typeof navigator === "undefined" ? [] : navigator.languages).langue;
let anglais: Catalogue | null = null;
let communAnglais: Catalogue | null = null;

function creer(l: Langue): Traducteur {
  return traducteur(l, { fr: CATALOGUE_FR, en: anglais ?? {} } as never, { fr: CATALOGUE_COMMUN_FR, en: communAnglais ?? {} } as never);
}
let courant: Traducteur = creer(langue);

/** Charge ce que la langue demande (l'anglais : son catalogue, un fichier à part) ; avant le premier écran. Ne lève jamais. */
export async function chargerLangue(): Promise<void> {
  if (langue === "fr" || anglais) return;
  try {
    const m = await import("./catalogue.en");
    anglais = m.CATALOGUE_EN;
    communAnglais = m.CATALOGUE_COMMUN_EN;
    courant = creer(langue);
  } catch {
    // sans l'anglais, les clés s'écrivent telles quelles : on repasse au français
    langue = "fr";
    courant = creer("fr");
  }
}

export const langueCourante = (): Langue => langue;

/** Le texte d'une clé dans la langue courante, paramètres remplacés (`{n}` choisit aussi la forme plurielle). */
export const t = (cle: string, params?: Parametres): string => courant.t(cle, params);

/** Le traducteur à passer aux composants du socle (`boutonPleinEcran`…). */
export const traducteurDuSocle = (): Traducteur<never> => courant as Traducteur<never>;

/** Pose la langue et le titre du document. */
export function appliquerDocument(): void {
  document.documentElement.lang = langue;
  document.title = t("page.titre");
}
