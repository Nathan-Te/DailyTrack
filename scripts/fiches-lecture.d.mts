export interface FicheCI {
  id: string;
  /** Le dossier de l'application (`web` pour Track). */
  app: string;
  zones: { jeu: string[]; serveur: string[]; documents?: string[] };
  e2e: {
    dossier: string;
    suite: string;
    projet?: string;
    dette?: string;
    fumee: string[];
    zones: Record<string, { _?: string; globs: string[]; sauf?: string[] }>;
    specs: Record<string, string[]>;
    regression?: string[];
    parts: { main: number; complet: number; nuit: number };
  };
  jours: {
    dossier: string | null;
    registre: string | null;
    preuveInterditeEnProd: boolean;
    fabrication: {
      empreinte: string;
      registre?: string;
      figer?: { paquet: string; script: string; forme: "jusqu-a-la-veille" | "jours-proteges" };
      preparer?: { paquet: string; script: string; joursApresBascule: number; garde: string };
      apresPose?: { paquet: string; script: string; sorties: string[] };
    };
  };
  /** Lot K4b : le dossier de la simulation (`packages/<sim>`). */
  sim: string;
  budget: string[];
  /** Lot K4e : préfixes de fichiers chargés à la demande, en plus des briques du kit. */
  budgetALaDemande?: string[];
  outilsAdmin: boolean;
  /** Lot K4e : un jeu témoin (jamais en production). */
  temoin?: true;
}
export const FICHES_CI: FicheCI[];
export const IDS_FICHES: string[];
/** Lot K4e : les jeux qui vont en production (tous sauf les témoins). */
export const IDS_PRODUCTION: string[];
export function ficheCI(id: string): FicheCI | undefined;
export function regressionDesFiches(): string[];

/** Lot K4 : une suite e2e d'un jeu, lue dans sa fiche. */
export interface SuiteE2e {
  id: string;
  suite: string;
  dossier: string;
  app: string;
  espace: string;
  projet: string;
  dette: string;
}
export const SUITES: SuiteE2e[];
export function suiteNommee(suite: string): SuiteE2e | undefined;
export function projetDe(suite: string, navigateur: string): string;
export function suiteDuProjet(projet: string): SuiteE2e | undefined;
export function navigateurDuProjet(projet: string): string;
export interface FicheServeur {
  id: string;
  code: string;
  versions: { sim: string; generateur: string; medailles?: string };
  jours: { mode: string; dossier?: string; registre?: string; preuveInterditeEnProd: boolean };
  [cle: string]: unknown;
}
export const FICHES_SERVEUR: FicheServeur[];
export const NOMS_DES_JEUX: Record<string, string>;
export const VERSIONS_DES_JEUX: { nom: string; fichier: string; jeu: string; id: string; role: "sim" | "generateur" }[];

/** Lot K4b : un jeu de la chaîne de « Mettre en production », lu dans sa fiche (`jours.fabrication`). */
export interface JeuDeLaChaine {
  id: string;
  nom: string;
  mode: "registre" | "fichier-par-jour";
  dossier: string | null;
  registre: string | null;
  sim: string;
  versions: { sim: string; generateur: string; medailles?: string };
  moduleEmpreinte: string;
  moduleRegistre?: string;
  figer?: { paquet: string; script: string; forme: "jusqu-a-la-veille" | "jours-proteges" };
  preparer?: { paquet: string; script: string; joursApresBascule: number; garde: string };
  apresPose?: { paquet: string; script: string; sorties: string[] };
}
export const CHAINE: JeuDeLaChaine[];
export function jeuDeLaChaine(id: string): JeuDeLaChaine;
