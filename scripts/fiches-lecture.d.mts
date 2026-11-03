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
  jours: { dossier: string | null; registre: string | null; preuveInterditeEnProd: boolean };
  budget: string[];
  outilsAdmin: boolean;
}
export const FICHES_CI: FicheCI[];
export const IDS_FICHES: string[];
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
