export interface FicheCI {
  id: string;
  zones: { jeu: string[]; serveur: string[] };
  e2e: {
    dossier: string;
    suite: string;
    fumee: string[];
    zones: Record<string, { _?: string; globs: string[]; sauf?: string[] }>;
    specs: Record<string, string[]>;
    regression?: string[];
    parts: { main: number; complet: number; nuit: number };
  };
  jours: { dossier: string | null; preuveInterditeEnProd: boolean };
  budget: string[];
  outilsAdmin: boolean;
}
export const FICHES_CI: FicheCI[];
export const IDS_FICHES: string[];
export function ficheCI(id: string): FicheCI | undefined;
