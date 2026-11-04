import { lireLangue } from "@cdj/profile";
import { CATALOGUE_COMMUN_FR, traducteur, type Catalogue, type Langue, type Parametres, type Traducteur } from "@cdj/ui";
import type { CataloguesJeu } from "./types";

// La langue d'un jeu neuf : celle de la plateforme (`cdj:langue`, `lireLangue` de `@cdj/profile`), le catalogue du jeu (le kit y est réuni) puis le commun de `@cdj/ui`. L'anglais est chargé à la demande (un
// autre fichier : il ne pèse pas sur le premier chargement des joueurs en français). Un traducteur par jeu, créé par `creerI18n`.
export interface I18n {
  readonly langue: Langue;
  t(cle: string, params?: Parametres): string;
  /** Le traducteur à passer aux composants du socle. */
  socle(): Traducteur<never>;
  charger(): Promise<void>;
  /** L'anglais du catalogue commun (vide en français) : les composants du socle qui se traduisent seuls (les amis) le réunissent à leur vocabulaire. */
  communEn(): Catalogue;
  /** Les aides citent les touches choisies (`{pause}`…) : le jeu donne ses paramètres communs. */
  parametresCommuns(f: () => Parametres): void;
}

export function creerI18n(catalogues: CataloguesJeu, stockage: Storage | null): I18n {
  let langue: Langue = lireLangue(stockage, typeof navigator === "undefined" ? [] : navigator.languages).langue;
  let anglais: Catalogue | null = null;
  let communAnglais: Catalogue | null = null;
  let params: (() => Parametres) | null = null;
  const creer = (l: Langue): Traducteur => traducteur(l, { fr: catalogues.fr, en: anglais ?? {} } as never, { fr: CATALOGUE_COMMUN_FR, en: communAnglais ?? {} } as never);
  let courant = creer(langue);
  return {
    get langue() {
      return langue;
    },
    t: (cle, p) => courant.t(cle, params && /^(kit\.commandes\.|commandes\.|aide\.)/.test(cle) ? { ...params(), ...p } : p),
    socle: () => courant as Traducteur<never>,
    communEn: () => communAnglais ?? {},
    parametresCommuns(f) {
      params = f;
    },
    async charger() {
      if (langue === "fr" || anglais) return;
      try {
        const m = await catalogues.chargerEn();
        anglais = m.jeu;
        communAnglais = m.commun;
        courant = creer(langue);
      } catch {
        langue = "fr"; // sans l'anglais, les clés s'écriraient telles quelles : on repasse au français
        courant = creer("fr");
      }
    },
  };
}
